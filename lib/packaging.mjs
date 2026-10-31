// Packaging is an optional chain above a single smallest tracked unit.
const fail=m=>{throw new Error(m);};
const integer=(v,label,max=10000000)=>{v=Number(v);if(!Number.isSafeInteger(v)||v<1||v>max)fail(`${label} must be a positive whole number (up to ${max}).`);return v;};
export function definePackaging(unit,levels=[]){
 if(!Array.isArray(levels)||levels.length>8)fail('Use up to eight optional packaging levels.');
 const used=new Set([String(unit).trim().toLowerCase()]);let units=1;
 return levels.map((l,i)=>{const label=typeof l.label==='string'?l.label.trim():'';if(!label||label.length>40||used.has(label.toLowerCase()))fail('Packaging names must be unique and up to 40 characters.');used.add(label.toLowerCase());const contains=integer(l.contains,`Quantity inside ${label}`);units*=contains;integer(units,'Units in a package');if(l.kind==='pallet'&&i!==levels.length-1)fail('A pallet must be the outermost packaging level.');return {key:`level-${i+1}`,label,contains,units,sellable:l.sellable!==false,kind:l.kind==='pallet'?'pallet':'package',...(l.price!==undefined&&l.price!==''?{price:Math.round(Number(l.price))}:{})};});
}
export function packagingUnits(p){
 if(!p)return [];
 const base={key:'base',label:p.unit,contains:1,units:1,sellable:true,kind:'unit'};
 if(Array.isArray(p.packaging))return [base,...p.packaging];
 return [base,...(p.pallet?[{key:'pallet',label:'pallet',contains:p.pallet,units:p.pallet,sellable:true,kind:'pallet'}]:[])];
}
export function packagingUnit(p,key='base'){
 const units=packagingUnits(p),u=units.find(u=>u.key===(key||'base'));
 if(!u)fail('Choose a defined packaging unit for this product.');return u;
}
/**
 * @param {any} p
 * @param {any} customer
 * @param {any} [key]
 */
export function sellingPrice(p,customer,key='base'){
 const u=typeof key==='object'?key:packagingUnit(p,key),specific=customer?.packPrices?.[`${p.id}::${u.key}::${u.units}`]??customer?.packPrices?.[`${p.id}::${u.key}`];
 return specific??(customer?.prices?.[p.id]!==undefined?customer.prices[p.id]*u.units:u.price??(p.rate??0)*u.units);
}
export function packageQuantity(nodes,levels){return nodes.reduce((sum,n)=>sum+(n.open?packageQuantity(n.children,levels):n.count*levels[n.level].units),0);}
// Whole groups stay compressed. Only an opened package gets its own child tree.
function removeFrom(nodes,levels,qty,target){
 let left=qty;
 // Pick from already open packages before breaking another intact package.
 const ordered=[...nodes.filter(n=>n.open),...nodes.filter(n=>!n.open)];
 for(const n of ordered){
  if(!left)break;
  if(n.open){if(n.level>target){const used=removeFrom(n.children,levels,left,target);left-=used;}continue;}
  if(n.level<target)continue;
  const size=levels[n.level].units;
  if(n.level===target){const count=Math.min(n.count,Math.floor(left/size));n.count-=count;left-=count*size;continue;}
  // Preserve whole larger packages whenever one of their children can serve the request.
  while(n.count>0&&left>0){
   if(target===0&&left>=size){const count=Math.min(n.count,Math.floor(left/size));n.count-=count;left-=count*size;continue;}
   n.count--;const opened={level:n.level,count:1,open:true,children:[{level:n.level-1,count:levels[n.level].contains}]};nodes.push(opened);
   left-=removeFrom(opened.children,levels,left,target);
  }
 }
 for(let i=nodes.length-1;i>=0;i--)if(nodes[i].open?!packageQuantity(nodes[i].children,levels):!nodes[i].count)nodes.splice(i,1);
 return qty-left;
}
export function takePackages(nodes,levels,qty,target=0){
 const copy=structuredClone(nodes),used=removeFrom(copy,levels,qty,target);
 if(used!==qty)fail('There are not enough intact packages in this lot. Choose smaller units or repack the stock first.');
 return copy;
}
export function receiptPackages(levels,key,count,extra=0){const index=levels.findIndex(u=>u.key===key);if(index<0)fail('Receipt packaging is undefined.');return [{level:index,count},...(extra?[{level:0,count:extra}]:[])];}
export function packagingSummary(nodes,levels){
 const result=levels.map(u=>({...u,intact:0,opened:0,full:0,partial:0}));
 function walk(items){for(const n of items){if(n.open){const q=packageQuantity(n.children,levels);result[n.level].opened++;result[n.level][q===levels[n.level].units?'full':'partial']++;walk(n.children);}else{result[n.level].intact+=n.count;result[n.level].full+=n.count;for(let i=0;i<n.level;i++){result[i].intact+=n.count*levels[n.level].units/levels[i].units;result[i].full+=n.count*levels[n.level].units/levels[i].units;}}}}
 walk(nodes);return result;
}
export function openPackages(nodes,levels,key,count=1){
 const index=levels.findIndex(u=>u.key===key);if(index<=0)fail('Choose packaging above the smallest unit.');integer(count,'Packages to open');const copy=structuredClone(nodes);let left=count;
 function walk(items){for(const n of [...items]){if(!left)break;if(n.open){if(n.level>index)walk(n.children);continue;}if(n.level<index)continue;
  if(n.level===index){const q=Math.min(left,n.count);n.count-=q;left-=q;for(let i=0;i<q;i++)items.push({level:index,count:1,open:true,children:[{level:index-1,count:levels[index].contains}]});}
  else while(n.count&&left){n.count--;const opened={level:n.level,count:1,open:true,children:[{level:n.level-1,count:levels[n.level].contains}]};items.push(opened);walk(opened.children);}
 }for(let i=items.length-1;i>=0;i--)if(!items[i].open&&!items[i].count)items.splice(i,1);}
 walk(copy);if(left)fail('Not enough unopened packages to open.');return copy;
}
export function repackPackages(nodes,levels,key,count){
 const index=levels.findIndex(u=>u.key===key);if(index<=0)fail('Choose packaging above the smallest unit.');integer(count,'Packages to build');
 const result=takePackages(nodes,levels,count*levels[index].units,0);result.push({level:index,count});return result;
}
export function unitsForProduct(s,p){
 const units=packagingUnits(p),seen=new Set(units.map(u=>u.label+'|'+u.units));
 for(const c of s.containers||[])for(const l of c.lines)if(l.productId===p.id)for(const [profile,definitions] of [['stock',l.packaging],['receipt',l.receivedPackaging||l.packaging]])for(const u of definitions||[]){const signature=u.label+'|'+u.units;if(seen.has(signature))continue;seen.add(signature);units.push({...u,key:`${profile}:${l.id}:${u.key}`,source:c.ref});}
 return units;
}
export function stateUnit(s,p,key='base'){const u=unitsForProduct(s,p).find(u=>u.key===(key||'base'));if(!u)fail('Choose a defined packaging unit for this product.');return u;}
