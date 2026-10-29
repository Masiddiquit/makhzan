import {warehouseSession} from '../../../lib/auth';
import {emptyState,apply} from '../../../lib/warehouse.mjs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){try{const {supabase,user}=await warehouseSession();if(!user)return reply({error:'Sign in to your Makhzan account.'},401);const {data,error}=await supabase.from('warehouse').select('revision,data,updated_at').eq('owner_id',user.id).maybeSingle();if(error)return reply({error:'Warehouse storage is unavailable. Please retry.'},503);return reply({state:data?.data||emptyState(),revision:data?.revision||0,updatedAt:data?.updated_at||null});}catch{return reply({error:'Warehouse storage is unavailable. Please retry.'},503);}}
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'Cross-origin writes are not allowed.'},403);
 if(!request.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON is required.'},415);
 try{
  const {supabase,user}=await warehouseSession();if(!user)return reply({error:'Sign in is required.'},401);
  let body;try{const raw=await request.text();if(raw.length>100000)return reply({error:'Request is too large.'},413);body=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
  if(!Number.isSafeInteger(body?.revision)||body.revision<0||!body.action||typeof body.action.type!=='string')return reply({error:'Invalid revision or operation.'},400);
  const {data:row,error:readError}=await supabase.from('warehouse').select('revision,data').eq('owner_id',user.id).maybeSingle();
  if(readError)return reply({error:'Unable to read warehouse storage.'},503);
  if((row?.revision||0)!==body.revision)return reply({error:'Records changed in another tab. Refresh and retry.'},409);
  let state;try{state=apply(row?.data||emptyState(),body.action);}catch(e){return reply({error:e instanceof Error?e.message:'Invalid operation.'},400);}
  const {data:result,error}=await supabase.rpc('save_warehouse',{expected_revision:body.revision,new_data:state});
  if(error){if(error.code==='40001'||error.message.includes('revision_conflict'))return reply({error:'Another tab saved first. Refresh and retry; nothing was overwritten.'},409);return reply({error:'The change was not saved. Refresh before retrying.'},503);}
  const saved=Array.isArray(result)?result[0]:result;
  return reply({state,revision:saved.revision,updatedAt:saved.updated_at});
 }catch{return reply({error:'The change was not saved. Refresh before retrying.'},503);}
}
