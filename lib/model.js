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

export const RelationColor = {
  가족: "var(--color-tag-family)",
  회사: "var(--color-tag-work)",
  학교: "var(--color-tag-school)",
  지인: "var(--color-tag-friend)",
};

// 박 상태 (지붕 위 박 = 내가 받은 마음, 갚아야 할 것)
export const GourdState = {
  SPROUT: "새싹",        // 심음 직후 ~ 1개월
  GROWING: "자라는 박",   // 1개월 ~ 상대 이벤트 D-30
  RIPE: "익은 박",        // D-30 ~ 답례 완료 (곧 다녀올 때)
  OPENED: "열린 박",      // 답례 완료 (종결, 온기 자산)
  OLD_RIPE: "오래 익은 박", // 익은 상태 1년+ (리마인드 트리거)
};

// 방향
export const Direction = {
  RECEIVED: "받음", // 상대가 나에게 → 지붕에 박 심김
  SENT: "보냄",     // 내가 상대에게 → 하늘 궤적
};

// 전달 방식 (maeums.asset_kind — 마이그레이션 전에는 null = 미표기)
// 주의: maeums.kind는 경조사 종류라 별도 컬럼을 쓴다.
export const AssetKind = {
  CASH: "cash", // 현금 (봉투·계좌이체)
  GOODS: "goods", // 선물·물건 (상품권·기프티콘·실물 — '고른 물건')
};
export const AssetKindLabel = {
  cash: "현금",
  goods: "선물",
};

/**
 * 전달 방식 정규화 — DB CHECK 없이 앱 레벨에서 강제한다.
 * 2분류→3분류 변경이 마이그레이션 없이 되도록.
 */
export function normalizeAssetKind(v) {
  return v === AssetKind.GOODS ? AssetKind.GOODS : AssetKind.CASH;
}

// ---- 엔티티 ----

/**
 * 인연 (Relationship) — 한 사람
 * @typedef {Object} Yeon
 * @property {string} id
 * @property {string} name         - 이름
 * @property {string} relationTag  - "가족"|"회사"|"학교"|"지인"
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
 * @property {number|null} amount   - 전한 마음 (원, null 가능)
 * @property {string|null} eventDate - 경조사 날짜 "YYYY-MM-DD" (연도미상 "????-MM-DD")
 * @property {string|null} eventTime
 * @property {string|null} place
 * @property {string|null} account  - 계좌 (관계의 기억)
 * @property {number} plantedAt     - 심은/보낸 시각 timestamp
 * @property {number|null} repaidAt - 갚은/답례받은 시각 (열림) — null이면 미완결
 * @property {number|null} remindedAt - 마지막 리마인드 발송 시각
 * @property {string|null} grownFromSeedId - 이 박이 자라난 박씨의 원본 마음 id (박씨에서 자란 박)
 * @property {string} gourdState    - GourdState (받은 마음만 의미. 계산됨)
 */

// ---- 박 상태 계산 (기록한 행동 기반) ----
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
  if (!isTransferRecord(m)) return null; // J02: 일정만 받은 것은 박이 아니다
  if (m.repaidAt) return GourdState.OPENED; // 답례 완료 → 열린 박

  // 경과 시간·금액은 성장 조건이 아니다. 사용자 행동만 반영한다.
  if (m.attendance === "attended") return GourdState.RIPE;
  if (m.attendance === "planned") return GourdState.GROWING;
  return GourdState.SPROUT;
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

// ---- 박씨 (정의 순환) ----
/**
 * 심어지길 기다리는 박씨 목록.
 * 열린 박(=답례 완료된 받은 마음) 중, 아직 어떤 박의 박씨로도 심어지지 않은 것.
 * @param {Array} maeums
 * @returns {Array} 최신 열린 순
 */
export function availableSeeds(maeums) {
  const used = new Set(
    maeums.filter((m) => m.grownFromSeedId).map((m) => m.grownFromSeedId)
  );
  return transfersOf(maeums) // J02: 금품 기록만 박씨가 된다
    .filter(
      (m) =>
        m.direction === Direction.RECEIVED && m.repaidAt && !used.has(m.id)
    )
    .sort((a, b) => b.repaidAt - a.repaidAt);
}

// ---- 인연별 차액 요약 (P1-2) ----
// "○○님이 3만원 더 주셨어요" / "주고받은 게 비슷해요"
// 숫자는 문장으로 번역 — '정' 프레임의 북극성
export function summarizeYeon(maeums) {
  const list = transfersOf(maeums); // J02: 금품 기록만 합산
  const received = list.filter((m) => m.direction === Direction.RECEIVED);
  const sent = list.filter((m) => m.direction === Direction.SENT);
  const receivedTotal = received.reduce((a, m) => a + (m.amount || 0), 0);
  const sentTotal = sent.reduce((a, m) => a + (m.amount || 0), 0);
  return {
    receivedTotal,
    sentTotal,
    count: list.length,
    diff: receivedTotal - sentTotal, // +면 받은 정이 더 많음
    // J03 (QA03/QA04, S10): 미입력 건수 병기 — null과 0을 구분한다.
    // null = 미입력, 0 = 0원 명시. 합계에는 알려진 금액만 들어간다.
    receivedUnknown: received.filter((m) => m.amount == null).length,
    sentUnknown: sent.filter((m) => m.amount == null).length,
  };
}

