/**
 * 제비 데이터 계층 — Supabase 백엔드.
 * 기존 Vite 앱 store.js와 동일한 인터페이스(비동기화).
 * - getYeons / getMaeums
 * - upsertYeon / updateYeon / deleteYeon
 * - addMaeum / updateMaeum / deleteMaeum
 * - isOnboarded / setOnboarded (온보딩 완료 플래그는 기기별 localStorage)
 * - reset (내 데이터 전체 삭제)
 */
import { supabase, ensureUser } from "./supabase.js";

const OB_KEY = "jebi.onboarded";
const BIGTEXT_KEY = "jebi.bigtext";
// P0-4 백업 상태 UI — 마지막 쓰기 성공 시각 (Supabase 쓰기가 끝난 시점)
const SYNC_KEY = "jebi:last-sync";
function touchSync() {
  try {
    localStorage.setItem(SYNC_KEY, String(Date.now()));
  } catch { /* noop */ }
}
// P1-2 마음/정산 모드 — 사용자별 저장 (기본 '마음')
const MODE_KEY = "jebi:statement-mode";

/**
 * 박씨 컬럼(grown_from_seed_id) 사용 가능 여부.
 * 마이그레이션이 아직 적용되지 않은 DB에서는 false가 되어 박씨 연결 UI가 숨겨진다.
 * - getMaeums 성공 시 실제 컬럼 존재 여부로 확정
 * - addMaeum에서 컬럼 부재 오류가 나면 false로 전환 후 재시도
 */
let seedColumnOk = true;
function isMissingSeedColumn(e) {
  if (!e) return false;
  const msg = `${e.message || ""} ${e.details || ""} ${e.hint || ""}`;
  return e.code === "PGRST204" || msg.includes("grown_from_seed_id");
}

/**
 * 전달 방식 컬럼(asset_kind) 사용 가능 여부.
 * 주의: maeums.kind는 경조사 종류로 이미 사용 중이라 별도 컬럼을 쓴다.
 * 마이그레이션 전 DB에서는 false가 되어 종류 선택 UI가 숨겨진다.
 */
let assetKindOk = true;
function isMissingAssetKindColumn(e) {
  if (!e) return false;
  const msg = `${e.message || ""} ${e.details || ""} ${e.hint || ""}`;
  return e.code === "PGRST204" || msg.includes("asset_kind");
}

/**
 * 참석 상태 컬럼(attendance) 사용 가능 여부 (J02).
 * 주의: 마이그레이션 전 DB에서는 false가 되어 참석 기록 UI가 숨겨진다.
 * asset_kind와 동일한 graceful degradation 패턴.
 */
let attendanceOk = true;
function isMissingAttendanceColumn(e) {
  if (!e) return false;
  const msg = `${e.message || ""} ${e.details || ""} ${e.hint || ""}`;
  return e.code === "PGRST204" || /\battendance\b/.test(msg);
}

/**
 * 날짜 정밀도 컬럼(date_precision) 사용 가능 여부 (J02/J03).
 */
let datePrecisionOk = true;
function isMissingDatePrecisionColumn(e) {
  if (!e) return false;
  const msg = `${e.message || ""} ${e.details || ""} ${e.hint || ""}`;
  return e.code === "PGRST204" || msg.includes("date_precision");
}

function toYeon(r) {
  return {
    id: r.id,
    name: r.name,
    relationTag: r.relation_tag || "지인",
    avatarGender: r.avatar_gender || null,
    createdAt: new Date(r.created_at).getTime(),
  };
}

