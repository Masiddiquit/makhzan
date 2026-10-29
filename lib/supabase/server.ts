import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
export async function createClient(){
 const store=await cookies();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('Makhzan database configuration is missing.');
 return createServerClient(url,key,{cookies:{getAll:()=>store.getAll(),setAll(values){try{for(const {name,value,options} of values)store.set(name,value,options);}catch{/* Proxy persists refreshed cookies for Server Components. */}}}});
}
