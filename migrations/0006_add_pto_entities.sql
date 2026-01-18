-- Add PTO schema: leave types, policies, assignments, requests, balances, ledger

-- Add employee fields used by PTO workflows
ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "hire_date" date;
ALTER TABLE "hrm_employees" ADD COLUMN IF NOT EXISTS "job_level" integer;

-- Add optional position level
ALTER TABLE "hrm_positions" ADD COLUMN IF NOT EXISTS "level" integer;

-- Enums
CREATE TYPE "pto_balance_mode" AS ENUM ('unlimited', 'tracked');
CREATE TYPE "pto_accrual_method" AS ENUM ('fixed', 'accrual');
CREATE TYPE "pto_unit" AS ENUM ('days', 'hours');
CREATE TYPE "pto_request_status" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'cancelled');
CREATE TYPE "pto_ledger_entry_type" AS ENUM ('accrual', 'deduction', 'rollover', 'expiration', 'adjustment');

-- Leave types
CREATE TABLE "hrm_leave_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(50),
  "description" text,
  "is_paid" boolean DEFAULT true NOT NULL,
  "color" varchar(20),
  "requires_attachment" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "hrm_leave_types_name_idx" ON "hrm_leave_types" ("name");
CREATE INDEX "hrm_leave_types_code_idx" ON "hrm_leave_types" ("code");
CREATE INDEX "hrm_leave_types_active_idx" ON "hrm_leave_types" ("is_active");

-- PTO policies
CREATE TABLE "hrm_pto_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "code" varchar(50),
  "description" text,
  "balance_mode" pto_balance_mode DEFAULT 'tracked' NOT NULL,
  "accrual_method" pto_accrual_method DEFAULT 'accrual' NOT NULL,
  "unit" pto_unit DEFAULT 'days' NOT NULL,
  "rules" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "effective_date" date,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "hrm_pto_policies_name_idx" ON "hrm_pto_policies" ("name");
CREATE INDEX "hrm_pto_policies_code_idx" ON "hrm_pto_policies" ("code");
CREATE INDEX "hrm_pto_policies_active_idx" ON "hrm_pto_policies" ("is_active");

-- PTO policy assignments
CREATE TABLE "hrm_pto_policy_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "policy_id" uuid NOT NULL REFERENCES "hrm_pto_policies"("id") ON DELETE CASCADE,
  "employee_id" uuid REFERENCES "hrm_employees"("id") ON DELETE CASCADE,
  "location_id" uuid,
  "department_id" uuid,
  "division_id" uuid,
  "group_id" varchar(255),
  "effective_date" date,
  "end_date" date,
  "priority" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "hrm_pto_policy_assignments_policy_idx" ON "hrm_pto_policy_assignments" ("policy_id");
CREATE INDEX "hrm_pto_policy_assignments_employee_idx" ON "hrm_pto_policy_assignments" ("employee_id");
CREATE INDEX "hrm_pto_policy_assignments_scope_idx" ON "hrm_pto_policy_assignments" ("location_id", "department_id", "division_id");

-- PTO requests
CREATE TABLE "hrm_pto_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hrm_employees"("id") ON DELETE CASCADE,
  "leave_type_id" uuid NOT NULL REFERENCES "hrm_leave_types"("id") ON DELETE RESTRICT,
  "policy_id" uuid REFERENCES "hrm_pto_policies"("id") ON DELETE SET NULL,
  "status" pto_request_status DEFAULT 'draft' NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "amount" numeric(12, 2),
  "unit" pto_unit DEFAULT 'days' NOT NULL,
  "reason" text,
  "requested_by_user_key" varchar(255),
  "submitted_at" timestamp,
  "approved_at" timestamp,
  "approved_by_user_key" varchar(255),
  "denied_at" timestamp,
  "denied_by_user_key" varchar(255),
  "decision_note" text,
  "workflow_run_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "hrm_pto_requests_employee_idx" ON "hrm_pto_requests" ("employee_id");
CREATE INDEX "hrm_pto_requests_status_idx" ON "hrm_pto_requests" ("status");
CREATE INDEX "hrm_pto_requests_dates_idx" ON "hrm_pto_requests" ("start_date", "end_date");

-- PTO balances
CREATE TABLE "hrm_pto_balances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hrm_employees"("id") ON DELETE CASCADE,
  "leave_type_id" uuid NOT NULL REFERENCES "hrm_leave_types"("id") ON DELETE RESTRICT,
  "policy_id" uuid REFERENCES "hrm_pto_policies"("id") ON DELETE SET NULL,
  "balance" numeric(12, 2) DEFAULT '0' NOT NULL,
  "unit" pto_unit DEFAULT 'days' NOT NULL,
  "as_of_date" date,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "hrm_pto_balances_employee_idx" ON "hrm_pto_balances" ("employee_id");
CREATE INDEX "hrm_pto_balances_leave_type_idx" ON "hrm_pto_balances" ("leave_type_id");

-- PTO ledger entries
CREATE TABLE "hrm_pto_ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "hrm_employees"("id") ON DELETE CASCADE,
  "leave_type_id" uuid NOT NULL REFERENCES "hrm_leave_types"("id") ON DELETE RESTRICT,
  "policy_id" uuid REFERENCES "hrm_pto_policies"("id") ON DELETE SET NULL,
  "entry_type" pto_ledger_entry_type NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "unit" pto_unit DEFAULT 'days' NOT NULL,
  "effective_date" date NOT NULL,
  "source_type" varchar(50),
  "source_id" uuid,
  "notes" text,
  "created_by_user_key" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "hrm_pto_ledger_entries_employee_idx" ON "hrm_pto_ledger_entries" ("employee_id");
CREATE INDEX "hrm_pto_ledger_entries_effective_idx" ON "hrm_pto_ledger_entries" ("effective_date");
