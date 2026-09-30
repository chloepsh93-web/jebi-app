"use client";

/**
 * 라우트 전역 에러 폴백 — 렌더 크래시 시 흰 화면 대신 제비 안내.
 * '정' 프레임: 탓하지 않고, 다시 불러오기를 권한다.
 */
export default function Error({ error, reset }) {
  return (
    <div className="app">
      <div className="setup-root">
        <div className="setup-title serif">제비가 잠시 쉬고 있어요</div>
        <p className="setup-sub">
          화면을 그리는 중에 문제가 생겼어요.
          <br />
          기록은 안전하게 보관돼 있으니 걱정 마세요.
        </p>
        <button
          className="btn btn-primary"
          style={{ maxWidth: 240, margin: "16px auto 0" }}
          onClick={() => reset()}
        >
          다시 불러오기
        </button>
        {process.env.NODE_ENV === "development" && error?.message && (
          <div className="error-box">{error.message}</div>
        )}
      </div>
    </div>
  );
}
