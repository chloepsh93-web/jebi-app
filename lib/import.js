/**
 * P0-3 CSV 가져오기 MVP — "내보낸 기록을 다시 심어요"
 * - lib/export.js 내보내기 포맷과 왕복 호환 (헤더 12열 일치 검증)
 * - 인코딩: UTF-8 BOM 우선, 깨지면 EUC-KR(CP949) 폴백 (한국 엑셀 저장본 대응)
 * - 중복 병합 정책 (기획 결정 2026-09-25):
 *   인연 이름·방향·경조사·금액·날짜·방식·참석·정밀도·메모·시간·장소·계좌 일치 → 건너뛰기
 * - 동명이인: 같은 이름 인연이 2개 이상이면 해당 행은 건너뛰고 '확인 필요'로 집계
 *   (가이드라인 #11 — 이름만으로 인연을 자동 매칭해 마음을 섞지 않는다)
 * - 결과는 건수로 리포트: 새로 심음 / 이미 있던 마음 건너뜀 / 확인 필요 / 형식 오류
 */

import { store } from "./store.js";
import { EventType, Direction } from "./model.js";

const EXPECTED_HEADER = [
  "인연",
  "관계",
  "방향",
  "경조사",
  "전한 마음(원)",
  "한 줄 메모",
  "경조사 날짜",
  "경조사 시간",
  "장소",
  "계좌",
  "기록일",
  "답례일",
];
// J08: 15열 확장 헤더 (참석·날짜 정밀도·마음 종류)
const EXPECTED_HEADER_V2 = [...EXPECTED_HEADER, "참석", "날짜 정밀도", "마음 종류"];

const RELATIONS = ["가족", "회사", "학교", "지인"];
const EVENTS = [EventType.WEDDING, EventType.FUNERAL, EventType.DOLJANCHI, EventType.BIRTHDAY, EventType.OTHER];

/** 파일 버퍼 디코딩 — UTF-8 strict 실패 시 EUC-KR 폴백 */
export function decodeCsv(buffer) {
  const bytes = new Uint8Array(buffer);
  try {
    const strict = new TextDecoder("utf-8", { fatal: true });
    return stripBom(strict.decode(bytes));
  } catch {
    return stripBom(new TextDecoder("euc-kr").decode(bytes));
  }
}

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** CSV 텍스트 → 행 배열 (따옴표·줄바꿈 셀 대응) */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(cell); cell = "";
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  if (inQ) throw new Error("따옴표가 닫히지 않은 CSV예요");
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/** 헤더가 제비 내보내기 포맷인지 검증 — 구 12열·신 15열 모두 허용 */
export function isJebiCsv(rows) {
  if (!rows || rows.length < 1) return false;
  const h = rows[0].map((c) => c.trim());
  const match = (exp) => h.length === exp.length && exp.every((e, i) => h[i] === e);
  return match(EXPECTED_HEADER_V2) || match(EXPECTED_HEADER);
}

function parseYmdHm(s) {
  const text = (s || "").trim();
  if (!text) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(text);
  if (!m) return undefined;
  const year = +m[1], month = +m[2], day = +m[3], hour = +(m[4] || 0), minute = +(m[5] || 0);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return undefined;
  return date.getTime();
}

function parseEventDate(s) {
  const t = (s || "").trim();
  if (!t) return null;
  const m = /^(\d{4}|\?\?\?\?)-(\d{2})(?:-(\d{2}))?$/.exec(t);
  if (!m || (m[1] === "????" && !m[3])) return undefined;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return undefined;
  if (m[3]) {
    const year = m[1] === "????" ? 2000 : Number(m[1]);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, Number(m[3]));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== Number(m[3])) return undefined;
  }
  return t;
}

function parseAmount(s) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(t)) return undefined;
  const value = Number(t.replace(/,/g, ""));
  return Number.isSafeInteger(value) && value <= 2147483647 ? value : undefined;
}

/** J08: CSV 표기 → 참석 상태 */
function parseAttendance(s) {
  const t = (s || "").trim();
  return { "참석 예정": "planned", "참석함": "attended", "불참": "declined", "미정": "unknown" }[t] || null;
}
/** J08: CSV 표기 → 날짜 정밀도 */
function parseDatePrecision(s) {
  const t = (s || "").trim();
  return { "확정": "exact", "월만": "month", "미정": "unknown" }[t] || null;
}
/** J08: CSV 표기 → 금품 종류 */
function parseAssetKind(s) {
  const t = (s || "").trim();
  return { "현금": "cash", "물건": "goods", "돈": "money", "선물": "gift", "품": "help" }[t] || null;
}

/**
 * 데이터 행 → 마음 레코드 초안 (+ 인연 이름). 형식 오류면 { skip: "bad" }.
 * direction은 받음/보냄 외 값이면 행 전체를 건너뛴다 (방향을 추측하지 않는다).
 * J08: 왕복 테스트용으로 export한다.
 */
