-- Add phone and address fields to hrm_employees

ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "phone" varchar(50);
ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "address1" varchar(255);
ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "address2" varchar(255);
ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "city" varchar(100);
ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "state" varchar(100);
ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "postal_code" varchar(20);
ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "country" varchar(100);
