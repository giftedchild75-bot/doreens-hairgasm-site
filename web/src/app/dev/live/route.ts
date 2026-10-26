import { readFile } from "node:fs/promises";
import path from "node:path";

// Side-by-side desktop + phone viewer, served same-origin so the phone frame can
// follow the desktop frame's navigation. Development only.
export async function GET() {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const html = await readFile(path.join(process.cwd(), "scripts", "live-view.html"), "utf8");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
