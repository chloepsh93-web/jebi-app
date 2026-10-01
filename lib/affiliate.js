/**
 * "챙길 때" 어필리에이트 — 제휴 커미션 유료화의 트리거·톤·빈도 설계.
 *
 * 원칙 (놀부 방지 — '정' 프레임 수호):
 * 1. 기록 플로우(10초 기록)는 성역. 어떤 상업 요소도 들어가지 않는다.
 * 2. 제안 ≤ 돌봄: "사세요"가 아니라 "마음을 전할 때가 됐어요"가 먼저다.
 * 3. 금액 추천 금지: "얼마가 적당할까요" 같은 계산 유도는 절대 없음.
 * 4. 빈도 캡: 마음당 1회, 전체 30일 쿨다운. 스팸처럼 보이면 평점이 무너진다.
 *
 * J09 계약 — 클릭 ≠ 구매 ≠ 전달:
 * - 제휴 CTA 클릭은 "관심" 신호일 뿐이다. 클릭했다고 선물을 샀다거나
 *   마음을 전했다는 기록을 절대 만들지 않는다.
 * - 구매·전달은 사용자가 직접 "마음 심기"에서 기록할 때만 생긴다.
 * - 제휴몰에서 돌아와도(복귀) 앱은 아무것도 추측하지 않는다.
 *   기록은 언제나 사용자의 손으로.
 *
 * PARTNER.enabled=false 이면 구매 CTA를 숨기고 돌봄 메시지만 보여준다.
 * 실제 제휴몰 연동·결제는 이번 범위 밖.
 */
import { GourdState, computeGourdState } from "./model";
import { nextEvent } from "./alerts";
import { won } from "./format";

/**
 * P1-4 과거 맥락 복기 — 같은 인연·같은 경조사 종류의 가장 최근 기록 한 줄.
 * nudgeCopy에 주입되어 돌봄 메시지가 실용 정보가 된다.
 * 예: "작년에는 3만원을 주고받았어요."
 * @param {Array} maeums 전체 마음 기록
 * @param {{kind, maeum}} nudge 대상 nudge
 * @returns {string} 맥락 한 줄 (없으면 "")
 */
export function pastContextLine(maeums, nudge) {
  if (!nudge?.maeum || !Array.isArray(maeums)) return "";
  const { yeonId, eventType, id, plantedAt } = nudge.maeum;
  const cands = maeums
    .filter(
      (m) =>
        m.id !== id &&
        m.yeonId === yeonId &&
        (m.eventType || "기타") === (eventType || "기타") &&
        (m.amount || 0) > 0 &&
        (m.plantedAt || 0) <= (plantedAt || Date.now())
    )
    .sort((a, b) => (b.plantedAt || 0) - (a.plantedAt || 0));
  const p = cands[0];
  if (!p) return "";
  const py = new Date(p.plantedAt || Date.now()).getFullYear();
  const when = py === new Date().getFullYear() - 1 ? "작년에는" : "예전에는";
  return `${when} ${won(p.amount)}을 주고받았어요.`;
}

const partnerUrl = process.env.NEXT_PUBLIC_PARTNER_URL || "";
const partnerName = process.env.NEXT_PUBLIC_PARTNER_NAME || "";
function validPartnerUrl(value) {
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
}
export const PARTNER = {
  enabled: !!partnerName && validPartnerUrl(partnerUrl),
  name: partnerName,
  url: validPartnerUrl(partnerUrl) ? partnerUrl : "",
};

const CAP_KEY = "jebi:aff:shown";
const COOLDOWN = 30 * 24 * 60 * 60 * 1000;

function readCaps() {
  try {
    return JSON.parse(localStorage.getItem(CAP_KEY) || "{}");
  } catch {
    return {};
  }
}

/** 이 마음에 대해 지금 제안을 보여줘도 되는지 (빈도 캡) */
export function canSuggest(maeumId) {
  try {
    const caps = readCaps();
    const last = caps[maeumId] || 0;
    return Date.now() - last >= COOLDOWN;
  } catch {
    return true;
  }
}

export function markSuggested(maeumId) {
  try {
    const caps = readCaps();
    caps[maeumId] = Date.now();
    localStorage.setItem(CAP_KEY, JSON.stringify(caps));
  } catch {
    /* noop */
  }
}

/**
 * "챙길 때" 후보 수집 — 돌봄이 필요한 마음들.
 * @returns {Array<{kind, maeum, name, years?, days?}>}
 */
export function collectNudges(maeums, yeons, now = Date.now()) {
  const out = [];
  const nameOf = (id) => yeons.find((y) => y.id === id)?.name || "소중한 분";
  for (const m of maeums) {
    if (m.repaidAt) continue;
    if (!canSuggest(m.id)) continue;
    const st = computeGourdState(m, now);
    // 1) 오래 익은 박 — 안부 + 작은 선물
    if (st === GourdState.OLD_RIPE) {
      out.push({ kind: "old_ripe", maeum: m, name: nameOf(m.yeonId) });
      continue;
    }
  }
  // 2) 다가오는 경조사 (D-30 이내, 가장 가까운 1건)
  const up = nextEvent(maeums, now);
  if (up && canSuggest(up.id)) {
    const t = new Date(up.eventDate + "T00:00:00").getTime();
    const days = Math.max(0, Math.round((t - now) / (24 * 60 * 60 * 1000)));
    if (days <= 30) {
      out.push({
        kind: "upcoming",
        maeum: up,
        name: yeons.find((y) => y.id === up.yeonId)?.name || "소중한 분",
        days,
      });
    }
  }
  return out;
}

/** 트리거별 돌봄 카피 — 계산기 톤 금지, 금액 언급 금지
 * @param {{kind, maeum, name, years?, days?}} n
 * @param {Array} [maeums] P1-4 과거 맥락 복기용 (없으면 과거 한 줄 없이)
 */
export function nudgeCopy(n, maeums = null) {
  // P1-4: 같은 인연·같은 경조사 종류의 최근 기록 한 줄을 돌봄 메시지에 주입
  const past = pastContextLine(maeums, n);
  const withPast = (base) => (past ? `${base} ${past}` : base);
  switch (n.kind) {
    case "old_ripe":
      return {
        title: "제비가 챙겨봤어요",
        body: withPast(
          `${n.name}님과의 박이 오래 익었어요. 오랜만에 안부 인사 어때요? 작은 선물에도 마음이 실려요.`
        ),
        cta: "선물 둘러보기",
      };
    case "upcoming":
      return {
        title: "제비가 챙겨봤어요",
        body: withPast(
          `${n.name}님 ${n.maeum.eventType}이 ${n.days}일 남았어요. 마음을 전할 때가 됐어요.`
        ),
        cta: "선물 둘러보기",
      };
    case "anniversary":
      return {
        title: "제비가 챙겨봤어요",
        body: withPast(
          `${n.name}님이 ${n.years}년 전 마음을 보내주셨어요. 고마운 마음, 선물로 전해볼까요?`
        ),
        cta: "선물 둘러보기",
      };
    default:
      return null;
  }
}
