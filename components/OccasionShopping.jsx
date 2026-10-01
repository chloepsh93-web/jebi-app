"use client";
import { useEffect, useRef, useState } from "react";
import { PARTNER } from "@/lib/affiliate";
import { logEvent } from "@/lib/metrics";

export default function OccasionShopping({ onRecord }) {
  const pending = useRef(false);
  const away = useRef(false);
  const [returned, setReturned] = useState(false);
  useEffect(() => {
    const visibility = () => {
      if (pending.current && document.visibilityState === "hidden") away.current = true;
      if (pending.current && away.current && document.visibilityState === "visible") {
        pending.current = false; setReturned(true);
        logEvent("affiliate_returned", {}, "detail");
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  if (!PARTNER.enabled) return null;
  return <section className="aff-card" aria-label="경조사 준비">
    <strong>마음을 전할 준비</strong>
    <p>제휴 쇼핑몰로 이동해요. 구매 시 제비가 수수료를 받을 수 있어요.</p>
    <a className="btn btn-ghost" href={PARTNER.url} target="_blank" rel="sponsored noopener noreferrer" onClick={() => {
      pending.current = true; away.current = false;
      logEvent("affiliate_outbound_clicked", {}, "detail");
    }}>{PARTNER.name} 둘러보기</a>
    <p>둘러보기나 구매만으로 금품 기록이 저장되지 않아요.</p>
    {returned && <p role="status">돌아오셨네요. 실제로 전한 선물이 있다면 직접 기록해주세요.</p>}
    <button type="button" className="btn btn-primary" onClick={onRecord}>실제로 전한 돈·선물 기록</button>
  </section>;
}
