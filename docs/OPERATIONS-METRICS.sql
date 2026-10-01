-- Supabase SQL Editor에서 관리자만 실행한다. 사용자용 API/RPC로 공개하지 않는다.
-- QA user_id는 아래 배열에 운영자가 채운다. 개인정보를 PR에 넣지 않는다.
with settings as (
  select now() as cutoff, array[]::uuid[] as excluded_qa_users
), valid_events as (
  select e.* from public.app_events e, settings s
  where e.created_at <= s.cutoff and not (e.user_id = any(s.excluded_qa_users))
    and e.props->>'is_demo' = 'false'
), users as (
  select user_id, min(created_at) as first_seen,
    min(created_at) filter (where event in ('occasion_saved','transfer_saved')) as first_save
  from valid_events group by user_id
), cohort as (
  select u.*,
    exists(select 1 from valid_events e where e.user_id=u.user_id
      and e.event in ('occasion_saved','transfer_saved') and e.created_at <= u.first_seen + interval '7 days') as activated_7d,
    exists(select 1 from valid_events e where e.user_id=u.user_id
      and e.event in ('occasion_saved','transfer_saved') and e.created_at > s.cutoff - interval '28 days') as active_28d,
    exists(select 1 from valid_events e where e.user_id=u.user_id
      and e.event in ('occasion_saved','transfer_saved')
      and (e.created_at at time zone 'Asia/Seoul')::date > (u.first_save at time zone 'Asia/Seoul')::date
      and e.created_at <= u.first_save + interval '28 days') as reused_28d
  from users u cross join settings s
)
select count(*) as observed_accounts,
  count(*) filter(where first_seen <= now()-interval '7 days') as activation_eligible,
  count(*) filter(where first_seen <= now()-interval '7 days' and activated_7d) as activated_7d,
  count(*) filter(where first_seen <= now()-interval '28 days') as active_eligible,
  count(*) filter(where first_seen <= now()-interval '28 days' and active_28d) as active_28d,
  count(*) filter(where first_save <= now()-interval '28 days') as reuse_eligible,
  count(*) filter(where first_save <= now()-interval '28 days' and reused_28d) as reused_28d
from cohort;

-- 최근 7일 이벤트 수. 저장 성공률·복구 성공률은 이 표로 계산하지 않는다.
select (created_at at time zone 'Asia/Seoul')::date as day, event, count(*)
from public.app_events where created_at >= now()-interval '7 days'
group by day,event order by day desc,event;

-- 보관 정리는 관리자가 별도 스케줄을 설정한다. 아래 삭제는 검토 후 실행한다.
-- delete from public.app_events where created_at < now() - interval '90 days';
