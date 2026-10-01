/**
 * P0-2 CSV 내보내기 (무료) — "탈출구가 있어야 들어간다" (3·4차 FGI 전원 합의)
 * - yeons + maeums를 단일 CSV로 변환 후 다운로드
 * - 인코딩 UTF-8 BOM (엑셀 한글 깨짐 방지)
 * - 파일명 jebi-YYYYMMDD.csv
 * - 4차 과금 원칙: 내보내기는 신뢰의 기본값 → 무료
 */

/** CSV 셀 이스케이프 — 쉼표·따옴표·줄바꿈 포함 시 큰따옴표로 감싸고 따옴표는 2개로 */
function cell(v) {
  if (v == null || v === "") return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ymd(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const HEADER = [
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
  // J08: 백업 리허설 — J02/J03 필드도 백업에 포함 (없으면 왕복 시 손실)
  "참석",
  "날짜 정밀도",
  "마음 종류",
];

/** 참석 상태 → CSV 표기 */
function attendanceCell(a) {
  return { planned: "참석 예정", attended: "참석함", declined: "불참", unknown: "미정" }[a] || "";
}
/** 날짜 정밀도 → CSV 표기 */
function datePrecisionCell(p) {
  return { exact: "확정", month: "월만", unknown: "미정" }[p] || "";
}
/** 금품 종류 → CSV 표기 */
function assetKindCell(k) {
  return { cash: "현금", goods: "물건", money: "돈", gift: "선물", help: "품" }[k] || "";
}

/**
 * @param {Array} yeons
 * @param {Array} maeums
 * @returns {string} BOM이 붙은 CSV 텍스트
 */
export function buildCsv(yeons = [], maeums = []) {
  const nameOf = (id) => yeons.find((y) => y.id === id);
  const rows = [HEADER.map(cell).join(",")];
  const sorted = [...maeums].sort((a, b) => (a.plantedAt || 0) - (b.plantedAt || 0));
  for (const m of sorted) {
    const y = nameOf(m.yeonId);
    rows.push(
      [
        y?.name || "",
        y?.relationTag || "",
        m.direction === "받음" ? "받음" : "보냄",
        m.eventType || "",
        m.amount ?? "",
        m.memo || "",
        m.eventDate || "",
        m.eventTime || "",
        m.place || "",
        m.account || "",
        ymd(m.plantedAt),
        ymd(m.repaidAt),
        attendanceCell(m.attendance),
        datePrecisionCell(m.datePrecision),
        assetKindCell(m.assetKind),
      ]
        .map(cell)
        .join(",")
    );
  }
  return "﻿" + rows.join("\r\n");
}

/** jebi-YYYYMMDD.csv 다운로드 */
export function downloadCsv(yeons, maeums) {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  const blob = new Blob([buildCsv(yeons, maeums)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jebi-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { rows: maeums.length };
}
