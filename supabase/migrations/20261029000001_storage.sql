-- ============================================================================
-- Storage bucket for menu images
-- Target: Supabase Storage (storage schema is managed by Supabase)
-- ============================================================================

BEGIN;

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) VALUES (
  'menu-images',
  'menu-images',
  true,
  5242880,
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'menu_images_public_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY menu_images_public_read
        ON storage.objects
        FOR SELECT
        TO anon, authenticated
        USING (bucket_id = 'menu-images')
    $policy$;
  END IF;
END;
$$;

COMMIT;
