/** 최소 운영 측정. user_id는 가명 식별자이며 개인정보 관리 대상이다.
 * 콘텐츠를 보내지 않고 허용된 구조 필드만 전송한다.
 * DB 미적용/측정 실패는 앱 동작을 막지 않는다. 실제 수집 여부는 운영자가 확인한다.
 */
import { supabase, ensureUser } from "./supabase.js";

const APP_VERSION = "0.1.0";

const EVENTS = [
  // 05-OPERATIONS.md 이벤트 사전
  "session_started",
  "session_authenticated",
  "reminder_snoozed",
  "onboarding_view",
  "demo_started",
  "invitation_parse_requested",
  "invitation_parse_succeeded",
  "invitation_parse_failed",
  "occasion_saved",
  "transfer_saved",
  "care_saved",
  "person_search",
  "history_viewed",
  "affiliate_offer_viewed",
  "affiliate_outbound_clicked",
  "affiliate_returned",
  "recap_viewed",
  // 앱 진단용 (사전 외)
  "onboarding_done",
  "first_maeum",
  "seed_planted",
  "share_used",
  "guard_linked",
  "guard_restored",
  "invite_accepted",
];

/** J10: props에 콘텐츠가 섞여도 서버로 나가지 않게 런타임 차단 */
const SCREENS = new Set(["welcome", "home", "input", "people", "settings"]);
// 자유 입력 문자열·이름을 닮은 새 키도 기본 차단한다.
export function sanitizeProps(props) {
  if (!props || typeof props !== "object") return {};
  return typeof props.empty === "boolean" ? { empty: props.empty } : {};
}

let tableOk = true;

/**
 * @param {string} name 이벤트명 (사전 + 진단)
 * @param {object} props 콘텐츠 제외, 플래그·건수만
 * @param {string} [screenId] 화면 ID (사전 공통)
 */
export async function logEvent(name, props = {}, screenId = null) {
  if (!EVENTS.includes(name)) return;
  if (!tableOk || !supabase) return;
  try {
    const userId = await ensureUser();
    if (!userId) return;
    const { error } = await supabase.from("app_events").insert({
      user_id: userId,
      event: name,
      props: {
        ...sanitizeProps(props), // J10: 이름·금액·메모·원문 차단
        // J10: 사전 공통 — demo는 항상 false (J05 예시 격리로 demo 저장 경로 없음)
        is_demo: false,
        app_version: APP_VERSION,
        ...(SCREENS.has(screenId) ? { screen_id: screenId } : {}),
      },
    });
    if (error && (error.code === "PGRST204" || error.code === "42P01")) {
      tableOk = false; // 테이블 미적용 DB — 이후 시도 중단
    }
  } catch {
    /* 측정 실패가 앱을 막으면 안 됨 */
  }
}
