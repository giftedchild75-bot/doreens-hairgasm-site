// Minimal local stand-in for the Paystack API + hosted payment page, used only
// by the end-to-end tests. It never touches real money or real Paystack.
import http from "node:http";

const PORT = Number(process.env.MOCK_PAYSTACK_PORT ?? 3199);
const txs = new Map(); // reference -> { amount, email, callback, status }

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { "Content-Type": "application/json", ...headers });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b ? JSON.parse(b) : {})); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "POST" && url.pathname === "/transaction/initialize") {
    if (!String(req.headers.authorization ?? "").startsWith("Bearer sk_test_")) return send(res, 401, { status: false, message: "bad key" });
    const b = await readBody(req);
    txs.set(b.reference, { amount: b.amount, currency: b.currency, email: b.email, callback: b.callback_url, status: "abandoned" });
    return send(res, 200, { status: true, data: { authorization_url: `http://localhost:${PORT}/pay/${b.reference}`, access_code: "mock", reference: b.reference } });
  }
  let m = url.pathname.match(/^\/pay\/(.+)$/);
  if (m) {
    const ref = decodeURIComponent(m[1]);
    const t = txs.get(ref);
    if (!t) return send(res, 404, "unknown");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`<!doctype html><title>Mock Paystack</title><h1>Mock Paystack checkout</h1><p>Amount: ${t.amount} kobo</p>
      <a id="pay-success" href="/complete/${ref}?result=success">Pay successfully</a> <a id="pay-fail" href="/complete/${ref}?result=failed">Decline card</a>`);
  }
  m = url.pathname.match(/^\/complete\/(.+)$/);
  if (m) {
    const ref = decodeURIComponent(m[1]);
    const t = txs.get(ref);
    t.status = url.searchParams.get("result") === "success" ? "success" : "failed";
    res.writeHead(302, { Location: `${t.callback}?trxref=${encodeURIComponent(ref)}&reference=${encodeURIComponent(ref)}` });
    return res.end();
  }
  m = url.pathname.match(/^\/transaction\/verify\/(.+)$/);
  if (m) {
    const ref = decodeURIComponent(m[1]);
    const t = txs.get(ref);
    if (!t) return send(res, 400, { status: false, message: "Transaction reference not found" });
    return send(res, 200, { status: true, data: { id: 1000 + txs.size, status: t.status, reference: ref, amount: t.amount, currency: t.currency ?? "NGN", channel: "card" } });
  }
  if (req.method === "POST" && url.pathname === "/refund") return send(res, 200, { status: true, data: { id: Date.now(), status: "pending" } });
  send(res, 404, { status: false, message: "not found" });
}).listen(PORT, () => console.log(`mock paystack on ${PORT}`));
