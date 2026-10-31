import {cookies} from 'next/headers';
import {createClient} from '../../../lib/supabase/server';
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get('code'),supabase=await createClient(),store=await cookies();
 const passwordFlow=store.get('makhzan-password-flow')?.value==='1';
 store.delete('makhzan-password-flow');
 if(code){
  const {data,error}=await supabase.auth.exchangeCodeForSession(code);
  if(!error&&data.user?.email&&data.user.email_confirmed_at&&!data.user.is_anonymous)return Response.redirect(new URL(passwordFlow?'/account/password':'/',url),303);
 }
 await supabase.auth.signOut();
 return Response.redirect(new URL('/login?error=invalid-link',url),303);
}
