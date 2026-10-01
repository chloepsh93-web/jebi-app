"use client";

import { useState } from "react";
import { Direction, parseDatePrecision, DatePrecision, isTransferRecord, Attendance, AttendanceLabel, validateOccasionDate } from "@/lib/model";
import OccasionShopping from "./OccasionShopping";
import DateField from "./DateField";
import ImageSlot from "./ImageSlot";
import { BottomSheet } from "./ui";

/**
 * 마음 상세/수정 시트 (타임라인 항목을 눌렀을 때)
 * - P1-1: 받은 마음마다 다녀왔음 액션
 * - 날짜는 달력 피커 (P2-2)
 */
export default function MaeumSheet({ maeum, yeonName, onClose, onSave, onDelete, onRepay, onZoomImage, onRecord }) {
  const transfer = isTransferRecord(maeum);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    eventType: maeum.eventType || "기타",
    date: maeum.eventDate || "",
    // J03 (QA05): 기존 미정 기록은 미정 체크 상태로 연다
    dateUnknown: maeum.datePrecision === DatePrecision.UNKNOWN,
    time: maeum.eventTime || "",
    place: maeum.place || "",
    account: maeum.account || "",
    amount: maeum.amount != null ? Number(maeum.amount).toLocaleString() : "",
    memo: maeum.memo || "",
    attendance: maeum.attendance || Attendance.UNKNOWN,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const invalid = validateOccasionDate(form);
    if (invalid.date) { setError(invalid.date); return; }
    setError("");
    setSaving(true);
    try {
      await onSave(maeum.id, {
        // 미표기 assetKind는 추정하지 않는다 — 모호한 기존 행을 자동 변환하지 않음
        eventType: form.eventType,
        // J03 (QA05): 날짜 미정이면 null + unknown
        eventDate: form.dateUnknown ? null : (form.date || null),
        datePrecision: form.dateUnknown ? DatePrecision.UNKNOWN : parseDatePrecision(form.date),
        eventTime: form.time || null,
        place: form.place || null,
        account: transfer ? form.account || null : null,
        amount: transfer && form.amount !== "" ? Number(String(form.amount).replace(/[^0-9]/g, "")) : null,
        ...(form.attendance !== (maeum.attendance || Attendance.UNKNOWN) ? { attendance: form.attendance } : {}),
        memo: form.memo.trim() || null,
      });
    } catch (e) {
      setError(e.message || "저장하지 못했어요. 입력 내용은 그대로 남아 있어요.");
    } finally {
      setSaving(false);
    }
  };

  // J02/J07: 박 열기는 실제 금품 수신 기록에만 — 초대·참석만 있는 행은 대상 아님
  const repayable =
    maeum.direction === Direction.RECEIVED && !maeum.repaidAt && isTransferRecord(maeum);
  const dirLabel = maeum.direction === Direction.RECEIVED ? "받은" : "보낸";

  return (
    <BottomSheet title={`${yeonName}님과의 마음`} onClose={onClose}>
        <p className="sub">{transfer ? `${dirLabel} 금품` : "일정"} · {maeum.eventType}</p>

        <label className="fl">경조사 종류</label>
        <select className="field" value={form.eventType}
          onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
          <option>결혼</option><option>부고</option><option>돌잔치</option><option>생일</option>
          <option>기타</option>
        </select>

        <DateField
          label="언제"
          value={form.date}
          onChange={(v) => setForm({ ...form, date: v })}
          dateUnknown={form.dateUnknown}
          onDateUnknownChange={(v) => setForm({ ...form, dateUnknown: v })}
        />

        <label className="fl">시간</label>
        <input className="field" placeholder="예: 14:00" value={form.time}
          onChange={(e) => setForm({ ...form, time: e.target.value })} />
        <label className="fl">장소</label>
        <input className="field" placeholder="장소" value={form.place}
          onChange={(e) => setForm({ ...form, place: e.target.value })} />
        <label className="fl" htmlFor="record-attendance">참석 상태 (금품과 별도)</label>
        <select id="record-attendance" className="field" value={form.attendance} onChange={e => setForm({ ...form, attendance: e.target.value })}>
          {Object.entries(AttendanceLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {!transfer && <p className="sub">참석해도 돈·선물 기록은 생기지 않아요. 실제로 주고받은 금품은 새 기록으로 남겨주세요.</p>}
        {transfer && <>
        <label className="fl">금액 (모르면 비워두기)</label>
        <input className="field" inputMode="numeric" placeholder="예: 100,000"
          value={form.amount}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, "");
            setForm({ ...form, amount: v ? Number(v).toLocaleString() : "" });
          }} />
        </>}
        <label className="fl">한 줄 메모</label>
        <input className="field" placeholder="메모" value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })} />
        {transfer && <>
        <label className="fl">계좌 (제비가 기억해요)</label>
        <input className="field" placeholder="예: 국민은행 123456-01-234567" value={form.account}
          onChange={(e) => setForm({ ...form, account: e.target.value })} />

        {/* P1-3: 기프티콘 이미지 슬롯 — 로컬 미리보기 (서버 보관 후속) */}
        {/* 라운드3: 썸네일 탭 → 확대 보기 시트 (onZoomImage) */}
        <div style={{ marginTop: 4 }}>
          <ImageSlot maeumId={maeum.id} onZoom={onZoomImage} />
        </div>

        </>}
        {error && <p role="alert" className="sub">{error}</p>}
        {repayable && (
          <button
            className="btn btn-primary"
            style={{ marginBottom: 8 }}
            onClick={() => onRepay(maeum.id)}
          >
            마음에 답했어요
          </button>
        )}
        {maeum.repaidAt && (
          <button
            className="btn btn-ghost"
            style={{ marginBottom: 8 }}
            onClick={() => onSave(maeum.id, { repaidAt: null })}
          >
            답한 마음 표시 취소
          </button>
        )}

        {onRecord && <OccasionShopping onRecord={onRecord} />}
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? "저장 중…" : "수정 내용 저장"}
        </button>
        <button
          className="btn btn-ghost"
          style={{ color: "var(--color-semantic-danger)" }}
          onClick={() => onDelete(maeum)}
        >
          이 마음 삭제하기
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          닫기
        </button>
    </BottomSheet>
  );
}
