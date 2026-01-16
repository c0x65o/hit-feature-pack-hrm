-- Add positions table and position_id to employees

-- Create hrm_positions table
CREATE TABLE "hrm_positions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "hrm_positions_name_idx" ON "hrm_positions" ("name");

-- Add position_id column to hrm_employees
ALTER TABLE "hrm_employees" ADD COLUMN "position_id" uuid;

CREATE INDEX "hrm_employees_position_idx" ON "hrm_employees" ("position_id");

ALTER TABLE "hrm_employees"
ADD CONSTRAINT "hrm_employees_position_fk"
FOREIGN KEY ("position_id") REFERENCES "hrm_positions"("id") ON DELETE SET NULL;
