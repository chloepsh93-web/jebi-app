/**
 * 기프티콘 OCR — 파서 인터페이스 정의 (이번 라운드: 구조까지만, 엔진 미선정)
 *
 * 입력: 이미지 File/Blob
 * 출력 (성공):
 *   { ok: true,
 *     fields: {
 *       brand:       { value: string|null, confidence: number|null },
 *       productName: { value: string|null, confidence: number|null },
 *       expiry:      { value: string|null, confidence: number|null }, // "YYYY-MM-DD"
 *     },
 *     rawText: string|null }
 * 출력 (실패):
 *   { ok: false, reason: "preparing"|"unreadable"|"no-text", message }
 *
 * 설계 근거 (개발팀 반론):
 * - 필드별 confidence가 필수다. 기획안 D2("신뢰도 70% 미만 필드는 자동 입력
 *   금지")는 필드 단위 정책이라 단일 overall confidence로는 구현 불가.
 * - 70% 임계값은 이번 라운드에서 코드 상수로 박지 않는다. 엔진별 confidence
 *   캘리브레이션이 전부 달라 근거 없는 매직넘버가 되므로, 엔진 선정 후
 *   캘리브레이션으로 결정한다. 인터페이스에는 confidence만 담는다.
 * - 바코드 번호·PIN은 추출·저장하지 않는다 (기획안 정책).
 * - OCR이 읽은 금액은 '전한 마음'을 덮어쓰지 않는다 (기획안 정책).
 * - 개인정보 검토: 외부 OCR API는 바코드가 보일 수 있는 이미지 자체를
 *   제3자에게 전송한다. 엔진 선정 시 전송 범위·보존 정책을 승인 항목에
 *   포함해야 한다. 대안: on-device (Tesseract.js + 한국어 학습데이터).
 */

export const OCR_STATUS = {
  PREPARING: "preparing",
  UNREADABLE: "unreadable",
  NO_TEXT: "no-text",
};

/**
 * 기프티콘에서 브랜드·상품명·유효기간을 읽는다.
 * @param {File|Blob} image
 * @returns {Promise<object>} 위 스펙의 성공/실패 객체
 */
export async function extractGifticon(image) {
  void image;
  return {
    ok: false,
    reason: OCR_STATUS.PREPARING,
    message: "기프티콘 읽기는 준비 중이에요",
  };
}

/** 후속 구현이 반환해야 하는 필드 shape (계약) */
export function emptyGifticonFields() {
  const f = (value = null, confidence = null) => ({ value, confidence });
  return { brand: f(), productName: f(), expiry: f() };
}
