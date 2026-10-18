import { getDb } from "../src/db/client";
import { seedCatalog } from "../src/server/seed";
import { STORE_CATALOG } from "../src/catalog/store-catalog";

const db = await getDb();
const res = await seedCatalog(db, STORE_CATALOG);
console.log(
  res.skipped
    ? "Catalogue already present — nothing seeded."
    : `Seeded ${res.products} products (${res.drafts} hidden as drafts until photos are uploaded).`,
);
process.exit(0);
