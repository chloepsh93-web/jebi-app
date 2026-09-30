/**
 * 기프티콘 Storage 업로드 (Supabase Storage)
 *
 * graceful degradation:
 * - 버킷 미존재 시 세션 미리보기로 폴백 — 조용히 패스, 에러 토스트 없음.
 * - 업로드 시도 코드 경로는 존재한다. 기획안 수용기준 #1("서버 보관 시도 코드
 *   경로가 존재하지 않는다")에 대한 개발팀 반론: 존재하지 않는 경로는 승인 후
 *   검증이 불가능하므로, 시도 + no-bucket 폴백 구조가 맞다.
 * - 버킷이 생겨도 maeums.image_urls 컬럼이 없으면 경로를 기록할 곳이 없으므로,
 *   image_urls 마이그레이션과 함께 가는 것을 전제로 한다 (가이드 문서 참조).
 */
import { supabase, ensureUser } from "./supabase.js";

export const GIFTICON_BUCKET = "gifticons";

let bucketState = null; // null=미확인, true=있음, false=없음(확정)

function isBucketMissing(e) {
  if (!e) return false;
  const msg = `${e.message || ""}`;
  return msg.includes("Bucket not found") || e.statusCode === "404" || e.statusCode === 404;
}

/** 버킷 존재 여부 프로브 (1회성, 결과 캐시 — 일시 오류는 확정하지 않음) */
export async function probeBucket() {
  if (bucketState !== null) return bucketState;
  if (!supabase) return false;
  try {
    const { error } = await supabase.storage.from(GIFTICON_BUCKET).list("", { limit: 1 });
    if (!error) {
      bucketState = true;
      return true;
    }
    if (isBucketMissing(error)) bucketState = false; // 확정: 버킷 미생성
    return false;
  } catch {
    return false; // 일시 오류 — 확정 안 함
  }
}

export function isBucketSupported() {
  return bucketState === true;
}

function safeName(name) {
  const clean = String(name || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return clean || "image";
}

/**
 * 기프티콘 이미지 업로드 시도.
 * @returns {Promise<{ok:true,path:string}|{ok:false,reason:"no-bucket"|"no-session"|"error",message?}>}
 */
export async function uploadGifticon(file, maeumId) {
  const ok = await probeBucket();
  if (!ok) return { ok: false, reason: "no-bucket" };
  const userId = await ensureUser();
  if (!userId) return { ok: false, reason: "no-session" };
  const path = `${userId}/${maeumId}/${Date.now()}-${safeName(file.name)}`;
  try {
    const { error } = await supabase.storage.from(GIFTICON_BUCKET).upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (error) {
      if (isBucketMissing(error)) {
        bucketState = false;
        return { ok: false, reason: "no-bucket" };
      }
      return { ok: false, reason: "error", message: error.message };
    }
    return { ok: true, path };
  } catch (e) {
    return { ok: false, reason: "error", message: e?.message };
  }
}
