// Headless screenshot capture using direct chromium spawn.
// Logs in via the local-password API, then loads each route with the cookie.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import fetch from "node-fetch";

const BASE = "http://localhost:3000";
const accounts = [
  { role: "admin",     email: "admin@iosky.local",     password: "IOSky-Admin-2026!" },
  { role: "client",    email: "client@iosky.local",    password: "IOSky-Client-2026!" },
  { role: "developer", email: "developer@iosky.local", password: "IOSky-Developer-2026!" },
];

async function loginCookie(acc) {
  const res = await fetch(`${BASE}/api/auth/local/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: acc.email, password: acc.password }),
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const m = setCookie.match(/app_session_id=([^;]+)/);
  if (!m) throw new Error(`No cookie for ${acc.email}: ${setCookie}`);
  return m[1];
}

function snap(url, outFile, cookie) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--no-sandbox",
      "--hide-scrollbars",
      "--disable-gpu",
      "--window-size=1280,900",
      `--screenshot=${outFile}`,
      `--virtual-time-budget=4000`,
      url,
    ];
    // chromium does not accept arbitrary cookies via CLI; we'll use a tiny html shim that sets a cookie via fetch.
    // Instead use --user-data-dir with a pre-seeded cookie file.
    const env = { ...process.env, IO_SKY_COOKIE: cookie };
    const p = spawn("chromium", args, { env, stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("chromium exit " + code))));
  });
}

const targets = {
  admin: [
    ["/admin/bookings", "admin-bookings"],
    ["/admin/booking-availability", "admin-availability"],
  ],
  client: [
    ["/client-portal", "client-overview"],
  ],
  developer: [
    ["/developer-workspace", "developer-overview"],
  ],
};

(async () => {
  for (const acc of accounts) {
    const cookie = await loginCookie(acc);
    console.log(`logged in as ${acc.email}, cookie len=${cookie.length}`);
    // write a Netscape cookie file readable to chromium via user-data-dir? Too brittle.
    // Use puppeteer-core via npx as a fallback? Skipping — we use direct fetch + auto-page screenshots via Manus browser tool.
  }
})();
