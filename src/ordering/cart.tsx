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
import type { Dish, Selection } from "@/catalog/types";
import { useMenu } from "@/cms/context";
import { useLocale } from "@/i18n/locale";
import { pickName } from "@/i18n/localize";
import {
  parseSelection,
  isSelectionComplete,
  selectionLabel,
  serializeSelection,
  unitPrice,
} from "./price";

const STORAGE_KEY = "sushina-menu-cart-v1";

type StoredCart = {
  lines: Record<string, number>;
};

function emptyStored(): StoredCart {
  return { lines: {} };
}

function readStored(raw: string, DISH_BY_ID: Record<string, Dish>): StoredCart {
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
  return { lines };
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
  note: string;
};

type CartValue = {
  add: (id: string, sel: Selection, count?: number, note?: string) => void;
  inc: (key: string) => void;
  dec: (key: string) => void;
  clear: () => void;
  itemCount: number;
  lines: CartLine[];
  totalQar: number;
};

const CartContext = createContext<CartValue | null>(null);

function lineKey(id: string, sel: Selection, note: string): string {
  const extra = serializeSelection(sel);
  const base = extra ? `${id}::${extra}` : id;
  return note ? `${base}::note=${encodeURIComponent(note)}` : base;
}

function parseKey(key: string): { id: string; sel: Selection; note: string } {
  const noteIndex = key.indexOf("::note=");
  let note = "";
  if (noteIndex >= 0) {
    try { note = decodeURIComponent(key.slice(noteIndex + 7)).slice(0, 400); } catch { /* ignore malformed note */ }
    key = key.slice(0, noteIndex);
  }
  const i = key.indexOf("::");
  if (i === -1) return { id: key, sel: {}, note };
  return { id: key.slice(0, i), sel: parseSelection(key.slice(i + 2)), note };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { lang, t } = useLocale();
  const { dishes: DISHES } = useMenu();
  const DISH_BY_ID = useMemo(() => Object.fromEntries(DISHES.map((d) => [d.id, d])), [DISHES]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  // Hydrate browser storage only after SSR has mounted.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = readStored(raw, DISH_BY_ID);
        setQtys(stored.lines);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [DISH_BY_ID]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready) return;
    const payload: StoredCart = { lines: qtys };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch { /* storage may be unavailable */ }
  }, [qtys, ready]);

  const add = useCallback((id: string, sel: Selection, count = 1, note = "") => {
    const n = Math.max(1, Math.floor(count));
    const key = lineKey(id, sel, note.trim().slice(0, 400));
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

  const clear = useCallback(() => {
    setQtys({});
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
        const { id, sel, note } = parseKey(key);
        const dish = DISH_BY_ID[id];
        if (!dish || !isSelectionComplete(dish, sel)) return [];
        const unitQar = unitPrice(dish, sel);
        const meta = selectionLabel(dish, sel, lang, t);
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
            note,
          },
        ];
      });
  }, [qtys, lang, DISHES, DISH_BY_ID, t]);

  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty, 0),
    [lines],
  );

  const totalQar = useMemo(
    () => lines.reduce((sum, line) => sum + line.lineTotal, 0),
    [lines],
  );

  const value = useMemo(
    () => ({ add, inc, dec, clear, itemCount, lines, totalQar }),
    [add, inc, dec, clear, itemCount, lines, totalQar],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
