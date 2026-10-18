import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { categories } from "@/db/schema";
import { ProductForm } from "../ProductForm";

export default async function NewProduct() {
  const cats = await (await getDb()).select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder));
  return (
    <>
      <h1>New product</h1>
      <p className="muted">New products start as drafts. Add at least one option (price) and a photo, then publish.</p>
      <div className="panel"><ProductForm p={null} categories={cats} /></div>
    </>
  );
}
