import {createClient} from '../../../../lib/supabase/server';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'Cross-origin requests are not allowed.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON is required.'},415);
 let body;try{const raw=await request.text();if(raw.length>2000)throw new Error();body=JSON.parse(raw);}catch{return reply({error:'Enter a valid email address.'},400);}
 const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'Enter a valid email address.'},400);
 try{
  const supabase=await createClient();const {error}=await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:new URL('/auth/callback',request.url).href}});
  if(error){
   if(error.code==='email_address_not_authorized')return reply({error:'Email sign-in is not ready for new accounts yet. Please try again later.'},503);
   if(error.status===429)return reply({error:'Too many sign-in requests. Please wait before trying again.'},429);
   return reply({error:'The sign-in email could not be delivered. Please try again later.'},503);
  }
  return reply({ok:true});
 }catch{return reply({error:'Email sign-in is temporarily unavailable. Please try again later.'},503);}
}
