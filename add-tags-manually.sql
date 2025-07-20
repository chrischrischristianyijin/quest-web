-- 手动添加tags字段到insights表
-- 请在Supabase Dashboard的SQL编辑器中运行此脚本

-- 1. 添加tags列
ALTER TABLE public.insights 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. 添加索引以提高性能
CREATE INDEX IF NOT EXISTS insights_tags_idx ON public.insights USING GIN (tags);

-- 3. 验证字段是否添加成功
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'insights' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. 查看现有数据（如果有的话）
SELECT id, url, title, tags, created_at 
FROM public.insights 
ORDER BY created_at DESC 
LIMIT 5; 