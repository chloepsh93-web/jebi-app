/**
 * 제비 날짜 표기 통일
 * - 같은 해: "M월 d일 (요일)" + D-day ("D-3" / "D+2" / "오늘")
 * - 다른 해: "YYYY년 M월 d일 (요일)"
 * - 연도 미상("????-MM-DD"): "M월 d일 (연도미상)"
 */
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseEventDate(eventDate, now = new Date()) {
  if (!eventDate) return null;
  const unknownYear = eventDate.startsWith("????");
  const y = unknownYear ? now.getFullYear() : parseInt(eventDate.slice(0, 4), 10);
  const mo = parseInt(eventDate.slice(5, 7), 10);
  const d = parseInt(eventDate.slice(8, 10), 10);
  if (!mo || !d) return null;
  const date = new Date(y, mo - 1, d);
  return { date, unknownYear };
}

/** "7월 18일 (토)" 형태 */
export function formatShort(eventDate, now = new Date()) {
  const p = parseEventDate(eventDate, now);
  if (!p) return "";
  const { date, unknownYear } = p;
  const base = `${date.getMonth() + 1}월 ${date.getDate()}일 (${DAYS_KO[date.getDay()]})`;
  if (unknownYear) return `${base} · 연도미상`;
  if (date.getFullYear() !== now.getFullYear()) return `${date.getFullYear()}년 ${base}`;
  return base;
}

/** D-day 문자열: "D-3" / "오늘" / "D+2" / "" (날짜 없음) */
export function dday(eventDate, now = new Date()) {
  const p = parseEventDate(eventDate, now);
  if (!p) return "";
  const { date } = p;
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((b - a) / DAY_MS);
  if (diff === 0) return "오늘";
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

/** "3일 전" / "2주 전" / "1개월 전" / "1년 3개월 전" */
export function relTime(ts, now = Date.now()) {
  const diff = now - ts;
  if (diff < 0) return "곧";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return "방금";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}년 ${rem}개월 전` : `${years}년 전`;
}

/** "2026.07" 형태 */
export function ym(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "100,000원" */
export function won(n) {
  if (n == null) return "";
  return `${Number(n).toLocaleString()}원`;
}
