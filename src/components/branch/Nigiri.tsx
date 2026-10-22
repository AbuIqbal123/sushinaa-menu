import type { Nigiri as Kind } from "@/branches/branches";

const SLAB = "M6 44 C9 24 36 14 70 14 C106 14 133 22 136 40 C136 52 118 56 70 54 C26 56 6 56 6 44 Z";

function Rice() {
  return (
    <>
      <ellipse cx="70" cy="80" rx="58" ry="6" fill="#000" opacity=".35" />
      <rect x="16" y="36" width="108" height="42" rx="21" fill="#f6efe0" />
      <path d="M22 66 C46 74 94 74 118 66" stroke="#e3d8c1" strokeWidth="2" fill="none" />
      <g fill="#e6dcc6">
        <ellipse cx="34" cy="70" rx="3" ry="1.6" /><ellipse cx="58" cy="73" rx="3" ry="1.6" />
        <ellipse cx="84" cy="73" rx="3" ry="1.6" /><ellipse cx="106" cy="69" rx="3" ry="1.6" />
      </g>
    </>
  );
}

const TOPPINGS: Record<Kind, React.ReactNode> = {
  salmon: (
    <>
      <path d={SLAB} fill="#f2874a" />
      <g stroke="#fff6ea" strokeOpacity=".75" strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M30 18 C24 30 24 42 30 54" /><path d="M52 15 C46 28 46 42 52 55" /><path d="M76 14 C70 28 70 42 76 54" />
        <path d="M100 16 C94 29 94 42 100 54" /><path d="M121 22 C116 32 116 42 120 52" />
      </g>
    </>
  ),
  tuna: (
    <>
      <path d={SLAB} fill="#b3233a" />
      <path d="M14 44 C30 36 60 32 92 36" stroke="#d24a5e" strokeOpacity=".6" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>
  ),
  ebi: (
    <>
      <path d={SLAB} fill="#f6b08c" />
      <g stroke="#e0552c" strokeWidth="4" fill="none" strokeLinecap="round" strokeOpacity=".8">
        <path d="M28 18 C26 30 26 42 30 54" /><path d="M50 15 C48 28 48 42 52 55" />
        <path d="M74 14 C72 28 72 42 76 54" /><path d="M98 16 C96 29 96 42 100 54" />
      </g>
      <path d="M128 30 L140 18 L144 34 L138 46 Z" fill="#d9472a" />
    </>
  ),
  tamago: (
    <>
      <path d={SLAB} fill="#f4c94e" />
      <path d="M14 44 C40 38 100 38 128 42" stroke="#e0ad2c" strokeWidth="2" fill="none" />
      <path d="M60 13 L82 13 L82 79 L60 79 Z" fill="#1c2a22" />
      <path d="M60 13 L82 13 L82 79 L60 79 Z" fill="none" stroke="#2f4236" strokeWidth="1.2" />
    </>
  ),
};

/** One nigiri piece, drawn inline so the board needs no image requests. */
export function Nigiri({ kind }: { kind: Kind }) {
  return (
    <svg viewBox="0 0 140 84" aria-hidden="true" focusable="false">
      <Rice />
      {TOPPINGS[kind]}
      <path className="bp-sheen" d="M20 30 C40 20 90 18 118 26" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
