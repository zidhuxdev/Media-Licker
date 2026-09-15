export function log(level, msg, extra = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...extra,
  };
  const out = level === "error" ? console.error : console.log;
  out(JSON.stringify(line));
}
