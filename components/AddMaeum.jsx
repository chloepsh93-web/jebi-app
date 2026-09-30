"use client";

import { useState } from "react";
import { A } from "@/lib/assets";
import { parse } from "@/lib/parser";
import { store } from "@/lib/store";
import { logEvent } from "@/lib/metrics";
import { Direction, EventType, AssetKind, availableSeeds, parseDatePrecision, DatePrecision } from "@/lib/model";
import { formatShort, ym, won } from "@/lib/format";
import { probeSplitsSupport, addSplits, normalizeCompanionNames, equalShare } from "@/lib/splits";
import DateField from "./DateField";
import { Avatar } from "./ui";

/**
 * 소식 기록 플로우 — 목업의 "감지 · 소식이 도착했어요" 화면을 통합.
 * input → parsing → detect("제비가 소식을 물고 왔어요") → 저장
 * - P1-3: 파서가 "기타"로 분류하면 범위 안내 메시지 표시
 * - P2-2: 날짜 입력은 달력 피커(DateField)
 * - P2-4: 동명이인 → 인연 선택 UI
 */
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
      onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
      style={{
        width: "100%", border: "none", borderBottom: "1px solid var(--color-brand-amber-deep)",
        fontFamily: "inherit", fontSize: 16, background: "transparent",
      }}
    />
  );
}

const KIND_KEY = "jebi:asset-kind"; // 직전 전달 방식 기억 (점진적 기본값 — 디자인팀 반론 채택)
// 첫 기록은 명시 선택(빈 값), 이후에는 직전 선택을 기본값으로. 미선택 저장은 null(미표기).
function readLastKind() {
  try {
    const v = localStorage.getItem(KIND_KEY);
    return v === AssetKind.GOODS || v === AssetKind.CASH ? v : "";
  } catch {
    return "";
  }
}

const emptyForm = () => ({
  // J03 (QA06): 폼 인스턴스당 하나의 멱등 키 — 더블탭 저장이 같은 id로 upsert된다
  clientId: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  yeonId: null, name: "", event: "", date: "", dateUnknown: false, time: "", place: "", account: "",
  amount: "", relation: "", memo: "", direction: Direction.RECEIVED,
  assetKind: "",
});

