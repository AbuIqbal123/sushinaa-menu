"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DISH_BY_ID, DISHES, type Dish } from "@/data/menu";
import type { Selection } from "@/data/types";
import {
  parseSelection,
  selectionLabel,
  serializeSelection,
  unitPrice,
} from "./price";

const STORAGE_KEY = "sushina-menu-cart-v1";

export type CartLine = {
  key: string;
  dish: Dish;
  sel: Selection;
  qty: number;
  unitQar: number;
  lineTotal: number;
  displayName: string;
  meta: string;
};

type CartValue = {
  add: (id: string, sel: Selection, count?: number) => void;
  inc: (key: string) => void;
  dec: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  itemCount: number;
  lines: CartLine[];
  totalQar: number;
};

const CartContext = createContext<CartValue | null>(null);

function lineKey(id: string, sel: Selection): string {
  const extra = serializeSelection(sel);
  return extra ? `${id}::${extra}` : id;
}

function parseKey(key: string): { id: string; sel: Selection } {
  const i = key.indexOf("::");
  if (i === -1) return { id: key, sel: {} };
  return { id: key.slice(0, i), sel: parseSelection(key.slice(i + 2)) };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        const next: Record<string, number> = {};
        for (const [key, qty] of Object.entries(parsed)) {
          const { id } = parseKey(key);
          if (!DISH_BY_ID[id] || !Number.isInteger(qty) || qty <= 0) continue;
          next[key] = qty;
        }
        setQtys(next);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(qtys));
  }, [qtys, ready]);

  const add = useCallback((id: string, sel: Selection, count = 1) => {
    const n = Math.max(1, Math.floor(count));
    const key = lineKey(id, sel);
    setQtys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + n }));
  }, []);

  const inc = useCallback((key: string) => {
    setQtys((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }, []);

  const dec = useCallback((key: string) => {
    setQtys((prev) => {
      const current = prev[key] ?? 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: current - 1 };
    });
  }, []);

  const remove = useCallback((key: string) => {
    setQtys((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clear = useCallback(() => setQtys({}), []);

  const lines = useMemo<CartLine[]>(() => {
    const order = new Map<string, number>();
    DISHES.forEach((dish, i) => order.set(dish.id, i));
    return Object.entries(qtys)
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => {
        const ia = order.get(parseKey(a[0]).id) ?? 99;
        const ib = order.get(parseKey(b[0]).id) ?? 99;
        return ia - ib || a[0].localeCompare(b[0]);
      })
      .flatMap(([key, qty]) => {
        const { id, sel } = parseKey(key);
        const dish = DISH_BY_ID[id];
        if (!dish) return [];
        const unitQar = unitPrice(dish, sel);
        const meta = selectionLabel(dish, sel);
        return [
          {
            key,
            dish,
            sel,
            qty,
            unitQar,
            lineTotal: unitQar * qty,
            displayName: dish.name,
            meta,
          },
        ];
      });
  }, [qtys]);

  const itemCount = useMemo(
    () => Object.values(qtys).reduce((sum, n) => sum + n, 0),
    [qtys],
  );

  const totalQar = useMemo(
    () => lines.reduce((sum, line) => sum + line.lineTotal, 0),
    [lines],
  );

  const value = useMemo(
    () => ({ add, inc, dec, remove, clear, itemCount, lines, totalQar }),
    [add, inc, dec, remove, clear, itemCount, lines, totalQar],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
