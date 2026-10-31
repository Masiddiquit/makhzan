import {cookies} from 'next/headers';
import {createEmailClient} from '../../../../lib/supabase/email';
import {createClient} from '../../../../lib/supabase/server';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin!==new URL(request.url).origin)return reply({error:'Use this page to complete email verification.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON is required.'},415);
 let body;try{const raw=await request.text();if(raw.length>20000)return reply({error:'Invalid link.'},400);body=JSON.parse(raw);}catch{return reply({error:'Invalid link.'},400);}
 if(typeof body?.access_token!=='string'||typeof body?.refresh_token!=='string'||!body.access_token||!body.refresh_token)return reply({error:'This email link is incomplete. Request a new one.'},400);
 try{
  // Check the token with Auth before trusting the identity or creating cookies.
  const emailClient=createEmailClient();
  const {data:{user},error}=await emailClient.auth.getUser(body.access_token);
  if(error||!user?.email||!user.email_confirmed_at||user.is_anonymous)return reply({error:'This email link is expired or invalid. Request a new one.'},401);
  if(body.confirmed!==true)return reply({ok:true,email:user.email});
  // Validate the refresh token belongs to the displayed identity before writing cookies.
  const {data:renewed,error:refreshError}=await emailClient.auth.refreshSession({refresh_token:body.refresh_token});
  if(refreshError||!renewed.session||renewed.user?.id!==user.id)return reply({error:'This email link could not restore the verified account. Request a new one.'},401);
  const supabase=await createClient();const {data,error:sessionError}=await supabase.auth.setSession({access_token:renewed.session.access_token,refresh_token:renewed.session.refresh_token});
  if(sessionError||data.user?.id!==user.id)return reply({error:'The session could not be restored. Request a new email link.'},401);
  (await cookies()).delete('makhzan-password-flow');
  return reply({ok:true,redirect:body.recovery===true?'/account/password':'/'});
 }catch{return reply({error:'Email verification is temporarily unavailable. Please retry.'},503);}
}
