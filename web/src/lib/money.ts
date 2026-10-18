/** All amounts are integer kobo (1 NGN = 100 kobo). */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  return "₦" + naira.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

/** Effective selling price of a variant (sale price wins when set). */
export function effectivePrice(v: { priceKobo: number; salePriceKobo: number | null }): number {
  return v.salePriceKobo ?? v.priceKobo;
}
