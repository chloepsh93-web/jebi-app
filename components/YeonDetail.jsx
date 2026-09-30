"use client";

import { useState } from "react";
import { GourdState, Direction, AssetKind, computeGourdState, summarizeYeon, transfersOf } from "@/lib/model";
import { store } from "@/lib/store";
import { splitLabel } from "@/lib/splits";
import { formatShort, relTime, won, ym } from "@/lib/format";
import { parseEventDate } from "@/lib/format";
import { Avatar } from "./ui";

/**
 * 인연 타임라인 (개별) — 목업 스펙
 * - 상단: 아바타 블록 (민화 프로필) + 이름 + "관계 · 주고받은 마음 N개"
 * - 타임라인: 좌측 선 + 상태별 도트, 태그 pill, 날짜/내용/전한 마음
 * - P1-1: 받은 마음마다 다녀왔음 액션 · P1-2: 막다른 화면 금지
 */
const ST_TAG = {
  [GourdState.SPROUT]: { t: "심음", c: "st-sprout" },
  [GourdState.GROWING]: { t: "자람", c: "st-growing" },
  [GourdState.RIPE]: { t: "익음", c: "st-ripe" },
  [GourdState.OPENED]: { t: "열림", c: "st-opened" },
  [GourdState.OLD_RIPE]: { t: "오래 익음", c: "st-old" },
};

function amtLabel(m) {
  const dirLabel = m.direction === Direction.RECEIVED ? "받은" : "보낸";
  // 아직 치르지 않은 미래 경조사의 받은 마음 = 담아둔 봉투
  if (m.direction === Direction.RECEIVED && !m.repaidAt && m.eventDate && !m.eventDate.startsWith("????")) {
    const p = parseEventDate(m.eventDate, new Date());
    if (p && p.date.getTime() > Date.now()) return "담아둔";
  }
  return dirLabel;
}

