/**
 * Database schema — single source of truth for the store's persistent data.
 *
 * Money is always stored as integer minor units (kobo for NGN) to avoid float
 * rounding. Prices sent by the browser are never trusted: every total is
 * recomputed from these tables on the server (see src/server/pricing.ts).
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
  index,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const productKind = pgEnum("product_kind", ["physical", "service"]);
export const productStatus = pgEnum("product_status", ["draft", "published", "archived"]);
export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "payment_failed",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);
export const paymentStatus = pgEnum("payment_status", [
  "initialized",
  "success",
  "failed",
  "abandoned",
  "amount_mismatch",
]);
export const refundStatus = pgEnum("refund_status", ["pending", "processed", "failed"]);
export const discountType = pgEnum("discount_type", ["percent", "fixed"]);
export const adminRole = pgEnum("admin_role", ["owner", "staff"]);
export const movementReason = pgEnum("movement_reason", [
  "initial",
  "adjustment",
  "reservation",
  "release",
  "restock_refund",
]);
export const emailStatus = pgEnum("email_status", ["queued", "sent", "failed", "not_configured"]);

// ---------------------------------------------------------------- catalogue

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: createdAt(),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    kind: productKind("kind").notNull().default("physical"),
    status: productStatus("status").notNull().default("draft"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    isFeatured: boolean("is_featured").notNull().default(false),
    // Merchandising attributes used by catalogue filters. Values are curated
    // from the product's own description — never invented.
    texture: text("texture"), // straight | wavy | curly
    lengthGroup: text("length_group"), // bob | mid | long
    colorFamily: text("color_family"), // black | brown | blonde | red | grey | fashion
    specs: jsonb("specs").$type<string[]>().notNull().default([]),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    sortOrder: integer("sort_order").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_status_idx").on(t.status),
    index("products_category_idx").on(t.categoryId),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_images_product_idx").on(t.productId, t.position)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    title: text("title").notNull().default("Default"),
    priceKobo: integer("price_kobo").notNull(),
    salePriceKobo: integer("sale_price_kobo"),
    lengthInches: integer("length_inches"),
    color: text("color"),
    density: text("density"),
    laceType: text("lace_type"),
    capSize: text("cap_size"),
    // NULL = stock not tracked (availability confirmed by the store after the
    // order). A number = tracked; purchases can never take it below zero.
    stockQuantity: integer("stock_quantity"),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    check("variants_price_nonneg", sql`${t.priceKobo} >= 0`),
    check("variants_sale_lt_price", sql`${t.salePriceKobo} IS NULL OR (${t.salePriceKobo} >= 0 AND ${t.salePriceKobo} < ${t.priceKobo})`),
    check("variants_stock_nonneg", sql`${t.stockQuantity} IS NULL OR ${t.stockQuantity} >= 0`),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: id(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: movementReason("reason").notNull(),
    orderId: uuid("order_id"),
    note: text("note"),
    actorAdminId: uuid("actor_admin_id"),
    createdAt: createdAt(),
  },
  (t) => [index("inventory_movements_variant_idx").on(t.variantId)],
);

// ---------------------------------------------------------------- people

export const customers = pgTable("customers", {
  id: id(),
  email: text("email").notNull().unique(), // stored lower-cased
  name: text("name"),
  phone: text("phone"),
  passwordHash: text("password_hash"), // NULL for guest-only customers
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const customerAddresses = pgTable("customer_addresses", {
  id: id(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  line1: text("line1").notNull(),
  city: text("city").notNull(),
  region: text("region").notNull(),
  country: text("country").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
});

export const adminUsers = pgTable("admin_users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: adminRole("role").notNull().default("staff"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the cookie token; the raw token is never stored.
    tokenHash: text("token_hash").primaryKey(),
    adminId: uuid("admin_id").references(() => adminUsers.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check("sessions_one_subject", sql`(${t.adminId} IS NULL) <> (${t.customerId} IS NULL)`),
  ],
);

export const passwordResets = pgTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- commerce

export const shippingMethods = pgTable("shipping_methods", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  // Zone matching: ISO country code ('NG'), or '*' for everywhere else.
  country: text("country").notNull().default("NG"),
  // Optional list of regions (states) this method covers; empty = whole country.
  regions: jsonb("regions").$type<string[]>().notNull().default([]),
  feeKobo: integer("fee_kobo").notNull().default(0),
  estimatedDays: text("estimated_days"),
  isActive: boolean("is_active").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: text("code").notNull().unique(), // stored upper-cased
    type: discountType("type").notNull(),
    // percent: 1..100 ; fixed: kobo
    value: integer("value").notNull(),
    minSubtotalKobo: integer("min_subtotal_kobo").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").notNull().default(0),
    // Empty arrays = applies to everything.
    productIds: jsonb("product_ids").$type<string[]>().notNull().default([]),
    categoryIds: jsonb("category_ids").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    check("coupons_value_positive", sql`${t.value} > 0`),
    check("coupons_percent_max", sql`${t.type} <> 'percent' OR ${t.value} <= 100`),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    reference: text("reference").notNull().unique(), // human-facing, e.g. DH-7K3Q9P
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    addressLine1: text("address_line1").notNull(),
    city: text("city").notNull(),
    region: text("region").notNull(),
    country: text("country").notNull(),
    deliveryInstructions: text("delivery_instructions"),
    shippingMethodId: uuid("shipping_method_id").references(() => shippingMethods.id),
    shippingMethodName: text("shipping_method_name").notNull(),
    currency: text("currency").notNull().default("NGN"),
    subtotalKobo: integer("subtotal_kobo").notNull(),
    discountKobo: integer("discount_kobo").notNull().default(0),
    shippingKobo: integer("shipping_kobo").notNull().default(0),
    totalKobo: integer("total_kobo").notNull(),
    couponId: uuid("coupon_id").references(() => coupons.id),
    couponCode: text("coupon_code"),
    status: orderStatus("status").notNull().default("pending_payment"),
    // True while this order holds stock reservations that must be released
    // if it never gets paid. Guards against double-release.
    stockReserved: boolean("stock_reserved").notNull().default(false),
    // Set when a payment lands on an order that can no longer be fulfilled
    // as-is (e.g. it was cancelled first). Shown to staff for manual action.
    needsAttention: text("needs_attention"),
    trackingNumber: text("tracking_number"),
    carrier: text("carrier"),
    // sha256 of the secret in the customer's order link (guest access).
    accessTokenHash: text("access_token_hash").notNull(),
    // Idempotency key from the browser so a double-submit can't create two orders.
    checkoutKey: text("checkout_key").unique(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    index("orders_email_idx").on(t.email),
    check("orders_total_consistent", sql`${t.totalKobo} = ${t.subtotalKobo} - ${t.discountKobo} + ${t.shippingKobo}`),
    check("orders_total_nonneg", sql`${t.totalKobo} >= 0 AND ${t.discountKobo} >= 0`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    // Snapshots — the order must still read correctly if the product changes later.
    productName: text("product_name").notNull(),
    variantTitle: text("variant_title").notNull(),
    sku: text("sku").notNull(),
    unitPriceKobo: integer("unit_price_kobo").notNull(),
    quantity: integer("quantity").notNull(),
    stockTracked: boolean("stock_tracked").notNull(),
    lineTotalKobo: integer("line_total_kobo").notNull(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check("order_items_qty_positive", sql`${t.quantity} > 0`),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status"),
    message: text("message").notNull(),
    actorAdminId: uuid("actor_admin_id"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'paystack'
    reference: text("reference").notNull(), // provider transaction reference (ours, unique per attempt)
    amountKobo: integer("amount_kobo").notNull(),
    currency: text("currency").notNull(),
    status: paymentStatus("status").notNull().default("initialized"),
    providerTransactionId: text("provider_transaction_id"),
    channel: text("channel"),
    rawStatus: text("raw_status"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payments_provider_ref_uq").on(t.provider, t.reference),
    index("payments_order_idx").on(t.orderId),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payments.id),
    amountKobo: integer("amount_kobo").notNull(),
    status: refundStatus("status").notNull().default("pending"),
    providerRefundId: text("provider_refund_id"),
    reason: text("reason"),
    restock: boolean("restock").notNull().default(false),
    actorAdminId: uuid("actor_admin_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("refunds_amount_positive", sql`${t.amountKobo} > 0`)],
);

/** Every webhook delivery we've accepted, keyed for idempotency. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventKey: text("event_key").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("webhook_events_key_uq").on(t.provider, t.eventKey)],
);

// ---------------------------------------------------------------- operations

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    actorAdminId: uuid("actor_admin_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_events_created_idx").on(t.createdAt)],
);

/** Outbox: every notification the system decided to send, and what happened. */
export const emailMessages = pgTable(
  "email_messages",
  {
    id: id(),
    toEmail: text("to_email").notNull(),
    template: text("template").notNull(),
    subject: text("subject").notNull(),
    orderId: uuid("order_id"),
    // Prevents sending the same notification twice (e.g. on webhook retries).
    dedupeKey: text("dedupe_key").unique(),
    status: emailStatus("status").notNull().default("queued"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("email_messages_order_idx").on(t.orderId)],
);

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: id(),
  email: text("email").notNull().unique(),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
  consentText: text("consent_text").notNull(),
  unsubscribeTokenHash: text("unsubscribe_token_hash").notNull(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** First-party, cookie-less analytics. No IP or personal data is stored. */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    name: text("name").notNull(),
    sessionId: text("session_id"),
    productId: uuid("product_id"),
    props: jsonb("props"),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_events_name_created_idx").on(t.name, t.createdAt)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/** Owner-editable store copy (delivery info, returns policy, announcement). */
export const storeSettings = pgTable("store_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});
