import type { Dish } from "@/catalog/types";
import type { Category, MenuData } from "@/cms/schema";
export type Lang="en"|"ar";
export function pickName(item:{name:string;nameAr?:string},lang:Lang){return lang==='ar'&&item.nameAr?item.nameAr:item.name;}
export function dishDescription(dish:Pick<Dish,'description'|'descriptionAr'>,lang:Lang){return lang==='ar'&&dish.descriptionAr?dish.descriptionAr:dish.description;}
export function sectionName(id:string,lang:Lang,categories:Category[]){const c=categories.find(c=>c.id===id);return c?pickName(c,lang):id;}
export function fieldLabel(label:string,lang:Lang,fields:MenuData['fields']){const f=fields[label];return f?pickName(f,lang):label;}
