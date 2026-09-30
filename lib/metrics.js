/**
 * 익명 사용 측정 — 무엇이 4.5점을 만드는지 알기 위한 최소한의 계기판.
 * - 개인 식별 정보 수집 금지: user_id(이미 RLS 주체)와 이벤트명만.
 * - 문자 원문·이름·금액 등 어떤 콘텐츠도 보내지 않는다.
 * - app_events 테이블이 없으면(마이그레이션 전) 조용히 무시 — 앱 흐름에 영향 없음.
 * - PIPA 관점: 기기 내 생성 식별자 외 개인정보 없음.
 * - J10 보강 (05-OPERATIONS.md 이벤트 사전):
 *   공통 props — screen_id, is_demo, app_version. (event id=테이블 id, timestamp=created_at)
 *   저장 성공 기준으로만 기록. 중복전송은 테이블 id로 제거.
 */
import { supabase, ensureUser } from "./supabase.js";

const APP_VERSION = "0.1.0";

const EVENTS = [
  // 05-OPERATIONS.md 이벤트 사전
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
const PII_KEYS = /^(name|amount|memo|raw|text|content|note|phone|email|address)$/i;
export function sanitizeProps(props) {
  if (!props || typeof props !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (PII_KEYS.test(k)) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
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
        ...(screenId ? { screen_id: screenId } : {}),
      },
    });
    if (error && (error.code === "PGRST204" || error.code === "42P01")) {
      tableOk = false; // 테이블 미적용 DB — 이후 시도 중단
    }
  } catch {
    /* 측정 실패가 앱을 막으면 안 됨 */
  }
}
