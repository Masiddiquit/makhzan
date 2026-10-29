import {createClient} from '../../../../lib/supabase/server';
import {isOwner} from '../../../../lib/auth';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Cross-origin requests are not allowed.'},{status:403});
 let body;try{const raw=await request.text();if(raw.length>2000)throw new Error();body=JSON.parse(raw);}catch{return Response.json({error:'Enter a valid email address.'},{status:400});}
 const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
 if(!isOwner(email))return Response.json({error:'This email is not authorized for this private warehouse.'},{status:403});
 const supabase=await createClient();const {error}=await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:new URL('/auth/callback',request.url).href}});
 if(error)return Response.json({error:'The sign-in link could not be sent. Please wait a minute and retry.'},{status:429});
 return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