function toMaeum(r) {
  return {
    id: r.id,
    yeonId: r.yeon_id,
    direction: r.direction,
    eventType: r.kind || "기타",
    amount: r.amount ?? null,
    memo: r.memo || null,
    occurredAt: r.occurred_at ? new Date(r.occurred_at).getTime() : null,
    eventDate: r.event_date || null,
    eventTime: r.event_time || null,
    place: r.place || null,
    account: r.account || null,
    plantedAt: r.planted_at ? new Date(r.planted_at).getTime() : Date.now(),
    repaidAt: r.repaid_at ? new Date(r.repaid_at).getTime() : null,
    remindedAt: r.reminded_at ? new Date(r.reminded_at).getTime() : null,
    // 박씨 마이그레이션 전 DB에서는 undefined → null (방어)
    grownFromSeedId: r.grown_from_seed_id || null,
    // 전달 방식 (asset_kind 마이그레이션 전에는 null = 미표기)
    assetKind: r.asset_kind || null,
    // J02: 참석 상태·날짜 정밀도 (마이그레이션 전에는 null)
    attendance: r.attendance || null,
    datePrecision: r.date_precision || null,
  };
}

async function uid() {
  const id = await ensureUser();
  if (!id) throw new Error("로그인 세션을 만들지 못했어요.");
  return id;
}

