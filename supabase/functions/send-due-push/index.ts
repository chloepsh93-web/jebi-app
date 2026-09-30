/**
 * 제비(Jebi) 푸시 발송 Edge Function — P0-1b (코드 초안)
 *
 * ⚠️ chloe 승인 전 배포 금지.
 * chloe가 직접 해야 하는 것:
 *  1. VAPID 키 쌍 생성 → 공개키는 앱 Vercel 환경변수(NEXT_PUBLIC_VAPID_PUBLIC_KEY),
 *     비공개키는 이 Function의 Secret(VAPID_PRIVATE_KEY, VAPID_SUBJECT)에 등록
 *  2. supabase functions deploy send-due-push
 *  3. pg_cron으로 매일 1회 스케줄 등록 (초안 SQL 하단 참고)
 *  4. SUPABASE_SERVICE_ROLE_KEY 사용 승인 (auth.users 접근 때문 — service_role만 가능)
 *
 * 발송 톤: "○○님 결혼이 3일 남았어요. 마음 준비는 되셨나요?"
 * - 챙김 앱의 돌봄 톤 유지. 기록 플로우와 분리.
 * - 하루 1회, 유저당 최대 1통 (스팸 방지).
 */
// @ts-ignore: Deno 런타임 (로컬 빌드에서는 타입 체크 안 함)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore
import webpush from "npm:web-push@3.6.7";
// @ts-ignore
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const DAY = 24 * 60 * 60 * 1000;

serve(async (req: Request) => {
  // pg_cron 호출용 — 크론 시크릿(선택)으로 잠금. 미설정이면 오픈.
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = Date.now();
  const horizon = now + 3 * DAY;

  // 1) 구독자 전체
  const { data: subs, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, keys_p256dh, keys_auth");
  if (subErr) return new Response(JSON.stringify({ error: subErr.message }), { status: 500 });

  let sent = 0;
  let skipped = 0;

  for (const sub of subs || []) {
    // 2) 이 유저의 다가오는 경조사 (3일 이내, 아직 안 갚은 마음 1건)
    const { data: maeums } = await supabase
      .from("maeums")
      .select("id, yeon_id, kind, event_date, reminded_at")
      .eq("user_id", sub.user_id)
      .is("repaid_at", null)
      .not("event_date", "is", null)
      .order("event_date", { ascending: true })
      .limit(5);

    const due = (maeums || []).find((m: any) => {
      if (!m.event_date || m.event_date.startsWith("????")) return false;
      const t = new Date(m.event_date + "T00:00:00").getTime();
      return t >= now - DAY && t <= horizon;
    });

    // 오늘 이미 리마인드했거나 보낼 게 없으면 건너뛰기
    if (!due) { skipped++; continue; }
    const { data: yeon } = await supabase
      .from("yeons")
      .select("name")
      .eq("id", due.yeon_id)
      .maybeSingle();
    const name = yeon?.name || "소중한 분";
    const days = Math.max(0, Math.round((new Date(due.event_date + "T00:00:00").getTime() - now) / DAY));

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        JSON.stringify({
          title: "제비가 물어왔어요",
          body: `${name}님 ${due.kind || "경조사"}이 ${days}일 남았어요. 마음 준비는 되셨나요?`,
          url: "/",
        })
      );
      sent++;
    } catch (e) {
      // 410 Gone — 구독 만료 → 행 삭제
      if ((e as any)?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("user_id", sub.user_id);
      }
      skipped++;
    }
  }

  return new Response(JSON.stringify({ sent, skipped }), {
    headers: { "Content-Type": "application/json" },
  });
});

/*
 * pg_cron 스케줄 초안 (Supabase SQL Editor — chloe 직접 실행)
 *
 * select cron.schedule(
 *   'send-due-push-daily',
 *   '0 0 * * *',                       -- 매일 09:00 KST (= 00:00 UTC)
 *   $$
 *   select net.http_post(
 *     url := '<PROJECT_REF>.supabase.co/functions/v1/send-due-push',
 *     headers := jsonb_build_object(
 *       'Content-Type', 'application/json',
 *       'x-cron-secret', '<CRON_SECRET>'
 *     )
 *   );
 *   $$
 * );
 */
