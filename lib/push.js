/**
 * P0-1a 푸시 구독 수집 — 발송 없이 수집만 먼저 (구독자가 쌓여야 발송 의미가 있음)
 *
 * 상태: 'unsupported' (브라우저 미지원) | 'no-vapid' (VAPID 미설정 — chloe 설정 필요)
 *       | 'denied' (브라우저 권한 거부) | 'off' (미구독) | 'on' (구독 중)
 *
 * VAPID 공개키: NEXT_PUBLIC_VAPID_PUBLIC_KEY (공개키라 노출돼도 안전)
 * 구독 행: push_subscriptions(user_id, endpoint, keys_p256dh, keys_auth)
 * 발송 Edge Function은 supabase/functions/send-due-push/index.ts 초안만 존재.
 */
import { supabase, ensureUser } from "./supabase.js";

const TABLE = "push_subscriptions";

function vapidKey() {
  const k = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  return k && k.trim() ? k.trim() : null;
}

/** base64url → Uint8Array */
function urlBase64ToUint8Array(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const base64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    typeof window.atob === "function"
  );
}

async function currentSubscription() {
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function getPushStatus() {
  if (!isPushSupported()) return "unsupported";
  if (!vapidKey()) return "no-vapid";
  try {
    if (Notification.permission === "denied") return "denied";
    const sub = await currentSubscription();
    return sub ? "on" : "off";
  } catch {
    return "off";
  }
}

/** 구독 저장 — 브라우저 구독 + push_subscriptions 행 upsert */
export async function subscribePush() {
  if (!isPushSupported()) throw new Error("이 기기·브라우저에서는 알림을 받을 수 없어요.");
  const key = vapidKey();
  if (!key) throw new Error("알림 준비 중이에요. 조금만 기다려주세요.");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("알림이 허용되지 않았어요.");

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  const json = sub.toJSON();

  const userId = await ensureUser();
  if (!userId) throw new Error("로그인 세션을 만들지 못했어요.");

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      keys_p256dh: json.keys?.p256dh || null,
      keys_auth: json.keys?.auth || null,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error("구독 저장에 실패했어요.");
  return true;
}

/** 구독 해제 — 브라우저 구독 취소 + push_subscriptions 행 삭제 */
export async function unsubscribePush() {
  try {
    const sub = await currentSubscription();
    if (sub) await sub.unsubscribe();
  } catch {
    /* 브라우저 구독 취소 실패해도 DB 행은 정리 */
  }
  try {
    const userId = await ensureUser();
    if (userId) {
      await supabase.from(TABLE).delete().eq("user_id", userId);
    }
  } catch {
    /* noop */
  }
  return true;
}
