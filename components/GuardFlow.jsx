"use client";
import { useState } from "react";
import { A } from "@/lib/assets.js";
import { linkEmail, sendLoginLink } from "@/lib/auth.js";

/**
 * 데이터 복원 플로우 오버레이.
 * mode="link":  "내 기록 지키기" (익명 → 이메일 전환)
 * mode="login": "이미 지킨 기록이 있어요" (새 기기 매직링크 로그인)
 * linked=true: 세션 전환 완료 → 완료 화면 ("기기 바꿔도 이어져요"는
 * 검증 전까지 사용하지 않음)
 */
export default function GuardFlow({ mode, linked, onClose, onToast }) {
  const [stage, setStage] = useState("email"); // email | waiting
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const isLink = mode === "link";

  const send = async () => {
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      onToast("이메일 주소를 확인해주세요");
      return;
    }
    if (sending) return;
    setSending(true);
    try {
      if (isLink) await linkEmail(v);
      else await sendLoginLink(v);
      setStage("waiting");
    } catch (e) {
      onToast(e.message || "메일을 보내지 못했어요. 다시 시도해주세요");
    }
    setSending(false);
  };

  return (
    <div className="share-backdrop" onClick={onClose}>
      <div className="share-card pop-in" onClick={(e) => e.stopPropagation()}>
        <img className="share-img" src={A.jebi_perched} alt="" />
        {linked ? (
          <>
            <div className="share-title serif">
              {isLink ? "기록 지키기 완료" : "다시 만나서 반가워요"}
            </div>
            <div className="share-body">
              이제 이 이메일로 기록을 찾을 수 있어요.
            </div>
            <button className="btn btn-primary" onClick={onClose}>
              확인
            </button>
          </>
        ) : stage === "email" ? (
          <>
            <div className="share-title serif">
              {isLink ? "내 기록 지키기" : "이미 지킨 기록이 있어요"}
            </div>
            <div className="share-body">
              {isLink
                ? "이메일을 연결하면, 제비가 기록을 이어가요."
                : "연결했던 이메일을 알려주세요."}
            </div>
            <input
              className="field"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              style={{ marginBottom: 12 }}
            />
            <button className="btn btn-primary" onClick={send} disabled={sending}>
              {sending
                ? "보내는 중…"
                : isLink
                  ? "확인 메일 보내기"
                  : "로그인 링크 보내기"}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              뒤로
            </button>
            {isLink && (
              <div className="share-note" style={{ marginTop: 12 }}>
                연결하면{" "}
                <a href="/privacy" style={{ textDecoration: "underline" }}>
                  개인정보처리방침
                </a>
                ·
                <a href="/terms" style={{ textDecoration: "underline" }}>
                  이용약관
                </a>
                에 동의하게 돼요
              </div>
            )}
          </>
        ) : (
          <>
            <div className="share-title serif">제비가 메일을 보냈어요</div>
            <div className="share-body">
              메일함에서 확인을 눌러주세요.
              {isLink ? "" : " 이 기기에 있던 기록은 이어서 합칠 수 있어요."}
            </div>
            <button className="btn btn-ghost" onClick={onClose}>
              뒤로
            </button>
          </>
        )}
      </div>
    </div>
  );
}
