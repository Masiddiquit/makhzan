import {createClient} from '../../../lib/supabase/server';
import {isOwner} from '../../../lib/auth';
export async function GET(request:Request){const url=new URL(request.url),code=url.searchParams.get('code'),supabase=await createClient();
 if(code){const {data,error}=await supabase.auth.exchangeCodeForSession(code);if(!error&&isOwner(data.user?.email))return Response.redirect(new URL('/',url),303);}
 await supabase.auth.signOut();return Response.redirect(new URL('/login?error=invalid-link',url),303);
}
