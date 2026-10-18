/**
 * Creates (or resets the password of) an admin user. The password is read
 * from the ADMIN_PASSWORD env var so it never lands in shell history args.
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME="Doreen" ADMIN_ROLE=owner ADMIN_PASSWORD=… npm run admin:create
 */
import { getDb } from "../src/db/client";
import { adminUsers } from "../src/db/schema";
import { hashPassword, PASSWORD_MIN } from "../src/server/passwords";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || "Owner";
const role = process.env.ADMIN_ROLE === "staff" ? "staff" : "owner";
const password = process.env.ADMIN_PASSWORD ?? "";
if (!email || password.length < PASSWORD_MIN) {
  console.error(`Set ADMIN_EMAIL and ADMIN_PASSWORD (min ${PASSWORD_MIN} chars).`);
  process.exit(1);
}
const db = await getDb();
const passwordHash = await hashPassword(password);
await db
  .insert(adminUsers)
  .values({ email, name, role, passwordHash })
  .onConflictDoUpdate({ target: adminUsers.email, set: { passwordHash, name, role, isActive: true } });
console.log(`Admin ${email} (${role}) ready.`);
process.exit(0);
