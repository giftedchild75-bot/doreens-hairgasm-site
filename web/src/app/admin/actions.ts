"use server";
/**
 * Admin server actions. Each one authenticates the caller first (requireAdmin),
 * then delegates to src/server/admin.ts, which validates input and writes the
 * audit trail. Owner-only actions: refunds, coupons, delivery fees, settings.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { getDb } from "@/db/client";
import { adminUsers, products } from "@/db/schema";
import { clientIp, requireAdmin, signInAdmin, signOut } from "@/server/auth";
import { verifyPassword } from "@/server/passwords";
import { rateLimit } from "@/server/ratelimit";
import { audit } from "@/server/audit";
import * as admin from "@/server/admin";
import { staffUpdateStatus, type OrderStatus } from "@/server/orders";
import { requestRefund } from "@/server/payments";
import { storeProductImage } from "@/server/storage";
import type { ActionState } from "@/components/ActionForm";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const obj = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, typeof v === "string" ? v : ""]));

// requireAdmin() redirects unauthenticated callers by throwing; it is always called
// OUTSIDE try/catch so that redirect is never swallowed as an error message.
const OWNER_ONLY: ActionState = { error: "Only the store owner can do this." };

function fail(err: unknown): ActionState {
  if (err instanceof ZodError) {
    const i = err.issues[0];
    return { error: `${i?.path.join(".") || "Input"}: ${i?.message ?? "invalid"}` };
  }
  return { error: err instanceof Error ? err.message : "Something went wrong" };
}

// ---------------------------------------------------------------- session

export async function adminLoginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const db = await getDb();
  if (!(await rateLimit(db, `admin-login:${await clientIp()}`, 5, 900))) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }
  const email = s(fd, "email").trim().toLowerCase();
  const [a] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  const ok = await verifyPassword(s(fd, "password"), a?.passwordHash ?? `scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$${Buffer.alloc(64).toString("base64")}`);
  if (!a || !ok || !a.isActive) {
    await audit(db, null, "admin.login_failed", "admin", a?.id ?? null, { email });
    return { error: "Email or password is incorrect." };
  }
  await signInAdmin(a.id);
  await audit(db, a.id, "admin.login", "admin", a.id);
  redirect("/admin");
}

export async function adminLogoutAction() {
  await signOut("admin");
  redirect("/admin/login");
}

// ---------------------------------------------------------------- products

export async function saveProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  const id = s(fd, "id") || null;
  let saved;
  try {
    saved = await admin.saveProduct(await getDb(), a.id, id, { ...obj(fd), isFeatured: fd.get("isFeatured") === "on" });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/products/${saved.id}`);
  return { ok: "Product saved." };
}

export async function saveVariantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  try {
    await admin.saveVariant(await getDb(), a.id, s(fd, "productId"), s(fd, "variantId") || null, {
      ...obj(fd), trackStock: fd.get("trackStock") === "on", isActive: fd.get("isActive") === "on",
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: "Option saved." };
}

export async function adjustStockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  try {
    await admin.adjustStock(await getDb(), a.id, s(fd, "variantId"), parseInt(s(fd, "delta"), 10), s(fd, "note"));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: "Stock updated." };
}

export async function uploadImageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  const productId = s(fd, "productId");
  const file = fd.get("file");
  if (!(file instanceof File)) return { error: "Choose an image" };
  try {
    const db = await getDb();
    const [p] = await db.select({ slug: products.slug, name: products.name }).from(products).where(eq(products.id, productId)).limit(1);
    if (!p) return { error: "Product not found" };
    const url = await storeProductImage(file, p.slug);
    await admin.addImage(db, a.id, productId, url, s(fd, "alt") || p.name);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: "Image uploaded." };
}

export async function moveImageAction(fd: FormData) {
  const a = await requireAdmin();
  await admin.moveImage(await getDb(), a.id, s(fd, "imageId"), s(fd, "dir") === "up" ? -1 : 1);
  revalidatePath("/", "layout");
}

export async function removeImageAction(fd: FormData) {
  const a = await requireAdmin();
  await admin.removeImage(await getDb(), a.id, s(fd, "imageId"));
  revalidatePath("/", "layout");
}

export async function saveCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  try {
    await admin.saveCategory(await getDb(), a.id, s(fd, "id") || null, { ...obj(fd), isVisible: fd.get("isVisible") === "on" });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: "Category saved." };
}

// ---------------------------------------------------------------- orders

export async function updateOrderStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  try {
    await staffUpdateStatus(await getDb(), s(fd, "orderId"), s(fd, "to") as OrderStatus, a.id, {
      trackingNumber: s(fd, "trackingNumber"),
      carrier: s(fd, "carrier"),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin", "layout");
  return { ok: "Order updated." };
}

export async function refundAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  if (a.role !== "owner") return OWNER_ONLY;
  const amount = Number(s(fd, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a refund amount in naira" };
  if (fd.get("confirm") !== "on") return { error: "Tick the confirmation box — refunds send real money back." };
  try {
    await requestRefund(await getDb(), {
      orderId: s(fd, "orderId"),
      amountKobo: Math.round(amount * 100),
      reason: s(fd, "reason").slice(0, 300) || "Refund",
      restock: fd.get("restock") === "on",
      actorAdminId: a.id,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin", "layout");
  return { ok: "Refund requested from Paystack. The order updates automatically when Paystack confirms it." };
}

export async function resolveAttentionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  const note = s(fd, "note").trim();
  if (note.length < 3) return { error: "Describe how it was resolved" };
  await admin.resolveAttention(await getDb(), a.id, s(fd, "orderId"), note);
  revalidatePath("/admin", "layout");
  return { ok: "Marked as resolved." };
}

// ---------------------------------------------------------------- owner settings

export async function saveCouponAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  if (a.role !== "owner") return OWNER_ONLY;
  try {
    await admin.saveCoupon(await getDb(), a.id, s(fd, "id") || null, {
      ...obj(fd),
      isActive: fd.get("isActive") === "on",
      productIds: fd.getAll("productIds").map(String).filter(Boolean),
      categoryIds: fd.getAll("categoryIds").map(String).filter(Boolean),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/coupons");
  return { ok: "Discount code saved." };
}

export async function saveShippingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  if (a.role !== "owner") return OWNER_ONLY;
  try {
    await admin.saveShipping(await getDb(), a.id, s(fd, "id") || null, { ...obj(fd), isActive: fd.get("isActive") === "on" });
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/admin/shipping");
  return { ok: "Delivery method saved." };
}

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const a = await requireAdmin();
  if (a.role !== "owner") return OWNER_ONLY;
  try {
    await admin.saveSettings(await getDb(), a.id, obj(fd));
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}
