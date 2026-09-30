"use client";

import { useState } from "react";

/**
 * P2-2: 날짜는 달력 피커로 입력.
 * value: "YYYY-MM-DD" | "????-MM-DD"(연도미상) | ""
 * "연도를 몰라요"를 켜면 월/일만 입력.
 * J03 (QA05): "날짜 미정" — dateUnknown=true면 value는 ""이고
 * 부모가 datePrecision=unknown으로 저장한다.
 */
export default function DateField({ value, onChange, label, dateUnknown = false, onDateUnknownChange = null }) {
  const unknown = value.startsWith("????");
  const [noYear, setNoYear] = useState(unknown);

  const month = unknown ? value.slice(5, 7) : "";
  const day = unknown ? value.slice(8, 10) : "";

  const toggleNoYear = (v) => {
    setNoYear(v);
    if (v) {
      onChange("");
    } else {
      onChange("");
    }
  };

  const setMD = (m, d) => {
    if (m && d) onChange(`????-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    else onChange("");
  };

  const disabled = dateUnknown;

  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label className="fl">{label}</label>}
      {!noYear ? (
        <input
          type="date"
          className="field"
          style={{ marginBottom: 6, opacity: disabled ? 0.45 : 1 }}
          value={unknown ? "" : value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div style={{ display: "flex", gap: 8, marginBottom: 6, opacity: disabled ? 0.45 : 1 }}>
          <select
            className="field"
            style={{ marginBottom: 0 }}
            value={month}
            disabled={disabled}
            onChange={(e) => setMD(e.target.value, day)}
          >
            <option value="">월</option>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                {i + 1}월
              </option>
            ))}
          </select>
          <select
            className="field"
            style={{ marginBottom: 0 }}
            value={day}
            disabled={disabled}
            onChange={(e) => setMD(month, e.target.value)}
          >
            <option value="">일</option>
            {Array.from({ length: 31 }).map((_, i) => (
              <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                {i + 1}일
              </option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: "flex", gap: 14 }}>
        <label
          style={{
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={noYear}
            disabled={disabled}
            onChange={(e) => toggleNoYear(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--color-brand-amber-deep)" }}
          />
          연도를 몰라요
        </label>
        {onDateUnknownChange && (
          <label
            style={{
              display: "flex", alignItems: "center", gap: 7,
              fontSize: 13, color: "var(--color-text-secondary)", cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={dateUnknown}
              onChange={(e) => onDateUnknownChange(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "var(--color-brand-amber-deep)" }}
            />
            날짜 미정
          </label>
        )}
      </div>
      {dateUnknown && (
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "6px 0 0" }}>
          날짜 미정으로 기록돼요. 나중에 알게 되면 다시 적을 수 있어요.
        </p>
      )}
    </div>
  );
}
