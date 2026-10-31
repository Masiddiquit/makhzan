import {cookies} from 'next/headers';
import {createClient} from '../../../lib/supabase/server';
export async function GET(request:Request){
 const url=new URL(request.url),code=url.searchParams.get('code');
 // Fragment tokens are not sent to a server. Browsers preserve the fragment
 // when following this redirect; the completion page validates it via POST.
 if(!code&&!url.searchParams.has('error'))return Response.redirect(new URL('/auth/complete',url),303);
 const supabase=await createClient(),store=await cookies();
 const passwordFlow=store.get('makhzan-password-flow')?.value==='1';
 store.delete('makhzan-password-flow');
 if(code){
  const {data,error}=await supabase.auth.exchangeCodeForSession(code,url.searchParams.has('sb_flow_id')?{flowId:url.searchParams.get('sb_flow_id')!}:undefined);
  if(!error&&data.user?.email&&data.user.email_confirmed_at&&!data.user.is_anonymous){
   const recovery=passwordFlow||(data as typeof data&{redirectType?:string}).redirectType==='recovery';
   return Response.redirect(new URL(recovery?'/account/password':'/',url),303);
  }
 }
 // A bad/old link must not globally sign out valid sessions on other devices.
 return Response.redirect(new URL('/login?mode=recover&error=invalid-link',url),303);
}
