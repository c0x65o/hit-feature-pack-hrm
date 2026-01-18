-- Add profile picture to hrm_employees (owned by HRM, not auth)

ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "profile_picture_url" text;

