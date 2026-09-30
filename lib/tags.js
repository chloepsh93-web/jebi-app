/**
 * 인연 다중 태그 (yeon_tags) 클라이언트 계층
 *
 * 스키마: yeon_tags(user_id, yeon_id, tag, created_at), PK(yeon_id, tag),
 *   FK yeons(id) on delete cascade. 태그 삭제는 인연·마음을 건드리지 않는다.
 * 저장 방식: 배열 컬럼이 아닌 조인 테이블 — 태그별 인연 검색·인덱스·RLS가
 *   깔끔하고, 상한 변경이 마이그레이션 없이 된다.
 *
 * 상한(인연당 3개·전체 10개·12자)은 UX 정책이라 클라이언트 상수로만 강제하고
 * DB CHECK는 두지 않는다 (개발팀 반론: 정책 변경 시 마이그레이션 없이 바꾸기 위해).
 *
 * graceful: 테이블 미존재 시 태그 UI 전체 숨김 + 조용히 패스.
 */
import { supabase, ensureUser } from "./supabase.js";

export const TAG_MAX_PER_YEON = 3;
export const TAG_MAX_TOTAL = 10;
export const TAG_MAX_LEN = 12;

let tagsOk = null; // null=미확인, true=사용 가능, false=미지원(확정)

function isMissing(e) {
  if (!e) return false;
  const msg = `${e.message || ""} ${e.details || ""} ${e.hint || ""}`;
  return e.code === "PGRST205" || msg.includes("yeon_tags");
}

export async function probeTagsSupport() {
  if (tagsOk !== null) return tagsOk;
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("yeon_tags").select("yeon_id").limit(1);
    if (!error) {
      tagsOk = true;
      return true;
    }
    if (isMissing(error)) tagsOk = false; // 확정: 마이그레이션 전
    return false;
  } catch {
    return false; // 일시 오류 — 확정 안 함
  }
}

export function isTagsSupported() {
  return tagsOk === true;
}

export function markTagsUnsupported() {
  tagsOk = false;
}

/** @returns {Promise<Map<string, string[]>>} yeonId → 태그 목록 */
export async function getTagsMap(yeonIds) {
  const map = new Map();
  const ok = await probeTagsSupport();
  if (!ok || !yeonIds || yeonIds.length === 0) return map;
  try {
    const { data, error } = await supabase
      .from("yeon_tags")
      .select("yeon_id, tag")
      .in("yeon_id", yeonIds);
    if (error) {
      if (isMissing(error)) markTagsUnsupported();
      return map;
    }
    for (const r of data || []) {
      if (!map.has(r.yeon_id)) map.set(r.yeon_id, []);
      map.get(r.yeon_id).push(r.tag);
    }
  } catch {
    /* 조용히 빈 맵 */
  }
  return map;
}

/** 인연의 태그를 통째로 교체 (delete + insert — 태그만 떨어지고 인연·마음은 유지) */
export async function setTags(yeonId, tags) {
  const ok = await probeTagsSupport();
  if (!ok) return { ok: false, reason: "unsupported" };
  const userId = await ensureUser();
  if (!userId) return { ok: false, reason: "no-session" };
  const clean = normalizeTags(tags);
  try {
    const { error: e1 } = await supabase.from("yeon_tags").delete().eq("yeon_id", yeonId);
    if (e1) {
      if (isMissing(e1)) {
        markTagsUnsupported();
        return { ok: false, reason: "unsupported" };
      }
      return { ok: false, reason: "error" };
    }
    if (clean.length > 0) {
      const { error: e2 } = await supabase
        .from("yeon_tags")
        .insert(clean.map((tag) => ({ user_id: userId, yeon_id: yeonId, tag })));
      if (e2) {
        if (isMissing(e2)) markTagsUnsupported();
        return { ok: false, reason: "error" };
      }
    }
    return { ok: true, count: clean.length };
  } catch {
    return { ok: false, reason: "error" };
  }
}

// ---- 순수 함수 (단위 테스트 대상) ----

/**
 * 태그 정제: trim·12자 절단·빈 제외·중복 제거·최대 3개.
 * @param {string|string[]} input 쉼표 구분 문자열 또는 배열
 */
export function normalizeTags(input) {
  const arr = Array.isArray(input) ? input : String(input || "").split(",");
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const tag = String(t || "").trim().slice(0, TAG_MAX_LEN);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out.slice(0, TAG_MAX_PER_YEON);
}

/** 입력창 텍스트(쉼표 구분) → 태그 배열 */
export function parseTagInput(text) {
  return normalizeTags(text);
}
