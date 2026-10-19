// Crawls a running preview build (PREVIEW_BASE_PATH set) and writes a static
// copy for GitHub Pages. Browsing works; anything needing the server
// (checkout, sign-in, admin, filters) does not.
//
//   node scripts/static-preview.mjs <origin> <basePath> <outDir>
import { mkdir, writeFile, cp } from "node:fs/promises";
import path from "node:path";

const [origin, base, outDir] = process.argv.slice(2);
const SKIP = [/^\/api\//, /^\/admin/, /^\/checkout/, /^\/orders?\//, /^\/account\/(?!login|register)/];

const queue = [base, `${base}/account/login`, `${base}/account/register`];
const seen = new Set(queue);
const write = async (rel, body) => {
  const file = path.join(outDir, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
};

while (queue.length) {
  const url = queue.shift();
  const res = await fetch(origin + url, { redirect: "manual" });
  if (res.status !== 200 || !res.headers.get("content-type")?.includes("text/html")) {
    console.log(res.status, url);
    continue;
  }
  // next/image leaves public-folder paths without the basePath.
  const html = (await res.text()).replace(/(["(]|\\")\/assets\//g,`$1${base}/assets/`);
  const local = url.slice(base.length).replace(/\/$/, "");
  await write(path.join(local, "index.html"), html);
  console.log("ok ", url);

  for (const m of html.matchAll(/href="([^"#?]+)/g)) {
    const href = m[1];
    if (!(href === base || href.startsWith(`${base}/`)) || /\.\w{2,5}$/.test(href)) continue;
    if (SKIP.some((re) => re.test(href.slice(base.length)))) continue;
    if (!seen.has(href)) { seen.add(href); queue.push(href); }
  }
}

const notFound = await fetch(`${origin}${base}/__missing__`);
await write("404.html", await notFound.text());
await cp(".next-preview/static", path.join(outDir, "_next/static"), { recursive: true });
await cp("public", outDir, { recursive: true });
await write(".nojekyll", "");
console.log(`pages: ${seen.size}`);
