import {cookies} from 'next/headers';
import {createClient} from '../../../../lib/supabase/server';
import {createEmailClient} from '../../../../lib/supabase/email';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const validEmail=(email:string)=>email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const verified=(user:any)=>!!user?.email&&!!user.email_confirmed_at&&!user.is_anonymous;
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return reply({error:'Cross-origin requests are not allowed.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON is required.'},415);
 let body;try{const raw=await request.text();if(raw.length>4096)return reply({error:'Request is too large.'},413);body=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
 const action=body?.action;
 if(!['signin','signup','recover','password'].includes(action))return reply({error:'Choose a valid account action.'},400);
 const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
 const password=typeof body.password==='string'?body.password:'';
 if(action!=='password'&&!validEmail(email))return reply({error:'Enter a valid email address.'},400);
 if(action!=='recover'&&(password.length>(128)||password.length<(action==='signin'?1:12)))return reply({error:action==='signin'?'Enter your password.':'Use a password between 12 and 128 characters.'},400);
 try{
  const supabase=await createClient();
  if(action==='signin'){
   const {data,error}=await supabase.auth.signInWithPassword({email,password});
   if(error){
    if(error.status===429)return reply({error:'Too many sign-in attempts. Please wait before trying again.'},429);
    if(error.code==='email_not_confirmed')return reply({error:'Confirm your email before signing in. Check your signup email.'},403);
    return reply({error:'Email or password is incorrect. If you previously used email links, choose “Set or reset password”.'},401);
   }
   if(!verified(data.user)){await supabase.auth.signOut();return reply({error:'A verified email account is required.'},403);}
   (await cookies()).delete('makhzan-password-flow');
   return reply({ok:true,redirect:'/'});
  }
  if(action==='password'){
   const {data:{user},error:sessionError}=await supabase.auth.getUser();
   if(sessionError||!verified(user))return reply({error:'Sign in or open your password-reset link before setting a password.'},401);
   const {error}=await supabase.auth.updateUser({password});
   if(error){
    if(error.code==='same_password')return reply({error:'Choose a different password from your current one.'},400);
    if(error.status===429)return reply({error:'Please wait before trying to save your password again.'},429);
    if(error.code==='reauthentication_needed'||error.code==='reauthentication_not_valid')return reply({error:'For your security, request a new password-reset link and open it before saving.'},403);
    return reply({error:'The password could not be saved. Choose a strong password, or request a new reset link.'},400);
   }
   (await cookies()).delete('makhzan-password-flow');
   return reply({ok:true,redirect:'/'});
  }
  const callback=new URL('/auth/callback',request.url).href;
  if(action==='recover'){
   const {error}=await createEmailClient().auth.resetPasswordForEmail(email,{redirectTo:callback});
   if(error){
    if(error.status===429)return reply({error:'The email service is temporarily rate limited. Wait before requesting another setup link. Password sign-in does not send an email.'},429);
    return reply({error:'The password-setup email could not be sent. Please try again later.'},503);
   }
   (await cookies()).set('makhzan-password-flow','1',{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:3600});
   return reply({ok:true,message:'If an account exists for this email, a password-setup link has been sent. Open the latest link to choose your password. It can be opened in your email app’s browser.'});
  }
  const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:callback}});
  if(error){
   if(error.status===429)return reply({error:'The email service is temporarily rate limited. Wait before requesting another confirmation email.'},429);
   if(error.code==='user_already_exists'||error.code==='email_exists')return reply({error:'Use Sign in, or Set or reset password, for an existing account.'},400);
   if(error.code==='weak_password')return reply({error:'Choose a stronger password with a mix of letters, numbers, and symbols.'},400);
   return reply({error:'The account could not be created or the confirmation email could not be sent. Please try again later.'},503);
  }
  if(!data.session&&Array.isArray(data.user?.identities)&&data.user.identities.length===0)return reply({ok:true,nextAction:'recover',message:'No new account or password was created. If you already registered this email, choose Set or reset password to verify your email and choose a password for the existing account.'});
  if(data.session&&verified(data.user))return reply({ok:true,redirect:'/'});
  return reply({ok:true,message:'Check your email to confirm your account once. Then sign in with your email and password. If you already have an account, use Sign in or Set or reset password.'});
 }catch{return reply({error:'Account services are temporarily unavailable. Please try again.'},503);}
}
