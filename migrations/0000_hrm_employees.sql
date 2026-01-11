-- HRM Employees (pre-1.0 identity)
-- Canonical employee record (first/last/preferred) keyed by user email.

CREATE TABLE "hrm_employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_email" varchar(255) NOT NULL,
  "first_name" varchar(255) NOT NULL,
  "last_name" varchar(255) NOT NULL,
  "preferred_name" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "hrm_employees_user_email_idx" ON "hrm_employees" ("user_email");
CREATE INDEX "hrm_employees_name_idx" ON "hrm_employees" ("last_name", "first_name");

