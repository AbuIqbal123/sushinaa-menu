"use client";

import type { Tag } from "@/catalog/types";
import { useLocale } from "@/i18n/locale";

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
