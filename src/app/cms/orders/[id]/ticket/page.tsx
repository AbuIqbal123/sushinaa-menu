import { notFound, redirect } from 'next/navigation';
import { currentStaff } from '@/cms/auth';
import { Ticket } from '@/components/order/Ticket';
import { OrderError } from '@/ordering/http';
import { loadTicket } from '@/ordering/printing';
import { storedEdits } from '@/ordering/order-edits';
import { ticketModel } from '@/ordering/ticket';

export const dynamic = 'force-dynamic';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await currentStaff();
  if (!staff) redirect('/admin/login');
  let model;
  try {
    const id = (await params).id;
    const row = await loadTicket(staff.branchScope, id);
    model = ticketModel(row, await storedEdits(id));
  } catch (error) {
    if (error instanceof OrderError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  return <Ticket model={model} />;
}
