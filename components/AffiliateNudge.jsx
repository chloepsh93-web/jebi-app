"use client";

import { useState, useEffect, useRef } from "react";
import { PARTNER, markSuggested, nudgeCopy } from "@/lib/affiliate";
import { logEvent } from "@/lib/metrics";

/**
 * "챙길 때" 돌봄 카드 — 어필리에이트의 UI 구조.
 * - PARTNER.enabled=false: 구매 CTA 숨김, 돌봄 메시지만.
 * - 기록 플로우에는 절대 노출하지 않는다 (성역).
 * - 금액 추천·계산 유도 문구 금지.
 * - J09: CTA 클릭은 analytics 이벤트만 남긴다. 마음을 생성·수정하지 않는다 (클릭 ≠ 구매 ≠ 전달).
 * - J10: 사전 이벤트 — affiliate_offer_viewed / affiliate_outbound_clicked / affiliate_returned.
 */
export default function AffiliateNudge({ nudge, maeums = null }) {
  const [dismissed, setDismissed] = useState(false);
  const returnedRef = useRef(false);
  // J10: 제안 노출 기록 (마음당 1회)
  useEffect(() => {
    if (nudge?.maeum?.id) logEvent("affiliate_offer_viewed", { kind: nudge.kind }, "home");
  }, [nudge?.maeum?.id]);
  // J10: 외부로 나갔다가 돌아오면 복귀만 기록 — 구매로 추측하지 않는다
  useEffect(() => {
    const onVisible = () => {
      if (returnedRef.current && document.visibilityState === "visible") {
        returnedRef.current = false;
        logEvent("affiliate_returned", {}, "home");
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  if (!nudge || dismissed) return null;
  // P1-4: 과거 맥락 한 줄 주입 (빈도 캡은 canSuggest로 유지)
  const copy = nudgeCopy(nudge, maeums);
  if (!copy) return null;

  const close = () => {
    markSuggested(nudge.maeum.id);
    setDismissed(true);
  };

  const openPartner = () => {
    markSuggested(nudge.maeum.id);
    // J09: 클릭은 관심 신호 — 기록을 만들지 않는다
    logEvent("affiliate_outbound_clicked", { kind: nudge.kind }, "home");
    returnedRef.current = true;
    setDismissed(true);
    if (PARTNER.enabled && PARTNER.url) {
      window.open(PARTNER.url, "_blank", "noopener");
    }
  };

  return (
    <div className="aff-card" role="note" aria-label="제비가 챙겨봤어요">
      <div className="aff-head">🕊 제비가 챙겨봤어요</div>
      <p className="aff-body">{copy.body}</p>
      <div className="aff-actions">
        {PARTNER.enabled && PARTNER.url ? (
          <button className="btn-inline btn-primary" onClick={openPartner}>
            {copy.cta}
          </button>
        ) : null}
        <button className="aff-later" onClick={close}>
          {PARTNER.enabled ? "다음에" : "고마워, 제비"}
        </button>
      </div>
    </div>
  );
}
