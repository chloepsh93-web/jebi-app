/**
 * 알림 센터 계산 — 목업의 시스템 알럿 + 리마인드 카드를 실제 데이터로 구동.
 * - check: 어제 끝난 경조사 (D+1) → "잘 다녀오셨어요?"
 * - nudge3: 3일 이상 무응답 → "혹시 다녀오셨다면 알려주세요"
 * - anniversary: 1·3·5년 주년 (checkRemindDue) → 양방향 리마인드 카드
 */
import { Direction, GourdState, checkRemindDue, computeGourdState } from "./model";
import { parseEventDate } from "./format";

const DAY = 24 * 60 * 60 * 1000;

function eventTime(m, now) {
  if (!m.eventDate || m.eventDate.startsWith("????")) return null;
  const p = parseEventDate(m.eventDate, new Date(now));
  return p ? p.date.getTime() : null;
}

export function computeAlerts(maeums, yeons, now = Date.now()) {
  const nameOf = (id) => yeons.find((y) => y.id === id)?.name || "소중한 분";
  const alerts = [];

  for (const m of maeums) {
    const name = nameOf(m.yeonId);
    const evT = eventTime(m, now);

    // 1) 행사 다음 날 확인 (D+1, 미완결)
    if (!m.repaidAt && evT) {
      const daysSince = Math.floor((now - evT) / DAY);
      if (daysSince === 1) {
        const isFuneral = m.eventType === "부고";
        alerts.push({
          id: `check-${m.id}`,
          kind: "check",
          maeumId: m.id,
          title: isFuneral
            ? `${name}님께 마음 잘 전하고 오셨어요?`
            : `${name}님 ${m.eventType}, 잘 다녀오셨어요?`,
          sub: isFuneral
            ? "제비가 조용히 박을 열어드릴게요"
            : "박이 열릴 준비를 하고 있어요",
          actions: ["went", "missed"],
        });
        continue;
      }
      // 2) 3일 무응답 넛지 (제비의 배려)
      if (daysSince >= 3) {
        const lastNudge = m.remindedAt || 0;
        if (now - lastNudge >= 3 * DAY) {
          alerts.push({
            id: `nudge3-${m.id}`,
            kind: "nudge3",
            maeumId: m.id,
            title: "혹시 다녀오셨다면 알려주세요",
            sub: `${name}님 ${m.eventType} · 답 없으시면 3일 뒤에 다시 물어볼게요`,
            actions: ["went", "missed"],
          });
          continue;
        }
      }
    }

    // 3) 주년 리마인드 (1·3·5년)
    const years = checkRemindDue(m, now);
    if (years) {
      if (m.direction === Direction.RECEIVED) {
        alerts.push({
          id: `anniv-${m.id}`,
          kind: "anniversary",
          maeumId: m.id,
          years,
          title: `지붕 위 박이 익은 지 ${years}년이 됐어요`,
          sub: `${name}님이 ${years}년 전 ${m.eventType}에 마음 보내주셨어요. 오랜만에 안부 인사 어때요?`,
          actions: ["greet", "send"],
        });
      } else {
        alerts.push({
          id: `anniv-${m.id}`,
          kind: "anniversary",
          maeumId: m.id,
          years,
          title: `제비 편에 마음 보낸 지 ${years}년이 됐어요`,
          sub: `${years}년 전 ${name}님 ${m.eventType}에 마음을 전하셨어요. 오늘 어떤 하루를 보내고 있는지, 안부를 물어볼까요?`,
          actions: ["greet", "send"],
        });
      }
    }
  }

  return alerts;
}

/** 다녀올 때가 온 박 (홈 인라인 넛지) */
export function dueToRepay(maeums, now = Date.now()) {
  return maeums.filter((m) => {
    if (m.direction !== Direction.RECEIVED || m.repaidAt) return false;
    const st = computeGourdState(m, now);
    return st === GourdState.RIPE || st === GourdState.OLD_RIPE;
  });
}

/** 가장 가까운 미래 경조사 (홈 다가오는 카드) */
export function nextEvent(maeums, now = Date.now()) {
  let best = null;
  let bestT = Infinity;
  for (const m of maeums) {
    if (m.repaidAt || !m.eventDate || m.eventDate.startsWith("????")) continue;
    const p = parseEventDate(m.eventDate, new Date(now));
    if (!p) continue;
    const t = p.date.getTime();
    if (t >= now - DAY && t < bestT) {
      bestT = t;
      best = m;
    }
  }
  return best;
}
