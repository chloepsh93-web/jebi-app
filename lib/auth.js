/**
 * 제비 — 데이터 복원(P0) 인증 계층.
 * 익명 시작은 유지하고, 사용자가 원할 때 이메일 계정으로 전환한다.
 *
 * - linkEmail: 익명 → 이메일 계정 전환 (Supabase 내장: updateUser({ email }),
 *   확인 완료 시 같은 user id 유지, yeons/maeums 그대로)
 * - sendLoginLink: 새 기기에서 signInWithOtp(매직링크)로 기존 user id 세션 시작
 * - mergeAnonymousRows: 병합 케이스 — 새 기기에서 익명으로 먼저 기록한 뒤
 *   로그인하면, 익명 세션에서 읽어둔 행을 영구 계정으로 복사(copy)한다.
 *
 * service_role 키는 사용하지 않는다. 모든 작업은 RLS 범위 내 클라이언트 작업이다.
 */
import { supabase } from "./supabase.js";

/** 이메일 확인 링크가 복귀할 주소 (Supabase Site URL) */
const SITE_URL = "https://jebi-app.vercel.app";

/** Keep email callbacks in the environment where recovery was started. */
export function getEmailRedirectUrl() {
  const configured = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;
  const value = configured || (typeof window !== "undefined" ? window.location.origin : SITE_URL);
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("이메일 복귀 주소 설정을 확인해주세요.");
  }
  return url.href;
}

export async function getAuthInfo() {
  if (!supabase) return { isAnonymous: true, email: null, id: null };
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return { isAnonymous: true, email: null, id: null };
    return {
      isAnonymous: !!user.is_anonymous,
      email: user.email || null,
      id: user.id,
    };
  } catch {
    return { isAnonymous: true, email: null, id: null };
  }
}

/** 인증 상태 변경 구독 — page.js에서 한 번만 등록한다. */
export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => cb(event, session));
  return () => data?.subscription?.unsubscribe();
}

/**
 * "내 기록 지키기" — 익명 사용자를 이메일 계정으로 전환.
 * 확인 메일 발송 후, 메일에서 확인하면 같은 user id 그대로 영구 계정이 된다.
 */
export async function linkEmail(email) {
  if (!supabase) throw new Error("서버 연결을 확인해주세요.");
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: getEmailRedirectUrl() }
  );
  if (error) {
    if (error.message?.includes("already registered") || error.status === 422) {
      throw new Error("이미 쓰고 있는 이메일이에요. '이미 지킨 기록이 있어요'로 로그인해주세요.");
    }
    throw new Error("메일을 보내지 못했어요. 다시 시도해주세요.");
  }
}

/** "이미 지킨 기록이 있어요" — 매직링크로 기존 계정 세션 시작. */
export async function sendLoginLink(email) {
  if (!supabase) throw new Error("서버 연결을 확인해주세요.");
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: getEmailRedirectUrl(), shouldCreateUser: false },
  });
  if (error) throw new Error("메일을 보내지 못했어요. 다시 시도해주세요.");
}

/**
 * 병합용 스냅샷 — 로그인(세션 전환) 전에 익명 세션으로 읽어둔다.
 * 전환 후에는 RLS(auth.uid()=user_id)상 익명 행이 보이지 않으므로,
 * 반드시 signInWithOtp 호출 전에 실행해야 한다.
 * 매직링크 클릭 시 페이지가 리로드될 수 있어, 메모리뿐 아니라
 * localStorage에도 임시 보관한다 (시크릿 아님 — 사용자 본인의 행 데이터).
 */
export async function snapshotAnonymous() {
  if (!supabase) return { anonId: null, yeons: [], maeums: [] };
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error("기록을 확인하지 못했어요. 다시 시도해주세요.");
  if (!user || !user.is_anonymous) return { anonId: null, yeons: [], maeums: [] };
  const [y, m] = await Promise.all([
    supabase.from("yeons").select("*").eq("user_id", user.id),
    supabase.from("maeums").select("*").eq("user_id", user.id),
  ]);
  if (y.error || m.error) throw new Error("기록을 읽지 못했어요. 로그인 전에 다시 시도해주세요.");
  return { anonId: user.id, yeons: y.data || [], maeums: m.data || [] };
}

const STAGE_KEY = "jebi:merge-snapshot";
const STAGE_TTL = 24 * 60 * 60 * 1000; // 24시간 — 버려진 스냅샷(이름 포함) 방치 방지
const MERGED_KEY = "jebi:merged-snapshots"; // J08: 병합 완료된 anonId 기록 — 중복 병합 방지

function readMerged() {
  try {
    return JSON.parse(localStorage.getItem(MERGED_KEY) || "[]");
  } catch {
    return [];
  }
}

/** 이미 병합한 스냅샷인지 (같은 익명 기록의 중복 복사 방지) */
export function isAlreadyMerged(anonId) {
  if (!anonId) return false;
  return readMerged().includes(anonId);
}

export function markMerged(anonId) {
  try {
    if (!anonId) return;
    const list = readMerged();
    if (!list.includes(anonId)) {
      list.push(anonId);
      localStorage.setItem(MERGED_KEY, JSON.stringify(list.slice(-10))); // 최근 10개만
    }
  } catch { /* noop */ }
}

