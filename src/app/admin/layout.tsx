import "./admin.css";
import { Notices } from "@/components/admin/Notices";
export const metadata = {
  title: "Menu administration",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin" dir="ltr">
      <Notices>{children}</Notices>
    </div>
  );
}
