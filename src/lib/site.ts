export function waLink(phone:string,text?:string){const base=`https://wa.me/${phone}`;return text?`${base}?text=${encodeURIComponent(text)}`:base;}
