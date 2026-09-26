import type { Metadata } from "next";
import { MissingView } from "@/components/DocViews";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This Sushinaa page does not exist. Head back to the QR menu.",
};

export default function NotFound() {
  return <MissingView />;
}
