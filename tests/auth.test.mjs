import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(path,replacement){let source=readFileSync(new URL(path,import.meta.url),'utf8').replace("import {cookies} from 'next/headers';","const cookies=async()=>globalThis.__authCookies||{get:()=>undefined,delete:()=>{},set:()=>{}};");source=source.replace(/import \{createClient\} from '[^']+';/,"const createClient=()=>globalThis.__authClient;");const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));}
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
test('password sign-in uses credentials without sending email and preserves verified account identity',async()=>{
 const api=await load('../app/api/auth/account/route.ts');let input,error=null,user={id:'existing-owner',email:'business@example.test',email_confirmed_at:'2026-10-31'},signedOut=0;
 globalThis.__authClient={auth:{signInWithPassword:async(args)=>{input=args;return {data:{user,session:{access_token:'NEVER_RETURN_TOKEN'}},error};},signOut:async()=>{signedOut++;}}};
 const post=body=>api.POST(new Request('https://makhzan.test/api/auth/account',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://makhzan.test'},body:JSON.stringify(body)}));
 try{
  const response=await post({action:'signin',email:' BUSINESS@example.test ',password:'my-existing-password'});assert.equal(response.status,200);assert.deepEqual(input,{email:'business@example.test',password:'my-existing-password'});assert.deepEqual(await response.json(),{ok:true,redirect:'/'});
  error={code:'invalid_credentials',status:400};let r=await post({action:'signin',email:'business@example.test',password:'wrong'});assert.equal(r.status,401);assert.match((await r.json()).error,/Set or reset password/);
  error={code:'email_not_confirmed',status:400};assert.equal((await post({action:'signin',email:'business@example.test',password:'something'})).status,403);
  error={status:429};assert.equal((await post({action:'signin',email:'business@example.test',password:'something'})).status,429);
  error=null;user.email_confirmed_at=null;assert.equal((await post({action:'signin',email:'business@example.test',password:'something'})).status,403);assert.equal(signedOut,1);
 }finally{delete globalThis.__authClient;}
});
test('account actions validate origin/input, require authentication for password changes, and never accept a client owner ID',async()=>{
 const api=await load('../app/api/auth/account/route.ts');let user=null,updated=[],signupInput,cookie=null,sessionError=null;
 globalThis.__authClient={auth:{getUser:async()=>({data:{user},error:sessionError}),updateUser:async data=>{updated.push(data);return {error:null};},signUp:async data=>{signupInput=data;return {data:{session:null,user:null},error:null};},resetPasswordForEmail:async()=>({error:null})}};
 globalThis.__authCookies={get:()=>cookie,set:(...args)=>{cookie=args;},delete:()=>{cookie=null;}};
 const post=(body,origin='https://makhzan.test')=>api.POST(new Request('https://makhzan.test/api/auth/account',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}));
 try{
  assert.equal((await post({action:'password',password:'strong-password-123',owner_id:'someone-else'})).status,401);assert.equal(updated.length,0);
  user={id:'me',email:'me@example.test',email_confirmed_at:'2026-10-31'};
  assert.equal((await post({action:'password',password:'short'})).status,400);
  assert.equal((await post({action:'password',password:'strong-password-123',owner_id:'someone-else'})).status,200);assert.deepEqual(updated,[{password:'strong-password-123'}]);
  user.is_anonymous=true;assert.equal((await post({action:'password',password:'strong-password-123'})).status,401);
  assert.equal((await post({action:'password',password:'strong-password-123'},'https://evil.test')).status,403);
  assert.equal((await post({action:'unknown'})).status,400);
  assert.equal((await post({action:'signup',email:'invalid',password:'strong-password-123'})).status,400);
  assert.equal((await post({action:'signup',email:'new@example.test',password:'short'})).status,400);
  const signup=await post({action:'signup',email:'new@example.test',password:'strong-password-123'});assert.equal(signup.status,200);assert.match((await signup.json()).message,/confirm your account once/);assert.equal(signupInput.options.emailRedirectTo,'https://makhzan.test/auth/callback');assert.equal(signupInput.password,'strong-password-123');
  const recovery=await post({action:'recover',email:'me@example.test'});assert.equal(recovery.status,200);assert.match((await recovery.json()).message,/If an account exists/);assert.equal(cookie[0],'makhzan-password-flow');assert.equal(cookie[2].httpOnly,true);assert.equal(cookie[2].secure,true);
 }finally{delete globalThis.__authClient;delete globalThis.__authCookies;}
});
test('recovery callback routes only a verified session to password setup, never an arbitrary next URL',async()=>{
 const api=await load('../app/auth/callback/route.ts');let cleared=0,error=null;
 globalThis.__authCookies={get:()=>({value:'1'}),delete:()=>{cleared++;}};
 globalThis.__authClient={auth:{exchangeCodeForSession:async()=>({data:{user:{email:'existing@example.test',email_confirmed_at:'2026-10-31'}},error}),signOut:async()=>{}}};
 try{let res=await api.GET(new Request('https://makhzan.test/auth/callback?code=recovery&next=https://evil.test'));assert.equal(res.headers.get('Location'),'https://makhzan.test/account/password');assert.equal(cleared,1);error=new Error('expired');res=await api.GET(new Request('https://makhzan.test/auth/callback?code=expired'));assert.equal(res.headers.get('Location'),'https://makhzan.test/login?error=invalid-link');}finally{delete globalThis.__authClient;delete globalThis.__authCookies;}
});
