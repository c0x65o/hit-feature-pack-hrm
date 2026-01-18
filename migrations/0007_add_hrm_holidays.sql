-- Add company holidays table

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

CREATE INDEX "hrm_holidays_name_idx" ON "hrm_holidays" ("name");
CREATE INDEX "hrm_holidays_date_idx" ON "hrm_holidays" ("holiday_date");
CREATE INDEX "hrm_holidays_location_idx" ON "hrm_holidays" ("location_id");
