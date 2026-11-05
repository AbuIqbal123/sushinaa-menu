import { requireStaff, reply, failure } from '@/ordering/http';
import { operationsQuery } from '@/ordering/operations-contracts';
import { operations } from '@/ordering/operations';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{const staff=await requireStaff(undefined,'orders');const query=operationsQuery.parse(Object.fromEntries(new URL(request.url).searchParams));return reply(await operations(staff.branchScope,query));}
  catch(error){return failure(error);}
}
