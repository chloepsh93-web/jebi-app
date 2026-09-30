import Link from "next/link";

export const metadata = {
  title: "이용약관 — 제비",
  description: "제비 앱의 이용약관",
};

export default function Terms() {
  return (
    <div className="app">
      <div className="content legal">
        <div className="navbar">
          <Link href="/" className="nav-back" aria-label="뒤로">
            ‹
          </Link>
          <div className="nav-title">이용약관</div>
          <div className="nav-spacer" />
        </div>

        <p className="legal-updated">시행일: 2026년 9월 24일</p>

        <h2>1. 제비는 이런 앱이에요</h2>
        <p>
          제비는 경조사로 오가는 마음을 기록하고, 인연을 오래 이어가도록 돕는
          앱입니다. 가계부가 아니라 '정'을 주고받는 기록이에요.
        </p>

        <h2>2. 계정</h2>
        <ul>
          <li>
            처음에는 별도 가입 없이 익명으로 시작할 수 있습니다. 이 경우 기록은
            현재 기기의 브라우저에 연결된 익명 계정에 보관됩니다.
          </li>
          <li>
            "내 기록 지키기"로 이메일을 연결하면, 기기를 바꿔도 기록을 이어볼 수
            있습니다.
          </li>
          <li>계정 정보는 본인이 안전하게 관리해주세요.</li>
        </ul>

        <h2>3. 이용자의 약속</h2>
        <ul>
          <li>타인의 개인정보(전화번호·계좌번호 등)를 무단으로 공유하지 않습니다.</li>
          <li>기록은 본인의 실제 경험을 바탕으로 작성합니다.</li>
          <li>서비스를 방해하는 행위를 하지 않습니다.</li>
        </ul>

        <h2>4. 기록의 삭제</h2>
        <p>
          "데이터 초기화" 또는 "탈퇴하기"를 하면 서버에 보관된 기록이 삭제됩니다.
          삭제된 기록은 복원할 수 없습니다.
        </p>

        <h2>5. 서비스의 변경·중단</h2>
        <p>
          제비는 더 나은 '정'의 기록을 위해 기능을 바꾸거나 다듬을 수 있습니다.
          중요한 변경은 앱 내 공지로 미리 알려드립니다.
        </p>

        <h2>6. 책임의 범위</h2>
        <p>
          제비는 기록 보관에 최선을 다하지만, 기기 분실·브라우저 데이터 삭제 등
          이용자 환경에서 생긴 손실에 대해서는 "내 기록 지키기"를 이용하지 않은
          경우 복원을 보장하지 않습니다. 소중한 기록은 꼭 지켜주세요.
        </p>

        <p className="legal-foot">
          이 약관에 동의하지 않으면 앱을 이용하지 않을 수 있습니다. 약관이
          바뀌면 앱 내 공지로 알려드립니다.
        </p>
      </div>
    </div>
  );
}
