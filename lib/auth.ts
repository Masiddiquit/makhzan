import {createClient} from './supabase/server';
export function isOwner(email:string|undefined){const allowed=process.env.MAKHZAN_OWNER_EMAIL?.trim().toLowerCase();return !!allowed&&!!email&&allowed===email.trim().toLowerCase();}
export async function ownerSession(){
 const supabase=await createClient();
 const {data:{user},error}=await supabase.auth.getUser();
 return {supabase,user:!error&&user&&isOwner(user.email)&&user.email_confirmed_at?user:null};
}