export function stageSnapshot(snap) {
  try {
    if (snap && snap.anonId) {
      localStorage.setItem(STAGE_KEY, JSON.stringify({ ...snap, stagedAt: Date.now() }));
    }
  } catch { /* 저장 실패 시 메모리 스냅샷만 사용 */ }
}

export function takeStagedSnapshot() {
  try {
    const raw = localStorage.getItem(STAGE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    // TTL 만료 시 파기
    if (!snap.stagedAt || Date.now() - snap.stagedAt > STAGE_TTL) {
      localStorage.removeItem(STAGE_KEY);
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

export function clearStagedSnapshot() {
  try {
    localStorage.removeItem(STAGE_KEY);
  } catch { /* noop */ }
}

/**
 * 병합 실행 — 스냅샷 행을 영구 계정으로 복사한다.
 * - yeon id를 새로 발급하고, maeums의 yeon_id와 grown_from_seed_id
 *   자기참조를 새 id에 맞게 재연결한다 (2-pass).
 * - J08: 참석·날짜정밀도·금품종류도 함께 복사 (없으면 데이터 손실).
 *   컬럼 미적용 DB에서는 해당 필드 없이 재시도 (graceful degradation).
 * - 원본 익명 행은 삭제하지 않고 남겨둔다: 로그인 후에는 RLS상
 *   익명 user_id의 행이 클라이언트에 보이지 않아 UPDATE/DELETE가
 *   불가능하고, service_role 없이 삭제할 방법이 없다.
 *   고아 행으로 남지만 무해하다 (해당 익명 세션에서만 보인다).
 */
function isMissingColumnError(e) {
  if (!e) return false;
  const msg = String(e.message || "");
  return e.code === "PGRST204" || /attendance|date_precision|asset_kind/.test(msg);
}

async function insertMaeumRow(row) {
  const { error } = await supabase.from("maeums").insert(row);
  if (error && isMissingColumnError(error)) {
    // J08: 마이그레이션 전 DB — 선택 컬럼 없이 재시도
    const { attendance, date_precision, asset_kind, ...base } = row;
    const retry = await supabase.from("maeums").insert(base);
    if (retry.error) throw retry.error;
    return;
  }
  if (error) throw error;
}

/**
 * J08 멱등: 이미 복사된 행인지 확인 (재시도 시 중복 삽입 방지).
 * RLS상 본인 행만 보이므로 user_id=permId 행만 검사하면 된다.
 */
async function rowExists(table, id) {
  const { data } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  return !!data;
}

export async function mergeAnonymousRows(snapshot) {
  if (!supabase) throw new Error("서버 연결을 확인해주세요.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) throw new Error("로그인 상태를 확인해주세요.");
  const permId = user.id;

  // J08: 재시도 멱등 — 첫 시도에서 발급한 새 ID 매핑을 스냅샷에 저장하고
  // 재시도 때는 재사용한다. 이미 복사된 행은 건너뛴다.
  const saved = snapshot.mergedIds || {};
  const yeonMap = { ...(saved.yeonMap || {}) };
  const maeumMap = { ...(saved.maeumMap || {}) };
  for (const y of snapshot.yeons || []) {
    if (!yeonMap[y.id]) yeonMap[y.id] = crypto.randomUUID();
  }
  for (const m of snapshot.maeums || []) {
    if (!maeumMap[m.id]) maeumMap[m.id] = crypto.randomUUID();
  }
  if (!snapshot.mergedIds) {
    stageSnapshot({ ...snapshot, mergedIds: { yeonMap, maeumMap } });
  }

  for (const y of snapshot.yeons || []) {
    const nid = yeonMap[y.id];
    if (await rowExists("yeons", nid)) continue; // 이전 시도에서 이미 복사됨
    const { error } = await supabase.from("yeons").insert({
      id: nid,
      user_id: permId,
      name: y.name,
      relation_tag: y.relation_tag,
      avatar_gender: y.avatar_gender,
    });
    if (error) throw error;
  }

  for (const m of snapshot.maeums || []) {
    const nid = maeumMap[m.id];
    if (await rowExists("maeums", nid)) continue; // 이전 시도에서 이미 복사됨
    await insertMaeumRow({
      id: nid,
      user_id: permId,
      yeon_id: yeonMap[m.yeon_id] || null,
      grown_from_seed_id:
        (m.grown_from_seed_id && maeumMap[m.grown_from_seed_id]) || null,
      direction: m.direction,
      kind: m.kind,
      amount: m.amount,
      memo: m.memo,
      occurred_at: m.occurred_at,
      event_date: m.event_date,
      event_time: m.event_time,
      place: m.place,
      account: m.account,
      planted_at: m.planted_at,
      repaid_at: m.repaid_at,
      reminded_at: m.reminded_at,
      // J08: 새 필드도 병합 (스냅샷은 DB snake_case)
      attendance: m.attendance || null,
      date_precision: m.date_precision || null,
      asset_kind: m.asset_kind || null,
    });
  }
}
