"use client";

function HouseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12l9-8 9 8v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="4" />
      <path d="M17 11l3 3-3 3M2 20c0-4 4-6 7-6s7 2 7 6" />
    </svg>
  );
}
function MeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

export default function TabBar({ tab, onTab }) {
  return (
    <nav className="tabbar">
      <button className={`tab ${tab === "home" ? "active" : ""}`} onClick={() => onTab("home")}>
        <HouseIcon /> 우리 집
      </button>
      <button className={`tab ${tab === "yeon" ? "active" : ""}`} onClick={() => onTab("yeon")}>
        <PeopleIcon /> 인연
      </button>
      <button className={`tab ${tab === "me" ? "active" : ""}`} onClick={() => onTab("me")}>
        <MeIcon /> 나
      </button>
    </nav>
  );
}
