"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { MenuData } from "./schema";
const Context = createContext<MenuData | null>(null);
export function MenuProvider({
  menu,
  children,
}: {
  menu: MenuData;
  children: ReactNode;
}) {
  return <Context.Provider value={menu}>{children}</Context.Provider>;
}
export function useMenu() {
  const m = useContext(Context);
  if (!m) throw new Error("MenuProvider is required");
  return m;
}