export const store = {
  async getYeons() {
    const userId = await uid();
    const { data, error } = await supabase
      .from("yeons")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(toYeon);
  },

  async getMaeums() {
    const userId = await uid();
    const { data, error } = await supabase
      .from("maeums")
      .select("*")
      .eq("user_id", userId)
      .order("planted_at", { ascending: false });
    if (error) throw error;
    // 박씨 컬럼 존재 여부 확정 (select("*")는 있는 컬럼만 돌려준다)
    if (data && data.length > 0) {
      seedColumnOk = Object.prototype.hasOwnProperty.call(data[0], "grown_from_seed_id");
      assetKindOk = Object.prototype.hasOwnProperty.call(data[0], "asset_kind");
      // J02: attendance/date_precision 컬럼 존재 여부 확정
      attendanceOk = Object.prototype.hasOwnProperty.call(data[0], "attendance");
      datePrecisionOk = Object.prototype.hasOwnProperty.call(data[0], "date_precision");
    }
    return (data || []).map(toMaeum);
  },

  /** 인연 찾기/생성 (이름 기준 매칭) */
  async upsertYeon(name, relationTag, gender) {
    const userId = await uid();
    const clean = name.trim() || "소중한 분";
    const { data: found } = await supabase
      .from("yeons")
      .select("*")
      .eq("user_id", userId)
      .eq("name", clean)
      .limit(1)
      .maybeSingle();
    if (found) return toYeon(found);
    const { data, error } = await supabase
      .from("yeons")
      .insert({
        user_id: userId,
        name: clean,
        relation_tag: relationTag || "지인",
        avatar_gender: gender || null,
      })
      .select()
      .single();
    if (error) throw error;
    touchSync();
    return toYeon(data);
  },

  /** 인연 항상 새로 생성 (동명이인 구분용) */
  async createYeon(name, relationTag, gender) {
    const userId = await uid();
    const { data, error } = await supabase
      .from("yeons")
      .insert({
        user_id: userId,
        name: (name || "").trim() || "소중한 분",
        relation_tag: relationTag || "지인",
        avatar_gender: gender || null,
      })
      .select()
      .single();
    if (error) throw error;
    touchSync();
    return toYeon(data);
  },

  async updateYeon(id, patch) {
    const row = {};
    if (patch.name !== undefined) row.name = patch.name.trim() || "소중한 분";
    if (patch.relationTag !== undefined) row.relation_tag = patch.relationTag;
    if (patch.avatarGender !== undefined) row.avatar_gender = patch.avatarGender;
    const { data, error } = await supabase
      .from("yeons")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    touchSync();
    return toYeon(data);
  },

  async deleteYeon(id) {
    // 마음 기록도 함께 삭제 (FK cascade)
    const { error } = await supabase.from("yeons").delete().eq("id", id);
    if (error) throw error;
    touchSync();
  },

  async addMaeum(m) {
    const userId = await uid();
    // J03 (QA06): 멱등 저장 — 클라이언트에서 id를 생성하고 upsert한다.
    // 중복 요청(더블탭·타임아웃 재시도)이 같은 id로 오면 같은 행을 갱신해
    // 중복 행·집 성장 중복이 생기지 않는다. 새 저장은 항상 새 id.
    const base = {
      id: m.id || crypto.randomUUID(),
      user_id: userId,
      yeon_id: m.yeonId,
      direction: m.direction,
      kind: m.eventType || "기타",
      amount: m.amount ?? null,
      memo: m.memo || null,
      occurred_at: m.occurredAt ? new Date(m.occurredAt).toISOString() : null,
      event_date: m.eventDate || null,
      event_time: m.eventTime || null,
      place: m.place || null,
      account: m.account || null,
      planted_at: new Date(m.plantedAt || Date.now()).toISOString(),
      repaid_at: m.repaidAt ? new Date(m.repaidAt).toISOString() : null,
      reminded_at: m.remindedAt ? new Date(m.remindedAt).toISOString() : null,
    };
    // J02: 선택 컬럼 4종 (grown_from_seed_id, asset_kind, attendance,
    // date_precision) — 컬럼이 없으면(마이그레이션 전) 해당 필드 없이 저장하고
    // UI 플래그를 끈다. 여러 컬럼이 동시에 없어도 루프로 순차 퇴행한다.
    const want = {
      seed: !!m.grownFromSeedId && seedColumnOk,
      kind: !!m.assetKind && assetKindOk,
      attendance: !!m.attendance && attendanceOk,
      datePrecision: !!m.datePrecision && datePrecisionOk,
    };
    const attempt = async (flags) => {
      const payload = { ...base };
      if (flags.seed) payload.grown_from_seed_id = m.grownFromSeedId;
      if (flags.kind) payload.asset_kind = m.assetKind;
      if (flags.attendance) payload.attendance = m.attendance;
      if (flags.datePrecision) payload.date_precision = m.datePrecision;
      const { data, error } = await supabase
        .from("maeums")
        .upsert(payload) // QA06: 같은 id 재시도는 갱신 — 중복 행 없음
        .select()
        .single();
      if (error) throw error;
      touchSync();
      return toMaeum(data);
    };
    const missCheckers = {
      seed: isMissingSeedColumn,
      kind: isMissingAssetKindColumn,
      attendance: isMissingAttendanceColumn,
      datePrecision: isMissingDatePrecisionColumn,
    };
    const okFlags = { seed: seedColumnOk, kind: assetKindOk, attendance: attendanceOk, datePrecision: datePrecisionOk };
    const setOkFlag = (k, v) => {
      okFlags[k] = v;
      if (k === "seed") seedColumnOk = v;
      if (k === "kind") assetKindOk = v;
      if (k === "attendance") attendanceOk = v;
      if (k === "datePrecision") datePrecisionOk = v;
    };
    if (want.seed || want.kind || want.attendance || want.datePrecision) {
      const flags = { ...want };
      for (;;) {
        try {
          return await attempt(flags);
        } catch (e) {
          let missed = false;
          for (const k of Object.keys(flags)) {
            if (flags[k] && missCheckers[k](e)) {
              setOkFlag(k, false);
              flags[k] = false;
              missed = true;
            }
          }
          if (!missed) throw e;
        }
      }
    }
    return await attempt({ seed: false, kind: false, attendance: false, datePrecision: false });
  },

  /** 박씨 연결 UI를 보여줘도 되는지 (마이그레이션 적용 여부) */
  isSeedSupported() {
    return seedColumnOk;
  },

  /** 전달 방식(현금/선물) UI를 보여줘도 되는지 (마이그레이션 적용 여부) */
  isAssetKindSupported() {
    return assetKindOk;
  },

  /** 참석 상태 UI를 보여줘도 되는지 (J02 마이그레이션 적용 여부) */
  isAttendanceSupported() {
    return attendanceOk;
  },

  /** 날짜 정밀도 UI를 보여줘도 되는지 (J02/J03 마이그레이션 적용 여부) */
  isDatePrecisionSupported() {
    return datePrecisionOk;
  },

  async updateMaeum(id, patch) {
    const row = {};
    if (patch.eventType !== undefined) row.kind = patch.eventType;
    if (patch.amount !== undefined) row.amount = patch.amount;
    if (patch.memo !== undefined) row.memo = patch.memo;
    if (patch.occurredAt !== undefined)
      row.occurred_at = patch.occurredAt ? new Date(patch.occurredAt).toISOString() : null;
    if (patch.eventDate !== undefined) row.event_date = patch.eventDate;
    if (patch.eventTime !== undefined) row.event_time = patch.eventTime;
    if (patch.place !== undefined) row.place = patch.place;
    if (patch.account !== undefined) row.account = patch.account;
    if (patch.repaidAt !== undefined)
      row.repaid_at = patch.repaidAt ? new Date(patch.repaidAt).toISOString() : null;
    if (patch.remindedAt !== undefined)
      row.reminded_at = patch.remindedAt ? new Date(patch.remindedAt).toISOString() : null;
    if (patch.assetKind !== undefined && assetKindOk) row.asset_kind = patch.assetKind;
    if (patch.attendance !== undefined && attendanceOk) row.attendance = patch.attendance;
    if (patch.datePrecision !== undefined && datePrecisionOk) row.date_precision = patch.datePrecision;
    const { data, error } = await supabase
      .from("maeums")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      // J02: 선택 컬럼 부재면 플래그를 끄고 해당 필드 없이 재시도
      const missMap = [
        [patch.assetKind !== undefined, isMissingAssetKindColumn, "asset_kind", (v) => { assetKindOk = v; }],
        [patch.attendance !== undefined, isMissingAttendanceColumn, "attendance", (v) => { attendanceOk = v; }],
        [patch.datePrecision !== undefined, isMissingDatePrecisionColumn, "date_precision", (v) => { datePrecisionOk = v; }],
      ];
      let missed = false;
      for (const [wanted, checker, col, setOk] of missMap) {
        if (wanted && checker(error)) {
          setOk(false);
          delete row[col];
          missed = true;
        }
      }
      if (missed) {
        const retry = await supabase
          .from("maeums")
          .update(row)
          .eq("id", id)
          .select()
          .single();
        if (retry.error) throw retry.error;
        touchSync();
        return toMaeum(retry.data);
      }
      throw error;
    }
    touchSync();
    return toMaeum(data);
  },

  async deleteMaeum(id) {
    const { error } = await supabase.from("maeums").delete().eq("id", id);
    if (error) throw error;
    touchSync();
  },

  isOnboarded() {
    try {
      return localStorage.getItem(OB_KEY) === "1";
    } catch {
      return false;
    }
  },
  setOnboarded(v) {
    try {
      localStorage.setItem(OB_KEY, v ? "1" : "0");
    } catch { /* noop */ }
  },

  /** 큰 글씨 (시니어 접근성) — 기기별 localStorage */
  isBigText() {
    try {
      return localStorage.getItem(BIGTEXT_KEY) === "1";
    } catch {
      return false;
    }
  },
  setBigText(v) {
    try {
      localStorage.setItem(BIGTEXT_KEY, v ? "1" : "0");
    } catch { /* noop */ }
  },

  /** 내 데이터 전체 삭제 (지붕 위 박과 인연 기록이 모두 사라져요) */
  async reset() {
    const userId = await uid();
    const { error: e1 } = await supabase.from("maeums").delete().eq("user_id", userId);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("yeons").delete().eq("user_id", userId);
    if (e2) throw e2;
    touchSync();
  },

  /** P0-4 백업 상태 UI — 마지막 동기화(쓰기 성공) 시각 */
  getLastSync() {
    try {
      const v = Number(localStorage.getItem(SYNC_KEY));
      return v > 0 ? v : null;
    } catch {
      return null;
    }
  },

  /** P1-2 마음/정산 모드 — '마음' | '정산' (기본 '마음') */
  getStatementMode() {
    try {
      const v = localStorage.getItem(MODE_KEY);
      return v === "정산" ? "정산" : "마음";
    } catch {
      return "마음";
    }
  },
  setStatementMode(v) {
    try {
      localStorage.setItem(MODE_KEY, v === "정산" ? "정산" : "마음");
    } catch { /* noop */ }
  },
};
