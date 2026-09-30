"use client";

import { useEffect, useRef, useState } from "react";
import { store } from "@/lib/store";
import { downloadCsv } from "@/lib/export";
import { decodeCsv, parseCsv, importRows, importReport } from "@/lib/import";
import { getPushStatus, subscribePush, unsubscribePush } from "@/lib/push";
import { relTime } from "@/lib/format";
import { COPY } from "@/lib/copy";
import { Glossary } from "@/components/ui";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * 나 탭 — 돌아보기 진입점, 온보딩 다시 보기, 데이터 초기화
 * P2-1: Supabase 보관 안내 (백업)
 * '정' 프레임: 큰 글씨 (시니어 접근성)
 * P0 데이터 복원: 내 기록 지키기 (이메일 연결) / 이미 지킨 기록이 있어요 (로그인)
 * P0-2: CSV 내보내기 — "언제든 가져가실 수 있어요" (무료, 신뢰의 기본값)
 * P0-4: 백업 상태 UI — 마지막 동기화 시각 + 복원 가능 상태
 * P0-1a: 푸시 구독 수집 — "다가오는 소식을 제비가 알려드려요" (발송 없이 수집만)
 */
export default function Me({
  bigText,
  onToggleBigText,
  onOpenSettlement,
  onOpenYearReport,
  onReplayOnboarding,
  onReset,
  onWithdraw,
  auth,
  onGuardLink,
  onGuardLogin,
  onInvite,
  yeons = [],
  maeums = [],
  onToast,
  onImported,
  splitsSupported = true, // N빵 테이블 미지원이면 하단 한 줄 안내
}) {
  const guarded = auth && auth.email && !auth.isAnonymous;

  // P0-4: 마지막 동기화 시각 (Supabase 쓰기 성공 시각, lib/store.js에서 기록)
  const [lastSync, setLastSync] = useState(null);
  useEffect(() => {
    setLastSync(store.getLastSync());
  }, [yeons, maeums]);

  // P0-2: CSV 내보내기
  const handleExport = () => {
    try {
      const { rows } = downloadCsv(yeons, maeums);
      onToast?.(rows > 0 ? `마음 기록 ${rows}개를 내려받았어요` : "내려받을 기록이 아직 없어요");
    } catch (e) {
      onToast?.("내려받지 못했어요. 다시 시도해주세요");
    }
  };

  // P0-3: CSV 가져오기 — 제비 내보내기 포맷 왕복, 중복은 건너뛰고 건수 리포트
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || importing) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const rows = parseCsv(decodeCsv(buf));
      const result = await importRows({ yeons, maeums }, rows);
      onToast?.(importReport(result));
      if (result.added > 0) await onImported?.();
    } catch (err) {
      onToast?.(err?.code === "not-jebi-csv"
        ? "제비가 내보낸 기록이 아닌 것 같아요"
        : "읽지 못했어요. CSV 파일인지 확인해주세요");
    } finally {
      setImporting(false);
    }
  };
  // P0-1a: 푸시 구독 토글
  const [pushState, setPushState] = useState("loading");
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    getPushStatus().then(setPushState);
  }, []);
  const togglePush = async () => {
    if (pushBusy || pushState === "unsupported" || pushState === "no-vapid" || pushState === "loading") return;
    setPushBusy(true);
    try {
      if (pushState === "on") {
        await unsubscribePush();
      } else {
        await subscribePush();
      }
    } catch (e) {
      onToast?.(e?.message || "알림 설정에 실패했어요");
    }
    setPushState(await getPushStatus());
    setPushBusy(false);
  };
  const pushHint = {
    loading: COPY.PUSH.loading,
    on: COPY.PUSH.on,
    off: COPY.PUSH.off,
    denied: COPY.PUSH.denied,
    unsupported: COPY.PUSH.unsupported,
    "no-vapid": COPY.PUSH.noVapid,
  }[pushState] || "";
  const pushOn = pushState === "on";

  return (
    <div className="content">
      <div className="navbar">
        <div className="nav-spacer" /><div className="nav-title">나</div><div className="nav-spacer" />
      </div>

      {/* 기록 지키기 (데이터 복원 P0) */}
      {guarded ? (
        <div className="guard-card">
          <div className="guard-done">🕊 기록 지키기 완료</div>
          <div className="guard-mail">{auth.email}</div>
          {/* P0-4: 백업 상태 UI — 마지막 동기화 + 복원 가능 상태 */}
          <div className="guard-sync">
            {lastSync
              ? `마지막 동기화 ${relTime(lastSync)} · 이 기기에서도 볼 수 있어요`
              : "이 기기에서도 볼 수 있어요"}
          </div>
        </div>
      ) : (
        <div className="guard-card">
          <div className="guard-title">내 기록 지키기</div>
          <div className="guard-sub">
            아직 기록이 이 기기에만 있어요. 이메일만 연결하면 제비가 이어가요.
          </div>
          <button className="btn btn-primary" onClick={onGuardLink}>
            이메일 연결하기
          </button>
          <button className="btn btn-ghost" onClick={onGuardLogin}>
            이미 지킨 기록이 있어요
          </button>
        </div>
      )}

      <div className="me-row" onClick={onOpenSettlement}>
        <span>{COPY.SETTLEMENT.navTitle}</span><span className="chev">›</span>
      </div>
      <div className="me-row" onClick={onOpenYearReport}>
        <span>
          🕊 올해의 인연 돌아보기
          <span className="me-hint">정이 오간 한 해</span>
        </span>
        <span className="chev">›</span>
      </div>
      {/* P0-2: CSV 내보내기 (무료) */}
      <div className="me-row" onClick={handleExport}>
        <span>
          📥 내 기록 내보내기 (CSV)
          <span className="me-hint">언제든 가져가실 수 있어요</span>
        </span>
        <span className="chev">›</span>
      </div>
      {/* P0-3: CSV 가져오기 (들여오기) */}
      <div className="me-row" onClick={() => { if (!importing) fileRef.current?.click(); }}>
        <span>
          📥 내 기록 들여오기 (CSV)
          <span className="me-hint">{importing ? "기록을 심는 중이에요…" : "예전에 내보낸 기록을 다시 심어요"}</span>
        </span>
        <span className="chev">›</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        aria-hidden
        tabIndex={-1}
        onChange={handleImportFile}
      />
      {/* P0-1a: 푸시 구독 수집 */}
      <div className="me-row" onClick={togglePush}>
        <span>
          🔔 소식을 제비가 알려드려요
          <span className="me-hint">{pushHint}</span>
        </span>
        <span className={`switch${pushOn ? " on" : ""}`} aria-hidden><i /></span>
      </div>
      <div className="me-row" onClick={onInvite}>
        <span>💌 친구에게 제비 알리기</span><span className="chev">›</span>
      </div>
      <div className="me-row" onClick={onToggleBigText}>
        <span>
          🔍 큰 글씨로 보기
          <span className="me-hint">눈이 편한 크기로 바꿔드려요</span>
        </span>
        <span className={`switch${bigText ? " on" : ""}`} aria-hidden><i /></span>
      </div>
      {/* 라운드2: 밤의 박 테마 — 낮/밤/기기에 따라 3선택 (기본 기기에 따라) */}
      <div className="me-row me-row-static">
        <span>
          🌙 밤의 박
          <span className="me-hint">눈이 편한 밤의 색으로 바꿔드려요</span>
        </span>
      </div>
      <ThemeToggle />
      <div className="me-row" onClick={onReplayOnboarding}>
        <span>🐦 온보딩 다시 보기</span><span className="chev">›</span>
      </div>
      <div className="me-row" onClick={onReset}>
        <span style={{ color: "var(--color-semantic-danger)" }}>데이터 초기화</span><span className="chev">›</span>
      </div>
      <div className="me-row" onClick={onWithdraw}>
        <span style={{ color: "var(--color-semantic-danger)" }}>탈퇴하기</span><span className="chev">›</span>
      </div>

      <div className="me-legal">
        <a href="/privacy">개인정보처리방침</a>
        <a href="/terms">이용약관</a>
      </div>

      {/* P2-④: 세계관 용어 풀 버전 (compact 3줄 → 도움말 5줄) */}
      <p className="me-glossary-label">제비의 말들</p>
      <Glossary />

      <p className="empty" style={{ paddingTop: 24 }}>
        모든 기록은 서버에 안전하게 보관돼요.
        <br />
        기기 변경 시 이어보기는 준비 중이에요.
        {!splitsSupported && (
          <>
            <br />
            공동선물 기록은 제비가 준비하고 있어요.
          </>
        )}
      </p>
      <div className="me-ver">제비 v0.1 · 마음을 기억하는 집</div>
    </div>
  );
}
