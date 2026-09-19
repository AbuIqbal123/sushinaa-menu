import type { Tag } from "@/data/types";

const LABEL: Record<Tag, string> = {
  veg: "Veg",
  spicy: "Spicy",
  seafood: "Seafood",
};

export function DietTags({ tags }: { tags: Tag[] }) {
  if (!tags.length) return <div className="tags-spacer" />;
  return (
    <div className="tags">
      {tags.map((tag) => (
        <span key={tag} className={`tag tag-${tag}`}>
          {LABEL[tag]}
        </span>
      ))}
    </div>
  );
}
