-- Fix: add categoryId to ProductDictionaryEntry if missing (20260201100000 ran before table existed)
ALTER TABLE "ProductDictionaryEntry" ADD COLUMN IF NOT EXISTS "categoryId" UUID;

CREATE INDEX IF NOT EXISTS "ProductDictionaryEntry_categoryId_idx" ON "ProductDictionaryEntry"("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductDictionaryEntry_categoryId_fkey'
  ) THEN
    ALTER TABLE "ProductDictionaryEntry" ADD CONSTRAINT "ProductDictionaryEntry_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
