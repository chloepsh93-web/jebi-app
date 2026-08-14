import { useState, useEffect } from "react";
import { A } from "./assets/assets.js";
import { store } from "./store.js";
import { parse } from "./parser.js";
import Onboarding from "./Onboarding.jsx";
import {
  computeGourdState, summarize, GourdState, Direction, EventType,
  RelationTag, RelationColor, checkRemindDue,
} from "./model.js";

const GOURD_ASSET = {
  [GourdState.SPROUT]: A.gourd_small,
  [GourdState.GROWING]: A.gourd_small,
  [GourdState.RIPE]: A.gourd_big,
  [GourdState.OLD_RIPE]: A.gourd_old,
  [GourdState.OPENED]: A.gourd_open,
};
const ROOF_POS = [
  { top: "17%", left: "34%", w: "8%" },
  { top: "14%", left: "47.5%", w: "6.5%" },
  { top: "19%", left: "58.5%", w: "7.5%" },
  { top: "13%", left: "27%", w: "6%" },
  { top: "20%", left: "68%", w: "7%" },
];

export default function App() {
  const [onboarded, setOnboarded] = useState(store.isOnboarded());
  const [tab, setTab] = useState("home");
  const [yeons, setYeons] = useState(store.getYeons());
  const [maeums, setMaeums] = useState(store.getMaeums());
  const [showAdd, setShowAdd] = useState(false);
  const [detailYeonId, setDetailYeonId] = useState(null); // 인연 상세

  const refresh = () => {
    setYeons(store.getYeons());
    setMaeums(store.getMaeums());
  };

  // 온보딩 미완료 → 온보딩 먼저
  if (!onboarded) {
    return <Onboarding onDone={() => { setOnboarded(true); refresh(); }} />;
  }

  const stats = summarize(maeums);
  const roofGourds = maeums.filter(
    (m) => m.direction === Direction.RECEIVED && !m.repaidAt
  );

  // 인연 상세 화면
  if (detailYeonId) {
    const yeon = yeons.find((y) => y.id === detailYeonId);
    return (
      <div className="app">
        <YeonDetail
          yeon={yeon}
          maeums={maeums.filter((m) => m.yeonId === detailYeonId)}
          onBack={() => setDetailYeonId(null)}
          onRepay={(mid) => { store.updateMaeum(mid, { repaidAt: Date.now() }); refresh(); }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {tab === "home" && (
        <Home stats={stats} roofGourds={roofGourds} maeums={maeums}
          onRepay={(mid) => { store.updateMaeum(mid, { repaidAt: Date.now() }); refresh(); }} />
      )}
      {tab === "yeon" && <YeonList yeons={yeons} maeums={maeums} onOpen={setDetailYeonId} />}
      {tab === "me" && <MePlaceholder onReset={() => { store.reset(); refresh(); }}
        onReplayOnboarding={() => { store.setOnboarded(false); setOnboarded(false); }} />}

      {tab === "home" && (
        <button className="fab" onClick={() => setShowAdd(true)}>
          + 소식 기록하기
        </button>
      )}

      <nav className="tabbar">
        <button className={`tab ${tab === "home" ? "active" : ""}`} onClick={() => setTab("home")}>
          <HouseIcon /> 우리 집
        </button>
        <button className={`tab ${tab === "yeon" ? "active" : ""}`} onClick={() => setTab("yeon")}>
          <PeopleIcon /> 인연
        </button>
        <button className={`tab ${tab === "me" ? "active" : ""}`} onClick={() => setTab("me")}>
          <MeIcon /> 나
        </button>
      </nav>

      {showAdd && (
        <AddSheet
          onClose={() => setShowAdd(false)}
          onSaved={() => { refresh(); setShowAdd(false); setTab("home"); }}
        />
      )}
    </div>
  );
}

// ---------------- HOME ----------------
function Home({ stats, roofGourds, maeums, onRepay }) {
  const empty = maeums.length === 0;
  // 갚을 때가 온 박 (익음/오래익음) — 갚기 넛지
  const dueToRepay = roofGourds.filter((m) => {
    const st = computeGourdState(m);
    return st === GourdState.RIPE || st === GourdState.OLD_RIPE;
  });
  const yeons = store.getYeons();
  const nameOf = (id) => yeons.find((y) => y.id === id)?.name || "소중한 분";

  return (
    <div className="content">
      <div className="navbar">
        <div className="nav-spacer" />
        <div className="nav-title">우리 집</div>
        <div className="bell-wrap">
          <img src={A.bell} alt="알림" />
          {dueToRepay.length > 0 && <span className="bell-badge">{dueToRepay.length}</span>}
        </div>
      </div>

      <div className="home-house">
        <img className="house" src={A.house_empty} alt="우리 집" />
        <img className="jebi-nest" src={A.jebi_perched} alt="둥지 곁 제비" />
        {roofGourds.slice(0, 5).map((m, i) => {
          const st = computeGourdState(m);
          const pos = ROOF_POS[i];
          return (
            <div key={m.id} className="roof-gourd" style={{ top: pos.top, left: pos.left, width: pos.w }}>
              <img src={GOURD_ASSET[st] || A.gourd_small} alt={st} />
            </div>
          );
        })}
      </div>

      {empty ? (
        <p className="home-caption">
          아직 지붕이 비어 있어요<br />
          <span className="em">첫 소식</span>을 기록하면 박이 심어져요
        </p>
      ) : (
        <p className="home-caption">
          지붕 위 <span className="em">박 {stats.oweCount}개</span>가 자라고 있어요<br />
          전한 마음 {stats.warmthCount}개가 우리 집을 밝히고 있어요
        </p>
      )}

      <div className="home-stats">
        <div className="stat">
          <div className="lbl">갚을 마음</div>
          <div className="val">{stats.oweCount}<span className="sub">개 · 지붕 위</span></div>
        </div>
        <div className="stat">
          <div className="lbl">전한 마음</div>
          <div className="val">{stats.warmthCount}<span className="sub">개 · 온기</span></div>
        </div>
      </div>

      {/* 갚을 때가 온 박 — 넛지 카드 */}
      {dueToRepay.map((m) => (
        <div className="repay-card" key={m.id}>
          <div className="repay-body">
            <b>{nameOf(m.yeonId)}</b>님과의 박이 익었어요
            <span className="repay-sub"> — 갚을 때가 왔어요</span>
          </div>
          <div className="repay-cta">
            <button className="repay-btn primary"
              onClick={() => onRepay(m.id)}>다녀왔어요</button>
          </div>
        </div>
      ))}
    </div>
  );
}


// ---------------- ADD FLOW ----------------
function AddSheet({ onClose, onSaved }) {
  const [step, setStep] = useState("input"); // input → confirm
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({
    name: "", event: "", date: "", time: "", place: "", account: "",
    amount: "", relation: "", direction: Direction.RECEIVED,
  });

  const doParse = () => {
    if (!text.trim()) return;
    const r = parse(text);
    setParsed(r);
    setForm((f) => ({
      ...f,
      name: r.name || "",
      event: r.event || "",
      date: r.date || "",
      time: r.time || "",
      place: r.place || "",
      account: r.account || "",
    }));
    setStep("confirm");
  };

  const goManual = () => {
    setManual(true);
    setStep("confirm");
  };

  const save = () => {
    const name = form.name.trim() || "소중한 분";
    const y = store.upsertYeon(name, form.relation, null);
    const now = Date.now();
    store.addMaeum({
      id: "m_" + now + "_" + Math.random().toString(36).slice(2, 7),
      yeonId: y.id,
      direction: form.direction,
      eventType: form.event || EventType.OTHER,
      amount: form.amount ? Number(String(form.amount).replace(/[^0-9]/g, "")) : null,
      eventDate: form.date || null,
      eventTime: form.time || null,
      place: form.place || null,
      account: form.account || null,
      plantedAt: now,
      repaidAt: null,
      remindedAt: null,
    });
    onSaved();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {step === "input" && (
          <>
            <h3>소식이 도착했나요?</h3>
            <p className="sub">청첩장·부고 문자를 붙여넣으면 제비가 정리해드려요</p>
            <textarea
              className="paste"
              placeholder="문자를 여기에 붙여넣어 보세요"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn btn-primary" disabled={!text.trim()} onClick={doParse}>
              제비에게 건네기
            </button>
            <button className="btn btn-ghost" onClick={goManual}>문자 없이 직접 입력</button>
          </>
        )}

        {step === "confirm" && (
          <>
            <h3>{manual ? "직접 입력" : "제비가 이렇게 정리했어요"}</h3>
            <p className="sub">확인하고 고친 뒤 지붕에 심어요</p>

            {parsed && parsed.event === "기타" && (
              <div className="etc-notice">
                제비가 아직 배우지 못한 소식이에요 (개업·집들이 등).<br />
                아래에서 종류를 직접 골라 기록할 수 있어요.
              </div>
            )}

            <label className="fl">받음 / 보냄</label>
            <select className="field" value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value={Direction.RECEIVED}>받은 마음 (지붕에 심김)</option>
              <option value={Direction.SENT}>보낸 마음 (하늘 궤적)</option>
            </select>

            <input className="field" placeholder="이름" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="field" value={form.event}
              onChange={(e) => setForm({ ...form, event: e.target.value })}>
              <option value="">경조사 종류</option>
              <option>결혼</option><option>부고</option><option>돌잔치</option><option>생일</option>
            </select>
            <input className="field" placeholder="언제 (예: 2026-09-12)" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="field" placeholder="시간 (예: 12:30)" value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <input className="field" placeholder="장소" value={form.place}
              onChange={(e) => setForm({ ...form, place: e.target.value })} />
            <select className="field" value={form.relation}
              onChange={(e) => setForm({ ...form, relation: e.target.value })}>
              <option value="">관계 (선택)</option>
              <option>가족</option><option>회사</option><option>학교</option><option>지인</option>
            </select>
            <input className="field" inputMode="numeric" placeholder="봉투 금액 (선택)"
              value={form.amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setForm({ ...form, amount: v ? Number(v).toLocaleString() : "" });
              }} />

            <button className="btn btn-primary" onClick={save}>지붕에 심기</button>
            <button className="btn btn-ghost" onClick={() => setStep("input")}>뒤로</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- YEON LIST ----------------
function YeonList({ yeons, maeums, onOpen }) {
  if (yeons.length === 0) {
    return (
      <div className="content">
        <div className="navbar"><div className="nav-spacer" /><div className="nav-title">인연</div><div className="nav-spacer" /></div>
        <p className="empty">아직 인연이 없어요.<br />소식이 오면 제비가 물어다 줄 거예요.</p>
      </div>
    );
  }
  // 각 인연의 최근 마음 상태
  const rows = yeons.map((y) => {
    const ms = maeums.filter((m) => m.yeonId === y.id).sort((a, b) => b.plantedAt - a.plantedAt);
    const latest = ms[0];
    const st = latest ? computeGourdState(latest) : null;
    return { y, latest, st, count: ms.length };
  }).sort((a, b) => (b.latest?.plantedAt || 0) - (a.latest?.plantedAt || 0));

  const tagCopy = (st) => {
    switch (st) {
      case GourdState.SPROUT: return { t: "심음", c: "#B9D08A" };
      case GourdState.GROWING: return { t: "자람", c: "#97C459" };
      case GourdState.RIPE: return { t: "익음", c: "#EF9F27" };
      case GourdState.OPENED: return { t: "열림", c: "#0F6E56" };
      case GourdState.OLD_RIPE: return { t: "오래 익음", c: "#8B6B3E" };
      default: return { t: "", c: "#C4A876" };
    }
  };

  return (
    <div className="content">
      <div className="navbar"><div className="nav-spacer" /><div className="nav-title">인연</div><div className="nav-spacer" /></div>
      <div>
        {rows.map(({ y, latest, st, count }) => {
          const tc = tagCopy(st);
          return (
            <div className="yeon-item" key={y.id} onClick={() => onOpen(y.id)}>
              <div className="y-tags">
                <span className="y-dot" style={{ background: tc.c }} />
                <span className="y-tag">{tc.t}</span>
                <span className="y-when">· 마음 {count}개</span>
              </div>
              <div className="y-copy">{copyFor(y.name, st, latest)}</div>
              <div className="y-who">{y.name}{y.relationTag ? ` · ${y.relationTag}` : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function copyFor(name, st, m) {
  switch (st) {
    case GourdState.SPROUT: return `${name}님과의 인연이 시작됐어요`;
    case GourdState.GROWING: return `${name}님과의 박이 자라고 있어요`;
    case GourdState.RIPE: return `${name}님과의 박이 익었어요 — 갚을 때가 왔어요`;
    case GourdState.OPENED: return `${name}님과의 박이 열렸어요`;
    case GourdState.OLD_RIPE: return `${name}님과의 박이 오래 익었어요 — 안부 물어볼까요?`;
    default: return `${name}님`;
  }
}

// ---------------- YEON DETAIL (타임라인) ----------------
function YeonDetail({ yeon, maeums, onBack, onRepay }) {
  if (!yeon) return null;
  const sorted = [...maeums].sort((a, b) => b.plantedAt - a.plantedAt);

  const eventLabel = (m) => {
    const dir = m.direction === Direction.RECEIVED ? "받음" : "보냄";
    return `${m.eventType || "경조사"} · ${dir}`;
  };
  const fmtDate = (m) => {
    if (m.eventDate) {
      const d = m.eventDate.startsWith("????") ? m.eventDate.slice(5) + " (연도미상)" : m.eventDate;
      return d + (m.eventTime ? ` ${m.eventTime}` : "");
    }
    return new Date(m.plantedAt).toLocaleDateString("ko-KR");
  };

  return (
    <div className="content">
      <div className="navbar">
        <button className="nav-back" onClick={onBack}>‹</button>
        <div className="nav-title">{yeon.name}</div>
        <div className="nav-spacer" />
      </div>

      <div className="detail-head">
        <div className="detail-name">{yeon.name}
          {yeon.relationTag ? <span className="detail-tag">{yeon.relationTag}</span> : null}
        </div>
        <div className="detail-sub">주고받은 마음 {maeums.length}개</div>
      </div>

      <div className="timeline">
        {sorted.map((m) => {
          const st = computeGourdState(m);
          const repayable = m.direction === Direction.RECEIVED && !m.repaidAt &&
            (st === GourdState.RIPE || st === GourdState.OLD_RIPE);
          return (
            <div className="tl-item" key={m.id}>
              <div className="tl-dot" style={{ background: m.direction === Direction.RECEIVED ? "#EF9F27" : "#8EC5E8" }} />
              <div className="tl-body">
                <div className="tl-top">{eventLabel(m)}</div>
                <div className="tl-date">{fmtDate(m)}</div>
                {m.place && <div className="tl-place">{m.place}</div>}
                {m.amount != null && <div className="tl-amt">{Number(m.amount).toLocaleString()}원</div>}
                {m.repaidAt && <div className="tl-done">✓ 갚음 완료 · 박이 열렸어요</div>}
                {repayable && (
                  <button className="repay-btn primary sm" onClick={() => onRepay(m.id)}>
                    다녀왔어요 (박 열기)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- ME (placeholder) ----------------
function MePlaceholder({ onReset, onReplayOnboarding }) {
  return (
    <div className="content">
      <div className="navbar"><div className="nav-spacer" /><div className="nav-title">나</div><div className="nav-spacer" /></div>
      <p className="empty">
        설정은 다음 단계에서 채워집니다.<br />
        (알림 설정 · 백업 · 세계관 다시 보기)
      </p>
      <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <button className="btn btn-ghost" onClick={onReplayOnboarding}>
          온보딩 다시 보기
        </button>
        <button className="btn btn-ghost" onClick={() => { if (confirm("모든 데이터를 지울까요? (테스트용)")) onReset(); }}>
          데이터 초기화 (테스트용)
        </button>
      </div>
    </div>
  );
}

// ---------------- ICONS ----------------
function HouseIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12l9-8 9 8v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" /></svg>;
}
function PeopleIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="4" /><path d="M17 11l3 3-3 3M2 20c0-4 4-6 7-6s7 2 7 6" /></svg>;
}
function MeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>;
}
