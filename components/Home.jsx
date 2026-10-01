"use client";

import { useState } from "react";
import { A } from "@/lib/assets";
import { GourdState, Direction, computeGourdState, summarize, isTransferRecord } from "@/lib/model";
import { formatShort, dday, ym } from "@/lib/format";
import { dueToRepay, nextEvent } from "@/lib/alerts";
import { collectNudges } from "@/lib/affiliate";
import { Glossary } from "./ui";
import AffiliateNudge from "./AffiliateNudge";
import { COPY } from "@/lib/copy";

const GOURD_IMG = {
  [GourdState.SPROUT]: A.gourd_small,
  [GourdState.GROWING]: A.gourd_small,
  [GourdState.RIPE]: A.gourd_big,
  [GourdState.OLD_RIPE]: A.gourd_old,
  [GourdState.OPENED]: A.gourd_open,
};
const ROOF_POS = [
  { top: "17%", left: "34%", w: "8%" },
  { top: "14%", left: "47.5%", w: "6.5%" },
  { top: "19%", left: "58.5%", w: "7.5%" },
  { top: "13%", left: "27%", w: "6%" },
  { top: "20%", left: "68%", w: "7%" },
];

/**
 * 홈 · 우리 집
 * - P1-1: 익은 박마다 [다녀왔어요] 액션 (핵심 순환)
 * - P2-3: 빈 상태에서 앱의 가치를 설득하는 카피
 */
