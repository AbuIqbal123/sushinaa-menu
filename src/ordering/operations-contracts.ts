import { z } from 'zod';
import { branchId } from './contracts';
import type { BranchId } from '@/branches/branches';

export const operationsQuery = z.object({
  branch: branchId.optional(), period: z.enum(['today','yesterday','7d','30d','custom']).default('today'),
  from: z.iso.date().optional(), to: z.iso.date().optional(),
}).strict().refine(q => q.period !== 'custom' || Boolean(q.from && q.to && q.from <= q.to), 'Choose a valid date range');
export type OperationsQuery = z.infer<typeof operationsQuery>;
export type OperationCounts = { received:number; preparing:number; ready:number; active:number; unprinted:number };
export type Performance = { orders:number; completed:number; cancelled:number; paidSalesMinor:number; unpaidMinor:number; averageMinor:number; prepMinutes:number|null; acceptMinutes:number|null; collectionMinutes:number|null; timedOrders:number };
export type OperationsData = {
  generatedAt:string; range:{from:string;to:string}; counts:OperationCounts; metrics:Performance;
  series:{key:string;orders:number;salesMinor:number}[]; hourly:boolean;
  branches:({id:BranchId}&OperationCounts&{orders:number;salesMinor:number})[];
  popular:{dishId:string;name:string;nameAr:string;quantity:number}[];
  attention:{kind:'received'|'ready'|'unprinted';count:number;oldestAt:string|null}[];
};
