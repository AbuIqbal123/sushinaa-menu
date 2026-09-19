import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This Sushinaa page does not exist. Head back to the QR menu.",
};

export default function NotFound() {
  return (
    <LegalShell title="This roll is missing">
      <p>That link is not on the menu.</p>
      <p>
        <Link className="doc-cta" href="/">
          Back to the menu
        </Link>
      </p>
    </LegalShell>
  );
}
