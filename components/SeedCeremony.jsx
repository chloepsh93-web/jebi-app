"use client";

import { useEffect, useState } from "react";
import { A } from "@/lib/assets";
import { EventType } from "@/lib/model";

/**
 * 박 열림 세리머니 — '다녀왔어요' 후 진입하는 정의 순환의 시작.
 * phase 0: 박 열리는 연출 ("정이 돌아왔어요" — 기존 카피 유지)
 * phase 1: 제비가 새 박씨를 물어옴 (흥부와 놀부 모티브)
 * - seedOk=false(박씨 컬럼 미적용 DB)면 박씨 CTA 없이 닫기만
 */
export default function SeedCeremony({ name, eventType, seedOk, onPlant, onLater, onShare }) {
  const [phase, setPhase] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  // J07: 조문은 차분한 말투 유지
  const isFuneral = eventType === EventType.FUNERAL;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      // reduced-motion: 2.4s 자동 phase 전환을 멈추고 사용자 탭으로 전환 (guidelines §2.4.1 v2.1)
      setReduceMotion(true);
      return;
    }
    const t = setTimeout(() => setPhase(1), 2400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="ceremony-backdrop">
      <div
        className="ceremony-card pop-in"
        key={phase}
        onClick={() => phase === 0 && setPhase(1)}
      >
        {phase === 0 ? (
          <>
            <img
              src={A.gourd_open}
              alt="열린 박"
              className="ceremony-img gourd-burst"
            />
            <div className="ceremony-title serif">
              {isFuneral ? "마음을 전했어요" : "정이 돌아왔어요"}
            </div>
            <div className="ceremony-sub">
              {isFuneral ? `${name}님께 깊은 조의를 표했어요` : `${name}님과의 박이 열렸어요`}
            </div>
            {reduceMotion && (
              <button className="btn btn-ghost" onClick={() => setPhase(1)}>
                다음 ›
              </button>
            )}
          </>
        ) : (
          <>
            <img
              src={A.jebi_perched}
              alt="박씨를 물어온 제비"
              className="ceremony-img"
            />
            <div
              style={{
                fontSize: 12,
                fontWeight: "var(--font-weight-bold)",
                letterSpacing: "0.2em",
                color: "var(--color-brand-amber-deep)",
                marginBottom: "var(--space-2)",
              }}
            >
              박씨
            </div>
            <div className="ceremony-title serif">
              제비가 새 박씨를 물어왔어요
            </div>
            <div className="ceremony-sub">
              흥부가 그랬듯, 베푼 정은 박씨가 되어 돌아와요
            </div>
            {seedOk ? (
              <>
                <button className="btn btn-primary" onClick={onPlant}>
                  박씨 심으러 가기
                </button>
                <button className="btn btn-ghost" onClick={onLater}>
                  나중에 심을게요
                </button>
                <button className="btn btn-ghost ceremony-share" onClick={onShare}>
                  이 순간 나누기
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={onLater}>
                  닫기
                </button>
                <button className="btn btn-ghost ceremony-share" onClick={onShare}>
                  이 순간 나누기
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
