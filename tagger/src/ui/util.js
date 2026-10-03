// Small browser helpers (no football logic).
export function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// "12:34" -> 754000 ms (minutes may exceed 59); "" -> null
export function parseMmSs(s) {
  const m = /^\s*(\d{1,3}):([0-5]\d)\s*$/.exec(s || "");
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : null;
}
export const fmtMmSs = (ms) => (ms == null ? "" : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`);

export const matchId = (date, opponent) =>
  `m_${date || "sans-date"}_${(opponent || "adversaire").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}`;

// Today's date in local time (toISOString would give tomorrow in the evening, in UTC).
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
