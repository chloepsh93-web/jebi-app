"use client";

import { useState } from "react";
import { parseTagInput, TAG_MAX_PER_YEON } from "@/lib/tags";

/**
 * 인연 추가/수정 폼 (목업의 비주얼 언어로 신규 화면)
 * P2-4: 이름은 id 기준으로 관리되므로 동명이인도 각각 수정 가능
 * 라운드2: 다중 태그 입력 (yeon_tags 미지원이면 숨김)
 */
export default function YeonForm({ yeon, initialTags = [], allTags = [], tagsSupported = false, onClose, onSave, onDelete }) {
  const [name, setName] = useState(yeon?.name || "");
  const [relation, setRelation] = useState(yeon?.relationTag || "지인");
  const [gender, setGender] = useState(yeon?.avatarGender || "");
  const [saving, setSaving] = useState(false);
  // 태그 — 쉼표 구분 입력 + 제안 칩
  const [tagText, setTagText] = useState((initialTags || []).join(", "));
  const addTag = (t) => {
    const cur = parseTagInput(tagText);
    if (cur.includes(t) || cur.length >= TAG_MAX_PER_YEON) return;
    setTagText([...cur, t].join(", "));
  };

  const save = async () => {
    if (saving || !name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        relationTag: relation,
        avatarGender: gender || null,
        tags: tagsSupported ? parseTagInput(tagText) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="navbar" style={{ padding: "0 0 4px" }}>
          <button className="nav-back" onClick={onClose} aria-label="뒤로">‹</button>
          <div className="nav-title">{yeon ? "인연 수정" : "인연 추가"}</div>
          <div className="nav-spacer" />
        </div>
        <p className="sub">
          {yeon
            ? "이름·관계를 고치면 주고받은 마음 기록은 그대로 이어져요."
            : "소식이 없어도 먼저 심어둘 수 있어요."}
        </p>

        <label className="fl">이름</label>
        <input
          className="field"
          placeholder="이름 (예: 김도현)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="fl">관계</label>
        <select className="field" value={relation} onChange={(e) => setRelation(e.target.value)}>
          <option>가족</option><option>회사</option><option>학교</option><option>지인</option>
        </select>
        <label className="fl">성별 (선택)</label>
        <select className="field" value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">선택 안 함</option>
          <option value="male">남성</option>
          <option value="female">여성</option>
        </select>

        {tagsSupported && (
          <>
            <label className="fl">태그 (선택, {TAG_MAX_PER_YEON}개까지)</label>
            <input
              className="field"
              placeholder="예: 대학동기, 골프모임 (쉼표로 구분)"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
            />
            {allTags.length > 0 && (
              <div className="tag-suggest">
                {allTags.filter((t) => !parseTagInput(tagText).includes(t)).slice(0, 8).map((t) => (
                  <button key={t} type="button" className="chip-btn" onClick={() => addTag(t)}>
                    + {t}
                  </button>
                ))}
              </div>
            )}
            <p className="edit-hint">이 인연과의 사이를 가볍게 표시해요</p>
          </>
        )}

        <button className="btn btn-primary" disabled={!name.trim() || saving} onClick={save}>
          {saving ? "저장 중…" : yeon ? "수정하기" : "인연 심기"}
        </button>
        {yeon && onDelete && (
          <button
            className="btn btn-ghost"
            style={{ color: "var(--color-semantic-danger)" }}
            onClick={() => onDelete(yeon)}
          >
            이 인연 삭제하기
          </button>
        )}
        <button className="btn btn-ghost" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
