-- Brand Brain Storage Bucket fuer Drive-Cache
-- Privater Bucket, nur ueber Service Role Key zugaenglich

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-brain',
  'brand-brain',
  false,
  524288, -- 512 KB
  ARRAY['text/plain', 'application/json', 'text/markdown']
)
ON CONFLICT (id) DO NOTHING;
