import {createClient} from '@supabase/supabase-js';
// Recovery links must work when Gmail opens a different browser. No browser-bound
// PKCE verifier or persisted session is used by this email-only client.
export function createEmailClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('Email authentication configuration is missing.');
 return createClient(url,key,{auth:{flowType:'implicit',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
