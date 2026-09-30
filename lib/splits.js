/**
 * N빵·공동선물 분할 (maeum_splits) 클라이언트 계층
 *
 * 설계 전제 (migrations/maeum-splits.sql):
 * - maeums 1행 = 박 1개 전제 유지. 분할은 이 테이블에만 기록, 부모 maeum의
 *   yeon_id는 "대표 인연"으로 둔다.
 * - 현재 유효 분할 = 어떤 행의 correction_of에도 등장하지 않은 행
 *   → maeum_splits_current 뷰로 제공 (클라이언트는 뷰 우선 조회).
 *
 * graceful degradation:
 * - 테이블/뷰가 없으면(마이그레이션 전) 모든 분할 UI를 숨기고 조용히 패스한다.
 * - 존재 감지는 박씨 seedColumnOk 패턴과 동일: select limit 1 → PGRST205 판정.
 * - 에러 토스트를 띄우지 않는다 (조용한 패스가 스펙).
 */
import { supabase, ensureUser } from "./supabase.js";

const VIEW = "maeum_splits_current";
const TABLE = "maeum_splits";

let splitsOk = null; // null=미확인, true=사용 가능, false=미지원(확정)
let useTableFallback = false; // 뷰는 없고 테이블만 있을 때 클라이언트에서 정정 필터

function isMissingRelation(e) {
  if (!e) return false;
  const msg = `${e.message || ""} ${e.details || ""} ${e.hint || ""}`;
  return e.code === "PGRST205" || msg.includes("maeum_splits");
}

/**
 * 분할 기능 사용 가능 여부 (1회성 프로브, 결과 캐시).
 * 일시적 네트워크 오류는 false로 확정하지 않고 다음 호출 때 재시도한다.
 */
export async function probeSplitsSupport() {
  if (splitsOk !== null) return splitsOk;
  if (!supabase) return false;
  try {
    // 1) 뷰 우선 (정정 반영된 현재 유효 행)
    const v = await supabase.from(VIEW).select("id").limit(1);
    if (!v.error) {
      splitsOk = true;
      useTableFallback = false;
      return true;
    }
    if (!isMissingRelation(v.error)) return false; // 권한 등 — 이번만 false, 확정 안 함
    // 2) 뷰는 없는데 테이블만 있으면 테이블 + 클라이언트 정정 필터
    const t = await supabase.from(TABLE).select("id").limit(1);
    if (!t.error) {
      splitsOk = true;
      useTableFallback = true;
      return true;
    }
    if (isMissingRelation(t.error)) splitsOk = false; // 확정: 마이그레이션 전
    return false;
  } catch {
    return false; // 일시 오류 — 확정하지 않음
  }
}

/** 분할 UI를 보여줘도 되는지 (프로브 완료 후) */
export function isSplitsSupported() {
  return splitsOk === true;
}

/** 저장 중 테이블 부재가 확정되면 UI를 즉시 숨긴다 */
export function markSplitsUnsupported() {
  splitsOk = false;
}

/**
 * 마음 id 목록에 대한 현재 유효 분할 맵.
 * @returns {Promise<Map<string, Array<{yeonId:string, amount:number|null}>>>}
 */
export async function getSplitsMap(maeumIds) {
  const map = new Map();
  const ok = await probeSplitsSupport();
  if (!ok || !maeumIds || maeumIds.length === 0) return map;
  try {
    const src = useTableFallback ? TABLE : VIEW;
    const { data, error } = await supabase
      .from(src)
      .select("id, maeum_id, yeon_id, amount, correction_of")
      .in("maeum_id", maeumIds);
    if (error) {
      if (isMissingRelation(error)) markSplitsUnsupported();
      return map;
    }
    let rows = data || [];
    if (useTableFallback) {
      // 정정 체인 클라이언트 필터: 정정된 구 버전 제외
      const corrected = new Set(rows.map((r) => r.correction_of).filter(Boolean));
      rows = rows.filter((r) => !corrected.has(r.id));
    }
    for (const r of rows) {
      if (!map.has(r.maeum_id)) map.set(r.maeum_id, []);
      map.get(r.maeum_id).push({ yeonId: r.yeon_id, amount: r.amount ?? null });
    }
  } catch {
    /* 조용히 빈 맵 */
  }
  return map;
}

/**
 * 분할 행 생성 (정정 체인의 원본 — correction_of null).
 * @param {string} maeumId
 * @param {Array<{yeonId:string, amount:number|null}>} splits
 */
export async function addSplits(maeumId, splits) {
  const ok = await probeSplitsSupport();
  if (!ok) return { ok: false, reason: "unsupported" };
  const userId = await ensureUser();
  if (!userId) return { ok: false, reason: "no-session" };
  const rows = (splits || [])
    .filter((s) => s && s.yeonId)
    .map((s) => ({
      user_id: userId,
      maeum_id: maeumId,
      yeon_id: s.yeonId,
      amount: s.amount ?? null,
      correction_of: null,
    }));
  if (rows.length === 0) return { ok: true, count: 0 };
  try {
    const { error } = await supabase.from(TABLE).insert(rows);
    if (error) {
      if (isMissingRelation(error)) {
        markSplitsUnsupported();
        return { ok: false, reason: "unsupported" };
      }
      return { ok: false, reason: "error" };
    }
    return { ok: true, count: rows.length };
  } catch {
    return { ok: false, reason: "error" };
  }
}

// ---- 순수 함수 (단위 테스트 대상) ----

/**
 * 타임라인 표기: "○○님 외 N명과 함께"
 * @param {string} repName 대표 인연 이름
 * @param {Array} splits 분할 목록
 * @returns {string|null} 분할이 없으면 null
 */
export function splitLabel(repName, splits) {
  const n = splits ? splits.length : 0;
  if (n <= 0) return null;
  return `${repName}님 외 ${n}명과 함께`;
}

/**
 * 함께한 인연 — 직접 입력한 이름 정제.
 * guideline #11: 입력한 이름은 절대 기존 인연과 자동 매칭하지 않는다.
 * 저장 시 store.createYeon으로 항상 새로 만든다 (upsert 금지 — 섞임 방지).
 * - 빈 이름 제외, 대표 인연과 같은 이름 제외, 중복 1회만, 최대 5명
 */
export function normalizeCompanionNames(names, repName) {
  const rep = (repName || "").trim();
  const seen = new Set();
  const out = [];
  for (const n of names || []) {
    const name = (n || "").trim();
    if (!name || name === rep || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out.slice(0, 5);
}

/**
 * 균등 분할 제안값 (UI 표시용 — 저장되는 건 사용자가 확정한 값만).
 * 방향서 결정과 정합: "금액 환산은 하지 않고 입력된 분할 금액만 저장".
 * @param {number|null} total 부모 마음의 전한 마음
 * @param {number} count 분할 인원 (대표 포함)
 * @returns {number|null} 1인당 제안 금액 (계산 불가면 null)
 */
export function equalShare(total, count) {
  if (!total || total <= 0 || !count || count <= 0) return null;
  return Math.floor(total / count);
}
