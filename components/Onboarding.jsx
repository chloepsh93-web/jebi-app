"use client";

import { useEffect, useRef, useState } from "react";
import { A } from "@/lib/assets";
import { parse } from "@/lib/parser";
import { store } from "@/lib/store";
import { Direction, EventType } from "@/lib/model";
import { formatShort } from "@/lib/format";
import { logEvent } from "@/lib/metrics";
import { COPY } from "@/lib/copy";
import DateField from "./DateField";
import { Glossary } from "./ui";

/**
 * 인터랙티브 온보딩 — 첫 소식 기록
 * jebi-onboarding-interactive.html 기준:
 * 인트로 슬라이드 3장(스와이프) → 입력(샘플/직접) → 파싱 중 → 확인(수정 가능) → 심기 → 목표 → 완료
 * 카드로 설명하지 않고, 첫 인연을 직접 심게 만든다.
 */
const SAMPLE =
  "[모바일청첩장] 저희 두 사람이 부부의 연을 맺습니다. 신랑 김도현 ❤ 신부 이서연 / 2026년 8월 15일 토요일 오후 1시 / 그랜드컨벤션 5층 아너스홀 / 마음 전하실 곳 신랑측 국민 123456-01-234567";

const EVENTS = ["결혼", "부고", "돌잔치", "생일"];

/** 인트로 슬라이드 — '마음·박·인연·제비' 세계관 소개 */
const INTRO_SLIDES = [
  {
    kicker: "정을 기억하는 제비",
    art: A.house_jebi_intro,
    alt: "제비가 머무는 초가집",
    title: "마음을 챙기면,\n인연이 자라는 집",
    desc: "흥부가 제비에게 건넨 정이 박씨로 돌아왔듯, 주변의 소중한 순간을 함께 기억해요.",
  },
  {
    kicker: "소중한 순간을 놓치지 않게",
    art: A.jebi_perched,
    alt: "소식을 전하는 제비",
    title: "소식을 건네고,\n일정을 기억해요",
    desc: "청첩장·부고 문자를 확인해 일정으로 기록해요. 돈·선물은 실제 주고받은 뒤 따로 남겨요.",
  },
  {
    kicker: "정이 쌓이는 우리 집",
    art: A.house_gourds,
    alt: "정이 쌓이는 같은 초가집",
    title: "기억한 마음이,\n다음 인사로 이어져요",
    desc: "참석과 안부, 주고받은 기록을 인연별로 돌아봐요. 복은 더 따뜻해진 관계의 이야기예요.",
  },
];

function IntroSlides({ onDone, onSkip, invite }) {
  const [idx, setIdx] = useState(0);
  const touch = useRef({ x: 0, y: 0 });
  const last = INTRO_SLIDES.length - 1;

  const onTouchStart = (e) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && idx < last) setIdx(idx + 1);
      if (dx > 0 && idx > 0) setIdx(idx - 1);
    }
  };

  return (
    <div className="intro-slides fade-in">
      <button className="intro-skip" onClick={onSkip}>
        건너뛰기
      </button>
      {invite && (
        <div className="link-badge" style={{ display: "table", margin: "12px auto 0" }}>
          🕊 초대로 오셨네요, 환영해요
        </div>
      )}
      <div
        className="intro-viewport"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="intro-track"
          aria-live="polite" aria-atomic="true"
        >
          {INTRO_SLIDES.filter((_, i) => i === idx).map((s) => (
            <div className="intro-slide" key={idx}>
              <img className="ob-hero" src={s.art} alt={s.alt} />
              <div className="intro-kicker">{s.kicker}</div>
              <h2 className="serif">
                {s.title.split("\n").map((line, li) => (
                  <span key={li}>
                    {line}
                    {li === 0 && <br />}
                  </span>
                ))}
              </h2>
              <p className="ob-sub">{s.desc}</p>
              {s.glossary && <Glossary compact />}
            </div>
          ))}
        </div>
      </div>
      <div className="intro-dots">
        {INTRO_SLIDES.map((_, i) => (
          <button
            key={i}
            className={`intro-dot${i === idx ? " on" : ""}`}
            onClick={() => setIdx(i)}
            aria-label={`${i + 1}번 슬라이드`}
            aria-current={i === idx ? "step" : undefined}
          />
        ))}
      </div>
      <button
        className="btn btn-primary intro-next"
        onClick={() => (idx < last ? setIdx(idx + 1) : onDone())}
      >
        {idx < last ? "다음" : "시작하기"}
      </button>
    </div>
  );
}

