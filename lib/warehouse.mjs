// All ledger money is integer USD cents. Quantities are individual sale units.
export const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fail = message => { throw new Error(message); };
const int = (v,name,min=0,max=1e9) => { v=Number(v); if(!Number.isSafeInteger(v)||v<min||v>max) fail(`${name} must be a whole number between ${min} and ${max}.`); return v; };
const str = (v,name,max=160) => { if(typeof v!=='string'||!v.trim()||v.trim().length>max) fail(`${name} is required (up to ${max} characters).`); return v.trim(); };
const proportionalFloor=(cost,qty,total)=>Number(BigInt(cost)*BigInt(qty)/BigInt(total));
const note = v => typeof v==='string'?v.trim().slice(0,1200):'';
function date(v,future=false) { if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v) fail('Enter a valid date.'); if(!future&&v>today()) fail('Activity cannot be dated in the future.'); return v; }
const find=(a,id,name)=>a.find(x=>x.id===id)||fail(`${name} was not found.`);
export const money = v => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((v||0)/100);
export function cents(v) { const s=String(v).trim(); if(!/^\d+(\.\d{1,2})?$/.test(s)) fail('Enter a nonnegative dollar amount with at most two decimals.'); return int(Math.round(Number(s)*100),'Amount'); }
export function split(total,weights) {
 int(total,'Total',0,1e12); const sum=weights.reduce((a,w)=>a+w,0); if(!sum)return weights.map(()=>0);
 const parts=weights.map((w,i)=>({i,v:Math.floor(total*w/sum),r:total*w/sum%1})); let left=total-parts.reduce((a,x)=>a+x.v,0);
 for(const p of [...parts].sort((a,b)=>b.r-a.r||a.i-b.i)){if(left-->0)p.v++;} return parts.map(x=>x.v);
}
export function emptyState() {return {version:1,products:[],customers:[],containers:[],orders:[],damages:[],expenses:[],audit:[]};}
export function orderTotal(o){return o.lines.reduce((s,l)=>s+l.qty*l.rate,0);}
export function paid(o){return o.payments.reduce((s,p)=>s+p.amount,0);}
export function paymentStatus(o){const p=paid(o),t=orderTotal(o);return p>t?'Credit':p===t?'Paid':p>0?'Partial':'Unpaid';}
export function lots(s) {
 const out=[];
 for(const c of s.containers) for(const l of c.lines) {
  const movements=[];
  for(const o of s.orders) for(const a of o.allocations||[]) if(a.lotId===l.id)movements.push({...a,date:o.dispatchDate,type:'sale',orderId:o.id});
  for(const d of s.damages)for(const a of d.allocations)if(a.lotId===l.id)movements.push({...a,date:d.date,type:'damage'});
  const used=movements.reduce((a,x)=>a+x.qty,0),usedCost=movements.reduce((a,x)=>a+x.cost,0);
  out.push({...l,containerId:c.id,containerRef:c.ref,date:c.date,weight:find(s.products,l.productId,'Product').weight,remaining:l.qty-l.damaged-used,remainingCost:l.cost-l.damageCost-usedCost,movements});
 }
 return out.sort((a,b)=>a.date.localeCompare(b.date)||s.containers.findIndex(c=>c.id===a.containerId)-s.containers.findIndex(c=>c.id===b.containerId));
}
export function stock(s) {
 const ls=lots(s);return s.products.map(p=>{
 const onHand=ls.filter(l=>l.productId===p.id).reduce((a,l)=>a+l.remaining,0);
 const reserved=s.orders.filter(o=>o.status==='Placed').flatMap(o=>o.lines).filter(l=>l.productId===p.id).reduce((a,l)=>a+l.qty,0);
 return {...p,onHand,reserved,available:onHand-reserved,value:ls.filter(l=>l.productId===p.id).reduce((a,l)=>a+l.remainingCost,0)};
 });
}
export function allocations(s,productId,qty,containerId='') {
 let left=qty; const out=[];
 for(const l of lots(s).filter(l=>l.productId===productId&&l.remaining>0&&(!containerId||l.containerId===containerId))) {
  const q=Math.min(left,l.remaining);if(!q)break;const used=l.qty-l.remaining;
  const cost=proportionalFloor(l.cost,used+q,l.qty)-proportionalFloor(l.cost,used,l.qty);
  out.push({lotId:l.id,containerId:l.containerId,productId,qty:q,cost});left-=q;
 }
 if(left)fail('Insufficient physical stock for this operation.');return out;
}
function stockDate(s,d,productIds) {
 const dates=[...s.containers.filter(c=>c.lines.some(l=>productIds.includes(l.productId))).map(c=>c.date),...s.orders.filter(o=>o.dispatchDate&&o.lines.some(l=>productIds.includes(l.productId))).map(o=>o.dispatchDate),...s.damages.filter(x=>productIds.includes(x.productId)).map(x=>x.date)];
 const latest=dates.sort().at(-1);if(latest&&d<latest)fail(`Stock activity for these products must be on or after ${latest}. This preserves the FIFO ledger.`);
}
export function expenseAllocations(s) {
 const ls=lots(s);return s.expenses.map(e=>{
  if(e.containerId)return {...e,shares:[{containerId:e.containerId,amount:e.amount}],unallocated:0};
  // Opening usable stock plus same-day receipts includes stock dispatched that day.
  const weights=s.containers.map(c=>ls.filter(l=>l.containerId===c.id&&l.date<=e.date).reduce((a,l)=>a+Math.max(0,l.qty-l.damaged-l.movements.filter(m=>m.date<e.date).reduce((n,m)=>n+m.qty,0))*l.weight,0));
  const amounts=split(e.amount,weights);
  return {...e,shares:s.containers.map((c,i)=>({containerId:c.id,amount:amounts[i]})).filter(x=>x.amount>0),unallocated:weights.some(w=>w>0)?0:e.amount};
 });
}
export function reports(s,from='',to='9999-12-31') {
 const inRange=d=>d>=from&&d<=to,ls=lots(s),es=expenseAllocations(s).filter(e=>inRange(e.date));
 const cs=s.containers.map(c=>{
  let revenue=0,cogs=0,sold=0,damage=0,damageQty=0;
  for(const l of c.lines)if(inRange(c.date)){damage+=l.damageCost;damageQty+=l.damaged;}
  for(const o of s.orders.filter(o=>o.dispatchDate&&inRange(o.dispatchDate)))for(const a of o.allocations.filter(a=>a.containerId===c.id)){revenue+=a.revenue;cogs+=a.cost;sold+=a.qty;}
  for(const d of s.damages.filter(d=>inRange(d.date)))for(const a of d.allocations.filter(a=>a.containerId===c.id)){damage+=a.cost;damageQty+=a.qty;}
  const expense=es.flatMap(e=>e.shares).filter(a=>a.containerId===c.id).reduce((a,e)=>a+e.amount,0),own=ls.filter(l=>l.containerId===c.id);
  return {...c,revenue,cogs,sold,damage,damageQty,expense,profit:revenue-cogs-damage-expense,remaining:own.reduce((a,l)=>a+l.remaining,0),inventoryValue:own.reduce((a,l)=>a+l.remainingCost,0)};
 });
 const ps=s.products.map(p=>{
  let revenue=0,cogs=0,sold=0,damage=0;
  for(const c of s.containers.filter(c=>inRange(c.date)))for(const l of c.lines.filter(l=>l.productId===p.id))damage+=l.damageCost;
  for(const o of s.orders.filter(o=>o.dispatchDate&&inRange(o.dispatchDate)))for(const a of o.allocations.filter(a=>a.productId===p.id)){revenue+=a.revenue;cogs+=a.cost;sold+=a.qty;}
  for(const d of s.damages.filter(d=>inRange(d.date)))for(const a of d.allocations.filter(a=>a.productId===p.id))damage+=a.cost;
  let expense=0;
  for(const e of es)for(const sh of e.shares){
   const c=find(s.containers,sh.containerId,'Container');
   const weights=c.lines.map(l=>{const lot=ls.find(x=>x.id===l.id);return lot.date<=e.date?Math.max(0,lot.qty-lot.damaged-lot.movements.filter(m=>m.date<e.date).reduce((n,m)=>n+m.qty,0))*lot.weight:0;});
   const effective=weights.some(w=>w>0)?weights:c.lines.map(l=>(l.qty-l.damaged)*find(s.products,l.productId,'Product').weight);
   const amounts=split(sh.amount,effective.some(w=>w>0)?effective:c.lines.map(l=>l.qty));
   c.lines.forEach((l,i)=>{if(l.productId===p.id)expense+=amounts[i];});
  }
  return {...p,revenue,cogs,sold,damage,expense,profit:revenue-cogs-damage-expense};
 });
 const sum=k=>cs.reduce((a,c)=>a+c[k],0),unallocated=es.reduce((a,e)=>a+e.unallocated,0),daily={};
 for(const o of s.orders.filter(o=>o.dispatchDate&&inRange(o.dispatchDate))) {daily[o.dispatchDate]??={date:o.dispatchDate,revenue:0,qty:0};daily[o.dispatchDate].revenue+=orderTotal(o);daily[o.dispatchDate].qty+=o.lines.reduce((a,l)=>a+l.qty,0);}
 return {containers:cs,products:ps,expenses:es,revenue:sum('revenue'),cogs:sum('cogs'),damage:sum('damage'),expense:es.reduce((a,e)=>a+e.amount,0),profit:sum('profit')-unallocated,unallocated,daily:Object.values(daily).sort((a,b)=>a.date.localeCompare(b.date))};
}
export function apply(s,action,ctx={}) {
 s=structuredClone(s);const a=action,id=()=>ctx.id?ctx.id():crypto.randomUUID(),now=ctx.now||new Date().toISOString();
 switch(a.type){
 case 'product': {
  const name=str(a.name,'Product name'),sku=str(a.sku,'SKU',40).toUpperCase();if(s.products.some(p=>p.sku===sku))fail('SKU already exists.');
  const weight=Number(a.weight);if(!Number.isFinite(weight)||weight<=0||weight>10000)fail('Unit weight must be greater than zero and at most 10,000 lb.');
  s.products.push({id:id(),name,sku,category:['Rice','Soap','Other'].includes(a.category)?a.category:'Other',unit:str(a.unit,'Sale unit',30),weight,pallet:int(a.pallet,'Units per pallet',1,100000),rate:int(a.rate,'Default rate'),low:int(a.low||0,'Low stock threshold')});break;
 }
 case 'customer':{const name=str(a.name,'Customer name');s.customers.push({id:id(),name,contact:note(a.contact),address:note(a.address),prices:{}});break;}
 case 'price':{const c=find(s.customers,a.customerId,'Customer');find(s.products,a.productId,'Product');c.prices[a.productId]=int(a.rate,'Customer rate');break;}
 case 'receive': {
  const ref=str(a.ref,'Container reference',60);if(s.containers.some(c=>c.ref.toLowerCase()===ref.toLowerCase()))fail('Container reference already exists.');
  const d=date(a.date);if(!Array.isArray(a.lines)||!a.lines.length||a.lines.length>50)fail('Add 1–50 receipt lines.');
  if(new Set(a.lines.map(l=>l.productId)).size!==a.lines.length)fail('Combine duplicate products on a receipt.');
  const lines=a.lines.map(l=>{const p=find(s.products,l.productId,'Product'),qty=int(l.qty,'Received quantity',1,10000000),damaged=int(l.damaged||0,'Container damage',0,qty),costWeight=Number(l.costWeight||qty*p.weight);if(!Number.isFinite(costWeight)||costWeight<=0)fail('Cost allocation weights must be positive.');return {id:id(),productId:p.id,qty,damaged,costWeight};});
  stockDate(s,d,lines.map(l=>l.productId));const cost=int(a.cost,'Container total cost',1),costs=split(cost,lines.map(l=>l.costWeight));
  s.containers.push({id:id(),ref,date:d,supplier:note(a.supplier),notes:note(a.notes),cost,lines:lines.map((l,i)=>({...l,cost:costs[i],damageCost:proportionalFloor(costs[i],l.damaged,l.qty)}))});break;
 }
 case 'order':{
  const customer=find(s.customers,a.customerId,'Customer'),d=date(a.date),promised=a.promised?date(a.promised,true):'';
  if(!Array.isArray(a.lines)||!a.lines.length||a.lines.length>50)fail('Add 1–50 order lines.');
  const st=stock(s),lines=a.lines.map(l=>{const p=find(s.products,l.productId,'Product'),pack=l.pack==='pallet'?'pallet':'loose',count=int(l.count,'Order quantity',1,1000000),qty=count*(pack==='pallet'?p.pallet:1),rate=int(l.rate,'Unit selling price');int(qty,'Base units',1,10000000);int(qty*rate,'Line total',0,1e12);return {productId:p.id,pack,count,qty,rate,palletSize:p.pallet};});
  for(const p of st){const q=lines.filter(l=>l.productId===p.id).reduce((a,l)=>a+l.qty,0);if(q>0&&q>p.available)fail(`${p.name}: only ${p.available} units available after reservations.`);}
  const order={id:id(),ref:`INV-${String(s.orders.length+1).padStart(5,'0')}`,customerId:customer.id,date:d,promised,notes:note(a.notes),lines,status:'Placed',payments:[],allocations:[]};int(orderTotal(order),'Order total',1,1e12);s.orders.push(order);break;
 }
 case 'dispatch': {
  const o=find(s.orders,a.orderId,'Order');if(o.status!=='Placed')fail('Only placed orders can be dispatched.');const d=date(a.date);if(d<o.date)fail('Dispatch must be on or after the order date.');stockDate(s,d,o.lines.map(l=>l.productId));
  o.allocations=[];o.dispatchDate=d;o.status='Dispatched';for(const l of o.lines){const aa=allocations(s,l.productId,l.qty);for(const x of aa)o.allocations.push({...x,revenue:x.qty*l.rate});}break;
 }
 case 'deliver':{const o=find(s.orders,a.orderId,'Order');if(o.status!=='Dispatched')fail('Only dispatched orders can be delivered.');const d=date(a.date);if(d<o.dispatchDate)fail('Delivery must be on or after dispatch.');o.status='Delivered';o.deliveryDate=d;break;}
 case 'cancel':{const o=find(s.orders,a.orderId,'Order');if(o.status!=='Placed'||paid(o)>0)fail('Only unpaid, undispatched orders can be cancelled.');o.status='Cancelled';break;}
 case 'payment':{const o=find(s.orders,a.orderId,'Order');if(o.status==='Cancelled')fail('Cancelled orders cannot receive payments.');const d=date(a.date);if(d<o.date)fail('Payment must be on or after the order date.');o.payments.push({id:id(),date:d,amount:int(a.amount,'Payment amount',1),method:str(a.method||'Other','Payment method',40),reference:note(a.reference)});break;}
 case 'promise':{const o=find(s.orders,a.orderId,'Order');o.promised=a.promised?date(a.promised,true):'';break;}
 case 'damage':{
  const p=find(s.products,a.productId,'Product'),d=date(a.date),qty=int(a.qty,'Damaged units',1,10000000);stockDate(s,d,[p.id]);
  if(qty>find(stock(s),p.id,'Product').onHand)fail('Damage exceeds physical stock.');
  if(a.containerId)find(s.containers,a.containerId,'Container');
  const aa=allocations(s,p.id,qty,a.containerId||'');s.damages.push({id:id(),productId:p.id,date:d,qty,reason:str(a.reason,'Damage reason',500),allocations:aa});break;
 }
 case 'expense':{const d=date(a.date),cid=a.containerId||'';if(cid){const c=find(s.containers,cid,'Container');if(d<c.date)fail('Direct expenses cannot predate container receipt.');}s.expenses.push({id:id(),date:d,amount:int(a.amount,'Expense amount',1),category:str(a.category,'Expense category',60),description:str(a.description,'Expense description',500),containerId:cid});break;}
 default:fail('Unknown operation.');
 }
 s.audit.push({id:id(),at:now,type:a.type,summary:note(a.ref||a.name||a.description||a.reason||a.orderId||a.customerId||a.type)});
 if(new TextEncoder().encode(JSON.stringify(s)).length>1500000)fail('The warehouse ledger has reached its storage limit. Export a backup and contact support.');return s;
}
export function demoState() {
 let s=emptyState(),n=0;const run=a=>s=apply(s,a,{id:()=>`demo-${++n}`});const d=today(),prior=n=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()-n);return x.toISOString().slice(0,10);};
 for(const p of [{name:'PRID Long Grain Rice · 25 lb',sku:'RICE-25',category:'Rice',unit:'bag',weight:25,pallet:80,rate:2400,low:100},{name:'PRID Long Grain Rice · 50 lb',sku:'RICE-50',category:'Rice',unit:'bag',weight:50,pallet:40,rate:4300,low:60},{name:'Ivory Soap · individual bar',sku:'SOAP-BAR',category:'Soap',unit:'bar',weight:.25,pallet:2400,rate:125,low:300}])run({type:'product',...p});
 run({type:'customer',name:'Market Street Grocery',contact:'Sample retailer',address:'Philadelphia, PA'});run({type:'customer',name:'West African Foods',contact:'Sample retailer',address:'New York, NY'});
 const [p,q,r]=s.products,[c,b]=s.customers;run({type:'price',customerId:c.id,productId:p.id,rate:2200});
 run({type:'receive',ref:'PRID-2601',date:prior(21),supplier:'Sample rice supplier',cost:1800000,lines:[{productId:p.id,qty:800,damaged:8},{productId:q.id,qty:400,damaged:4}]});
 run({type:'receive',ref:'PRID-2602',date:prior(14),supplier:'Sample mixed shipment',cost:1200000,lines:[{productId:p.id,qty:600,damaged:0},{productId:r.id,qty:4800,damaged:24}]});
 run({type:'order',customerId:c.id,date:prior(10),promised:prior(2),lines:[{productId:p.id,count:5,pack:'pallet',rate:2200},{productId:q.id,count:60,pack:'loose',rate:4300}]});
 run({type:'dispatch',orderId:s.orders[0].id,date:prior(9)});run({type:'deliver',orderId:s.orders[0].id,date:prior(8)});run({type:'payment',orderId:s.orders[0].id,date:prior(7),amount:700000,method:'Bank transfer'});
 run({type:'order',customerId:b.id,date:prior(3),promised:d,lines:[{productId:r.id,count:600,pack:'loose',rate:125},{productId:p.id,count:1,pack:'pallet',rate:2400}]});run({type:'dispatch',orderId:s.orders[1].id,date:prior(2)});
 run({type:'order',customerId:c.id,date:d,promised:d,lines:[{productId:q.id,count:2,pack:'pallet',rate:4200}]});run({type:'damage',productId:p.id,date:d,qty:3,reason:'Torn bags found in warehouse'});
 run({type:'expense',date:prior(5),amount:18000,category:'Rent',description:'Shared warehouse rent for the day'});run({type:'expense',date:d,amount:6500,category:'Fuel',description:'Container unloading',containerId:s.containers[1].id});return s;
}
