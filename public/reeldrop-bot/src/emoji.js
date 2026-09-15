/**
 * Premium custom emoji used in every bot message and keyboard button.
 *
 * Messages: HTML <tg-emoji emoji-id="…">fallback</tg-emoji>
 * Buttons:  icon_custom_emoji_id on InlineKeyboardButton / KeyboardButton
 *
 * Telegram shows the animated premium glyph to viewers. The fallback unicode
 * is what appears if the bot cannot attach custom emoji (no Fragment username
 * and the bot owner is not Premium) or when a client cannot render it.
 */

export const E = {
  chat: { id: "5443038326535759644", fb: "💬" },
  video: { id: "6129782440157256336", fb: "🎬" },
  download: { id: "6129879029676776924", fb: "⬇️" },
  hd: { id: "6129840374971112593", fb: "🖥️" },
  p720: { id: "6129746001654718223", fb: "📺" },
  p480: { id: "6129652186684070216", fb: "📱" },
  audio: { id: "6129486856212979482", fb: "🎵" },
  cancel: { id: "6129913342170506824", fb: "❌" },
  internet: { id: "5447410659077661506", fb: "🌐" },
  percent: { id: "5229064374403998351", fb: "%" },
  mic: { id: "5224736245665511429", fb: "🎙" },
  quote: { id: "5460795800101594035", fb: "💬" },
  link: { id: "5271604874419647061", fb: "🔗" },
  play: { id: "5282843764451195532", fb: "▶️" },
  info: { id: "5334544901428229844", fb: "ℹ️" },
  pin: { id: "5391032818111363540", fb: "📍" },
  plus: { id: "5397916757333654639", fb: "➕" },
  mail: { id: "5253742260054409879", fb: "✉️" },
  lock: { id: "5296369303661067030", fb: "🔒" },
  file: { id: "5305265301917549162", fb: "📎" },
  speaker: { id: "5388632425314140043", fb: "🔊" },
  calendar: { id: "5413879192267805083", fb: "📅" },
  pencil: { id: "5395444784611480792", fb: "✏️" },
  folder: { id: "5463107823946717464", fb: "📁" },
  clock: { id: "5395695537687123235", fb: "⏱" },
  fire: { id: "6093780439439249308", fb: "🔥" },
  star: { id: "5445355530111437729", fb: "⭐" },
  screen: { id: "5201691993775818138", fb: "🖥️" },
  rocket: { id: "5197269100878907942", fb: "🚀" },
  save: { id: "5444856076954520455", fb: "💾" },
  pack: { id: "5445221832074483553", fb: "📦" },
  target: { id: "5463081281048818043", fb: "🎯" },
  user: { id: "5411525941031613886", fb: "👤" },
  chart: { id: "5420283297743780093", fb: "📊" },
  tag: { id: "5420512812206143917", fb: "🏷" },
  refresh: { id: "5384553404678814149", fb: "🔄" },
  home: { id: "5411096972582992980", fb: "🏠" },
  help: { id: "5411159893853880009", fb: "❓" },
  gear: { id: "5420291728764581871", fb: "⚙️" },
  film: { id: "5262739632423974354", fb: "🎞" },
  spark: { id: "5224446056200156529", fb: "✨" },
  note: { id: "5231345517434253685", fb: "📝" },
  stop: { id: "5262999654039039288", fb: "🛑" },
  check: { id: "5192954900719349873", fb: "✅" },
  wait: { id: "5193141001652285304", fb: "⏳" },
  warn: { id: "5193081361736414586", fb: "⚠️" },
};

export function pe(key) {
  const item = E[key];
  if (!item) return "";
  return `<tg-emoji emoji-id="${item.id}">${item.fb}</tg-emoji>`;
}

export function iconButton(text, callbackData, key, style) {
  const item = E[key];
  const btn = {
    text,
    callback_data: callbackData,
  };
  if (item) btn.icon_custom_emoji_id = item.id;
  if (style) btn.style = style;
  return btn;
}

export function iconUrlButton(text, url, key, style) {
  const item = E[key];
  const btn = { text, url };
  if (item) btn.icon_custom_emoji_id = item.id;
  if (style) btn.style = style;
  return btn;
}

export function iconKb(text, key, style) {
  const item = E[key];
  const btn = { text };
  if (item) btn.icon_custom_emoji_id = item.id;
  if (style) btn.style = style;
  return btn;
}

export const PARSE_HTML = { parse_mode: "HTML" };