export default function Home({
  yeons, maeums, alertCount, seeds = [],
  onRepay, onOpenAlerts, onAdd, onOpenYeon, onOpenSent, onPlantSeed, onShareStory,
}) {
  const stats = summarize(maeums);
  const empty = maeums.length === 0;
  const roofGourds = maeums.filter(
    // J02: 금품 기록만 박이 된다 — 초대·참석만으로는 지붕에 박이 그려지지 않는다
    (m) => m.direction === Direction.RECEIVED && !m.repaidAt && isTransferRecord(m)
  );
  const due = dueToRepay(maeums);
  const upcoming = nextEvent(maeums);
  // J06: 날짜 미정(예정 순 제외) 경조사 — 확인 필요 섹션용
  const dateless = maeums.filter(
    (m) => !m.repaidAt && (!m.eventDate || m.eventDate.startsWith("????"))
  );
  const sentOpen = maeums.filter((m) => m.direction === Direction.SENT && !m.repaidAt);
  const nameOf = (id) => yeons.find((y) => y.id === id)?.name || "소중한 분";

  // 첫 박씨 힌트 (1회성) — P1-6
  const [seedHintSeen, setSeedHintSeen] = useState(() => {
    try { return localStorage.getItem("jebi:seed-hint") === "1"; } catch { return true; }
  });
  const dismissSeedHint = () => {
    try { localStorage.setItem("jebi:seed-hint", "1"); } catch { /* noop */ }
    setSeedHintSeen(true);
  };

  // "챙길 때" 돌봄 후보 (어필리에이트 UI 구조 — CTA는 파트너 설정 전까지 숨김)
  const nudges = collectNudges(maeums, yeons);
  const upcomingNudge = nudges.find((n) => n.kind === "upcoming");
  const oldRipeNudges = nudges.filter((n) => n.kind === "old_ripe");

  return (
    <div className="content">
      <div className="navbar">
        <div className="nav-spacer" />
        <div className="nav-title">우리 집</div>
        <button className="bell-wrap" onClick={onOpenAlerts} aria-label="알림">
          <img src={A.bell} alt="알림" />
          {alertCount > 0 && <span className="bell-badge">{alertCount}</span>}
        </button>
      </div>

      <div className="home-section-heading">
        <span className="home-eyebrow">오늘 챙길 마음</span>
        <h2>다가오는 인연의 순간</h2>
      </div>
      {/* 다가오는 경조사 — 목업 schedule-card 스펙 */}
      {/* QA16: 예정 없음도 구분된 안내 */}
      {!upcoming && (
        <div className="schedule-card schedule-empty">
          <span className="txt" style={{ color: "var(--color-text-secondary)" }}>
            {empty ? "첫 소식을 기록하면 다가오는 일정을 여기서 볼 수 있어요." : "다가오는 경조사가 없어요. 날짜가 정해진 소식을 기록해주세요."}
          </span>
        </div>
      )}
      {upcoming && (
        <button type="button" className="schedule-card" onClick={() => onOpenYeon(upcoming.yeonId)}>
          <div className="row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <span className="txt">
              {formatShort(upcoming.eventDate)} · {nameOf(upcoming.yeonId)} {upcoming.eventType}
            </span>
            <span className="dday">{dday(upcoming.eventDate)}</span>
          </div>
          <div className="subrow">
            {upcoming.eventType === "부고" ? "조문 일정 확인하기 ›" : "일정 확인하기 ›"}
          </div>
        </button>
      )}

      {/* J06/S04: 날짜 미정 경조사 — 예정 순에서 제외되지만 확인 필요 섹션에 표시 */}
      {dateless.length > 0 && (
        <div className="dateless-card">
          <p className="dateless-title">날짜를 몰라요 · {dateless.length}건</p>
          {dateless.slice(0, 3).map((m) => (
            <button key={m.id} className="dateless-row" onClick={() => onOpenYeon(m.yeonId)}>
              <span className="dateless-txt">{nameOf(m.yeonId)} · {m.eventType}</span>
              <span className="dateless-go">날짜 정하기 ›</span>
            </button>
          ))}
        </div>
      )}

      <div className="home-house">
        <img className="house" src={A.house_empty} alt="우리 집" />
        <img className="jebi-nest" src={A.jebi_perched} alt="둥지 곁 제비" />
        {roofGourds.slice(0, 5).map((m, i) => {
          const st = computeGourdState(m);
          const pos = ROOF_POS[i];
          return (
            <div key={m.id} className="roof-gourd"
              style={{ top: pos.top, left: pos.left, width: pos.w }}>
              <img src={GOURD_IMG[st] || A.gourd_small} alt={st} />
            </div>
          );
        })}
      </div>

      {empty ? (
        <p className="home-caption">
          첫 기록부터 우리 집의 이야기가 시작돼요.
          <br />
          소식을 기억하고, 소중한 순간을 챙겨요.
        </p>
      ) : (
        <p className="home-caption">
          지붕 위 <span className="em">박 {stats.oweCount}개</span>가 자라고 있어요
          <br />
          전한 마음 {stats.warmthCount}개가 우리 집을 밝히고 있어요
        </p>
      )}

      <div className="home-stats">
        <div className="stat">
          <div className="lbl">받은 마음</div>
          <div className="val">{stats.oweCount}<span className="sub">개 · 지붕 위</span></div>
        </div>
        <div className="stat">
          <div className="lbl">전한 마음</div>
          <div className="val">{stats.warmthCount}<span className="sub">개 · 온기</span></div>
        </div>
      </div>

      <details className="home-glossary"><summary>제비의 말이 궁금해요</summary><Glossary compact /></details>

      {/* 정의 순환 — 심어지길 기다리는 박씨 */}
      {seeds.length > 0 && (
        <div className="seed-section">
          <div className="seed-title">심어지길 기다리는 박씨 {seeds.length}개</div>
          <div className="seed-sub">제비가 물어다 준 박씨예요. 심으면 정이 이어져요</div>
          {!seedHintSeen && (
            <div className="seed-hint">
              <p>
                열린 박에서 제비가 물어온 박씨예요.
                새 마음을 기록할 때 이 박씨를 심으면, 정이 이어져요.
              </p>
              <button onClick={dismissSeedHint} aria-label="닫기">×</button>
            </div>
          )}
          {seeds.map((s) => (
            <button
              key={s.id}
              className="seed-row"
              onClick={() => onPlantSeed && onPlantSeed(s.id)}
            >
              <span className="seed-txt">
                {nameOf(s.yeonId)}님과의 박에서 제비가 물어온 박씨 · {ym(s.repaidAt)}
              </span>
              <span className="seed-go">심기 ›</span>
            </button>
          ))}
          <button className="seed-story-link" onClick={onShareStory}>
            박씨 이야기가 궁금해요
          </button>
        </div>
      )}

      {/* "챙길 때" — 다가오는 경조사 돌봄 (어필리에이트 UI 구조) */}
      {upcomingNudge && <AffiliateNudge nudge={upcomingNudge} maeums={maeums} />}

      {/* P2-①: 다녀올 때가 온 박 — 핵심 순환 (행 레이아웃: 텍스트 + 규격 버튼) */}
      {due.map((m) => (
        <div className="repay-card" key={m.id}>
          <div className="repay-body">
            <b>{nameOf(m.yeonId)}</b>님과의 박이 익었어요
            <br />
            <span className="repay-sub">기억해둔 마음을 다시 살펴볼까요?</span>
          </div>
          <button className="btn-inline btn-primary" onClick={() => onOpenYeon(m.yeonId)}>
            기록 확인하기
          </button>
        </div>
      ))}

      {/* "챙길 때" — 오래 익은 박 돌봄 (어필리에이트 UI 구조) */}
      {oldRipeNudges.map((n) => (
        <AffiliateNudge key={n.maeum.id} nudge={n} maeums={maeums} />
      ))}

      {/* 제비 편에 보낸 마음 (하늘) */}
      {sentOpen.length > 0 && (
        <button type="button" className="sky-section" onClick={onOpenSent}>
          <div className="sky-title">제비 편에 보낸 마음</div>
          <div className="sky-sub">
            하늘을 나는 제비 {Math.min(sentOpen.length, 5)}
            <br />
            남겨둔 전한 마음을 돌아봐요
          </div>
          <div className="sky-more">전체 보기 ›</div>
        </button>
      )}

      <button className="fab" onClick={onAdd}>
        + 소식 기록하기
      </button>
    </div>
  );
}
