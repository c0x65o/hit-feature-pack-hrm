-- hit:schema-only
-- Auto-generated from pack schema; app Drizzle migrations handle tables.

CREATE TYPE "public"."pto_accrual_method" AS ENUM('fixed', 'accrual');--> statement-breakpoint
CREATE TYPE "public"."pto_balance_mode" AS ENUM('unlimited', 'tracked');--> statement-breakpoint
CREATE TYPE "public"."pto_ledger_entry_type" AS ENUM('accrual', 'deduction', 'rollover', 'expiration', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."pto_request_status" AS ENUM('draft', 'submitted', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pto_unit" AS ENUM('days', 'hours');--> statement-breakpoint
CREATE TABLE "hrm_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"preferred_name" varchar(255),
	"profile_picture_url" text,
	"manager_id" uuid,
	"position_id" uuid,
	"hire_date" date,
	"job_level" integer,
	"phone" varchar(50),
	"address1" varchar(255),
	"address2" varchar(255),
	"city" varchar(100),
	"state" varchar(100),
	"postal_code" varchar(20),
	"country" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hrm_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"holiday_date" date NOT NULL,
	"description" text,
	"location_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "hrm_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"level" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hrm_pto_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"policy_id" uuid,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"unit" "pto_unit" DEFAULT 'days' NOT NULL,
	"as_of_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hrm_pto_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"policy_id" uuid,
	"entry_type" "pto_ledger_entry_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"unit" "pto_unit" DEFAULT 'days' NOT NULL,
	"effective_date" date NOT NULL,
	"source_type" varchar(50),
	"source_id" uuid,
	"notes" text,
	"created_by_user_key" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hrm_pto_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"description" text,
	"balance_mode" "pto_balance_mode" DEFAULT 'tracked' NOT NULL,
	"accrual_method" "pto_accrual_method" DEFAULT 'accrual' NOT NULL,
	"unit" "pto_unit" DEFAULT 'days' NOT NULL,
	"rules" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hrm_pto_policy_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"employee_id" uuid,
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
--> statement-breakpoint
CREATE TABLE "hrm_pto_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"policy_id" uuid,
	"status" "pto_request_status" DEFAULT 'draft' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"amount" numeric(12, 2),
	"unit" "pto_unit" DEFAULT 'days' NOT NULL,
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
--> statement-breakpoint
ALTER TABLE "hrm_employees" ADD CONSTRAINT "hrm_employees_manager_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."hrm_employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_employees" ADD CONSTRAINT "hrm_employees_position_fk" FOREIGN KEY ("position_id") REFERENCES "public"."hrm_positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_balances" ADD CONSTRAINT "hrm_pto_balances_employee_id_hrm_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hrm_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_balances" ADD CONSTRAINT "hrm_pto_balances_leave_type_id_hrm_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."hrm_leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_balances" ADD CONSTRAINT "hrm_pto_balances_policy_id_hrm_pto_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."hrm_pto_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_ledger_entries" ADD CONSTRAINT "hrm_pto_ledger_entries_employee_id_hrm_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hrm_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_ledger_entries" ADD CONSTRAINT "hrm_pto_ledger_entries_leave_type_id_hrm_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."hrm_leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_ledger_entries" ADD CONSTRAINT "hrm_pto_ledger_entries_policy_id_hrm_pto_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."hrm_pto_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_policy_assignments" ADD CONSTRAINT "hrm_pto_policy_assignments_policy_id_hrm_pto_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."hrm_pto_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_policy_assignments" ADD CONSTRAINT "hrm_pto_policy_assignments_employee_id_hrm_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hrm_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_requests" ADD CONSTRAINT "hrm_pto_requests_employee_id_hrm_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."hrm_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_requests" ADD CONSTRAINT "hrm_pto_requests_leave_type_id_hrm_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."hrm_leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hrm_pto_requests" ADD CONSTRAINT "hrm_pto_requests_policy_id_hrm_pto_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."hrm_pto_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hrm_employees_user_email_idx" ON "hrm_employees" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "hrm_employees_name_idx" ON "hrm_employees" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "hrm_employees_manager_idx" ON "hrm_employees" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "hrm_employees_position_idx" ON "hrm_employees" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "hrm_holidays_name_idx" ON "hrm_holidays" USING btree ("name");--> statement-breakpoint
CREATE INDEX "hrm_holidays_date_idx" ON "hrm_holidays" USING btree ("holiday_date");--> statement-breakpoint
CREATE INDEX "hrm_holidays_location_idx" ON "hrm_holidays" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "hrm_leave_types_name_idx" ON "hrm_leave_types" USING btree ("name");--> statement-breakpoint
CREATE INDEX "hrm_leave_types_code_idx" ON "hrm_leave_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "hrm_leave_types_active_idx" ON "hrm_leave_types" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "hrm_positions_name_idx" ON "hrm_positions" USING btree ("name");--> statement-breakpoint
CREATE INDEX "hrm_pto_balances_employee_idx" ON "hrm_pto_balances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "hrm_pto_balances_leave_type_idx" ON "hrm_pto_balances" USING btree ("leave_type_id");--> statement-breakpoint
CREATE INDEX "hrm_pto_ledger_entries_employee_idx" ON "hrm_pto_ledger_entries" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "hrm_pto_ledger_entries_effective_idx" ON "hrm_pto_ledger_entries" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "hrm_pto_policies_name_idx" ON "hrm_pto_policies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "hrm_pto_policies_code_idx" ON "hrm_pto_policies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "hrm_pto_policies_active_idx" ON "hrm_pto_policies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "hrm_pto_policy_assignments_policy_idx" ON "hrm_pto_policy_assignments" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "hrm_pto_policy_assignments_employee_idx" ON "hrm_pto_policy_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "hrm_pto_policy_assignments_scope_idx" ON "hrm_pto_policy_assignments" USING btree ("location_id","department_id","division_id");--> statement-breakpoint
CREATE INDEX "hrm_pto_requests_employee_idx" ON "hrm_pto_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "hrm_pto_requests_status_idx" ON "hrm_pto_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "hrm_pto_requests_dates_idx" ON "hrm_pto_requests" USING btree ("start_date","end_date");