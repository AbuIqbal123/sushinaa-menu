import { redirect } from "next/navigation";
import { authenticated } from "@/cms/auth";
import { readMenu } from "@/cms/repository";
import { Admin } from "@/components/admin/Admin";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  if (!(await authenticated())) redirect("/admin/login");
  return <Admin initial={await readMenu()} />;
}
