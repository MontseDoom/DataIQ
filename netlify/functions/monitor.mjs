import { schedule } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const SITE_URL   = "https://dataiq.mx/";
const SITE_NAME  = "dataiq.mx";
const WHATSAPP   = [
  { phone: "5215529217633", apikey: "1923440" },
  { phone: "5215515102746", apikey: "3602169" },
];

async function sendWhatsApp(phone, apikey, text) {
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(text)}&apikey=${apikey}`;
  await fetch(url).catch(err => console.error(`Error WA ${phone}:`, err.message));
}

async function notifyAll(text) {
  for (const n of WHATSAPP) await sendWhatsApp(n.phone, n.apikey, text);
}

function hora() {
  return new Date().toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export const handler = schedule("*/5 * * * *", async () => {
  const store = getStore("monitor");

  let isDown = false, statusCode = null;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(SITE_URL, { signal: ctrl.signal });
    statusCode = res.status;
    isDown = !res.ok;
  } catch { isDown = true; }

  const lastStatus = await store.get("status").catch(() => "up") ?? "up";

  if (isDown && lastStatus !== "down") {
    const msg = statusCode
      ? `🔴 ALERTA — ${SITE_NAME} respondió con error ${statusCode}.\n🕐 ${hora()}`
      : `🔴 ALERTA — ${SITE_NAME} no responde.\n🕐 ${hora()}`;
    await notifyAll(msg);
    await store.set("status", "down").catch(() => {});
  } else if (!isDown && lastStatus === "down") {
    await notifyAll(`✅ RECUPERADO — ${SITE_NAME} volvió a funcionar.\n🕐 ${hora()}`);
    await store.set("status", "up").catch(() => {});
  }

  return { statusCode: 200 };
});
