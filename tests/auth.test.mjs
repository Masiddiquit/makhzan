import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(path,replacement){let source=readFileSync(new URL(path,import.meta.url),'utf8');source=source.replace(/import \{createClient\} from '[^']+';/,"const createClient=()=>globalThis.__authClient;");const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
test('verified email sessions accept different businesses and reject anonymous/unverified users',async()=>{
 const api=await load('../lib/auth.ts');let user={id:'a',email:'business-a@example.test',email_confirmed_at:'2026-10-29',is_anonymous:false},error=null;
 globalThis.__authClient={auth:{getUser:async()=>({data:{user},error})}};
 try{assert.equal((await api.warehouseSession()).user.id,'a');user={...user,id:'b',email:'business-b@example.test'};assert.equal((await api.warehouseSession()).user.id,'b');user.email_confirmed_at=null;assert.equal((await api.warehouseSession()).user,null);user.email_confirmed_at='2026-10-29';user.is_anonymous=true;assert.equal((await api.warehouseSession()).user,null);user.is_anonymous=false;error=new Error('revoked');assert.equal((await api.warehouseSession()).user,null);}finally{delete globalThis.__authClient;}
});
test('public sign-in creates email accounts, validates requests and reports provider failures truthfully',async()=>{
 const api=await load('../app/api/auth/link/route.ts');let calls=[],failure=null;
 globalThis.__authClient={auth:{signInWithOtp:async(args)=>{calls.push(args);return {error:failure};}}};
 const post=(email,origin='https://makhzan.test',extra={})=>api.POST(new Request('https://makhzan.test/api/auth/link',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email,...extra})}));
 try{
  for(const email of ['business-a@example.test','business-b@example.test']){assert.equal((await post(email)).status,200);assert.equal(calls.at(-1).email,email);assert.equal(calls.at(-1).options.shouldCreateUser,true);assert.equal(calls.at(-1).options.emailRedirectTo,'https://makhzan.test/auth/callback');}
  assert.equal((await post(' BUSINESS-A@example.test ')).status,200);assert.equal(calls.at(-1).email,'business-a@example.test');
  const count=calls.length;for(const bad of ['',null,{},'bad','a@b','x'.repeat(255)+'@example.test'])assert.equal((await post(bad)).status,400);assert.equal(calls.length,count);
  assert.equal((await post('a@example.test','https://evil.test')).status,403);
  failure={code:'email_address_not_authorized',status:400};const unavailable=await post('new@example.test');assert.equal(unavailable.status,503);assert.match((await unavailable.json()).error,/not ready/);
  failure={code:'over_email_send_rate_limit',status:429};assert.equal((await post('a@example.test')).status,429);
  failure={message:'PRIVATE PROVIDER DETAILS',status:500};const failed=await post('a@example.test');assert.equal(failed.status,503);assert.doesNotMatch(JSON.stringify(await failed.json()),/PRIVATE PROVIDER/);
 }finally{delete globalThis.__authClient;}
});
test('email callback admits verified new accounts and rejects expired or unverified links',async()=>{
 const api=await load('../app/auth/callback/route.ts');let user={email:'new-business@example.test',email_confirmed_at:'2026-10-29',is_anonymous:false},error=null,signedOut=0;
 globalThis.__authClient={auth:{exchangeCodeForSession:async()=>({data:{user},error}),signOut:async()=>{signedOut++;}}};
 try{let response=await api.GET(new Request('https://makhzan.test/auth/callback?code=one-time'));assert.equal(response.status,303);assert.equal(response.headers.get('Location'),'https://makhzan.test/');user.email_confirmed_at=null;response=await api.GET(new Request('https://makhzan.test/auth/callback?code=unverified'));assert.match(response.headers.get('Location'),/invalid-link/);error=new Error('expired');response=await api.GET(new Request('https://makhzan.test/auth/callback?code=expired'));assert.match(response.headers.get('Location'),/invalid-link/);assert.equal(signedOut,2);}finally{delete globalThis.__authClient;}
});
