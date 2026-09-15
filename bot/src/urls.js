import { isIP } from "node:net";
import dns from "node:dns/promises";

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

function stripTrailing(raw) {
  return raw.replace(/[),.;!?]+$/g, "");
}

export function extractUrl(text) {
  if (!text) return null;
  const match = text.match(URL_RE);
  if (!match) return null;
  try {
    return new URL(stripTrailing(match[0]));
  } catch {
    return null;
  }
}

function ipv4ToInt(ip) {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isPrivateIp(ip) {
  if (ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) {
    return true;
  }
  if (!isIP(ip) || isIP(ip) === 6) return false;
  const n = ipv4ToInt(ip);
  return (
    n === 0 ||
    (n >= ipv4ToInt("10.0.0.0") && n <= ipv4ToInt("10.255.255.255")) ||
    (n >= ipv4ToInt("127.0.0.0") && n <= ipv4ToInt("127.255.255.255")) ||
    (n >= ipv4ToInt("169.254.0.0") && n <= ipv4ToInt("169.254.255.255")) ||
    (n >= ipv4ToInt("172.16.0.0") && n <= ipv4ToInt("172.31.255.255")) ||
    (n >= ipv4ToInt("192.168.0.0") && n <= ipv4ToInt("192.168.255.255"))
  );
}

const BLOCKED_HOSTS = new Set(["localhost", "0.0.0.0"]);

export async function assertSafeUrl(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) links are allowed.");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That host is blocked.");
  }
  if (isIP(host) && isPrivateIp(host)) {
    throw new Error("That host is blocked.");
  }
  try {
    const { address } = await dns.lookup(host);
    if (isPrivateIp(address)) {
      throw new Error("That host is blocked.");
    }
  } catch (err) {
    if (err.message === "That host is blocked.") throw err;
  }
  return url.href;
}
