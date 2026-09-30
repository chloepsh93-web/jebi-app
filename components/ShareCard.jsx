"use client";
import { useState } from "react";
import { QRCode } from "react-qr-code";
import { A } from "@/lib/assets.js";
import { shareText, inviteUrl } from "@/lib/share.js";
import { BottomSheet, useSheetHistory } from "@/components/ui";

/**
 * 세계관 번역 카드 3종 — "가계부 어휘 없이 정을 전하는 텍스트 카드".
 * kind: "moment" (박 열림 직후) | "cycle" (박씨 순환 설명) | "invite" (앱 초대)
 * layout: "card" (기본) | "story" (9:16 인스타 스토리 규격 + QR)
 * Web Share API 우선, 미지원 시 클립보드 복사 폴백.
 * QR에는 앱 초대 URL만 담는다 (개인정보 미포함 — lib/share.js getInviteCode 주석 참조).
 *
 * 라운드3 — 중앙 모달(.share-backdrop/.share-card pop-in)에서 BottomSheet로 전환.
 * - 닫기 문법 통일: 우측 스와이프·드래그 핸들·44px 닫기(‹)·뒤로가기 (useSheetHistory)
 * - 시트 타이틀은 카드의 kicker(정/박씨/초대)를 그대로 쓴다 (신규 카피 없음)
 * - story 레이아웃의 9:16 아트워크(.story-day '낮의 박' 고정)는 그대로 유지 — 기획안 §4 D2
 */
const CYCLE_STEPS = ["심음", "자람", "익음", "열림", "제비가 새 박씨를 물어옴"];

function contentFor(kind, ctx) {
  if (kind === "moment") {
    const name = ctx?.name || "소중한 분";
    // J07: 조문은 차분한 말투 유지
    if (ctx?.eventType === "부고") {
      return {
        kicker: "정",
        img: A.gourd_open,
        title: "마음을 전했어요",
        body: (
          <>
            {name}님께 깊은 조의를 표했어요.
            <br />
            함께한 마음이 오래 기억될 거예요.
          </>
        ),
        shareTitle: "제비 — 마음을 전했어요",
        shareText:
          `마음을 전했어요\n${name}님께 깊은 조의를 표했어요.\n— 제비에서 정을 기록하고 있어요`,
      };
    }
    return {
      kicker: "정",
      img: A.gourd_open,
      title: "정이 돌아왔어요",
      body: (
        <>
          {name}님과의 박이 열렸어요.
          <br />
          베푼 정은 박씨가 되어 돌아와요.
        </>
      ),
      shareTitle: "제비 — 정이 돌아왔어요",
      shareText:
        `정이 돌아왔어요 🐦\n${name}님과의 박이 열렸어요. 베푼 정은 박씨가 되어 돌아와요.\n— 제비에서 정을 기록하고 있어요`,
    };
  }
  if (kind === "cycle") {
    return {
      kicker: "박씨",
      img: A.sprout,
      title: "정은 박씨가 되어 돌아와요",
      body: (
        <>
          흥부가 제비를 고쳐 보내자,
          <br />
          제비가 박씨를 물어왔어요.
          <br />
          베푼 정은 사라지지 않고
          <br />
          박씨가 되어 다시 심어져요.
        </>
      ),
      cycle: CYCLE_STEPS,
      shareTitle: "제비 — 정의 순환",
      shareText:
        "정은 돌아오면 끝이 아니라, 박씨가 되어 다시 심어져요 🐦\n심음 → 자람 → 익음 → 열림 → 제비가 새 박씨를 물어옴\n— 제비에서 정을 기록하고 있어요",
    };
  }
  return {
    kicker: "초대",
    img: A.jebi_perched,
    title: "정이라는 게 있어요",
    body: (
      <>
        경조사비를 가계부가 아니라
        <br />
        '정'으로 기록하는 앱, 제비.
        <br />
        주고받은 마음이 인연이 되고,
        <br />
        박이 열리면 박씨가 되어 돌아와요.
      </>
    ),
    shareTitle: "제비 — 정을 기록하는 앱",
    shareText:
      "정이라는 게 있어요 🐦\n경조사비를 가계부가 아니라 '정'으로 기록하는 앱, 제비.\n주고받은 마음이 인연이 되고, 박이 열리면 박씨가 되어 돌아와요.\n" +
      inviteUrl(),
  };
}

