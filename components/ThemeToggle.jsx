"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 테마 토글 — 자립형 컴포넌트 (디자인팀, 2026-09-25)
 *
 * - localStorage 'jebi:theme': 'light' | 'night' | 'system' (기본 'system' — 기획안 §7)
 * - documentElement에 data-theme="night" 토글 (app/darkmode.css 오버라이드 레이어와 연결)
 * - 'system' 선택 시 OS 다크모드 변경을 실시간으로 따라간다
 * - 스타일은 app/darkmode.css의 .theme-toggle (토큰만 사용)
 * - 세계관 네이밍: 낮의 박 / 밤의 박 / 기기에 따라 (기획안 §7 카피)
 *
 * 코디네이터 연결 지점: Me(설정)에 <ThemeToggle /> 배치 + layout.js에서
 * applyStoredTheme()을 최우선 실행 (FOUC 방지).
 */

const KEY = "jebi:theme";

function resolveTheme(stored) {
  if (stored === "night") return "night";
  if (stored === "light") return "light";
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "light";
  }
  return "light";
}

/** 저장된 테마를 읽어 즉시 적용 — layout 부팅 시 호출용 (렌더 없음) */
export function applyStoredTheme() {
  try {
    const stored = localStorage.getItem(KEY) || "system";
    const resolved = resolveTheme(stored);
    const el = document.documentElement;
    if (resolved === "night") el.setAttribute("data-theme", "night");
    else el.removeAttribute("data-theme");
  } catch {
    /* 저장소 접근 실패 시 라이트 유지 */
  }
}

const OPTIONS = [
  { value: "light", label: "낮의 박" },
  { value: "night", label: "밤의 박" },
  { value: "system", label: "기기에 따라" },
];

export default function ThemeToggle() {
  const [value, setValue] = useState("system");

  useEffect(() => {
    let stored = "system";
    try {
      stored = localStorage.getItem(KEY) || "system";
    } catch {
      /* 무시 */
    }
    setValue(stored);
    applyStoredTheme();
  }, []);

  // 'system' 선택 중 OS 테마 변경을 따라간다 (기획안 §7 수용기준 2)
  useEffect(() => {
    if (value !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyStoredTheme();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [value ]);

  const choose = useCallback((v) => {
    setValue(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* 무시 */
    }
    const resolved = resolveTheme(v);
    const el = document.documentElement;
    if (resolved === "night") el.setAttribute("data-theme", "night");
    else el.removeAttribute("data-theme");
  }, []);

  return (
    <div className="theme-toggle" role="group" aria-label="화면 밝기">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => choose(o.value)}
        >
          {o.value === "night" ? "🌙 " : o.value === "light" ? "☀️ " : ""}
          {o.label}
        </button>
      ))}
    </div>
  );
}