export default function YeonDetail({
  yeon, maeums, yeons = [], allMaeums = [],
  splitsByMaeum = null, // Map<maeumId, Array<{yeonId, amount}>> — 미지원이면 null
  onBack, onRepay, onOpenMaeum, onAddMaeum, onEditYeon,
}) {
  if (!yeon) return null;
  // P1-2: 마음/정산 모드 토글 (사용자별 저장, 기본 '마음')
  const [mode, setMode] = useState(() => store.getStatementMode());
  const changeMode = (m) => {
    setMode(m);
    store.setStatementMode(m);
  };
  const sorted = [...maeums].sort((a, b) => b.plantedAt - a.plantedAt);
  const balance = summarizeYeon(maeums);
  // 차액 문장형 요약 (숫자를 문장으로 번역 — '정' 프레임)
  const balanceCopy = (() => {
    if (balance.count === 0) return null;
    if (balance.diff > 0)
      return { text: `${yeon.name}님이 ${won(balance.diff)} 더 주셨어요`, cls: "bal-received" };
    if (balance.diff < 0)
      return { text: `내가 ${won(-balance.diff)} 더 전했어요`, cls: "bal-sent" };
    return { text: "주고받은 게 비슷해요", cls: "bal-neutral" };
  })();
  // 전달 방식 집계 — '정' 톤 문장 (횟수 중심, 금액 합계 노출 없음)
  // J02/J03: 금품 기록만 집계. 일정만 있는 행은 "적지 않은 마음"에 넣지 않는다.
  // 미표기(null=마이그레이션 전 기록)는 별도 카운트. 전부 현금이면 조용히 숨김.
  const kindSummary = (() => {
    const transfers = transfersOf(maeums);
    const known = transfers.filter((m) => m.assetKind);
    if (known.length === 0) return null;
    const cash = known.filter((m) => m.assetKind === AssetKind.CASH).length;
    const goods = known.filter((m) => m.assetKind === AssetKind.GOODS).length;
    const unknown = transfers.length - known.length;
    if (goods === 0 && unknown === 0) return null;
    const parts = [];
    if (cash > 0) parts.push(`현금으로 ${cash}번`);
    if (goods > 0) parts.push(`선물로 ${goods}번`);
    let text = `${yeon.name}님과 ${parts.join(" · ")} 마음을 나눴어요`;
    if (unknown > 0) text += ` · 어떻게 전했는지 적지 않은 마음 ${unknown}개`;
    return text;
  })();
  // J03 (QA03/QA04, S10): 금액 미입력 건수 병기 — 합계는 알려진 금액만
  const unknownCopy = (() => {
    const parts = [];
    if (balance.receivedUnknown > 0) parts.push(`받은 마음 중 금액 미입력 ${balance.receivedUnknown}개`);
    if (balance.sentUnknown > 0) parts.push(`전한 마음 중 금액 미입력 ${balance.sentUnknown}개`);
    return parts.length > 0 ? parts.join(" · ") : null;
  })();
  // 박씨의 원본 마음 → 그 인연 이름 (정의 순환)
  const seedYeonNameOf = (m) => {
    if (!m.grownFromSeedId) return null;
    const seed = allMaeums.find((x) => x.id === m.grownFromSeedId);
    if (!seed) return null;
    return yeons.find((y) => y.id === seed.yeonId)?.name || null;
  };
  // N빵 분할 → "○○님 외 N명과 함께" (테이블 미지원이면 null → 숨김)
  const splitTextOf = (m) => {
    if (!splitsByMaeum) return null;
    const sp = splitsByMaeum.get ? splitsByMaeum.get(m.id) : splitsByMaeum[m.id];
    return splitLabel(yeon.name, sp);
  };

  return (
    <div className="content">
      <div className="navbar">
        <button className="nav-back" onClick={onBack} aria-label="뒤로">‹</button>
        <div className="nav-title">{yeon.name}와의 인연</div>
        <div className="nav-spacer" />
      </div>

      {/* 목업 tl-profile: 아바타 블록 */}
      <div className="tl-profile">
        <Avatar gender={yeon.avatarGender} name={yeon.name} size={64 /* v2.1: --size-avatar-lg */} />
        <div>
          <p className="tl-name">
            {yeon.name}
            {yeon.relationTag && <span className="detail-tag">{yeon.relationTag}</span>}
          </p>
          <p className="tl-sub">
            {yeon.relationTag || "지인"} · 주고받은 마음 {maeums.length}개
          </p>
        </div>
      </div>
      <div className="detail-actions">
        <button className="chip-btn" onClick={() => onAddMaeum(yeon.id)}>
          + 마음 기록하기
        </button>
        <button className="chip-btn" onClick={() => onEditYeon(yeon)}>
          인연 수정
        </button>
      </div>

      {/* P1-2: 차액 문장형 요약 카드 — 숫자를 문장으로 번역 */}
      {mode === "정산" && balanceCopy && (
        <div className="yeon-balance">
          <p className={`bal-main ${balanceCopy.cls}`}>{balanceCopy.text}</p>
          <p className="bal-sub tnum">
            받은 정 {won(balance.receivedTotal)} · 전한 정 {won(balance.sentTotal)}
          </p>
          {unknownCopy && <p className="bal-sub tnum">{unknownCopy}</p>}
          {kindSummary && <p className="bal-sub tnum">{kindSummary}</p>}
        </div>
      )}

      {/* P1-2: 마음/정산 모드 토글 — 보고 싶을 때만 보는 토글이 배려 */}
      {sorted.length > 0 && (
        <div className="mode-toggle" role="tablist" aria-label="요약 모드">
          <button
            className={`mode-btn${mode === "마음" ? " on" : ""}`}
            onClick={() => changeMode("마음")}
            role="tab"
            aria-selected={mode === "마음"}
          >
            마음 모드
          </button>
          <button
            className={`mode-btn${mode === "정산" ? " on" : ""}`}
            onClick={() => changeMode("정산")}
            role="tab"
            aria-selected={mode === "정산"}
          >
            정산 모드
          </button>
        </div>
      )}

      {mode === "정산" && sorted.length > 0 ? (
        /* 정산 모드 — 건별 전한 마음 표 (tabular-nums로 자릿수 흔들림 방지) */
        <div className="settle-list">
          {sorted.map((m) => {
            const sent = m.direction === Direction.SENT;
            return (
              <div className="st-row" key={m.id} onClick={() => onOpenMaeum(m)}>
                <span className="st-when">
                  {m.eventDate && !m.eventDate.startsWith("????")
                    ? formatShort(m.eventDate)
                    : ym(m.plantedAt)}
                </span>
                <span className="st-what">{m.eventType || "경조사"}</span>
                <span className={`st-dir ${sent ? "sent" : "recv"}`}>
                  {sent ? "전한" : "받은"}
                </span>
                <span className="st-amt tnum">{m.amount != null ? won(m.amount) : "—"}</span>
              </div>
            );
          })}
        </div>
      ) : sorted.length === 0 ? (
        <p className="empty">
          아직 주고받은 마음이 없어요.
          <br />
          첫 마음을 기록하면 이 인연의 박이 자라기 시작해요.
          <br />
          <button className="btn btn-primary" onClick={() => onAddMaeum(yeon.id)}>
            첫 마음 기록하기
          </button>
        </p>
      ) : (
        <div className="timeline">
          <div className="tl-line">
            {sorted.map((m) => {
              const st = computeGourdState(m);
              const tag = ST_TAG[st] || { t: "", c: "" };
              const repayable = m.direction === Direction.RECEIVED && !m.repaidAt;
              const sent = m.direction === Direction.SENT;
              const seedName = seedYeonNameOf(m);
              return (
                <div className={`tl-event ${tag.c}`} key={m.id} onClick={() => onOpenMaeum(m)}>
                  <div className="tl-tags">
                    {tag.t && <span className={`tag ${tag.c}`}>{tag.t}</span>}
                    {sent && <span className="tag dir-sent">보냄</span>}
                    {m.grownFromSeedId && <span className="tag seed-grown">박씨에서 자란 박</span>}
                    <span className="tl-when">
                      {m.eventDate && !m.eventDate.startsWith("????")
                        ? formatShort(m.eventDate)
                        : `${ym(m.plantedAt)} · ${relTime(m.plantedAt)}`}
                      {m.eventTime ? ` ${m.eventTime}` : ""}
                    </span>
                  </div>
                  <p className="tl-what">
                    {m.memo || `${m.eventType || "경조사"} · ${sent ? "마음을 전했어요" : "마음을 받았어요"}`}
                  </p>
                  {seedName && <div className="tl-seed">{seedName}님의 박씨에서 자랐어요</div>}
                  {splitTextOf(m) && <div className="tl-seed">{splitTextOf(m)}</div>}
                  {m.place && <div className="tl-place">{m.place}</div>}
                  {m.amount != null && (
                    <div className="tl-amt tnum">{amtLabel(m)} 마음 · {won(m.amount)}</div>
                  )}
                  {m.repaidAt && <div className="tl-done">✓ 다녀왔어요 · 박이 열렸어요</div>}
                  {repayable && (
                    <div className="tl-repay">
                      <button
                        className="btn-inline btn-primary"
                        onClick={(e) => { e.stopPropagation(); onRepay(m.id); }}
                      >
                        다녀왔어요
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
