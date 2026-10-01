-- Additive migration. Does not infer legacy attendance or convert unknown amounts.
ALTER TABLE public.maeums ADD COLUMN IF NOT EXISTS attendance text;
ALTER TABLE public.maeums ADD COLUMN IF NOT EXISTS date_precision text;
ALTER TABLE public.maeums ADD COLUMN IF NOT EXISTS asset_kind text;
