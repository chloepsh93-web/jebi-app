"use client";

import { useEffect } from "react";
import { Direction } from "@/lib/model";
import { formatShort, won } from "@/lib/format";
import { COPY } from "@/lib/copy";
import { logEvent } from "@/lib/metrics";

/** 제비 편에 보낸 마음 — 전체 보기 */
export default function SentList({ yeons, maeums, onClose, onOpenMaeum, onAdd }) {
  useEffect(() => { logEvent("history_viewed", {}, "home"); }, []); // J10 사전
  const sent = maeums
    .filter((m) => m.direction === Direction.SENT)
    .sort((a, b) => b.plantedAt - a.plantedAt);
  const nameOf = (id) => yeons.find((y) => y.id === id)?.name || "소중한 분";

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="navbar" style={{ padding: "0 0 4px" }}>
          <button className="nav-back" onClick={onClose} aria-label="뒤로">‹</button>
          <div className="nav-title">제비 편에 보낸 마음</div>
          <div className="nav-spacer" />
        </div>
        <p className="sub">하늘을 나는 제비 {sent.length} · 눌러서 자세히 볼 수 있어요</p>
        {sent.length === 0 && (
          <div className="empty">
            {COPY.EMPTY.sentEmpty}
            <br />
            <button className="btn btn-primary" onClick={onAdd}>
              {COPY.EMPTY.sentCta}
            </button>
          </div>
        )}
        {sent.map((m) => (
          <div className="yeon-item" key={m.id} onClick={() => onOpenMaeum(m)}>
            <div className="y-tags">
              <span className="y-dot" style={{ background: "var(--color-sky)" }} />
              <span className="y-tag">{m.eventType}</span>
              {m.eventDate && <span className="y-when">· {formatShort(m.eventDate)}</span>}
            </div>
            <div className="y-copy">
              {nameOf(m.yeonId)}님께 {m.eventType} 마음을 전했어요
            </div>
            {m.amount != null && <div className="y-who">보낸 봉투 · {won(m.amount)}</div>}
          </div>
        ))}
        <button className="btn btn-ghost" onClick={onClose} style={{ marginTop: 8 }}>
          닫기
        </button>
      </div>
    </div>
  );
}
