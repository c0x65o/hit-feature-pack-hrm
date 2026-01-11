-- Add phone and address fields to hrm_employees

ALTER TABLE "hrm_employees" ADD COLUMN "phone" varchar(50);
ALTER TABLE "hrm_employees" ADD COLUMN "address1" varchar(255);
ALTER TABLE "hrm_employees" ADD COLUMN "address2" varchar(255);
ALTER TABLE "hrm_employees" ADD COLUMN "city" varchar(100);
ALTER TABLE "hrm_employees" ADD COLUMN "state" varchar(100);
ALTER TABLE "hrm_employees" ADD COLUMN "postal_code" varchar(20);
ALTER TABLE "hrm_employees" ADD COLUMN "country" varchar(100);
