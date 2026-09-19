export const SITE = {
  name: "Sushinaa",
  nameAr: "سوشينا",
  tagline: "Let the good times roll",
  url: "https://sushinaa-menu.vercel.app",
  whatsappE164: "97455075933",
  whatsappDisplay: "+974 5507 5933",
  instagram: "https://www.instagram.com/sushinaa_qtr",
  instagramHandle: "@sushinaa_qtr",
  country: "Qatar",
  founded: "2015",
  areas: ["The Downtown", "Aspire Park", "Al Khor", "Sealine", "Nuaija"],
  addressLine: "Doha, Qatar — delivery across The Downtown, Aspire Park, Al Khor, Sealine, and Nuaija",
} as const;

export function waLink(text?: string) {
  const base = `https://wa.me/${SITE.whatsappE164}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
