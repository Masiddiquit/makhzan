import {createClient} from '../../../lib/supabase/server';
export async function GET(request:Request){const url=new URL(request.url),code=url.searchParams.get('code'),supabase=await createClient();
 if(code){const {data,error}=await supabase.auth.exchangeCodeForSession(code);if(!error&&data.user?.email&&data.user.email_confirmed_at&&!data.user.is_anonymous)return Response.redirect(new URL('/',url),303);}
 await supabase.auth.signOut();return Response.redirect(new URL('/login?error=invalid-link',url),303);
}
