import type { Nigiri as Kind } from "@/branches/branches";

const SRC: Record<Kind, string> = {
  salmon: "/branch/salmon.webp",
  tuna: "/branch/tuna.webp",
  ebi: "/branch/ebi.webp",
  tamago: "/branch/tamago.webp",
};

/** One sushi piece per branch. Chopstick pick targets the wrapping `.bp-piece`. */
export function Nigiri({ kind }: { kind: Kind }) {
  return (
    <>
      <img src={SRC[kind]} alt="" draggable={false} width={150} height={150} />
      <span className="bp-sheen" aria-hidden="true" />
    </>
  );
}
