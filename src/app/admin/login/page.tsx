import { redirect } from "next/navigation";
import { authenticated } from "@/cms/auth";
import { Login } from "@/components/admin/Login";
export default async function LoginPage() {
  if (await authenticated()) redirect("/admin");
  return <Login />;
}
