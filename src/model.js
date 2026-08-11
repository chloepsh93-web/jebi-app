/**
 * 제비(Jebi) 데이터 모델
 * 확정된 세계관/UX 결정 반영:
 * - 박 상태 6종: 새싹 → 자라는 박 → 익은 박 → 열린 박 → 오래 익은 박 / 하늘 궤적
 * - 관계 태그 4종: 가족/회사/학교/지인
 * - 경조사 4종: 결혼/부고/돌잔치/생일
 * - 방향: 받음(지붕에 심김) / 보냄(하늘 궤적)
 */

// ---- 열거형 ----
export const EventType = {
  WEDDING: "결혼",
  FUNERAL: "부고",
  DOLJANCHI: "돌잔치",
  BIRTHDAY: "생일",
  OTHER: "기타", // 범위 외 (개업 등) — 수동 입력 유도
};

export const RelationTag = {
  FAMILY: "가족",
  WORK: "회사",
  SCHOOL: "학교",
  ACQUAINTANCE: "지인",
};

export const RelationColor = {
  가족: "#EF9F27",
  회사: "#185FA5",
  학교: "#97C459",
  지인: "#C4A876",
};

// 박 상태 (지붕 위 박 = 내가 받은 마음, 갚아야 할 것)
export const GourdState = {
  SPROUT: "새싹",        // 심음 직후 ~ 1개월
  GROWING: "자라는 박",   // 1개월 ~ 상대 이벤트 D-30
  RIPE: "익은 박",        // D-30 ~ 답례 완료 (곧 갚을 때)
  OPENED: "열린 박",      // 답례 완료 (종결, 온기 자산)
  OLD_RIPE: "오래 익은 박", // 익은 상태 1년+ (리마인드 트리거)
};

// 방향
export const Direction = {
  RECEIVED: "받음", // 상대가 나에게 → 지붕에 박 심김
  SENT: "보냄",     // 내가 상대에게 → 하늘 궤적
};

// ---- 엔티티 ----

/**
 * 인연 (Relationship) — 한 사람
 * @typedef {Object} Yeon
 * @property {string} id
 * @property {string} name         - 이름
 * @property {string} relationTag  - RelationTag
 * @property {string} avatarGender - "male" | "female" | null
 * @property {number} createdAt    - timestamp
 */

/**
 * 마음 (Exchange) — 하나의 주고받음. 인연에 여러 개 매달림.
 * 받은 마음 = 지붕의 박 하나. 보낸 마음 = 하늘 궤적 하나.
 * @typedef {Object} Maeum
 * @property {string} id
 * @property {string} yeonId       - 소속 인연
 * @property {string} direction    - Direction (받음/보냄)
 * @property {string} eventType    - EventType
 * @property {number|null} amount   - 봉투 금액 (null 가능)
 * @property {string|null} eventDate - 경조사 날짜 "YYYY-MM-DD" (연도미상 "????-MM-DD")
 * @property {string|null} eventTime
 * @property {string|null} place
 * @property {string|null} account  - 계좌 (관계의 기억)
 * @property {number} plantedAt     - 심은/보낸 시각 timestamp
 * @property {number|null} repaidAt - 갚은/답례받은 시각 (열림) — null이면 미완결
 * @property {number|null} remindedAt - 마지막 리마인드 발송 시각
 * @property {string} gourdState    - GourdState (받은 마음만 의미. 계산됨)
 */

// ---- 박 상태 계산 (시간 기반) ----
const DAY = 24 * 60 * 60 * 1000;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * 받은 마음의 현재 박 상태를 계산.
 * @param {Maeum} m
 * @param {number} now
 * @returns {string} GourdState
 */
export function computeGourdState(m, now = Date.now()) {
  if (m.direction !== Direction.RECEIVED) return null; // 보낸 마음은 하늘 궤적
  if (m.repaidAt) return GourdState.OPENED; // 갚음 완료 → 열린 박

  const age = now - m.plantedAt;

  // 상대 이벤트가 임박(D-30 이내)하거나 지났으면 익은 박
  if (m.eventDate && !m.eventDate.startsWith("????")) {
    const evDate = new Date(m.eventDate + "T00:00:00").getTime();
    const dday = evDate - now;
    if (dday <= 30 * DAY) {
      // 익은 지 1년 넘었으면 오래 익은 박
      if (now - (evDate - 30 * DAY) >= YEAR) return GourdState.OLD_RIPE;
      return GourdState.RIPE;
    }
  }

  // 익은 지(=심은 뒤 오래) 1년 넘었는데 이벤트 없이 방치 → 오래 익은 박
  if (age >= YEAR) return GourdState.OLD_RIPE;

  if (age < MONTH) return GourdState.SPROUT;
  return GourdState.GROWING;
}

/**
 * 리마인드 대상인지 (1년/3년/5년 경과, 총 3회)
 * @returns {number|null} 몇 주년(1/3/5) or null
 */
export function checkRemindDue(m, now = Date.now()) {
  const anchor = m.repaidAt || m.plantedAt;
  const years = (now - anchor) / YEAR;
  for (const milestone of [5, 3, 1]) {
    if (years >= milestone) {
      // 이미 이 마일스톤 이후 리마인드를 보냈으면 skip
      if (m.remindedAt && (m.remindedAt - anchor) / YEAR >= milestone) continue;
      return milestone;
    }
  }
  return null;
}

// ---- 집계 (홈 화면 통계) ----
export function summarize(maeums, now = Date.now()) {
  const received = maeums.filter((m) => m.direction === Direction.RECEIVED);
  const sent = maeums.filter((m) => m.direction === Direction.SENT && !m.repaidAt);

  const roofGourds = received.filter((m) => !m.repaidAt); // 갚을 마음 (지붕 위)
  const opened = received.filter((m) => m.repaidAt); // 전한 마음 (열린 박, 온기)

  return {
    oweCount: roofGourds.length,      // 갚을 마음
    warmthCount: opened.length,        // 전한 마음 (온기)
    skyCount: Math.min(sent.length, 5), // 하늘 궤적 (최대 5)
    sentTotal: sent.length,
  };
}

// ---- 상태별 카피 (인연 목록/타임라인) ----
export function stateCopy(m, now = Date.now()) {
  const state = computeGourdState(m, now);
  const name = ""; // 호출부에서 이름 채움
  switch (state) {
    case GourdState.SPROUT:
    case GourdState.GROWING:
      return { tag: state === GourdState.SPROUT ? "심음" : "자람", dotColor: "#B9D08A" };
    case GourdState.RIPE:
      return { tag: "익음", dotColor: "#EF9F27", cta: "갚을 때가 왔어요" };
    case GourdState.OPENED:
      return { tag: "열림", dotColor: "#0F6E56" };
    case GourdState.OLD_RIPE:
      return { tag: "오래 익음", dotColor: "#8B6B3E", cta: "안부 물어볼까요?" };
    default:
      return { tag: "", dotColor: "#C4A876" };
  }
}
