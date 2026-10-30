"use client";
import type { ReactNode } from "react";
import { toast, Toaster } from "sonner";

type Notice = {
  tone: "ok" | "error";
  text: string;
  action?: { label: string; onClick: () => void };
};

export function useNotify() {
  return (notice: Notice) => {
    const show = notice.tone === "error" ? toast.error : toast.success;
    show(notice.text, notice.action ? { action: notice.action } : undefined);
  };
}

export function Notices({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" closeButton duration={4000} />
    </>
  );
}
