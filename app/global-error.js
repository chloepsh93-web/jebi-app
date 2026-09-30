"use client";

/**
 * 레이아웃 레벨 치명 오류 폴백.
 * globals.css에 의존하지 않고 인라인 스타일만 사용한다.
 */
export default function GlobalError({ reset }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FCFBF9",
          fontFamily: "'Apple SD Gothic Neo', -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 20, color: "#5A4400", marginBottom: 8 }}>
            제비가 잠시 쉬고 있어요
          </div>
          <p style={{ fontSize: 14, color: "#75705F", lineHeight: 1.7 }}>
            앱을 여는 중에 문제가 생겼어요.
            <br />
            기록은 안전하게 보관돼 있으니 걱정 마세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "14px 28px",
              fontSize: 15,
              fontWeight: "var(--font-weight-semibold)",
              color: "#fff",
              background: "#9A6410",
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            다시 불러오기
          </button>
        </div>
      </body>
    </html>
  );
}
