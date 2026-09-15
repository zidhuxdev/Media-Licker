/**
 * gen-session.js
 *
 * Run this ONCE to produce a TG_SESSION StringSession string.
 * It logs in to your Telegram account interactively (OTP to your phone),
 * then prints the session string. Copy it into your .env as TG_SESSION.
 *
 * Usage:
 *   TG_API_ID=12345678 TG_API_HASH=abc123... node bot/scripts/gen-session.js
 *
 * Keep TG_SESSION secret — it's equivalent to your Telegram login.
 * You only need to run this once; the session stays valid indefinitely.
 */

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const apiId = Number(process.env.TG_API_ID);
const apiHash = process.env.TG_API_HASH;

if (!apiId || !apiHash) {
  console.error(
    "Set TG_API_ID and TG_API_HASH before running.\n" +
    "Get them at https://my.telegram.org → API development tools",
  );
  process.exit(1);
}

const { TelegramClient, sessions } = await import("telegram");
const { StringSession } = sessions;

const rl = readline.createInterface({ input, output });

const session = new StringSession("");
const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: async () => rl.question("Phone number (with country code, e.g. +91…): "),
  password: async () => rl.question("2FA password (leave blank if none): "),
  phoneCode: async () => rl.question("OTP code sent to your Telegram app: "),
  onError: (err) => console.error("Auth error:", err.message),
});

const sessionString = client.session.save();

console.log("\n✅ Success! Add this to your .env:\n");
console.log(`TG_SESSION=${sessionString}\n`);
console.log("Keep this string secret — it's your Telegram login.");

await client.disconnect();
rl.close();
