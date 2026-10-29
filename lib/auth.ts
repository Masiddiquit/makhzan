import {createClient} from './supabase/server';
export async function warehouseSession(){
 const supabase=await createClient();
 const {data:{user},error}=await supabase.auth.getUser();
 return {supabase,user:!error&&user&&user.email&&user.email_confirmed_at&&!user.is_anonymous?user:null};
}
