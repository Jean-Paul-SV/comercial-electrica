-- AlterTable: solo si la tabla existe (esta migración corre antes que la que crea la tabla)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ProductDictionaryEntry'
  ) THEN
    ALTER TABLE "ProductDictionaryEntry" ADD COLUMN IF NOT EXISTS "categoryId" UUID;
    CREATE INDEX IF NOT EXISTS "ProductDictionaryEntry_categoryId_idx" ON "ProductDictionaryEntry"("categoryId");
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductDictionaryEntry_categoryId_fkey') THEN
      ALTER TABLE "ProductDictionaryEntry" ADD CONSTRAINT "ProductDictionaryEntry_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
