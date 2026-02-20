-- Add WOMPI to PaymentProvider enum for Wompi integration (Colombia).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PaymentProvider' AND e.enumlabel = 'WOMPI'
  ) THEN
    ALTER TYPE "PaymentProvider" ADD VALUE 'WOMPI';
  END IF;
END $$;
