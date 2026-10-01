-- 운영자가 QA DB부터 적용한다. 사용자 콘텐츠·금액·연락처는 저장하지 않는다.
begin;
create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check (length(event) between 1 and 64),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint app_events_props_shape check (
    jsonb_typeof(props) = 'object'
    and props ?& array['is_demo','app_version']
    and jsonb_typeof(props->'is_demo') = 'boolean'
    and jsonb_typeof(props->'app_version') = 'string'
    and props - array['is_demo','app_version','screen_id','empty']::text[] = '{}'::jsonb
    and props->>'is_demo' = 'false'
    and props->>'app_version' = '0.1.0'
    and (not props ? 'screen_id' or props->>'screen_id' in ('welcome','home','input','people','settings'))
    and (not props ? 'empty' or jsonb_typeof(props->'empty') = 'boolean')
  )
);
create index if not exists app_events_user_created_idx on public.app_events(user_id, created_at);
create index if not exists app_events_created_idx on public.app_events(created_at);
alter table public.app_events enable row level security;
revoke all on public.app_events from anon, authenticated;
grant insert on public.app_events to authenticated;
drop policy if exists app_events_owner_insert on public.app_events;
create policy app_events_owner_insert on public.app_events for insert to authenticated
  with check (user_id = auth.uid() and created_at between now() - interval '1 minute' and now() + interval '1 minute');
comment on table public.app_events is '가명 운영 이벤트. 서비스 관리자만 집계. 90일 보관 후 관리자가 삭제.';
commit;
