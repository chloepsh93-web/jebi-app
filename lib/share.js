/**
 * 공유 — Web Share API 우선, 미지원 시 클립보드 복사 폴백.
 * 이미지 렌더링 없음. 텍스트 카드만 나눈다.
 * @returns {"shared"|"copied"|"cancelled"}
 */
export async function shareText({ title, text }) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      throw e;
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
  throw new Error("share-unavailable");
}

const INVITE_CODE_KEY = "jebi:invite-code";
export const INVITE_BASE = "https://jebi-app.vercel.app";

/** 내 초대 코드 — 기기별 생성, user id 노출 없음 */
export function getInviteCode() {
  try {
    let c = localStorage.getItem(INVITE_CODE_KEY);
    if (!c) {
      c = Math.random().toString(36).slice(2, 10);
      localStorage.setItem(INVITE_CODE_KEY, c);
    }
    return c;
  } catch {
    return "jebi";
  }
}

export function inviteUrl() {
  return `${INVITE_BASE}?ref=${getInviteCode()}`;
}