export default function AddMaeum({ yeons, maeums, presetYeonId, seedFromMaeumId = null, seedSupported = true, splitsSupported = false, onClose, onSaved, onToast = null }) {
  const [step, setStep] = useState("input"); // input → parsing → parseFail → detect/manual
  const [text, setText] = useState("");
  const [parsedEtc, setParsedEtc] = useState(false); // P1-3: 범위 외 소식
  const [form, setForm] = useState(() => {
    const f = emptyForm();
    f.assetKind = readLastKind(); // 점진적 기본값: 첫 1회는 "" (명시 선택), 이후 직전 선택
    if (presetYeonId) {
      const y = yeons.find((v) => v.id === presetYeonId);
      if (y) { f.yeonId = y.id; f.name = y.name; f.relation = y.relationTag || ""; }
    }
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // 정의 순환 — 심어지길 기다리는 박씨 (받은 마음에만)
  const seeds = availableSeeds(maeums);
  const [seedId, setSeedId] = useState(() =>
    seedFromMaeumId && seeds.some((s) => s.id === seedFromMaeumId) ? seedFromMaeumId : null
  );
  const nameOf = (id) => yeons.find((y) => y.id === id)?.name || "소중한 분";
  const showSeedPick = seedSupported && seeds.length > 0;

  // N빵 — 함께한 인연 (maeum_splits 미지원이면 전체 숨김, graceful)
  const [splitsOn, setSplitsOn] = useState(splitsSupported);
  const [checkedIds, setCheckedIds] = useState([]); // 선택된 기존 인연 id
  const [newName, setNewName] = useState(""); // 직접 입력 중인 이름
  const [newNames, setNewNames] = useState([]); // 직접 입력한 새 인연 이름들
  const [splitAmts, setSplitAmts] = useState({}); // `y:${id}` | `n:${name}` → 금액 문자열
  const toggleCompanion = (id) =>
    setCheckedIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const addNewName = () => {
    const clean = normalizeCompanionNames([newName], form.name.trim());
    if (clean.length === 0) return;
    if (!newNames.includes(clean[0]) && checkedIds.length + newNames.length < 5) {
      setNewNames((p) => [...p, clean[0]]);
    }
    setNewName("");
  };
  const amtFor = (key) => {
    const digits = String(splitAmts[key] ?? "").replace(/[^0-9]/g, "");
    const n = digits ? Number(digits) : null;
    return n && n > 0 ? n : null;
  };
  // 균등 분할 제안값 채우기 — 사용자가 확정한 값만 저장된다 (자동 기록 안 함)
  const fillEqual = () => {
    const total = form.amount ? Number(String(form.amount).replace(/[^0-9]/g, "")) : 0;
    const per = equalShare(total, checkedIds.length + newNames.length + 1);
    if (per == null) return;
    const next = {};
    for (const id of checkedIds) next[`y:${id}`] = per.toLocaleString();
    for (const n of newNames) next[`n:${n}`] = per.toLocaleString();
    setSplitAmts(next);
  };
  const companionCount = checkedIds.length + newNames.length;

  const doParse = () => {
    if (!text.trim()) return;
    setStep("parsing");
    logEvent("invitation_parse_requested", {}, "input"); // J10 사전
    setTimeout(() => {
      const r = parse(text);
      if (!r.event && !r.name && !r.date && !r.place) {
        setStep("parseFail");
        logEvent("invitation_parse_failed", { empty: true }, "input"); // 원문 수집 금지
        return;
      }
      logEvent("invitation_parse_succeeded", {}, "input"); // J10 사전
      setParsedEtc(r.event === "기타");
      setForm((f) => ({
        ...f,
        name: r.name || f.name,
        event: r.event || "",
        date: r.date || "",
        time: r.time || "",
        place: r.place || "",
        account: r.account || "",
      }));
      setStep("detect");
    }, 1600);
  };

  // P2-4: 같은 이름의 인연이 여러 명이면 선택 UI
  const sameName = form.name.trim()
    ? yeons.filter((y) => y.name === form.name.trim())
    : [];
  const needPick = sameName.length > 1 && !form.yeonId;
  const pickedYeon = form.yeonId ? yeons.find((y) => y.id === form.yeonId) : sameName[0];
  const pickedMaeums = pickedYeon ? maeums.filter((m) => m.yeonId === pickedYeon.id) : [];
  const hasOpenGourd = pickedMaeums.some((m) => m.direction === Direction.RECEIVED && !m.repaidAt);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let y;
      if (form.yeonId && form.yeonId !== "new") {
        y = yeons.find((v) => v.id === form.yeonId);
      }
      const name = form.name.trim() || "소중한 분";
      if (!y) {
        // P2-4: "새로운 인연으로 기록"이면 이름 매칭을 우회하고 항상 새로 생성
        y = form.yeonId === "new"
          ? await store.createYeon(name, form.relation, null)
          : await store.upsertYeon(name, form.relation, null);
      }
      const saved = await store.addMaeum({
        id: form.clientId, // J03 (QA06): 멱등 키 — 중복 요청은 같은 행을 갱신
        yeonId: y.id,
        direction: form.direction,
        eventType: form.event || EventType.OTHER,
        amount: form.amount ? Number(String(form.amount).replace(/[^0-9]/g, "")) : null,
        memo: form.memo.trim() || null,
        // J03 (QA05): 날짜 미정이면 eventDate는 null, datePrecision은 unknown
        eventDate: form.dateUnknown ? null : (form.date || null),
        datePrecision: form.dateUnknown ? DatePrecision.UNKNOWN : parseDatePrecision(form.date),
        eventTime: form.time || null,
        place: form.place || null,
        account: form.account || null,
        plantedAt: Date.now(),
        repaidAt: null,
        remindedAt: null,
        grownFromSeedId: isReceived && seedId ? seedId : null,
        assetKind: form.assetKind || null, // 미선택은 null(미표기) — 억지로 채우지 않는다
      });
      // 직전 전달 방식 기억 (다음 기록의 기본값)
      if (form.assetKind) {
        try { localStorage.setItem(KIND_KEY, form.assetKind); } catch { /* 무시 */ }
      }
      // N빵 분할 — 조용히 시도, 실패해도 마음 저장은 유지 (에러 토스트 없음)
      if (splitsOn && companionCount > 0) {
        try {
          const ok = await probeSplitsSupport();
          if (!ok) {
            setSplitsOn(false);
          } else {
            const splits = [];
            for (const id of checkedIds) {
              if (id === y.id) continue; // 대표 인연 제외
              splits.push({ yeonId: id, amount: amtFor(`y:${id}`) });
            }
            // 직접 입력한 이름은 항상 새 인연으로 만든다 (guideline #11 — upsert 금지)
            for (const n of normalizeCompanionNames(newNames, name)) {
              const created = await store.createYeon(n, "", null);
              if (created.id === y.id) continue;
              splits.push({ yeonId: created.id, amount: amtFor(`n:${n}`) });
            }
            if (splits.length > 0) {
              const r = await addSplits(saved.id, splits);
              if (!r.ok && r.reason === "unsupported") setSplitsOn(false);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
      onSaved(saved);
    } catch (e) {
      console.error(e);
      setSaving(false);
      // S02: 저장 실패는 조용히 넘기지 않는다 — 입력은 그대로 두고 알린다
      if (onToast) onToast("저장에 실패했어요. 입력은 그대로 있으니 다시 시도해주세요");
    }
  };

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(form.account.replace(/[^0-9]/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const isReceived = form.direction === Direction.RECEIVED;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="navbar" style={{ padding: "0 0 4px" }}>
          <button
            className="nav-back"
            onClick={step === "input" ? onClose : () => setStep("input")}
            aria-label="뒤로"
          >
            ‹
          </button>
          <div className="nav-title">소식 기록하기</div>
          <div className="nav-spacer" />
        </div>

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
            <button className="btn btn-ghost" onClick={() => setStep("manual")}>
              문자 없이 직접 입력
            </button>
          </>
        )}

        {step === "parsing" && (
          <div className="jebi-looking">
            <img src={A.jebi_perched} alt="제비" />
            <p className="sub">제비가 소식을 살펴보고 있어요</p>
          </div>
        )}

        {step === "parseFail" && (
          <>
            <h3>제비가 소식을 찾지 못했어요</h3>
            <p className="sub">
              아직 배우지 못한 모양이에요.
              <br />
              기억나는 대로 직접 알려주세요.
            </p>
            <button className="btn btn-primary" onClick={() => setStep("manual")}>
              직접 입력하기
            </button>
            <button className="btn btn-ghost" onClick={() => setStep("input")}>
              다시 붙여넣기
            </button>
          </>
        )}

        {(step === "detect" || step === "manual") && (
          <>
            {step === "detect" ? (
              <>
                <div className="jebi-detect">
                  <img src={A.jebi_perched} alt="제비가 물어온 소식" />
                  <p className="jebi-detect-title">제비가 소식을 물어왔어요</p>
                </div>
                <p className="sub">
                  {form.name ? `${form.name}님의 ${form.event || "경조사"} 소식` : "이런 소식을 찾았어요"}
                </p>
              </>
            ) : (
              <>
                <h3>직접 입력</h3>
                <p className="sub">확인하고 고친 뒤 지붕에 심어요</p>
              </>
            )}

            {step === "detect" && (
              <div className="parsed">
                <span className="tag">제비가 물어온 소식</span>
                <div className="row">
                  <span className="k">누구</span>
                  <Editable value={form.name} placeholder="이름"
                    onChange={(v) => setForm({ ...form, name: v, yeonId: null })} />
                </div>
                <div className="row">
                  <span className="k">언제</span>
                  <span>{form.date ? formatShort(form.date) : "날짜 미정"}</span>
                </div>
                <div className="row">
                  <span className="k">어디</span>
                  <Editable value={form.place} placeholder="장소"
                    onChange={(v) => setForm({ ...form, place: v })} />
                </div>
                <div className="edit-hint">잘못된 부분이 있다면 톡 눌러 고칠 수 있어요</div>
              </div>
            )}

            {/* P1-3: 범위 외 소식 안내 */}
            {parsedEtc && (
              <div className="etc-notice">
                제비가 아직 배우지 못한 소식이에요 (개업·집들이 등).
                <br />
                아래에서 종류를 직접 골라 기록할 수 있어요.
              </div>
            )}

            {/* P2-4: 동명이인 선택 */}
            {needPick && (
              <div className="parsed" style={{ borderColor: "var(--color-border-gold)" }}>
                <div className="fl" style={{ marginBottom: 8 }}>
                  같은 이름의 인연이 {sameName.length}명 있어요. 어느 분인가요?
                </div>
                {sameName.map((y) => {
                  const ms = maeums.filter((m) => m.yeonId === y.id);
                  return (
                    <button
                      key={y.id}
                      className="chip-btn"
                      style={{ display: "block", width: "100%", marginBottom: 6, textAlign: "left" }}
                      onClick={() => setForm({ ...form, yeonId: y.id })}
                    >
                      {y.name} · {y.relationTag || "지인"} · 마음 {ms.length}개
                      {ms.length > 0 && ` · 최근 ${ym(ms[0].plantedAt)}`}
                    </button>
                  );
                })}
                <button
                  className="chip-btn"
                  style={{ display: "block", width: "100%", textAlign: "left" }}
                  onClick={() => setForm({ ...form, yeonId: "new" })}
                >
                  + 새로운 {form.name.trim()}님으로 기록
                </button>
              </div>
            )}

            {pickedYeon && sameName.length >= 1 && (
              <div className="etc-notice">
                {pickedMaeums.length > 0
                  ? `${pickedYeon.name}님과 주고받은 마음이 ${pickedMaeums.length}개 있어요.`
                  : `${pickedYeon.name}님은 이미 아는 인연이에요.`}
                {hasOpenGourd && <><br />지붕 위에 이분의 박이 있어요.</>}
              </div>
            )}
            {/* 인연 연결 배지 */}
            {pickedYeon && (
              <div className="link-badge">✓ {pickedYeon.name}님과 연결됐어요</div>
            )}

            <label className="fl">받음 / 보냄</label>
            <select className="field" value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value={Direction.RECEIVED}>받은 마음 (지붕에 심김)</option>
              <option value={Direction.SENT}>보낸 마음 (하늘 궤적)</option>
            </select>

            {/* 전달 방식 — asset_kind 마이그레이션 전에는 숨김 (점진적 기본값: 첫 1회 명시 선택, 이후 직전 선택 기억) */}
            {store.isAssetKindSupported() && (
              <>
                <label className="fl">어떻게 전했어요?</label>
                <select className="field" value={form.assetKind}
                  onChange={(e) => setForm({ ...form, assetKind: e.target.value })}>
                  <option value="">선택해주세요</option>
                  <option value={AssetKind.CASH}>현금으로</option>
                  <option value={AssetKind.GOODS}>선물로</option>
                </select>
              </>
            )}

            {step === "manual" && (
              <>
                <input className="field" placeholder="이름" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value, yeonId: null })} />
                <select className="field" value={form.event}
                  onChange={(e) => setForm({ ...form, event: e.target.value })}>
                  <option value="">경조사 종류</option>
                  <option>결혼</option><option>부고</option><option>돌잔치</option><option>생일</option>
                  <option>기타</option>
                </select>
                <input className="field" placeholder="장소" value={form.place}
                  onChange={(e) => setForm({ ...form, place: e.target.value })} />
              </>
            )}

            {step === "detect" && (
              <select className="field" value={form.event}
                onChange={(e) => setForm({ ...form, event: e.target.value })}>
                <option value="">경조사 종류</option>
                <option>결혼</option><option>부고</option><option>돌잔치</option><option>생일</option>
                <option>기타</option>
              </select>
            )}

            {/* P2-2: 날짜는 달력 피커 */}
            <DateField
              label="언제"
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
              dateUnknown={form.dateUnknown}
              onDateUnknownChange={(v) => setForm({ ...form, dateUnknown: v })}
            />

            <input className="field" placeholder="시간 (예: 14:00)" value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <select className="field" value={form.relation}
              onChange={(e) => setForm({ ...form, relation: e.target.value })}>
              <option value="">관계 (선택)</option>
              <option>가족</option><option>회사</option><option>학교</option><option>지인</option>
            </select>
            <input className="field" inputMode="numeric" placeholder="전한 마음 (선택)"
              value={form.amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setForm({ ...form, amount: v ? Number(v).toLocaleString() : "" });
              }} />
            <input className="field" placeholder="한 줄 메모 (선택)" value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })} />

            {/* N빵 — 함께한 인연 (maeum_splits 미지원이면 렌더링 안 됨) */}
            {splitsOn && (
              <div className="parsed split-pick">
                <label className="fl">함께한 인연 (선택)</label>
                <p className="sub" style={{ margin: "2px 0 8px" }}>
                  같이 마음을 전한 분들을 골라주세요
                </p>
                <div className="split-list">
                  {yeons.map((yy) => {
                    const ms = maeums.filter((m) => m.yeonId === yy.id);
                    const on = checkedIds.includes(yy.id);
                    return (
                      <button
                        key={yy.id}
                        type="button"
                        className={`chip-btn split-row${on ? " on" : ""}`}
                        onClick={() => toggleCompanion(yy.id)}
                        aria-pressed={on}
                      >
                        <Avatar gender={yy.avatarGender} name={yy.name} size={28} />
                        <span className="split-row-name">
                          {yy.name} · {yy.relationTag || "지인"} · 마음 {ms.length}개
                        </span>
                        <span aria-hidden>{on ? "✓" : "+"}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="split-newrow">
                  <input
                    className="field"
                    style={{ marginBottom: 0 }}
                    placeholder="목록에 없는 분 — 새 인연으로 기록돼요"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addNewName()}
                  />
                  <button type="button" className="chip-btn" onClick={addNewName}>
                    추가
                  </button>
                </div>
                {newNames.length > 0 && (
                  <div className="split-newnames">
                    {newNames.map((n) => (
                      <span key={n} className="chip-btn split-newchip">
                        {n} (새 인연)
                        <button
                          type="button"
                          aria-label={`${n} 빼기`}
                          onClick={() => setNewNames((p) => p.filter((x) => x !== n))}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {companionCount > 0 && (
                  <div className="split-amts">
                    <div className="fl" style={{ marginTop: 8 }}>
                      각자 전한 마음 (선택)
                      {form.amount ? (
                        <button type="button" className="btn-textlink" onClick={fillEqual}>
                          균등하게 나누기
                        </button>
                      ) : null}
                    </div>
                    {checkedIds.map((id) => (
                      <div className="split-amt-row" key={`y:${id}`}>
                        <span>{nameOf(id)}님</span>
                        <input
                          className="field"
                          style={{ marginBottom: 0 }}
                          inputMode="numeric"
                          placeholder="비워두면 금액 없이"
                          value={splitAmts[`y:${id}`] || ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            setSplitAmts((p) => ({ ...p, [`y:${id}`]: v ? Number(v).toLocaleString() : "" }));
                          }}
                        />
                      </div>
                    ))}
                    {newNames.map((n) => (
                      <div className="split-amt-row" key={`n:${n}`}>
                        <span>{n}님</span>
                        <input
                          className="field"
                          style={{ marginBottom: 0 }}
                          inputMode="numeric"
                          placeholder="비워두면 금액 없이"
                          value={splitAmts[`n:${n}`] || ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            setSplitAmts((p) => ({ ...p, [`n:${n}`]: v ? Number(v).toLocaleString() : "" }));
                          }}
                        />
                      </div>
                    ))}
                    <p className="edit-hint">
                      금액을 비워두면 "함께 전한 마음"으로만 기록돼요
                    </p>
                  </div>
                )}
              </div>
            )}

            {form.account && (
              <div className="copy-ok">
                <div className="row">
                  <span className="k">계좌</span>
                  <span>{form.account}</span>
                </div>
                <div className="row">
                  <span className="k">전한 마음</span>
                  <span>
                    {form.amount
                      ? `${Number(String(form.amount).replace(/[^0-9]/g, "")).toLocaleString()}원`
                      : "아직 정하지 않았어요"}
                  </span>
                </div>
                <div className="edit-hint">계좌는 제비가 기억하고 있어요</div>
                <button className="btn btn-ghost" onClick={copyAccount}>
                  {copied ? "복사됐어요 ✓" : "계좌번호 복사하기"}
                </button>
              </div>
            )}

            {/* 정의 순환 — 박씨 함께 심기 (받은 마음만) */}
            {showSeedPick && isReceived && (
              <div className="seed-pick">
                <div className="fl">박씨 함께 심기</div>
                <p className="sub" style={{ margin: "2px 0 8px" }}>
                  제비가 물어다 준 박씨와 함께 심으면 정이 이어져요
                </p>
                <div className="seed-chips">
                  {seeds.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`chip-btn seed-chip${seedId === s.id ? " on" : ""}`}
                      onClick={() => setSeedId(seedId === s.id ? null : s.id)}
                    >
                      {nameOf(s.yeonId)}님의 박씨 · {ym(s.repaidAt)}
                    </button>
                  ))}
                </div>
                {seedId && (
                  <div className="seed-picked">
                    {nameOf(seeds.find((s) => s.id === seedId)?.yeonId)}님의 박씨를 함께 심어요
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-primary" disabled={saving || needPick} onClick={save}>
              {saving ? "심는 중…" : isReceived ? "지붕에 심기" : "제비 편에 보내기"}
            </button>
            <button className="btn btn-ghost" onClick={() => setStep("input")}>
              뒤로
            </button>
          </>
        )}
      </div>
    </div>
  );
}