export default function ShareCard({ kind, name, eventType, onClose, onToast, onShared, layout = "card" }) {
  const [busy, setBusy] = useState(false);
  // 라운드3 — 시트-히스토리 동기화 (마음 상세 시트와 동일 문법). entry는 최대 1개.
  const closeSheet = useSheetHistory(true, onClose, "share");
  const c = contentFor(kind, { name, eventType });

  const doShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await shareText({ title: c.shareTitle, text: c.shareText });
      if (r === "copied") onToast("복사했어요. 붙여넣기로 나눠보세요");
      else if (r === "shared") closeSheet();
      if (r === "shared" || r === "copied") onShared && onShared(kind);
    } catch {
      onToast("공유하지 못했어요. 다시 시도해주세요");
    }
    setBusy(false);
  };

  return (
    <BottomSheet title={c.kicker} onClose={closeSheet} closeVariant="x">
      {layout === "story" ? (
        <StoryBody c={c} busy={busy} doShare={doShare} onClose={closeSheet} />
      ) : (
        <CardBody c={c} busy={busy} doShare={doShare} onClose={closeSheet} />
      )}
    </BottomSheet>
  );
}

/** 기본 카드 — 기존 .share-* 스타일 재사용 (중앙 정렬만 .share-sheet-body로 이관) */
function CardBody({ c, busy, doShare, onClose }) {
  return (
    <div className="share-sheet-body">
      {c.img && <img className="share-img" src={c.img} alt="" />}
      <div className="share-title serif">{c.title}</div>
      <div className="share-body">{c.body}</div>
      {c.cycle && (
        <div className="share-cycle">
          {c.cycle.map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              <span className="step">{s}</span>
              {i < c.cycle.length - 1 && <span className="arrow">→</span>}
            </span>
          ))}
        </div>
      )}
      <button className="btn btn-primary" onClick={doShare} disabled={busy}>
        {busy ? "나누는 중…" : "박씨 소식 나누기"}
      </button>
      <button className="btn btn-ghost" onClick={onClose}>
        닫기
      </button>
      <div className="share-note">문자로도, 메신저로도 보낼 수 있어요</div>
    </div>
  );
}

/**
 * 9:16 스토리 규격 카드 (인스타 스토리 대응).
 * - QR 규격 132px: 스캔 가능 최소 규격을 위한 기능 제약값 (가이드라인 §4 매직넘버 규칙의 기능 예외).
 * - QR 타일은 다크모드에서도 흰색 유지 (app/darkmode.css .story-qr 오버라이드).
 * - 공유 카드 출력물 = '낮의 박' 고정 (기획안 §4 D2, app/darkmode.css) — story-day 유지.
 * - 라운드3: 시트 안으로 들어오면서 배경이 밝아졌으므로 .share-note의 on-dark는 제외
 *   (어두운 배경용 밝은 텍스트가 시트 표면에서 안 읽힘).
 */
const STORY_QR_SIZE = 132;

function StoryBody({ c, busy, doShare, onClose }) {
  const url = inviteUrl();
  return (
    <div className="story-preview">
      <div
        role="img"
        aria-label={`제비 스토리 카드: ${c.title}`}
        className="story-day story-card" /* 공유 카드 출력물 = '낮의 박' 고정 (기획안 §4 D2, app/darkmode.css) */
      >
        <div className="story-kicker">
          {c.kicker}
        </div>
        {c.img && (
          <img
            src={c.img}
            alt=""
            className="story-img"
          />
        )}
        <div
          className="serif story-title"
        >
          {c.title}
        </div>
        <div className="story-body">
          {c.body}
        </div>
        <div className="story-qr">
          <QRCode
            value={url}
            size={STORY_QR_SIZE}
            bgColor="#FFFFFF"
            fgColor="#2B2823" /* --color-surface-dark (스캔 대비 고정) */
            aria-label="제비 앱 초대 QR 코드"
          />
          <div className="story-qr-cap">
            찍으면 정을 심는 집으로 가요
          </div>
        </div>
        <div className="story-url">
          {url}
        </div>
      </div>
      <div className="story-actions">
        <button
          className="btn btn-primary grow"
          onClick={doShare}
          disabled={busy}
        >
          {busy ? "나누는 중…" : "박씨 소식 나누기"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          닫기
        </button>
      </div>
      <div className="share-note">
        스크린샷을 찍어 스토리에 올려보세요
      </div>
    </div>
  );
}
