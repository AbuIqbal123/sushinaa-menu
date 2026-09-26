"use client";

import type { Tag } from "@/data/types";
import { useLocale } from "@/lib/locale";

export function DietTags({ tags }: { tags: Tag[] }) {
  const { t } = useLocale();
  if (!tags.length) return <div className="tags-spacer" />;
  return (
    <div className="tags">
      {tags.map((tag) => (
        <span key={tag} className={`tag tag-${tag}`}>
          {t[tag]}
        </span>
      ))}
    </div>
  );
}
