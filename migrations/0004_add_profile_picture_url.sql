-- Add profile picture to hrm_employees (owned by HRM, not auth)

ALTER TABLE "hrm_employees" ADD COLUMN "profile_picture_url" text;

