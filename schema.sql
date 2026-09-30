-- ============================================================
-- 제비(Jebi) Supabase 스키마
-- 적용법: Supabase Dashboard → SQL Editor → 이 파일 전체를 붙여넣고 Run
-- ============================================================

-- 인연 (한 사람)
create table if not exists yeons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relation_tag text,            -- 가족 / 회사 / 학교 / 지인
  avatar_gender text,           -- male / female / null
  created_at timestamptz not null default now()
);
create index if not exists yeons_user_idx on yeons(user_id);

-- 마음 (하나의 주고받음. 받은 마음=지붕의 박, 보낸 마음=하늘 궤적)
create table if not exists maeums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  yeon_id uuid not null references yeons(id) on delete cascade,
  direction text not null,      -- 받음 / 보냄
  kind text,                    -- 경조사 종류: 결혼 / 부고 / 돌잔치 / 생일 / 기타
  amount integer,               -- 전한 마음 (원)
  memo text,                    -- 한 줄 메모
  occurred_at timestamptz,      -- 주고받은 실제 시점 (기록용)
  event_date text,              -- 경조사 날짜 "YYYY-MM-DD" (연도미상 "????-MM-DD")
  event_time text,              -- "HH:MM"
  place text,                   -- 장소
  account text,                 -- 계좌 (관계의 기억)
  planted_at timestamptz not null default now(),  -- 심은/보낸 시각
  repaid_at timestamptz,        -- 갚은/답례받은 시각 (열림)
  reminded_at timestamptz,      -- 마지막 리마인드 발송 시각
  created_at timestamptz not null default now()
);
create index if not exists maeums_user_idx on maeums(user_id);
create index if not exists maeums_yeon_idx on maeums(yeon_id);

-- 정의 순환(박씨): 이 박이 어느 열린 박의 박씨에서 자라났는지 (nullable FK)
alter table maeums
  add column if not exists grown_from_seed_id uuid
  references maeums(id) on delete set null;
create index if not exists maeums_seed_idx on maeums(grown_from_seed_id);

-- ============================================================
-- RLS: 자기 데이터만 읽기/쓰기 (익명 로그인 유저 = auth.uid())
-- ============================================================
alter table yeons enable row level security;
alter table maeums enable row level security;

drop policy if exists "yeons_owner" on yeons;
create policy "yeons_owner" on yeons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "maeums_owner" on maeums;
create policy "maeums_owner" on maeums
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 인연 다중 태그 (2026-09-25 라운드2 — 미실행)
-- 태그는 '관계의 성격'을 가볍게 표시하는 용도. 상한(인연당 3개)은 UX 정책이라
-- 클라이언트에서만 강제하고 DB CHECK는 두지 않는다.
-- ============================================================
create table if not exists yeon_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  yeon_id uuid not null references yeons(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  primary key (yeon_id, tag)
);
create index if not exists yeon_tags_tag_idx on yeon_tags(tag);
comment on table yeon_tags is '인연 다중 태그. 태그 삭제는 인연·마음을 건드리지 않는다.';

alter table yeon_tags enable row level security;

drop policy if exists "yeon_tags_owner" on yeon_tags;
create policy "yeon_tags_owner" on yeon_tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 마음 전달 방식 (2026-09-25 라운드2 — 미실행)
-- asset_kind: 'cash' (현금) | 'goods' (선물·물건). null = 미표기(과거 기록).
-- 주의: maeums.kind는 경조사 종류(결혼/부고/...)로 이미 사용 중이라 별도 컬럼.
-- CHECK 제약을 두지 않는다 — 분류 체계 변경이 마이그레이션 없이 되도록.
-- ============================================================
alter table maeums
  add column if not exists asset_kind text;
comment on column maeums.asset_kind is '마음의 형태: cash=현금, goods=선물·물건, null=미표기';

-- ============================================================
-- P0-1a 푸시 구독 — 구독 수집 (발송은 Edge Function, 코드 초안만 존재)
-- ============================================================
create table if not exists push_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  endpoint text not null unique,
  keys_p256dh text,
  keys_auth text,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

-- 본인 구독만 등록·조회·삭제
drop policy if exists "push_subscriptions_owner_insert" on push_subscriptions;
create policy "push_subscriptions_owner_insert" on push_subscriptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "push_subscriptions_owner_select" on push_subscriptions;
create policy "push_subscriptions_owner_select" on push_subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "push_subscriptions_owner_delete" on push_subscriptions;
create policy "push_subscriptions_owner_delete" on push_subscriptions
  for delete using (auth.uid() = user_id);
drop policy if exists "push_subscriptions_owner_update" on push_subscriptions;
create policy "push_subscriptions_owner_update" on push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
