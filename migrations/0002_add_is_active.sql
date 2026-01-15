-- Add is_active to hrm_employees (sync with auth users)

ALTER TABLE "hrm_employees" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
