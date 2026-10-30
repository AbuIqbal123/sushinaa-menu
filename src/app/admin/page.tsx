import { redirect } from "next/navigation";
import { currentStaff } from "@/cms/auth";
import { readMenu } from "@/cms/repository";
import { Admin } from "@/components/admin/Admin";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const staff = await currentStaff();
  if (!staff) redirect("/admin/login");
  return <Admin initial={await readMenu()} role={staff.role} />;
}
