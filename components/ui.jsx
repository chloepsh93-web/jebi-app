"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { A } from "@/lib/assets";
import { mountModalFocus } from "@/lib/modalFocus";

function useModalFocus(onClose) {
  const root = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => mountModalFocus(root.current, () => close.current?.()), []);
  return root;
}


/** 파괴적/중요 확인 다이얼로그 — 목업의 시스템 알럿 패턴 (X 없음 · 두 액션 필수) */
export function ConfirmDialog({ title, sub, cancelLabel = "취소", okLabel = "지우기", danger = true, onCancel, onOk }) {
  const root = useModalFocus(onCancel);
  const titleId = useId();
  const subId = useId();
  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div
        className={`confirm-card${danger ? "" : " light"}`}
        ref={root} tabIndex={-1} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={sub ? subId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-title" id={titleId}>{title}</div>
        {sub && <div className="confirm-sub" id={subId}>{sub}</div>}
        <div className="confirm-actions">
          <button className="btn btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onOk}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 초기 로딩 — "제비가 집을 살펴보고 있어요" */
export function Loading({ text = "제비가 집을 살펴보고 있어요" }) {
  return (
    <div className="app">
      <div className="loading-root">
        <img src={A.jebi_perched} alt="제비" />
        <div className="loading-txt">{text}</div>
      </div>
    </div>
  );
}

/** Supabase 미설정 안내 — 크래시 대신 */
export function SetupGuide({ error }) {
  return (
    <div className="app">
      <div className="setup-root">
        <img src={A.house_jebi_intro} alt="제비" />
        <div className="setup-title serif">아직 집을 지을 준비가 안 됐어요</div>
        <p className="setup-sub">
          제비가 마음을 보관할 Supabase 창고를
          <br />
          먼저 연결해주세요.
        </p>
        {error && <div className="error-box">{error}</div>}
        <div className="setup-steps">
          1. <code>schema.sql</code>을 Supabase SQL Editor에서 실행
          <br />
          2. Authentication에서 <b>익명 로그인</b> 허용
          <br />
          3. <code>.env.local</code>에 아래 두 값을 입력
          <br />
          &nbsp;&nbsp;&nbsp;<code>NEXT_PUBLIC_SUPABASE_URL</code>
          <br />
          &nbsp;&nbsp;&nbsp;<code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          <br />
          4. 다시 실행하면 우리 집이 열려요
        </div>
        <p className="setup-sub" style={{ fontSize: 12 }}>
          자세한 방법은 README.md를 참고하세요.
        </p>
      </div>
    </div>
  );
}

/** 토스트 */
export function Toast({ text }) {
  if (!text) return null;
  return <div className="toast" role="status" aria-live="polite">{text}</div>;
}

/**
 * 시트-히스토리 동기화 훅 (라운드3 — 라운드2 마음 시트 패턴의 일반화)
 *
 * - 시트가 열리면 history에 entry 1개를 쌓고, 뒤로가기(popstate)가 내 entry를 떠나면
 *   onClose를 호출한다. 버튼 닫기는 history.back()으로 쌓은 entry를 소비한다
 *   (다음 뒤로가기가 엉뚱하게 동작하지 않게 — 기존 closeMaeumSheet 패턴과 동일).
 * - entry마다 고유 sid를 찍는다. 시트 위 ConfirmDialog의 entry가 사라지는 popstate에는
 *   시트가 반응하지 않는다 (기획안 §4 수용기준 3 — 뒤로가기 1회 = 최상위 1개만 닫기).
 * - 모듈 스코프 live 가드: history entry는 항상 최대 1개 (중첩 시트 금지).
 *   새 시트가 열리는데 이전 시트 entry가 살아 있으면, 이전 시트를 먼저 닫고
 *   그 popstate가 정착한 뒤에 새 entry를 쌓는다 (직렬화).
 *   연속 전환(닫기→열기)을 같은 틱에 push하면 브라우저가 새 entry를 떠난 것으로 보고
 *   시트가 즉시 닫히는 레이스가 생기므로, 반드시 이 직렬화를 거친다.
 * - reduced-motion: 스와이프는 직접 조작이라 애니메이션 없음 (BottomSheet 주석과 동일).
 */
let sheetSeq = 0;
let sheetLive = null; // { entry, close } — 현재 entry 소유자 (최대 1개)
let sheetPending = null; // () => void — 이전 시트 popstate 정착 후 실행할 deferred open

export function useSheetHistory(open, onClose, key = "sheet") {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const openRef = useRef(open);
  openRef.current = open;
  const entryRef = useRef(null);
  const detachRef = useRef(null);

  // 버튼/제스처 닫기 — entry가 살아 있으면 history.back()으로 소비하고,
  // popstate 핸들러가 onClose를 호출한다. entry가 없으면 직접 닫는다.
  const close = useCallback(() => {
    const e = entryRef.current;
    if (e && sheetLive && sheetLive.entry === e) {
      sheetLive = null;
      try {
        history.back();
        return;
      } catch {
        /* fallthrough — history 미지원 환경에서는 직접 닫기 */
      }
    }
    entryRef.current = null;
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!open) {
      entryRef.current = null;
      return;
    }
    const entry = { key, sid: `${key}-${++sheetSeq}` };

    const doOpen = () => {
      if (!openRef.current) return;
      if (entryRef.current) return; // 이미 열림 — 이중 실행 방지
      let ok = true;
      try {
        history.pushState({ jebiSheet: key, jebiSid: entry.sid }, "");
      } catch {
        ok = false;
      }
      if (!ok) return; // entry 없이 렌더만 (닫기는 직접 onClose)
      entryRef.current = entry;
      const onPop = (ev) => {
        // 내 entry 위의 것만 사라진 경우(예: 시트 위 Confirm이 닫힘) — 무시
        if (ev.state && ev.state.jebiSid === entry.sid) return;
        if (entryRef.current !== entry) return; // 이미 정리됨
        entryRef.current = null;
        if (sheetLive && sheetLive.entry === entry) sheetLive = null;
        onCloseRef.current();
        // 직렬화된 다음 시트가 대기 중이면 history 정착 후 연다
        const p = sheetPending;
        sheetPending = null;
        if (p) p();
      };
      window.addEventListener("popstate", onPop);
      detachRef.current = () => window.removeEventListener("popstate", onPop);
      sheetLive = { entry, close };
    };

    if (sheetLive && sheetLive.entry && sheetLive.entry !== entry) {
      // 중첩 방지: 이전 시트를 먼저 닫고(entry를 history.back()으로 소비),
      // 그 popstate가 정착한 뒤에 새 entry를 쌓는다 (직렬화).
      // ※ sheetLive를 미리 비우면 prev.close()가 back() 대신 직접 닫아
      //    entry가 스택에 누수되므로, 반드시 prev.close()에 맡긴다.
      const prev = sheetLive;
      sheetPending = doOpen;
      prev.close();
      return () => {
        if (sheetPending === doOpen) sheetPending = null;
      };
    }

    doOpen();
    return () => {
      if (detachRef.current) {
        detachRef.current();
        detachRef.current = null;
      }
      if (sheetLive && sheetLive.entry === entry) sheetLive = null;
      if (sheetPending === doOpen) sheetPending = null;
      entryRef.current = null;
    };
  }, [open, key]);

  return close;
}

/**
 * 하단 시트 — 바텀시트 표준 래퍼 (라운드2)
 * - 기존 .sheet-backdrop/.sheet 스타일 재사용 (신규 CSS 없음)
 * - 우측 스와이프로 닫기: dx > 90px + 수평 우세(dy 대비 1.5배)일 때만 발동.
 *   브라우저 엣지 제스처와 충돌 없게 threshold를 둔다.
 * - 입력 필드·버튼에서 시작한 터치는 무시 (텍스트 선택·커서 이동·탭과 충돌 방지)
 * - reduced-motion: 드래그는 직접 조작이라 애니메이션 없음, 대응 불필요
 * - 적용 범위: 마음 상세 시트부터 (신규 화면부터 단계 적용 — 기획안 §6 D1)
 * - closeVariant: "back"(‹, 기본·마음 상세) | "x"(✕, ShareCard·확대 보기).
 *   시트는 오버레이라 '‹'는 페이지 뒤로가기로 오해될 수 있어 신규 시트는 X를 쓴다
 *   (라운드3 코디네이터 권장안 — 디자인팀 반론 1.1① 채택). 한 시트에 두 버튼 금지.
 */
export function BottomSheet({ title, onClose, children, closeVariant = "back" }) {
  const root = useModalFocus(onClose);
  const start = useRef(null);
  const [dragX, setDragX] = useState(0);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    if (t.target.closest("input, textarea, select, button, a")) return;
    start.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e) => {
    if (!start.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    if (dx > 0 && dx > Math.abs(dy) * 1.5) {
      setDragX(Math.min(dx, 120));
    } else if (dragX !== 0) {
      setDragX(0);
    }
  };
  const onTouchEnd = () => {
    if (dragX > 90) onClose?.();
    start.current = null;
    setDragX(0);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        ref={root} tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={dragX > 0 ? { transform: `translateX(${dragX}px)`, transition: "none" } : undefined}
      >
        <div className="sheet-handle" />
        {closeVariant === "x" && (
          <button className="sheet-x" onClick={onClose} aria-label="닫기">✕</button>
        )}
        <div className="navbar" style={{ padding: closeVariant === "x" ? "0 44px 4px 0" : "0 0 4px" }}>
          {closeVariant === "back" && (
            <button className="nav-back" onClick={onClose} aria-label="뒤로">‹</button>
          )}
          <div className="nav-title">{title}</div>
          <div className="nav-spacer" />
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * P1-6 기록 완료 delight — 제비 미니 애니메이션 (600ms, 스킵 가능).
 * 호출부에서 prefers-reduced-motion을 확인해 바로 토스트로 대체한다.
 */
export function SaveDelight({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 620);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="delight-root" role="status" aria-label="마음이 박에 담겼어요">
      <img src={A.jebi_perched} alt="" className="delight-jebi" />
    </div>
  );
}

/**
 * 세계관 용어 한 줄 설명 — '정' 프레임의 핵심 언어는 유지하고,
 * 처음 보는 분도 바로 이해할 수 있게 덧붙인다.
 */
import { COPY } from "@/lib/copy";

export function Glossary({ compact = false }) {
  const rows = compact ? COPY.GLOSSARY.compact : COPY.GLOSSARY.full;
  return (
    <div className={`glossary${compact ? " compact" : ""}`}>
      {rows.map(([term, def]) => (
        <div key={term}><b>{term}</b> — {def}</div>
      ))}
    </div>
  );
}

/**
 * 민화 프로필 아바타 — avatarGender(male/female)에 맞는 초상.
 * 성별 미정이면 이름 첫 글자 플레이스홀더.
 */
export function Avatar({ gender, name, size = 48 /* v2.1: --size-avatar-md */ }) {
  const src =
    gender === "female" ? A.avatar_female
    : gender === "male" ? A.avatar_male
    : null;
  const style = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}님 프로필` : "인연 프로필"}
        className="avatar"
        style={style}
      />
    );
  }
  return (
    <div className="avatar-fallback" style={style} aria-hidden>
      {name ? name.trim()[0] : "?"}
    </div>
  );
}
