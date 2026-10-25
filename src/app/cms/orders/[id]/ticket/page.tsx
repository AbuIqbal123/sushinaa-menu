import { notFound, redirect } from 'next/navigation';
import { currentStaff } from '@/cms/auth';
import { Ticket } from '@/components/order/Ticket';
import { OrderError } from '@/ordering/http';
import { loadTicket } from '@/ordering/printing';
import { ticketModel } from '@/ordering/ticket';

export const dynamic = 'force-dynamic';

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await currentStaff();
  if (!staff) redirect('/admin/login');
  let model;
  try {
    model = ticketModel(await loadTicket(staff.branchScope, (await params).id));
  } catch (error) {
    if (error instanceof OrderError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  return <Ticket model={model} />;
}
