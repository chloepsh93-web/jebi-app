import { useState } from "react";
import { A } from "./assets/assets.js";
import { parse } from "./parser.js";
import { store } from "./store.js";
import { Direction, EventType } from "./model.js";

/**
 * 인터랙티브 온보딩 — 첫 실행 → 첫 박 심기 (50% Aha 여정)
 * jebi-onboarding-interactive.html을 React로 이식.
 * 완료 시 onDone() 호출. 첫 마음을 실제로 저장함.
 */
export default function Onboarding({ onDone }) {
  const [stage, setStage] = useState("intro"); // intro → input → confirm → plant → goal
  const [text, setText] = useState("");
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({ name: "", event: "", date: "", time: "", place: "" });
  const [planted, setPlanted] = useState(false);

  const doParse = () => {
    if (!text.trim()) return;
    const r = parse(text);
    setForm({
      name: r.name || "", event: r.event || "", date: r.date || "",
      time: r.time || "", place: r.place || "",
    });
    setStage("confirm");
  };
  const goManual = () => { setManual(true); setStage("confirm"); };

  const plant = () => {
    const name = form.name.trim() || "소중한 분";
    const y = store.upsertYeon(name, "", null);
    const now = Date.now();
    store.addMaeum({
      id: "m_" + now + "_" + Math.random().toString(36).slice(2, 7),
      yeonId: y.id, direction: Direction.RECEIVED,
      eventType: form.event || EventType.OTHER, amount: null,
      eventDate: form.date || null, eventTime: form.time || null,
      place: form.place || null, account: null,
      plantedAt: now, repaidAt: null, remindedAt: null,
    });
    setStage("plant");
    setTimeout(() => setPlanted(true), 200);
  };

  const finish = () => { store.setOnboarded(true); onDone(); };

  return (
    <div className="ob-root">
      {stage === "intro" && (
        <div className="ob-card">
          <img className="ob-hero" src={A.house_jebi_intro} alt="편지를 문 제비" />
          <h2 className="serif ob-head">받은 마음이 자라는 집</h2>
          <p className="ob-sub">제비가 소식을 물어다 주고,<br />그 마음이 지붕 위 박으로 자라요</p>
          <div className="ob-dots"><i className="on" /><i /><i /><i /></div>
          <button className="btn btn-primary" onClick={() => setStage("input")}>시작하기</button>
          <button className="btn btn-ghost" onClick={() => setStage("input")}>건너뛰기</button>
        </div>
      )}

      {stage === "input" && (
        <div className="ob-card">
          <h2 className="ob-head sm">최근 받은 청첩장이나<br />부고 문자가 있나요?</h2>
          <p className="ob-sub">제비에게 건네면, 알아서 정리해드려요</p>
          <textarea className="paste" placeholder="문자를 여기에 붙여넣어 보세요"
            value={text} onChange={(e) => setText(e.target.value)} />
          <div className="ob-dots"><i /><i className="on" /><i /><i /></div>
          <button className="btn btn-primary" disabled={!text.trim()} onClick={doParse}>제비에게 건네기</button>
          <button className="btn btn-ghost" onClick={goManual}>문자 없이 직접 알려줄래요</button>
        </div>
      )}

      {stage === "confirm" && (
        <div className="ob-card">
          <h2 className="ob-head sm">{manual ? "기억나는 경조사\n하나만 알려주세요" : "제비가 이렇게\n정리했어요"}</h2>
          <p className="ob-sub">확인하고 고친 뒤 지붕에 심어요</p>
          <input className="field" placeholder="이름" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="field" value={form.event}
            onChange={(e) => setForm({ ...form, event: e.target.value })}>
            <option value="">경조사 종류</option>
            <option>결혼</option><option>부고</option><option>돌잔치</option><option>생일</option>
          </select>
          <input className="field" placeholder="언제 (예: 2026-09-12)" value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input className="field" placeholder="장소 (선택)" value={form.place}
            onChange={(e) => setForm({ ...form, place: e.target.value })} />
          <div className="ob-dots"><i /><i /><i className="on" /><i /></div>
          <button className="btn btn-primary" onClick={plant}>지붕에 심기</button>
          <button className="btn btn-ghost" onClick={() => setStage("input")}>뒤로</button>
        </div>
      )}

      {stage === "plant" && (
        <div className="ob-card">
          <img className="ob-hero" src={A.sprout_closeup} alt="첫 새싹"
            style={{ opacity: planted ? 1 : 0, transition: "opacity 1s ease" }} />
          <h2 className="serif ob-head" style={{ opacity: planted ? 1 : 0, transition: "opacity 1s .3s" }}>
            첫 마음이<br />지붕에 심어졌어요
          </h2>
          <p className="ob-sub" style={{ opacity: planted ? 1 : 0, transition: "opacity 1s .5s" }}>
            당신의 우리 집이 시작됐어요
          </p>
          <div style={{ opacity: planted ? 1 : 0, transition: "opacity 1s .8s", width: "100%" }}>
            <button className="btn btn-primary" onClick={() => setStage("goal")}>계속</button>
          </div>
        </div>
      )}

      {stage === "goal" && (
        <div className="ob-card">
          <img className="ob-hero" src={A.house_gourds} alt="가득 찬 우리 집" />
          <h2 className="serif ob-head">언젠가 당신의 집도<br />이렇게 가득 차요</h2>
          <p className="ob-sub">주고받은 마음이 쌓일수록<br />지붕은 박으로, 집은 온기로 가득해져요</p>
          <p className="ob-badge">받은 마음도, 전할 마음도 놓치지 않게 — 제비</p>
          <div className="ob-dots"><i /><i /><i /><i className="on" /></div>
          <button className="btn btn-primary" onClick={finish}>내 집으로 들어가기</button>
        </div>
      )}
    </div>
  );
}
