export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8">개인정보 처리방침</h1>
      
      <div className="prose prose-blue max-w-none">
        <p className="mb-4">
          DailyStockBrief(이하 '서비스')는 이용자의 개인정보를 소중히 다루며, 관련 법령을 준수합니다.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-4">1. 수집하는 개인정보 항목</h2>
        <ul className="list-disc pl-5 mb-4">
          <li>이메일 주소</li>
          <li>이름 (또는 닉네임)</li>
          <li>프로필 사진 (선택 시)</li>
          <li>전화번호 (선택 시)</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-4">2. 개인정보의 수집 및 이용 목적</h2>
        <p className="mb-4">
          서비스는 수집한 개인정보를 다음의 목적을 위해 활용합니다.
        </p>
        <ul className="list-disc pl-5 mb-4">
          <li>회원 관리 및 본인 확인</li>
          <li>서비스 제공 및 알림 전송</li>
          <li>부정 이용 방지</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-4">3. 개인정보의 보유 및 이용 기간</h2>
        <p className="mb-4">
          원칙적으로 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.
          단, 회원이 탈퇴를 요청하거나 동의를 철회하는 경우 즉시 파기합니다.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-4">4. 문의처</h2>
        <p className="mb-4">
          개인정보 관련 문의는 관리자 이메일로 연락주시기 바랍니다.
        </p>
      </div>
    </div>
  )
}
