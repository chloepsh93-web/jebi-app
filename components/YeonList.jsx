"use client";

import { useState, useRef } from "react";
import { GourdState, RelationColor, computeGourdState } from "@/lib/model";
import { relTime, ym } from "@/lib/format";
import { logEvent } from "@/lib/metrics";
import { Avatar } from "./ui";
import { COPY } from "@/lib/copy";

/**
 * 인연 목록 탭
 * - P1-2: 항목을 누르면 타임라인으로 (막다른 화면 금지)
 * - P2-3: 빈 상태에서 가치 설득 카피
 * - P2-4: 동명이인 구분 표시
 */
const TAG = {
  [GourdState.SPROUT]: { t: "심음", c: "var(--color-gourd-sprout)" },
  [GourdState.GROWING]: { t: "자람", c: "var(--color-gourd-growing)" },
  [GourdState.RIPE]: { t: "익음", c: "var(--color-gourd-ripe)" },
  [GourdState.OPENED]: { t: "열림", c: "var(--color-gourd-opened)" },
  [GourdState.OLD_RIPE]: { t: "오래 익음", c: "var(--color-gourd-old)" },
};

function copyFor(name, st) {
  switch (st) {
    case GourdState.SPROUT: return `${name}님과의 인연이 시작됐어요`;
    case GourdState.GROWING: return `${name}님과의 박이 자라고 있어요`;
    case GourdState.RIPE: return `${name}님과의 박이 익었어요 — ${COPY.HOME.repaySub}`;
    case GourdState.OPENED: return `${name}님과의 박이 열렸어요`;
    case GourdState.OLD_RIPE: return `${name}님과의 박이 오래 익었어요 — 안부 물어볼까요?`;
    default: return `${name}님`;
  }
}

export default function YeonList({ yeons, maeums, tagsByYeon = null, tagsSupported = false, onOpen, onAdd, onEdit }) {
  // P2-4: 동명이인 카운트
  const nameCounts = {};
  yeons.forEach((y) => { nameCounts[y.name] = (nameCounts[y.name] || 0) + 1; });

  // 라운드2: 태그 필터 (테이블 미지원이면 숨김)
  const [tagFilter, setTagFilter] = useState(null);
  // J06: 인연 검색
  const [query, setQuery] = useState("");
  const searchedRef = useRef(false); // J10: 검색 세션당 1회만 기록
  const onQuery = (v) => {
    setQuery(v);
    if (v.trim() && !searchedRef.current) {
      searchedRef.current = true;
      logEvent("person_search", {}, "people"); // J10 사전 — 검색어 수집 금지
    }
    if (!v.trim()) searchedRef.current = false;
  };
  const tagsOf = (id) => (tagsByYeon?.get ? tagsByYeon.get(id) : tagsByYeon?.[id]) || [];
  const allTags = tagsSupported
    ? [...new Set(yeons.flatMap((y) => tagsOf(y.id)))]
    : [];

  if (yeons.length === 0) {
    return (
      <div className="content">
        <div className="navbar">
          <div className="nav-spacer" /><div className="nav-title">인연</div>
          <button className="nav-action" onClick={onAdd}>+ 추가</button>
        </div>
        <p className="empty">
          아직 인연이 없어요.
          <br />
          소식이 오면 제비가 물어다 주고,
          <br />
          그 인연의 박이 지붕 위에서 자라요.
          <br />
          <button className="btn btn-primary" onClick={onAdd}>첫 인연 심기</button>
        </p>
      </div>
    );
  }

  const q = query.trim();
  const rows = yeons.map((y) => {
    const ms = maeums
      .filter((m) => m.yeonId === y.id)
      .sort((a, b) => b.plantedAt - a.plantedAt);
    const latest = ms[0];
    const st = latest ? computeGourdState(latest) : null;
    return { y, latest, st, count: ms.length };
  })
    .filter(({ y }) => !tagFilter || tagsOf(y.id).includes(tagFilter))
    .filter(({ y }) => !q || y.name.includes(q))
    .sort((a, b) => (b.latest?.plantedAt || 0) - (a.latest?.plantedAt || 0));

  return (
    <div className="content">
      <div className="navbar">
        <div className="nav-spacer" /><div className="nav-title">인연</div>
        <button className="nav-action" onClick={onAdd}>+ 추가</button>
      </div>
      {/* J06: 인연 검색 */}
      <div className="yeon-search">
        <input
          type="search"
          className="field"
          placeholder="이름으로 찾기"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          aria-label="인연 검색"
        />
      </div>
      {allTags.length > 0 && (
        <div className="tag-filter" role="tablist" aria-label="태그로 보기">
          <button
            type="button"
            className={`chip-btn${!tagFilter ? " on" : ""}`}
            onClick={() => setTagFilter(null)}
            role="tab"
            aria-selected={!tagFilter}
          >
            전체
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip-btn${tagFilter === t ? " on" : ""}`}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
              role="tab"
              aria-selected={tagFilter === t}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="list-sort">최근 상호작용 순</div>
      {rows.length === 0 && q && (
        <p className="empty">
          ‘{q}’에 맞는 인연이 없어요.
          <br />
          <button className="btn btn-ghost" onClick={() => setQuery("")}>검색 지우기</button>
        </p>
      )}
      <div className="yeon-list">
        {rows.map(({ y, latest, st, count }) => {
          const tc = TAG[st] || { t: "", c: "var(--color-tag-friend)" };
          const dup = nameCounts[y.name] > 1;
          const ytags = tagsOf(y.id);
          return (
            <div className="yeon-item" key={y.id} onClick={() => onOpen(y.id)}>
              <Avatar gender={y.avatarGender} name={y.name} size={48 /* v2.1: --size-avatar-md */} />
              <div className="yeon-main">
                <div className="y-tags">
                  <span className="y-dot" style={{ background: tc.c }} />
                  <span className="y-tag">{tc.t}</span>
                  {latest && <span className="y-when">· {relTime(latest.plantedAt)}</span>}
                  <span className="y-when">· 마음 {count}개</span>
                </div>
                <div className="y-copy">{copyFor(y.name, st)}</div>
                <div className="y-who">
                  <span
                    className="y-dot"
                    style={{
                      background: RelationColor[y.relationTag] || "var(--color-tag-friend)",
                      display: "inline-block", marginRight: 5,
                    }}
                  />
                  {y.name} · {y.relationTag || "지인"}
                  {dup && <span> · 첫 기록 {ym(y.createdAt)}</span>}
                </div>
                {ytags.length > 0 && (
                  <div className="yeon-tags">
                    {ytags.map((t) => (
                      <span key={t} className="yeon-tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="chip-btn yeon-edit"
                onClick={(e) => { e.stopPropagation(); onEdit(y); }}
              >
                수정
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
