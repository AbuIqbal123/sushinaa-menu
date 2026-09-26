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
import { useLocale } from "./locale";
import { pickName } from "./localize";
import {
  parseSelection,
  selectionLabel,
  serializeSelection,
  unitPrice,
} from "./price";

const STORAGE_KEY = "sushina-menu-cart-v1";

type StoredCart = {
  lines: Record<string, number>;
  comment: string;
};

function emptyStored(): StoredCart {
  return { lines: {}, comment: "" };
}

function readStored(raw: string): StoredCart {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") return emptyStored();
  const record = parsed as { lines?: unknown; comment?: unknown };
  const source =
    record.lines && typeof record.lines === "object"
      ? (record.lines as Record<string, unknown>)
      : (parsed as Record<string, unknown>);
  const lines: Record<string, number> = {};
  for (const [key, qty] of Object.entries(source)) {
    if (key === "lines" || key === "comment") continue;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty <= 0) continue;
    const { id } = parseKey(key);
    if (!DISH_BY_ID[id]) continue;
    lines[key] = qty;
  }
  const comment = typeof record.comment === "string" ? record.comment.slice(0, 400) : "";
  return { lines, comment };
}

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
  comment: string;
  setComment: (value: string) => void;
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
  const { lang } = useLocale();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [comment, setCommentState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = readStored(raw);
        setQtys(stored.lines);
        setCommentState(stored.comment);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: StoredCart = { lines: qtys, comment };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [qtys, comment, ready]);

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

  const clear = useCallback(() => {
    setQtys({});
    setCommentState("");
  }, []);

  const setComment = useCallback((value: string) => {
    setCommentState(value.slice(0, 400));
  }, []);

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
        const meta = selectionLabel(dish, sel, lang);
        return [
          {
            key,
            dish,
            sel,
            qty,
            unitQar,
            lineTotal: unitQar * qty,
            displayName: pickName(dish, lang),
            meta,
          },
        ];
      });
  }, [qtys, lang]);

  const itemCount = useMemo(
    () => Object.values(qtys).reduce((sum, n) => sum + n, 0),
    [qtys],
  );

  const totalQar = useMemo(
    () => lines.reduce((sum, line) => sum + line.lineTotal, 0),
    [lines],
  );

  const value = useMemo(
    () => ({ add, inc, dec, remove, clear, comment, setComment, itemCount, lines, totalQar }),
    [add, inc, dec, remove, clear, comment, setComment, itemCount, lines, totalQar],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
