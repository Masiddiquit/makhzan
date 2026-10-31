import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply,emptyState,stock,lots,reports,orderTotal,lineTotal} from '../lib/warehouse.mjs';
import {packagingUnits,packageQuantity,packagingSummary,unitsForProduct,sellingPrice} from '../lib/packaging.mjs';
const d='2026-01-01';
function setup(levels=[['pack',12],['box',12],['pallet',60,'pallet']],extra={}){
 let s=emptyState(),i=0;const run=a=>s=apply(s,a,{id:()=>`pack-test-${++i}`});
 run({type:'product',name:'Turmeric soap',sku:'T75',category:'Soap',unit:'bar',weight:75,weightUnit:'g',rate:100,packaging:levels.map(([label,contains,kind])=>({label,contains,kind:kind||'package'})),...extra});run({type:'customer',name:'Shop'});
 return {run,get s(){return s;},get p(){return s.products[0];},receive:(ref,count,unitKey,cost=100000,other={})=>run({type:'receive',ref,date:d,cost,lines:[{productId:s.products[0].id,count,unitKey,loading:'palletized',...other}]}),order:(lines)=>run({type:'order',date:d,customerId:s.customers[0].id,lines:lines.map(l=>({productId:s.products[0].id,...l}))}),dispatch:()=>run({type:'dispatch',orderId:s.orders.at(-1).id,date:d})};
}
test('optional chains match rice, nested soap, papaya, pouch, and tea examples',()=>{
 for(const [levels,expected] of [[[],1],[[['pallet',100,'pallet']],100],[[['pallet',28,'pallet']],28],[[['pack',12],['box',12],['pallet',60,'pallet']],8640],[[['box',100]],100],[[['box',4],['pallet',80,'pallet']],320],[[['retail box',20],['master carton',30],['pallet',50,'pallet']],30000],[[['master carton',20],['pallet',50,'pallet']],1000]]){const f=setup(levels);assert.equal(packagingUnits(f.p).at(-1).units,expected);}
 const f=setup();assert.ok(Math.abs(f.p.weight*453.59237-75)<1e-10);assert.equal(f.p.pallet,8640);
});
test('receiving pallets versus floor-loaded smallest units preserves actual packaging distinctions',()=>{
 const f=setup();f.receive('PAL',2,'level-3');assert.equal(stock(f.s)[0].onHand,17280);assert.equal(stock(f.s)[0].packageStock.find(u=>u.kind==='pallet').intact,2);
 f.receive('FLOOR',150,'base',10000,{loading:'floor'});assert.equal(stock(f.s)[0].onHand,17430);assert.equal(stock(f.s)[0].packageStock.find(u=>u.kind==='pallet').intact,2);
 assert.throws(()=>f.receive('INVALID',1,'level-3',1000,{loading:'floor'}),/Floor-loaded/);
});
test('different receipt pallet configurations remain selectable and keep their conversions',()=>{
 const f=setup();f.receive('SIXTY',1,'level-3');f.receive('NINETY',1,'level-3',100000,{packaging:[{label:'pack',contains:12},{label:'box',contains:12},{label:'pallet',contains:90,kind:'pallet'}]});
 const variant=unitsForProduct(f.s,f.p).find(u=>u.units===12960);assert.ok(variant);assert.equal(f.s.containers[0].lines[0].qty,8640);assert.equal(f.s.containers[1].lines[0].qty,12960);
 f.order([{unitKey:variant.key,count:1,unitPrice:12345}]);f.dispatch();assert.equal(f.s.orders[0].allocations[0].containerId,f.s.containers[1].id);assert.equal(stock(f.s)[0].onHand,8640);
});
test('total-container cost and line-unit cost reconcile exactly, including receipt damage',()=>{
 const f=setup();f.run({type:'receive',ref:'UNITCOST',date:d,costMode:'lines',lines:[{productId:f.p.id,unitKey:'level-2',count:3,costUnitKey:'base',unitCost:25,damaged:1}]});
 assert.equal(f.s.containers[0].cost,10800);assert.equal(f.s.containers[0].lines[0].qty,432);assert.equal(f.s.containers[0].lines[0].damageCost,25);assert.equal(stock(f.s)[0].value,10775);
 assert.throws(()=>f.run({type:'receive',ref:'MISMATCH',date:d,costMode:'lines',cost:1,lines:[{productId:f.p.id,unitKey:'level-2',count:1,unitCost:1000}]}),/must match/);
 const g=setup();g.run({type:'receive',ref:'MIXED',date:d,cost:10001,lines:[{productId:g.p.id,unitKey:'level-2',count:1,costWeight:1},{productId:g.p.id,unitKey:'base',count:5,costWeight:2}]});assert.equal(g.s.containers[0].lines.reduce((n,l)=>n+l.cost,0),10001);
});
test('selling-price cents do not round through the individual bar rate',()=>{
 const f=setup();f.receive('C',1,'level-2',14400);f.order([{unitKey:'level-2',count:1,unitPrice:10000}]);assert.equal(orderTotal(f.s.orders[0]),10000);assert.equal(lineTotal(f.s.orders[0].lines[0]),10000);f.dispatch();assert.equal(reports(f.s).revenue,10000);assert.equal(f.s.orders[0].allocations.reduce((n,a)=>n+a.revenue,0),10000);assert.equal(reports(f.s).profit,-4400);
});
test('mixed selling units reserve combined base stock and allocate exact revenues across FIFO lots',()=>{
 const f=setup();f.receive('A',1,'level-1',1200);f.receive('B',3,'level-1',3600);f.order([{unitKey:'level-1',count:3,unitPrice:1001},{unitKey:'base',count:2,unitPrice:133}]);assert.equal(stock(f.s)[0].reserved,38);f.dispatch();assert.equal(orderTotal(f.s.orders[0]),3269);assert.equal(f.s.orders[0].allocations.reduce((n,a)=>n+a.revenue,0),3269);assert.equal(stock(f.s)[0].onHand,10);assert.equal(reports(f.s).revenue,3269);
});
test('opening nested boxes preserves occupied full pallets; picking individual bars creates partial packaging',()=>{
 const f=setup();f.receive('A',1,'level-3');const l=f.s.containers[0].lines[0];f.run({type:'handling',containerId:f.s.containers[0].id,lotId:l.id,operation:'open',unitKey:'level-2',count:1});let ps=stock(f.s)[0].packageStock;assert.equal(ps.find(u=>u.kind==='pallet').full,1);assert.equal(ps.find(u=>u.kind==='pallet').opened,1);assert.equal(ps.find(u=>u.label==='box').opened,1);assert.equal(stock(f.s)[0].onHand,8640);
 f.order([{unitKey:'base',count:1,unitPrice:100}]);f.dispatch();ps=stock(f.s)[0].packageStock;assert.equal(ps.find(u=>u.kind==='pallet').partial,1);assert.equal(ps.find(u=>u.label==='box').partial,1);assert.equal(ps.find(u=>u.label==='pack').partial,1);assert.equal(stock(f.s)[0].onHand,8639);
});
test('loose units are not unopened boxes until explicitly repacked, and reservations protect intact boxes',()=>{
 const f=setup();f.receive('FLOOR',288,'base');assert.throws(()=>f.order([{unitKey:'level-2',count:1,unitPrice:10000}]),/intact/);
 const l=f.s.containers[0].lines[0];f.run({type:'handling',containerId:f.s.containers[0].id,lotId:l.id,operation:'repack',unitKey:'level-2',count:2});assert.equal(stock(f.s)[0].value,100000);f.order([{unitKey:'level-2',count:2,unitPrice:10000}]);assert.throws(()=>f.run({type:'handling',containerId:f.s.containers[0].id,lotId:l.id,operation:'open',unitKey:'level-2',count:1}),/intact/);f.dispatch();assert.equal(stock(f.s)[0].onHand,0);
});
test('five tea sachet samples leave an open retail box and recognize marketing cost once',()=>{
 const f=setup([['retail box',20],['master carton',30],['pallet',50,'pallet']],{name:'Green tea',unit:'sachet',weight:2,weightUnit:'g'});f.receive('TEA',1,'level-1',1000);f.run({type:'sample',productId:f.p.id,date:d,unitKey:'base',count:5,reason:'Retailer tasting'});const r=reports(f.s);assert.equal(stock(f.s)[0].onHand,15);assert.equal(r.revenue,0);assert.equal(r.damage,0);assert.equal(r.expense,250);assert.equal(r.samples,250);assert.equal(r.profit,-250);assert.equal(r.products[0].expense,250);assert.equal(r.containers[0].expense,250);assert.equal(stock(f.s)[0].packageStock[0].intact,0);assert.equal(stock(f.s)[0].packageStock[0].opened,1);
});
test('package-specific customer prices and historical invoices survive future packaging changes',()=>{
 const f=setup();f.receive('A',1,'level-3');f.run({type:'price',customerId:f.s.customers[0].id,productId:f.p.id,unitKey:'level-2',rate:12345});assert.equal(sellingPrice(f.p,f.s.customers[0],'level-2'),12345);f.order([{unitKey:'level-2',count:1,unitPrice:12345}]);f.run({type:'packaging',productId:f.p.id,packaging:[{label:'box',contains:100}]});assert.equal(f.s.orders[0].lines[0].qty,144);assert.equal(orderTotal(f.s.orders[0]),12345);assert.equal(f.s.containers[0].lines[0].packaging.at(-1).units,8640);f.dispatch();assert.equal(reports(f.s).revenue,12345);
});
test('invalid packaging, fractional quantities, disabled selling units and non-mutating failures',()=>{
 assert.throws(()=>setup([['box','']]),/positive/);assert.throws(()=>setup([['box',12],['BOX',2]]),/unique/);
 const f=setup();f.receive('A',1,'level-2');const before=JSON.stringify(f.s);assert.throws(()=>f.order([{unitKey:'level-1',count:1.5,unitPrice:100}]),/whole/);assert.equal(JSON.stringify(f.s),before);f.run({type:'packaging',productId:f.p.id,packaging:[{label:'box',contains:144,sellable:false}]});assert.throws(()=>f.order([{unitKey:'level-1',count:1,unitPrice:100}]),/not enabled/);
});
test('dispatch cannot break packaging reserved for another order',()=>{
 const f=setup();f.receive('A',2,'level-2');f.order([{unitKey:'level-2',count:1,unitPrice:10000}]);f.order([{unitKey:'base',count:1,unitPrice:100}]);f.dispatch();const first=f.s.orders[0];f.run({type:'dispatch',orderId:first.id,date:d});assert.equal(stock(f.s)[0].onHand,143);
});
test('long sequences conserve all physical quantities and purchase cents after sales, samples and damage',()=>{
 const f=setup();f.receive('A',1,'level-3',10101);let seed=2026;
 for(let i=0;i<100;i++){seed=(seed*1664525+1013904223)>>>0;const q=seed%19+1;if(i%3===0){f.order([{unitKey:'base',count:q,unitPrice:37}]);f.dispatch();}else f.run({type:i%3===1?'damage':'sample',productId:f.p.id,date:d,unitKey:'base',count:q,reason:'Test movement'});const l=f.s.containers[0].lines[0],r=reports(f.s);assert.equal(packageQuantity(l.packages,l.packaging),stock(f.s)[0].onHand);assert.equal(stock(f.s)[0].value+r.cogs+r.damage+r.samples,10101);}
});
test('floor-loaded rice can be palletized after a later packaging setup without changing receipt quantities or costs',()=>{
 const f=setup([],{name:'Rice',unit:'bag',weight:25,weightUnit:'lb'});f.receive('FLOOR',1037,'base',123456,{loading:'floor'});const l=f.s.containers[0].lines[0];f.run({type:'packaging',productId:f.p.id,packaging:[{label:'pallet',contains:100,kind:'pallet'}]});f.run({type:'handling',containerId:f.s.containers[0].id,lotId:l.id,operation:'repack',reconcile:true,unitKey:'level-1',count:10});assert.equal(stock(f.s)[0].onHand,1037);assert.equal(stock(f.s)[0].value,123456);assert.equal(stock(f.s)[0].packageStock[0].intact,10);assert.equal(f.s.containers[0].lines[0].receivedPackaging.length,1);assert.equal(f.s.containers[0].lines[0].qty,1037);
});
