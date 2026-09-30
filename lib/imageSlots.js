/**
 * 기프티콘 이미지 슬롯 — 세션 레벨 로컬 미리보기 (P1-3 MVP)
 * - 서버 보관은 미구현: Supabase Storage 버킷 + maeums.image_urls는 후속 라운드
 * - 이 모듈은 탭 세션 동안의 미리보기 URL만 들고 있다 (objectURL, 메모리)
 * - 화면을 닫거나 새로고침하면 사라진다 — 카피에 정직하게 고지 (가이드라인 #12)
 */

export const SLOT_MAX = 3;
export const SLOT_MAX_BYTES = 8 * 1024 * 1024; // 8MB

const cache = new Map(); // maeumId -> Array<{id, url, name}>
let seq = 0;

export function getSlotImages(maeumId) {
  return cache.get(maeumId) || [];
}

/**
 * @param {string} maeumId
 * @param {File} file
 * @returns {{ok: boolean, item?: object, error?: string}}
 */
export function addSlotImage(maeumId, file) {
  if (!file || !file.type.startsWith("image/")) {
    return { ok: false, error: "사진 파일만 붙일 수 있어요" };
  }
  if (file.size > SLOT_MAX_BYTES) {
    return { ok: false, error: "너무 큰 사진이에요 (8MB까지)" };
  }
  const list = getSlotImages(maeumId);
  if (list.length >= SLOT_MAX) {
    return { ok: false, error: `사진은 ${SLOT_MAX}장까지 붙일 수 있어요` };
  }
  const item = { id: `slot-${++seq}`, url: URL.createObjectURL(file), name: file.name };
  cache.set(maeumId, [...list, item]);
  return { ok: true, item };
}

export function removeSlotImage(maeumId, id) {
  const list = getSlotImages(maeumId);
  const target = list.find((i) => i.id === id);
  if (target) URL.revokeObjectURL(target.url);
  cache.set(maeumId, list.filter((i) => i.id !== id));
}
