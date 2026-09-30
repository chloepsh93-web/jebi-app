import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 환경변수 설정 여부 — 없으면 크래시 대신 설정 안내 화면을 보여준다. */
export const isConfigured = Boolean(url && anonKey && !url.includes("your-project"));

export const supabase = isConfigured
  ? createClient(url, anonKey)
  : null;

/**
 * 익명 로그인 세션 확보 (개인 앱이라 별도 회원가입 없이 기기별 익명 유저로 시작)
 * @returns {Promise<string|null>} user id
 */
export async function ensureUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data?.session?.user) return data.session.user.id;
  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("익명 로그인 실패:", error.message);
    return null;
  }
  return signIn?.user?.id || null;
}
