ALTER TABLE hrm_employees
ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES hrm_employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS hrm_employees_manager_idx
ON hrm_employees(manager_id);
