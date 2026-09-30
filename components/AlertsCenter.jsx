"use client";

import { useState } from "react";
import { Direction } from "@/lib/model";
import { computeAlerts } from "@/lib/alerts";
import { canSuggest } from "@/lib/affiliate";
import AffiliateNudge from "./AffiliateNudge";

/**
 * 알림 센터 — 목업 "시스템 알럿" + "리마인드 카드" 스펙
 * - X 없음 · 두 액션 필수 (mini-alert)
 * - 부고/3일 배려는 무채 톤 (mourn)
 * - 주년 리마인드는 양방향 2원화 액션 (안부 묻기 / 마음 전달하기 → 채널 확장)
 * - 세계관 라벨 유지: "제비가 물어봐요" / "제비의 배려" / "오랜 인연"
 */
const KIND_LABEL = {
  check: "제비가 물어봐요",
  nudge3: "제비의 배려",
  anniversary: "오랜 인연",
};

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}
function MoneyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 12V8H6a2 2 0 010-4h12v4M4 6v12a2 2 0 002 2h14v-4M18 12a2 2 0 000 4h4v-4z" />
    </svg>
  );
}
function BellRingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 3v10M10 17h.01M5 8c0-3 2-5 5-5s5 2 5 5" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 2L9 11M18 2l-7 16-3-7-7-3z" />
    </svg>
  );
}

/** 미니멀 알럿 — 확인/넛지용 (X 없음 · 두 액션 필수) */
function MiniAlert({ kind, title, sub, mourn, onWent, onMissed }) {
  return (
    <div className={`mini-alert${mourn ? " mourn" : ""}`}>
      <div className="alert-kind">{KIND_LABEL[kind]}</div>
      <p className="msg">{title}</p>
      <p className="sub">{sub}</p>
      <div className="btns">
        <button className="b-cancel" onClick={onMissed}>못 갔어요</button>
        <button className="b-main" onClick={onWent}>다녀왔어요</button>
      </div>
    </div>
  );
}

/** 리마인드 카드 — 주년용 (안부/마음 2원화 + 채널 확장) */
function RemindCard({ alert, received, openKey, onToggle, onRemind }) {
  return (
    <div className="remind-card">
      <div className="head">
        <div className={`ic${received ? "" : " sent"}`}>
          {received ? <BellRingIcon /> : <SendIcon />}
        </div>
        <span className="t">{alert.title}</span>
      </div>
      <p className="body">{alert.sub}</p>
      <div className="remind-actions">
        <div className="ract-top">
          <button className="ract-btn" onClick={() => onToggle(`${alert.id}:warm`)}>
            <ChatIcon /> 안부 묻기
          </button>
          <button className="ract-btn" onClick={() => onToggle(`${alert.id}:money`)}>
            <MoneyIcon /> 마음 전달하기
          </button>
        </div>
        <div className={`ract-sub${openKey === `${alert.id}:warm` ? " on" : ""}`}>
          <p className="sub-label">어떻게 안부를 전할까요?</p>
          <div className="sub-btns">
            <button onClick={() => onRemind(alert.maeumId, "카카오톡으로 안부를 전했다고 기록했어요")}>
              카카오톡
            </button>
            <button onClick={() => onRemind(alert.maeumId, "문자로 안부를 전했다고 기록했어요")}>
              문자
            </button>
          </div>
        </div>
        <div className={`ract-sub${openKey === `${alert.id}:money` ? " on" : ""}`}>
          <p className="sub-label">어디로 마음을 전할까요?</p>
          <div className="sub-btns">
            <button onClick={() => onRemind(alert.maeumId, "토스로 마음을 전했다고 기록했어요")}>
              토스
            </button>
            <button onClick={() => onRemind(alert.maeumId, "네이버페이로 마음을 전했다고 기록했어요")}>
              네이버페이
            </button>
            <button onClick={() => onRemind(alert.maeumId, "카카오페이로 마음을 전했다고 기록했어요")}>
              카카오페이
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AlertsCenter({ yeons, maeums, onClose, onWent, onMissed, onRemind }) {
  const alerts = computeAlerts(maeums, yeons);
  const [openKey, setOpenKey] = useState(null);
  const maeumById = (id) => maeums.find((m) => m.id === id);

  const toggle = (key) => setOpenKey((k) => (k === key ? null : key));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ paddingLeft: 0, paddingRight: 0 }}>
        <div className="sheet-handle" />
        <div className="navbar" style={{ padding: "0 var(--layout-pad-x) 4px" }}>
          <button className="nav-back" onClick={onClose} aria-label="뒤로">‹</button>
          <div className="nav-title">제비가 물어온 소식</div>
          <div className="nav-spacer" />
        </div>

        {alerts.length === 0 && (
          <p className="empty">
            지금은 조용해요.
            <br />
            제비가 지붕 위 박들을 조용히 지키고 있어요.
          </p>
        )}

        {alerts.map((a) => {
          if (a.kind === "anniversary") {
            const m = maeumById(a.maeumId);
            const aname = m
              ? yeons.find((y) => y.id === m.yeonId)?.name || "소중한 분"
              : "소중한 분";
            return (
              <div key={a.id}>
                <RemindCard
                  alert={a}
                  received={!m || m.direction === Direction.RECEIVED}
                  openKey={openKey}
                  onToggle={toggle}
                  onRemind={onRemind}
                />
                {/* "챙길 때" — 주년 돌봄 (어필리에이트 UI 구조) */}
                {m && canSuggest(a.maeumId) && (
                  <AffiliateNudge
                    nudge={{ kind: "anniversary", maeum: m, name: aname, years: a.years }}
                    maeums={maeums}
                  />
                )}
              </div>
            );
          }
          const mourn = a.kind === "nudge3" || /부고/.test(a.title);
          return (
            <MiniAlert
              key={a.id}
              kind={a.kind}
              title={a.title}
              sub={a.sub}
              mourn={mourn}
              onWent={() => onWent(a.maeumId)}
              onMissed={() => onMissed(a.maeumId)}
            />
          );
        })}

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