export function rowToDraft(cells) {
  const get = (i) => (cells[i] || "").trim();
  if (![12, 15].includes(cells.length)) return { skip: "bad" };
  const name = get(0);
  if (!name) return { skip: "bad" };
  const direction = [Direction.RECEIVED, Direction.SENT].includes(get(2)) ? get(2) : null;
  const amount = parseAmount(get(4));
  const eventDate = parseEventDate(get(6));
  const plantedAt = parseYmdHm(get(10));
  const repaidAt = parseYmdHm(get(11));
  if (!direction || amount === undefined || eventDate === undefined || plantedAt === undefined || repaidAt === undefined) return { skip: "bad" };
  if (get(7) && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(get(7))) return { skip: "bad" };
  if (get(12) && !parseAttendance(get(12))) return { skip: "bad" };
  if (get(13) && !parseDatePrecision(get(13))) return { skip: "bad" };
  if (get(14) && !parseAssetKind(get(14))) return { skip: "bad" };
  return {
    name,
    relationTag: RELATIONS.includes(get(1)) ? get(1) : "지인",
    direction,
    eventType: EVENTS.includes(get(3)) ? get(3) : "기타",
    amount,
    memo: get(5) || null,
    eventDate,
    eventTime: get(7) || null,
    place: get(8) || null,
    account: get(9) || null,
    plantedAt: plantedAt ?? Date.now(),
    repaidAt,
    // J08: 15열 확장 — 구 12열 CSV에서는 null (미표기)
    attendance: parseAttendance(get(12)),
    datePrecision: parseDatePrecision(get(13)),
    assetKind: parseAssetKind(get(14)),
  };
}

/** CSV에 포함된 내용이 모두 같을 때만 중복 후보로 본다. */
export function dedupKey(name, direction, eventType, amount, eventDate, details = {}) {
  return JSON.stringify([name, direction, eventType, amount ?? null, eventDate ?? null,
    details.assetKind ?? null, details.attendance ?? null, details.datePrecision ?? null,
    details.memo ?? null, details.eventTime ?? null, details.place ?? null, details.account ?? null]);
}

function existingKeys(yeons, maeums) {
  const nameOf = new Map(yeons.map((y) => [y.id, y.name]));
  const set = new Set();
  for (const m of maeums) {
    set.add(dedupKey(nameOf.get(m.yeonId) || "", m.direction, m.eventType, m.amount, m.eventDate, m));
  }
  return set;
}

/**
 * CSV 가져오기 실행.
 * @param {{yeons: Array, maeums: Array}} snapshot 현재 데이터 스냅샷
 * @param {Array<Array<string>>} rows parseCsv 결과 (헤더 포함)
 * @returns {Promise<{added:number, skippedDup:number, skippedName:number, skippedBad:number}>}
 * @throws {Error} 제비 포맷이 아니면 "not-jebi-csv"
 */
export async function importRows(snapshot, rows) {
  if (!isJebiCsv(rows)) {
    const e = new Error("제비가 내보낸 기록이 아닌 것 같아요");
    e.code = "not-jebi-csv";
    throw e;
  }
  const { yeons, maeums } = snapshot;
  const seen = existingKeys(yeons, maeums);
  const byName = new Map();
  for (const y of yeons) {
    if (!byName.has(y.name)) byName.set(y.name, []);
    byName.get(y.name).push(y);
  }

  const result = { added: 0, skippedDup: 0, skippedName: 0, skippedBad: 0 };

  for (let i = 1; i < rows.length; i++) {
    const draft = rowToDraft(rows[i]);
    if (draft.skip) { result.skippedBad++; continue; }
    const key = dedupKey(draft.name, draft.direction, draft.eventType, draft.amount, draft.eventDate, draft);
    if (seen.has(key)) { result.skippedDup++; continue; }

    const matches = byName.get(draft.name) || [];
    let yeon;
    if (matches.length === 1) {
      yeon = matches[0];
    } else if (matches.length === 0) {
      yeon = await store.upsertYeon(draft.name, draft.relationTag, null);
      byName.set(draft.name, [yeon]);
    } else {
      // 동명이인 2인 이상 — 어느 인연의 마음인지 알 수 없으니 건너뛰고 집계
      result.skippedName++;
      continue;
    }

    await store.addMaeum({
      yeonId: yeon.id,
      direction: draft.direction,
      eventType: draft.eventType,
      amount: draft.amount,
      memo: draft.memo,
      eventDate: draft.eventDate,
      eventTime: draft.eventTime,
      place: draft.place,
      account: draft.account,
      plantedAt: draft.plantedAt,
      repaidAt: draft.repaidAt,
      // J08: 백업 복원 시 새 필드도 복원
      attendance: draft.attendance,
      datePrecision: draft.datePrecision,
      assetKind: draft.assetKind,
    });
    seen.add(key);
    result.added++;
  }
  return result;
}

/** 결과 리포트 문장 — '정' 톤, 숫자는 건수로만 */
export function importReport(r) {
  if (r.added === 0 && r.skippedDup === 0 && r.skippedName === 0 && r.skippedBad === 0) {
    return "심을 기록이 없었어요";
  }
  const parts = [];
  if (r.added > 0) parts.push(`마음 ${r.added}개를 다시 심었어요`);
  if (r.skippedDup > 0) parts.push(`이미 있던 ${r.skippedDup}개는 건너뛰었어요`);
  if (r.skippedName > 0) parts.push(`이름이 같은 분이 여러 명이라 ${r.skippedName}개는 확인이 필요해요`);
  if (r.skippedBad > 0) parts.push(`${r.skippedBad}개는 형식이 달라 건너뛰었어요`);
  return parts.join(" · ");
}
