import {createClient} from '../../../lib/supabase/server';
export async function POST(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return new Response('Forbidden',{status:403});const supabase=await createClient();await supabase.auth.signOut();return Response.redirect(new URL('/login',request.url),303);}
