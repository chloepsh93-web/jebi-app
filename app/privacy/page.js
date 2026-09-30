import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 — 제비",
  description: "제비 앱의 개인정보처리방침",
};

export default function Privacy() {
  return (
    <div className="app">
      <div className="content legal">
        <div className="navbar">
          <Link href="/" className="nav-back" aria-label="뒤로">
            ‹
          </Link>
          <div className="nav-title">개인정보처리방침</div>
          <div className="nav-spacer" />
        </div>

        <p className="legal-updated">시행일: 2026년 9월 24일</p>

        <h2>1. 수집하는 정보</h2>
        <p>
          제비는 마음을 기록하기 위해 최소한의 정보만 수집합니다.
        </p>
        <ul>
          <li>
            <b>인연 정보:</b> 이름, 관계(가족·회사·학교·지인), 프로필 이미지 선택값
          </li>
          <li>
            <b>마음 기록:</b> 경조사 종류·날짜·장소, 주고받은 내역, 메모, 계좌번호(직접 입력한 경우)
          </li>
          <li>
            <b>계정 정보:</b> "내 기록 지키기"를 이용한 경우 이메일 주소
          </li>
          <li>
            <b>이용 기록:</b> 어떤 기능을 눌렀는지 정도의 익명 통계 (문자 원문·이름 등 내용은 수집하지 않음)
          </li>
        </ul>

        <h2>2. 이용 목적</h2>
        <p>
          수집한 정보는 마음을 기록·알림·이어보기(기기 변경 시 복원) 목적으로만
          사용합니다. 광고·마케팅 목적으로 이용하지 않습니다.
        </p>

        <h2>3. 보관 및 파기</h2>
        <ul>
          <li>기록은 이용자가 삭제하거나 탈퇴할 때까지 보관합니다.</li>
          <li>
            "데이터 초기화" 또는 "탈퇴하기"를 하면 서버의 기록이 즉시 삭제됩니다.
          </li>
          <li>이메일 연결을 해제한 기록은 복원할 수 없습니다.</li>
        </ul>

        <h2>4. 제3자 제공</h2>
        <p>
          제비는 이용자의 정보를 제3자에게 판매·제공하지 않습니다. 데이터 보관을
          위한 클라우드(Supabase)에만 저장되며, 이 역시 본 방침의 보호를 받습니다.
        </p>

        <h2>5. 이용자의 권리</h2>
        <p>
          언제든 앱 내 "나" 탭에서 내 기록을 확인·수정·삭제할 수 있습니다.
          "탈퇴하기"를 하면 모든 기록이 삭제되고 로그아웃됩니다.
        </p>

        <h2>6. 문의</h2>
        <p>
          개인정보 관련 문의는 앱 내 공유·피드백 경로로 남겨주세요. 최대한 빨리
          답변드리겠습니다.
        </p>

        <p className="legal-foot">
          이 방침은 법령 변경이나 서비스 변화에 따라 바뀔 수 있으며, 바뀔 경우
          앱 내 공지로 알려드립니다.
        </p>
      </div>
    </div>
  );
}
