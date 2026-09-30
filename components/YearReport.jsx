"use client";

import { useEffect } from "react";
import { A } from "@/lib/assets";
import { Direction, AssetKind, GourdState, computeGourdState } from "@/lib/model";
import { logEvent } from "@/lib/metrics";

/**
 * 올해의 인연 돌아보기 — 연말 인맥 리포트 (라운드2)
 * 기획안 §8 미리보기 정책: 9~11월에는 "지금까지의 인연"이라 부른다.
 * 12월에 "올해의 인연" 풀 리포트가 되는 건 라벨만 바뀌고 파이프라인은 같다.
 * - 서열화 금지: 금액 랭킹·인연 등급 없음
 * - 채무 톤 없음: 건수는 '정이 오간' 문장으로만
 * - 9월에도 동작: 데이터 있는 만큼만, "모으는 중"임을 정직하게 표기 (guideline #12)
 */
export default function YearReport({ yeons, maeums, splitsByMaeum = null, onBack }) {
  useEffect(() => { logEvent("recap_viewed", {}, "home"); }, []); // J10 사전
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const isDecember = month === 12;
  const title = isDecember ? "올해의 인연" : "지금까지의 인연";

  const nameOf = (id) => yeons.find((y) => y.id === id)?.name || "소중한 분";
  const thisYear = maeums.filter((m) => new Date(m.plantedAt).getFullYear() === year);
  const yeonIds = [...new Set(thisYear.map((m) => m.yeonId))];

  // (코디네이터 결정, 2026-09-25) "가장 오래 이어진 박" 카드는 제거 — '가장' 선정이
  // 서열화의 여지를 만들므로, 돌봄 관점("안부 물어볼까요?") 하나로 통일한다 (디자인팀 반론 채택).

  // 제비가 물어온 박씨 = 올해 열린 박 수
  const seedsThisYear = thisYear.filter(
    (m) => m.direction === Direction.RECEIVED && m.repaidAt
  ).length;

  // 올해 새로 심은 인연
  const newYeons = yeons
    .filter((y) => new Date(y.createdAt).getFullYear() === year)
    .sort((a, b) => a.createdAt - b.createdAt);

  // 돌봄 제안 — 오래 익은 박 최대 2명 (숙제가 되지 않게)
  const careFor = [...thisYear]
    .filter((m) => computeGourdState(m) === GourdState.OLD_RIPE)
    .sort((a, b) => a.plantedAt - b.plantedAt)
    .slice(0, 2);

  // 함께 전한 마음 (N빵)
  const withCompany = splitsByMaeum
    ? thisYear.filter((m) => {
        const sp = splitsByMaeum.get ? splitsByMaeum.get(m.id) : splitsByMaeum[m.id];
        return sp && sp.length > 0;
      }).length
    : 0;

  // 현금/선물 분리 (§5 연결)
  const knownKind = thisYear.filter((m) => m.assetKind);
  const cashCount = knownKind.filter((m) => m.assetKind === AssetKind.CASH).length;
  const goodsCount = knownKind.filter((m) => m.assetKind === AssetKind.GOODS).length;

  const empty = thisYear.length === 0;

  return (
    <div className="content yr-wrap">
      <div className="navbar">
        <button className="nav-back" onClick={onBack} aria-label="뒤로">‹</button>
        <div className="nav-title">{title}</div>
        <div className="nav-spacer" />
      </div>

      <div className="yr-hero">
        <img src={A.jebi_perched} alt="제비" />
        <p className="yr-kicker">{year}년 {month}월, 우리 집에는</p>
        {empty ? (
          <p className="yr-big">아직 심은 마음이 없어요</p>
        ) : (
          <p className="yr-big">
            마음 <span className="n">{thisYear.length}개</span>를 주고받았어요
          </p>
        )}
        {!empty && (
          <p className="yr-copy">
            인연 {yeonIds.length}명과 정이 오갔어요
          </p>
        )}
      </div>

      {empty ? (
        <p className="empty">
          첫 마음을 기록하면
          <br />
          이 리포트가 자라기 시작해요.
        </p>
      ) : (
        <div className="yr-body">
          {seedsThisYear > 0 && (
            <div className="yr-card">
              <h4>제비가 물어온 박씨</h4>
              <p>
                제비가 올해 <span className="hl">{seedsThisYear}개</span>의 박씨를 물어왔어요
              </p>
            </div>
          )}

          {newYeons.length > 0 && (
            <div className="yr-card">
              <h4>새로 심은 인연</h4>
              <p>
                올해 새로 심은 인연이 <span className="hl">{newYeons.length}명</span>이에요
                <br />
                {newYeons.slice(0, 3).map((y) => y.name).join("님, ")}님
                {newYeons.length > 3 && ` 외 ${newYeons.length - 3}명`}
              </p>
            </div>
          )}

          {(cashCount > 0 || goodsCount > 0) && (
            <div className="yr-card sent">
              <h4>어떻게 전했어요?</h4>
              <p>
                {cashCount > 0 && <>현금으로 <span className="hl">{cashCount}번</span></>}
                {cashCount > 0 && goodsCount > 0 && " · "}
                {goodsCount > 0 && <>선물로 <span className="hl">{goodsCount}번</span></>}
                마음을 전했어요
              </p>
            </div>
          )}

          {withCompany > 0 && (
            <div className="yr-card">
              <h4>함께 전한 마음</h4>
              <p>
                <span className="hl">{withCompany}번</span>의 마음은 여러 인연과 함께 전했어요
              </p>
            </div>
          )}

          {careFor.length > 0 && (
            <div className="yr-card">
              <h4>안부 물어볼까요?</h4>
              {careFor.map((m) => (
                <p key={m.id}>
                  <span className="hl">{nameOf(m.yeonId)}님</span> 박이 오래 익었어요. 안부 물어볼까요?
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {!isDecember && !empty && (
        <p className="yr-note">
          아직 {month}월이라 모으는 중인 이야기예요.
          <br />
          12월이 되면 "{year}년, 올해의 인연"으로 완성돼요.
        </p>
      )}

      <div className="yr-actions">
        <button className="btn btn-ghost" onClick={onBack}>
          닫기
        </button>
      </div>
    </div>
  );
}