/** 톡 누르면 고칠 수 있는 필드 */
function Editable({ value, onChange, placeholder }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <span className="editable" onClick={() => setEditing(true)}>
        {value || placeholder}
      </span>
    );
  }
  return (
    <input
      autoFocus
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter") setEditing(false);
      }}
      style={{
        width: "100%", border: "none", borderBottom: "1px solid var(--color-brand-amber-deep)",
        fontFamily: "inherit", fontSize: 15, background: "transparent",
      }}
    />
  );
}

function Dots({ n, total = 4 }) {
  return (
    <div className="ob-dots">
      {Array.from({ length: total }).map((_, i) => (
        <i key={i} className={i === n ? "on" : ""} />
      ))}
    </div>
  );
}

export default function Onboarding({ onDone, inviteRef }) {
  // intro → input → manual → parsing → confirm → plant → goal
  const [stage, setStage] = useState("intro");
  const [text, setText] = useState("");
  // J05: 예시 격리 — 예시 문자로 체험하면 저장하지 않는다 (운영 데이터·집계 제외)
  const [isSample, setIsSample] = useState(false);
  // J10 사전: 온보딩 노출 1회 기록
  useEffect(() => { logEvent("onboarding_view", {}, "welcome"); }, []);
  const [form, setForm] = useState({ name: "", event: "", date: "", time: "", place: "" });
  const [planted, setPlanted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const startParse = () => {
    if (!text.trim()) return;
    setStage("parsing");
    setTimeout(() => {
      const r = parse(text);
      if (!r.event && !r.name && !r.date && !r.place) {
        // 파싱 실패 — 제비가 소식을 찾지 못했어요
        setForm({ name: "", event: "", date: "", time: "", place: "" });
        setStage("parseFail");
        return;
      }
      setForm({
        name: r.name || "",
        event: r.event || "",
        date: r.date || "",
        time: r.time || "",
        place: r.place || "",
      });
      setStage("confirm");
    }, 1900);
  };

  const plant = async () => {
    if (saving) return;
    if (!form.name.trim() || !form.event) {
      setSaveError("인연 이름과 경조사 종류를 확인해주세요.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      // J05: 예시 문자는 저장하지 않는다 — 김도현 같은 가짜 인연이
      // 실제 인연 목록·집계에 섞이지 않도록. 애니메이션만 보여준다.
      if (!isSample) {
        const name = form.name.trim() || "소중한 분";
        const y = await store.upsertYeon(name, "", null);
        await store.addMaeum({
          yeonId: y.id,
          direction: Direction.RECEIVED,
          eventType: form.event || EventType.OTHER,
          amount: null,
          eventDate: form.date || null,
          eventTime: form.time || null,
          place: form.place || null,
          account: null,
          plantedAt: Date.now(),
          repaidAt: null,
          remindedAt: null,
        });
        logEvent("occasion_saved", {}, "welcome");
      }
    } catch {
      setSaveError("저장하지 못했어요. 입력 내용은 남아 있어요. 다시 시도해주세요.");
      setSaving(false);
      return;
    }
    setSaving(false);
    setStage("plant");
    setTimeout(() => setPlanted(true), 250);
  };

  const skip = () => {
    store.setOnboarded(true);
    onDone();
  };
  const finish = () => {
    store.setOnboarded(true);
    onDone();
  };

  return (
    <div className="ob-root">
      {stage === "intro" && (
        <IntroSlides
          onDone={() => setStage("input")}
          onSkip={() => setStage("input")}
          invite={inviteRef}
        />
      )}

      {stage === "input" && (
        <div className="ob-card fade-in">
          <h2 className="ob-head sm">
            최근 받은 청첩장이나
            <br />
            부고 문자가 있나요?
          </h2>
          <p className="ob-sub">제비에게 건네면, 알아서 정리해드려요</p>
          <textarea
            className="paste"
            placeholder="문자를 여기에 붙여넣어 보세요"
            value={text}
            onChange={(e) => { setText(e.target.value); setIsSample(false); }}
          />
          <button
            className="ob-sample-link"
            onClick={() => { setText(SAMPLE); setIsSample(true); logEvent("demo_started", {}, "welcome"); }}
          >
            예시 문자로 체험해볼래요
          </button>
          <div className="ob-or">또는</div>
          <Dots n={1} />
          <button className="btn btn-primary" disabled={!text.trim()} onClick={startParse}>
            제비에게 건네기
          </button>
          <button className="btn btn-ghost" onClick={() => { setIsSample(false); setStage("manual"); }}>
            문자 없이 직접 알려줄래요
          </button>
          <button className="btn btn-ghost" onClick={skip}>
            건너뛰기
          </button>
        </div>
      )}

      {stage === "manual" && (
        <ManualForm
          onBack={() => setStage("input")}
          onDone={(f) => {
            setForm({ name: f.name, event: f.event, date: "", time: "", place: "" });
            setStage("confirm");
          }}
        />
      )}

      {stage === "parsing" && (
        <div className="ob-card">
          <div className="jebi-looking">
            <img src={A.jebi_perched} alt="제비" />
            <p className="ob-sub">제비가 소식을 살펴보고 있어요</p>
          </div>
        </div>
      )}

      {stage === "parseFail" && (
        <div className="ob-card fade-in">
          <h2 className="ob-head sm">
            제비가 소식을
            <br />
            찾지 못했어요
          </h2>
          <p className="ob-sub">
            아직 배우지 못한 모양이에요.
            <br />
            기억나는 대로 직접 알려주세요.
          </p>
          <Dots n={1} />
          <button className="btn btn-primary" onClick={() => { setIsSample(false); setStage("manual"); }}>
            직접 알려주기
          </button>
          <button className="btn btn-ghost" onClick={() => setStage("input")}>
            다시 붙여넣기
          </button>
        </div>
      )}

      {stage === "confirm" && (
        <div className="ob-card fade-in">
          {saveError && <div className="error-box" role="alert">{saveError}</div>}
          <h2 className="ob-head sm">
            제비가 이렇게
            <br />
            정리했어요
          </h2>
          {isSample && (
            <p className="ob-sub" style={{ color: "var(--color-brand-amber-deep)", fontWeight: 600 }}>
              예시 문자예요 — 저장되지 않아요.
              <br />
              흐름만 체험해 보세요.
            </p>
          )}
          <p className="ob-sub">
            맞는지 확인하고, 지붕에 심어볼까요?
          </p>
          <div className="parsed" style={{ width: "100%", textAlign: "left" }}>
            <span className="tag">제비가 물어온 소식</span>
            <div className="row">
              <span className="k">누구</span>
              <Editable value={form.name} placeholder="이름" onChange={(v) => setForm({ ...form, name: v })} />
            </div>
            <div className="row">
              <span className="k">언제</span>
              <span>{form.date ? formatShort(form.date) : "날짜 미정"}</span>
            </div>
            <div className="row">
              <span className="k">어디</span>
              <Editable value={form.place} placeholder="장소" onChange={(v) => setForm({ ...form, place: v })} />
            </div>
            <div className="row">
              <span className="k">무엇</span>
              <Editable value={form.event} placeholder="경조사 종류" onChange={(v) => setForm({ ...form, event: v })} />
            </div>
            <div className="edit-hint">잘못된 부분이 있다면 톡 눌러 고칠 수 있어요</div>
          </div>
          {/* P2-2: 날짜는 달력 피커로 */}
          <div style={{ width: "100%", textAlign: "left" }}>
            <DateField label="날짜 고치기" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
          </div>
          <Dots n={2} />
          <button className="btn btn-primary" disabled={saving} onClick={plant}>
            {saving ? "심는 중…" : "지붕에 심기"}
          </button>
          <button className="btn btn-ghost" onClick={() => setStage("input")}>
            뒤로
          </button>
        </div>
      )}

      {stage === "plant" && (
        <div className="ob-card">
          <img
            className={`ob-hero${form.event === "부고" ? "" : " sprout-grow"}`}
            src={form.event === "부고" ? A.jebi_perched : A.sprout_closeup}
            alt={form.event === "부고" ? "조용히 곁에 있는 제비" : "첫 새싹"}
            style={{ opacity: planted ? 1 : 0, transform: planted ? "none" : "scale(0.96)" }}
          />
          <h2
            className="serif ob-head"
            style={{ opacity: planted ? 1 : 0, transition: "opacity 1s .3s" }}
          >
            {isSample ? "기록 흐름을 체험했어요" : form.event === "부고" ? "조용히 소식을 기록했어요" : "소식을 기억했어요"}
          </h2>
          <p className="ob-sub" style={{ opacity: planted ? 1 : 0, transition: "opacity 1s .5s" }}>
            {isSample ? (
              <>
                예시라서 저장되진 않았어요.
                <br />
                이제 진짜 소식을 심어보세요.
              </>
            ) : (
              <>
                {form.name}님의 {form.event} · {form.date || "날짜 미정"}을 저장했어요. 홈에서 다시 확인할 수 있어요.
                <br />
                {form.event === "부고" ? "필요한 순간에 조용히 마음을 챙겨요." : "기억한 소식이 다음 인사로 이어져요."}
              </>
            )}
          </p>
          <div style={{ opacity: planted ? 1 : 0, transition: "opacity 1s .8s", width: "100%" }}>
            <button className="btn btn-primary" onClick={isSample ? () => { setIsSample(false); setStage("manual"); } : finish}>
              {isSample ? "내 첫 기록 남기기" : "저장한 일정 보러 가기"}
            </button>
          </div>
        </div>
      )}

      {stage === "goal" && (
        <div className="ob-card fade-in">
          <img className="ob-hero" src={form.event === "부고" ? A.house_empty : A.house_gourds} alt={form.event === "부고" ? "마음을 기억하는 우리 집" : "가득 찬 우리 집"} />
          <h2 className="serif ob-head">
            {form.event === "부고" ? "소중한 인연을 기억하는 집" : "정을 건네며 인연을 이어가요"}
          </h2>
          <p className="ob-sub">
            {form.event === "부고" ? "곁에 있고 싶은 순간을 잊지 않도록 도와드릴게요." : "기록한 마음이 다음 소중한 순간을 챙기는 데 도움이 돼요."}
          </p>
          <p className="ob-badge">받은 마음도, 전할 마음도 놓치지 않게 — 제비</p>
          <Dots n={3} />
          <button className="btn btn-primary" onClick={finish}>
            내 집으로 들어가기
          </button>
        </div>
      )}
    </div>
  );
}

/** 직접 입력 폼 — "기억나는 경조사 하나만 알려주세요" */
function ManualForm({ onBack, onDone }) {
  const [name, setName] = useState("");
  const [event, setEvent] = useState("");
  return (
    <div className="ob-card fade-in">
      <h2 className="ob-head sm">
        기억나는 경조사
        <br />
        하나만 알려주세요
      </h2>
      <p className="ob-sub">누구의, 어떤 마음이었나요?</p>
      <input
        className="field"
        placeholder="이름 (예: 김도현)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginTop: 12 }}
      />
      <p className="ob-sub" style={{ margin: "6px 0 0" }}>어떤 경조사인가요?</p>
      <div className="ev-chips">
        {EVENTS.map((ev) => (
          <button
            key={ev}
            className={`ev-chip${event === ev ? " on" : ""}`}
            onClick={() => setEvent(ev)}
          >
            {ev === "결혼" ? "결혼식" : ev}
          </button>
        ))}
      </div>
      <Dots n={1} />
      <button className="btn btn-primary" onClick={() => onDone({ name, event })}>
        이 마음 기억하기
      </button>
      <button className="btn btn-ghost" onClick={onBack}>
        뒤로
      </button>
    </div>
  );
}