// ---- 집계 (홈 화면 통계) ----
// J02: 금품 기록(transfer)만 집계한다. 초대 수신·참석만으로는 거래가 생기지 않는다.
export function summarize(maeums, now = Date.now()) {
  const transfers = transfersOf(maeums);
  const received = transfers.filter((m) => m.direction === Direction.RECEIVED);
  const sent = transfers.filter((m) => m.direction === Direction.SENT && !m.repaidAt);

  const roofGourds = received.filter((m) => !m.repaidAt); // 다녀올 마음 (지붕 위)
  const opened = received.filter((m) => m.repaidAt); // 전한 마음 (열린 박, 온기)

  return {
    oweCount: roofGourds.length,      // 다녀올 마음
    warmthCount: opened.length,        // 전한 마음 (온기)
    skyCount: Math.min(sent.length, 5), // 하늘 궤적 (최대 5)
    sentTotal: sent.length,
  };
}

// ============================================================
// J02: 일정/참석/금품 모델 분리 (2026-09-30)
// 인계서 04-DATA-API 도메인 계약을 기존 maeums 테이블 위에 구현한다.
// DB 스키마 변경 없이 동작하며, attendance/date_precision 컬럼이 있으면
// 사용하고 없으면 조용히 건너뛴다 (asset_kind 패턴과 동일).
//
// - 모든 행은 경조사(Occasion) 정보를 가진다 (누구의 무슨 경조사, 언제 어디서).
// - 금품(Transfer)인 행만 금액 합계·박(지붕) 집계에 포함된다.
// - 초대 수신·참석 기록만으로는 거래가 생성되지 않는다 (J02 수용 기준).
// ============================================================

/** 참석 상태 */
export const Attendance = {
  UNKNOWN: "unknown",   // 미정
  PLANNED: "planned",   // 참석 예정
  ATTENDED: "attended", // 참석함
  DECLINED: "declined", // 불참
};
export const AttendanceLabel = {
  unknown: "미정",
  planned: "참석 예정",
  attended: "참석함",
  declined: "불참",
};
export function normalizeAttendance(v) {
  return Object.values(Attendance).includes(v) ? v : Attendance.UNKNOWN;
}

/** 날짜 정밀도 */
export const DatePrecision = {
  EXACT: "exact",     // YYYY-MM-DD 확정
  MONTH: "month",     // YYYY-MM (일 미상)
  UNKNOWN: "unknown", // 날짜 미정
};
/**
 * 기존 event_date 텍스트 → 정밀도 판정.
 * "????-MM-DD" / null / "" → unknown (연도 미상 관행 포함)
 */
export function parseDatePrecision(eventDate) {
  if (!eventDate) return DatePrecision.UNKNOWN;
  if (/^\?\?\?\?-\d{2}-\d{2}$/.test(eventDate)) return DatePrecision.UNKNOWN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return DatePrecision.EXACT;
  if (/^\d{4}-\d{2}$/.test(eventDate)) return DatePrecision.MONTH;
  return DatePrecision.UNKNOWN;
}

/** 금품 분류 (인계서 계약) */
export const TransferCategory = {
  MONEY: "money", // 현금·계좌
  GIFT: "gift",   // 선물·물건
  HELP: "help",   // 비금전적 도움
};
/** 금품 상태 (인계서 계약) */
export const TransferStatus = {
  PLANNED: "planned",     // 예정
  COMPLETED: "completed", // 완료
};

/**
 * 이 행이 실제 금품 기록인지 (J02 핵심 판정).
 * - amount !== null (0원 명시 포함) → 금품
 * - assetKind !== null (선물 등 금액 미상 포함) → 금품
 * 초대 수신·참석 기록만으로는 false → 거래 생성 없음.
 */
export function isTransferRecord(m) {
  if (!m) return false;
  return m.amount != null || m.assetKind != null;
}

/** 금품 기록만 추출 */
export function transfersOf(maeums) {
  return (maeums || []).filter(isTransferRecord);
}

/**
 * 경조사(occasion) 그룹 키 — 같은 인연의 같은 경조사 행사를 묶는다.
 * occasions 테이블이 생기기 전까지의 임시 키다.
 */
export function occasionKeyOf(m) {
  return [m.yeonId, m.eventType || "기타", m.eventDate || "?"].join("|");
}

/**
 * 일정 날짜 검증 (J03, QA05).
 * - dateUnknown이면 eventDate는 null로 저장한다 (저장 호출자가 null로 변환).
 * - requireDate인데 날짜도 없고 미정도 아니면 fieldError를 돌려준다.
 */
export function validateOccasionDate({ date, dateUnknown, requireDate = false }) {
  if (dateUnknown) return {};
  if (!date) {
    if (requireDate) return { date: "날짜를 입력하거나 '날짜 미정'을 선택해주세요." };
    return {};
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) && !/^\?\?\?\?-\d{2}-\d{2}$/.test(date)) {
    return { date: "날짜 형식을 확인해주세요." };
  }
  const normalized = date.startsWith("????") ? "2000" + date.slice(4) : date;
  const parsed = new Date(normalized + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) return { date: "실제로 존재하는 날짜를 입력해주세요." };
  return {};
}

/**
 * 구(舊) 모호 행 판정 — J02 이전에 direction=받음·금액없음·선물표기없음으로
 * 저장된 행. 초대인지 받은 돈인지 알 수 없어 "확인 필요"로 표기한다
 * (인계서 마이그레이션 지침: 자동 추정 금지).
 */
const J02_CUTOFF = new Date("2026-09-30T00:00:00+09:00").getTime();
export function needsReview(m) {
  if (!m) return false;
  return (
    m.direction === Direction.RECEIVED &&
    !isTransferRecord(m) &&
    (m.plantedAt || 0) < J02_CUTOFF
  );
}