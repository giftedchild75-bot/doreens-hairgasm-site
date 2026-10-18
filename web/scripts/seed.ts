import { getDb } from "../src/db/client";
import { seedCatalog } from "../src/server/seed";

const db = await getDb();
const res = await seedCatalog(db);
console.log(res.skipped ? "Catalogue already present — nothing seeded." : `Seeded ${res.products} products from ../config.js`);
process.exit(0);
