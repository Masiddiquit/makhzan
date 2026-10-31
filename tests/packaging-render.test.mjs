import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import ts from 'typescript';
import {demoState,emptyState} from '../lib/warehouse.mjs';
const source=readFileSync(new URL('../app/packaging-forms.tsx',import.meta.url),'utf8').replace("'react'",JSON.stringify(import.meta.resolve('react'))).replace("'lucide-react'",JSON.stringify(import.meta.resolve('lucide-react'))).replace("'../lib/warehouse.mjs'",JSON.stringify(new URL('../lib/warehouse.mjs',import.meta.url).href)).replace("'../lib/packaging.mjs'",JSON.stringify(new URL('../lib/packaging.mjs',import.meta.url).href));
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replaceAll('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const {default:Form}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('all packaging forms render with existing catalogs, and new-product setup leaves packaging optional',()=>{
 const state=demoState();const render=(kind,st=state)=>renderToStaticMarkup(createElement(Form,{kind,modal:{},state:st,save:async()=>true,close:()=>{},busy:false}));
 const product=render('product',emptyState());assert.match(product,/Smallest tracked unit/);assert.match(product,/Optional packaging levels/);assert.match(product,/Add packaging level/);assert.match(product,/Green tea/);
 for(const kind of ['packaging','receive','order','price','handling','damage','sample']){const html=render(kind);assert.match(html,/<form/);assert.match(html,/Save entry|Receive &amp; save stock|Create &amp; reserve stock/);assert.doesNotMatch(html,/NaN|Infinity/);}
 assert.match(render('receive'),/Total container cost/);assert.match(render('receive'),/Purchase price for each product line/);assert.match(render('order'),/Selling price per bag/);
});
