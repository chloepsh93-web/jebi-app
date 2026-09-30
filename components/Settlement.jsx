"use client";

import { useState } from "react";
import { A } from "@/lib/assets";
import { summarize } from "@/lib/model";
import { relTime } from "@/lib/format";
import { COPY } from "@/lib/copy";

/**
 * 결산 — 목업 "저녁노을" 스펙
 * - hero: "1년 동안 정이 오간 기록이에요" + 집 그림 (노을 톤 그라데이션)
 * - CTA 2개 유지: 올해의 인연 다시 보기 / 스토리로 저장
 * - 세계관 용어 유지: "정"
 */
export default function Settlement({ yeons, maeums, splitsByMaeum = null, onBack, onBrowseYeons, onToast }) {
  const [copied, setCopied] = useState(false);
  const year = new Date().getFullYear();
  const thisYear = maeums.filter((m) => new Date(m.plantedAt).getFullYear() === year);
  const stats = summarize(maeums);
  const nameOf = (id) => yeons.find((y) => y.id === id)?.name || "소중한 분";

  const oldest = [...maeums].sort((a, b) => a.plantedAt - b.plantedAt)[0];

  // N빵 — 올해 여러 인연과 함께 전한 마음 횟수 (테이블 미지원이면 0 → 숨김)
  const withCompanyCount = splitsByMaeum
    ? thisYear.filter((m) => {
        const sp = splitsByMaeum.get ? splitsByMaeum.get(m.id) : splitsByMaeum[m.id];
        return sp && sp.length > 0;
      }).length
    : 0;

  const story =
    `${year}년, 우리 집에는 제비가 ${thisYear.length}번 다녀갔고 마음 ${stats.warmthCount}개를 전했어요.`;

  const saveStory = async () => {
    try {
      await navigator.clipboard.writeText(story);
      setCopied(true);
      onToast?.("돌아보기를 복사했어요. 스토리에 붙여넣어 보세요");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast?.("복사에 실패했어요");
    }
  };

  return (
    <div className="content settle-wrap">
      <div className="navbar">
        <button className="nav-back" onClick={onBack} aria-label="뒤로">‹</button>
        <div className="nav-title">{COPY.SETTLEMENT.navTitle}</div>
        <div className="nav-spacer" />
      </div>

      <div className="settle-hero">
        <img src={A.house_bluesky} alt="저녁노을 속 우리 집" />
        <p className="settle-copy">1년 동안 정이 오간 기록이에요</p>
      </div>

      <div className="settle-body">
        <div className="settle-year">{year}년, 우리 집에는</div>
        <div className="settle-big serif">
          제비가 <span className="n">{thisYear.length}번</span> 다녀갔고
          <br />
          마음 <span className="n">{stats.warmthCount}개</span>를 전했어요
        </div>
        <div className="settle-line">
          {stats.warmthCount > 0 ? (
            <>
              처마에 등불이 걸렸고
              <br />
              창문 {Math.min(stats.warmthCount, 5)}곳에 불이 켜졌어요
            </>
          ) : (
            <>
              아직 등불이 걸리지 않았어요.
              <br />
              첫 마음을 전하면 불이 켜져요.
            </>
          )}
        </div>

        {oldest && (
          <div className="settle-oldest">
            가장 오래된 인연 · {relTime(oldest.plantedAt)} {nameOf(oldest.yeonId)}님과의 첫 마음
          </div>
        )}

        {withCompanyCount > 0 && (
          <div className="settle-oldest">
            여러 인연과 함께 전한 마음 · {withCompanyCount}번
          </div>
        )}

        <div className="settle-actions">
          <button
            className="btn"
            onClick={onBrowseYeons}
          >
            올해의 인연 다시 보기
          </button>
          <button className="btn btn-primary" onClick={saveStory}>
            {copied ? "복사됐어요 ✓" : "스토리로 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
