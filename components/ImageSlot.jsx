"use client";

import { useRef, useState } from "react";
import { getSlotImages, addSlotImage, removeSlotImage, SLOT_MAX } from "@/lib/imageSlots";
import { uploadGifticon } from "@/lib/storage";
import { BottomSheet, useSheetHistory } from "./ui";

/**
 * 기프티콘·초대장 이미지 슬롯 (P1-3 MVP — UI 구조 + 로컬 미리보기)
 * - OCR·서버 보관은 후속. 지금은 이 화면에서만 보이는 미리보기.
 * - '정' 톤: "붙이기" (업로드·첨부 같은 기술 어휘 지양, 가이드라인 #19)
 * - 토큰 준수: --radius-md 썸네일, --color-text-muted 힌트, 44px 이상 터치 타겟
 * - 라운드3: 썸네일을 누르면 ImageZoomSheet(시트 확대 보기)가 열린다 (onZoom 콜백)
 */
export default function ImageSlot({ maeumId, onZoom }) {
  const [images, setImages] = useState(() => getSlotImages(maeumId));
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const refresh = () => {
    setImages([...getSlotImages(maeumId)]);
  };

  const handleFiles = (e) => {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;
    setError("");
    for (const file of files) {
      const r = addSlotImage(maeumId, file);
      if (!r.ok) { setError(r.error); break; }
      // 서버 보관 시도 — 버킷 미존재면 조용히 세션 미리보기로 폴백 (에러 토스트 없음).
      // maeums.image_urls 컬럼이 없어 경로를 기록할 수 없으므로, 지금은 시도 자체가
      // 목적(승인 후 검증 가능한 경로 확보). 실패는 화면에 드러내지 않는다.
      uploadGifticon(file, maeumId).then((u) => {
        if (!u.ok && u.reason !== "no-bucket") console.error("[storage]", u.reason, u.message);
      }).catch(() => { /* 일시 오류 — 미리보기는 유지 */ });
    }
    refresh();
  };

  const handleRemove = (id) => {
    removeSlotImage(maeumId, id);
    setError("");
    refresh();
  };

  return (
    <div className="img-slot">
      <label className="fl">기프티콘·초대장 붙이기</label>
      <div className="img-slot-row">
        {images.map((img) => (
          <div className="img-slot-thumb" key={img.id}>
            {/* 라운드3 — 썸네일은 확대 보기 진입 버튼 (× 빼기 버튼과 중첩 버튼 방지용 분리 구조) */}
            <button
              type="button"
              className="img-slot-view"
              aria-label={`${img.name || "붙인 사진"} 크게 보기`}
              onClick={() => onZoom && onZoom(img)}
            >
              <img src={img.url} alt={img.name || "붙인 사진"} />
            </button>
            <button
              type="button"
              className="img-slot-x"
              aria-label="사진 빼기"
              onClick={() => handleRemove(img.id)}
            >
              ×
            </button>
          </div>
        ))}
        {images.length < SLOT_MAX && (
          <button
            type="button"
            className="img-slot-add"
            aria-label="사진 붙이기"
            onClick={() => inputRef.current?.click()}
          >
            <span aria-hidden>+</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        aria-hidden
        tabIndex={-1}
        onChange={handleFiles}
      />
      {error ? (
        <p className="img-slot-err" role="alert">{error}</p>
      ) : (
        <p className="img-slot-hint">지금은 이 화면에서만 보여요 · 함께 보관은 준비 중이에요</p>
      )}
    </div>
  );
}

/**
 * 이미지 확대 보기 (라운드3 — 기획안 §1)
 * - BottomSheet 기반: 우측 스와이프·드래그 핸들·44px 닫기(X)·뒤로가기로 닫힌다.
 * - 확대해서 보는 순간 바코드가 가장 잘 보이므로, 바코드 가림 힌트 한 줄을 함께 둔다.
 * - 마음 상세 시트 안에서 열리는 경우 useSheetHistory의 직렬화 가드가
 *   마음 시트를 먼저 닫고 entry 1개를 유지한다 (중첩 시트 금지).
 */
export function ImageZoomSheet({ img, onClose }) {
  const closeSheet = useSheetHistory(true, onClose, "zoom");
  if (!img) return null;
  return (
    <BottomSheet title={img.name || "붙인 사진"} onClose={closeSheet} closeVariant="x">
      <img
        className="zoom-img"
        src={img.url}
        alt={`${img.name || "붙인 사진"} 크게 보기`}
      />
      <p className="zoom-hint">바코드 번호는 가려서 붙이면 더 안심이에요</p>
    </BottomSheet>
  );
}
