import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
  boolean,
  foreignKey,
  date,
  decimal,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

/**
 * Positions
 *
 * Job positions/titles that can be assigned to employees.
 * Simple entity for now - just a name. Can be extended with department, level, etc.
 */
export const positions = pgTable(
  'hrm_positions',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    level: integer('level'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    nameIdx: index('hrm_positions_name_idx').on(table.name),
  })
);

export const PositionSchema = createSelectSchema(positions);
export const InsertPositionSchema = createInsertSchema(positions, {
  name: z.string().min(1).max(255),
  level: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type Position = typeof positions.$inferSelect;
export type InsertPosition = typeof positions.$inferInsert;
export type UpdatePosition = Partial<Omit<InsertPosition, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Employees
 *
 * Pre-1.0: this is the canonical place for human name (first/last/preferred) in ERP contexts.
 * Auth module stays generic; HRM enriches identity when installed.
 */
export const employees = pgTable(
  'hrm_employees',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    /** Link to auth user identity (HIT user key is email today). */
    userEmail: varchar('user_email', { length: 255 }).notNull(),

    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    preferredName: varchar('preferred_name', { length: 255 }),
    /** Profile picture URL or data URL (owned by HRM, not auth). */
    profilePictureUrl: text('profile_picture_url'),

    /** Employee manager (self-referential). */
    managerId: uuid('manager_id'),

    /** Employee position/job title. */
    positionId: uuid('position_id'),

    /** Date the employee was hired (used for tenure). */
    hireDate: date('hire_date'),

    /** Job level / grade (used for approvals and reporting). */
    jobLevel: integer('job_level'),

    // Contact information
    phone: varchar('phone', { length: 50 }),
    
    // Address fields
    address1: varchar('address1', { length: 255 }),
    address2: varchar('address2', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    postalCode: varchar('postal_code', { length: 20 }),
    country: varchar('country', { length: 100 }),

    isActive: boolean('is_active').default(true).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userEmailUniq: uniqueIndex('hrm_employees_user_email_idx').on(table.userEmail),
    nameIdx: index('hrm_employees_name_idx').on(table.lastName, table.firstName),
    managerIdx: index('hrm_employees_manager_idx').on(table.managerId),
    managerFk: foreignKey({
      columns: [table.managerId],
      foreignColumns: [table.id],
      name: 'hrm_employees_manager_fk',
    }).onDelete('set null'),
    positionIdx: index('hrm_employees_position_idx').on(table.positionId),
    positionFk: foreignKey({
      columns: [table.positionId],
      foreignColumns: [positions.id],
      name: 'hrm_employees_position_fk',
    }).onDelete('set null'),
  })
);

export const EmployeeSchema = createSelectSchema(employees);
export const InsertEmployeeSchema = createInsertSchema(employees, {
  userEmail: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  preferredName: z.string().min(1).optional(),
  profilePictureUrl: z.string().optional(),
  managerId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  hireDate: z.string().optional(),
  jobLevel: z.number().int().optional(),
  phone: z.string().max(50).optional(),
  address1: z.string().max(255).optional(),
  address2: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;
export type UpdateEmployee = Partial<Omit<InsertEmployee, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Company Holidays
 */
export const holidays = pgTable(
  'hrm_holidays',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    holidayDate: date('holiday_date').notNull(),
    description: text('description'),
    locationId: uuid('location_id'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    nameIdx: index('hrm_holidays_name_idx').on(table.name),
    dateIdx: index('hrm_holidays_date_idx').on(table.holidayDate),
    locationIdx: index('hrm_holidays_location_idx').on(table.locationId),
  })
);

export const HolidaySchema = createSelectSchema(holidays);
export const InsertHolidaySchema = createInsertSchema(holidays, {
  name: z.string().min(1).max(255),
  holidayDate: z.string(),
  description: z.string().optional(),
  locationId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = typeof holidays.$inferInsert;
export type UpdateHoliday = Partial<Omit<InsertHoliday, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * PTO / Leave Types
 */
export const leaveTypes = pgTable(
  'hrm_leave_types',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }),
    description: text('description'),
    isPaid: boolean('is_paid').default(true).notNull(),
    color: varchar('color', { length: 20 }),
    requiresAttachment: boolean('requires_attachment').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    nameIdx: index('hrm_leave_types_name_idx').on(table.name),
    codeIdx: index('hrm_leave_types_code_idx').on(table.code),
    activeIdx: index('hrm_leave_types_active_idx').on(table.isActive),
  })
);

export const LeaveTypeSchema = createSelectSchema(leaveTypes);
export const InsertLeaveTypeSchema = createInsertSchema(leaveTypes, {
  name: z.string().min(1).max(255),
  code: z.string().max(50).optional(),
  description: z.string().optional(),
  isPaid: z.boolean().optional(),
  color: z.string().optional(),
  requiresAttachment: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type LeaveType = typeof leaveTypes.$inferSelect;
export type InsertLeaveType = typeof leaveTypes.$inferInsert;
export type UpdateLeaveType = Partial<Omit<InsertLeaveType, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * PTO Policies
 */
export const ptoBalanceModeEnum = pgEnum('pto_balance_mode', ['unlimited', 'tracked']);
export const ptoAccrualMethodEnum = pgEnum('pto_accrual_method', ['fixed', 'accrual']);
export const ptoUnitEnum = pgEnum('pto_unit', ['days', 'hours']);

export const ptoPolicies = pgTable(
  'hrm_pto_policies',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }),
    description: text('description'),
    balanceMode: ptoBalanceModeEnum('balance_mode').default('tracked').notNull(),
    accrualMethod: ptoAccrualMethodEnum('accrual_method').default('accrual').notNull(),
    unit: ptoUnitEnum('unit').default('days').notNull(),
    rules: text('rules'),
    isActive: boolean('is_active').default(true).notNull(),
    effectiveDate: date('effective_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    nameIdx: index('hrm_pto_policies_name_idx').on(table.name),
    codeIdx: index('hrm_pto_policies_code_idx').on(table.code),
    activeIdx: index('hrm_pto_policies_active_idx').on(table.isActive),
  })
);

export const PtoPolicySchema = createSelectSchema(ptoPolicies);
export const InsertPtoPolicySchema = createInsertSchema(ptoPolicies, {
  name: z.string().min(1).max(255),
  code: z.string().max(50).optional(),
  description: z.string().optional(),
  balanceMode: z.enum(['unlimited', 'tracked']).optional(),
  accrualMethod: z.enum(['fixed', 'accrual']).optional(),
  unit: z.enum(['days', 'hours']).optional(),
  rules: z.string().optional(),
  isActive: z.boolean().optional(),
  effectiveDate: z.string().optional(),
});

export type PtoPolicy = typeof ptoPolicies.$inferSelect;
export type InsertPtoPolicy = typeof ptoPolicies.$inferInsert;
export type UpdatePtoPolicy = Partial<Omit<InsertPtoPolicy, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * PTO Policy Assignments
 */
export const ptoPolicyAssignments = pgTable(
  'hrm_pto_policy_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => ptoPolicies.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id'),
    departmentId: uuid('department_id'),
    divisionId: uuid('division_id'),
    groupId: varchar('group_id', { length: 255 }),
    effectiveDate: date('effective_date'),
    endDate: date('end_date'),
    priority: integer('priority').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    policyIdx: index('hrm_pto_policy_assignments_policy_idx').on(table.policyId),
    employeeIdx: index('hrm_pto_policy_assignments_employee_idx').on(table.employeeId),
    scopeIdx: index('hrm_pto_policy_assignments_scope_idx').on(table.locationId, table.departmentId, table.divisionId),
  })
);

export const PtoPolicyAssignmentSchema = createSelectSchema(ptoPolicyAssignments);
export const InsertPtoPolicyAssignmentSchema = createInsertSchema(ptoPolicyAssignments, {
  policyId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  divisionId: z.string().uuid().optional(),
  groupId: z.string().optional(),
  effectiveDate: z.string().optional(),
  endDate: z.string().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

export type PtoPolicyAssignment = typeof ptoPolicyAssignments.$inferSelect;
export type InsertPtoPolicyAssignment = typeof ptoPolicyAssignments.$inferInsert;
export type UpdatePtoPolicyAssignment = Partial<Omit<InsertPtoPolicyAssignment, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * PTO Requests
 */
export const ptoRequestStatusEnum = pgEnum('pto_request_status', [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'cancelled',
]);

export const ptoRequests = pgTable(
  'hrm_pto_requests',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    leaveTypeId: uuid('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id, { onDelete: 'restrict' }),
    policyId: uuid('policy_id').references(() => ptoPolicies.id, { onDelete: 'set null' }),
    status: ptoRequestStatusEnum('status').default('draft').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }),
    unit: ptoUnitEnum('unit').default('days').notNull(),
    reason: text('reason'),
    requestedByUserKey: varchar('requested_by_user_key', { length: 255 }),
    submittedAt: timestamp('submitted_at'),
    approvedAt: timestamp('approved_at'),
    approvedByUserKey: varchar('approved_by_user_key', { length: 255 }),
    deniedAt: timestamp('denied_at'),
    deniedByUserKey: varchar('denied_by_user_key', { length: 255 }),
    decisionNote: text('decision_note'),
    workflowRunId: uuid('workflow_run_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    employeeIdx: index('hrm_pto_requests_employee_idx').on(table.employeeId),
    statusIdx: index('hrm_pto_requests_status_idx').on(table.status),
    datesIdx: index('hrm_pto_requests_dates_idx').on(table.startDate, table.endDate),
  })
);

export const PtoRequestSchema = createSelectSchema(ptoRequests);
export const InsertPtoRequestSchema = createInsertSchema(ptoRequests, {
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled']).optional(),
  startDate: z.string(),
  endDate: z.string(),
  amount: z.string().optional(),
  unit: z.enum(['days', 'hours']).optional(),
  reason: z.string().optional(),
  requestedByUserKey: z.string().optional(),
  submittedAt: z.string().optional(),
  approvedAt: z.string().optional(),
  approvedByUserKey: z.string().optional(),
  deniedAt: z.string().optional(),
  deniedByUserKey: z.string().optional(),
  decisionNote: z.string().optional(),
  workflowRunId: z.string().uuid().optional(),
});

export type PtoRequest = typeof ptoRequests.$inferSelect;
export type InsertPtoRequest = typeof ptoRequests.$inferInsert;
export type UpdatePtoRequest = Partial<Omit<InsertPtoRequest, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * PTO Balances
 */
export const ptoBalances = pgTable(
  'hrm_pto_balances',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    leaveTypeId: uuid('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id, { onDelete: 'restrict' }),
    policyId: uuid('policy_id').references(() => ptoPolicies.id, { onDelete: 'set null' }),
    balance: decimal('balance', { precision: 12, scale: 2 }).default('0').notNull(),
    unit: ptoUnitEnum('unit').default('days').notNull(),
    asOfDate: date('as_of_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    employeeIdx: index('hrm_pto_balances_employee_idx').on(table.employeeId),
    leaveTypeIdx: index('hrm_pto_balances_leave_type_idx').on(table.leaveTypeId),
  })
);

export const PtoBalanceSchema = createSelectSchema(ptoBalances);
export const InsertPtoBalanceSchema = createInsertSchema(ptoBalances, {
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  balance: z.string().optional(),
  unit: z.enum(['days', 'hours']).optional(),
  asOfDate: z.string().optional(),
});

export type PtoBalance = typeof ptoBalances.$inferSelect;
export type InsertPtoBalance = typeof ptoBalances.$inferInsert;
export type UpdatePtoBalance = Partial<Omit<InsertPtoBalance, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * PTO Ledger Entries
 */
export const ptoLedgerEntryTypeEnum = pgEnum('pto_ledger_entry_type', [
  'accrual',
  'deduction',
  'rollover',
  'expiration',
  'adjustment',
]);

export const ptoLedgerEntries = pgTable(
  'hrm_pto_ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    leaveTypeId: uuid('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id, { onDelete: 'restrict' }),
    policyId: uuid('policy_id').references(() => ptoPolicies.id, { onDelete: 'set null' }),
    entryType: ptoLedgerEntryTypeEnum('entry_type').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    unit: ptoUnitEnum('unit').default('days').notNull(),
    effectiveDate: date('effective_date').notNull(),
    sourceType: varchar('source_type', { length: 50 }),
    sourceId: uuid('source_id'),
    notes: text('notes'),
    createdByUserKey: varchar('created_by_user_key', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    employeeIdx: index('hrm_pto_ledger_entries_employee_idx').on(table.employeeId),
    effectiveIdx: index('hrm_pto_ledger_entries_effective_idx').on(table.effectiveDate),
  })
);

export const PtoLedgerEntrySchema = createSelectSchema(ptoLedgerEntries);
export const InsertPtoLedgerEntrySchema = createInsertSchema(ptoLedgerEntries, {
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  entryType: z.enum(['accrual', 'deduction', 'rollover', 'expiration', 'adjustment']),
  amount: z.string(),
  unit: z.enum(['days', 'hours']).optional(),
  effectiveDate: z.string(),
  sourceType: z.string().optional(),
  sourceId: z.string().uuid().optional(),
  notes: z.string().optional(),
  createdByUserKey: z.string().optional(),
});

export type PtoLedgerEntry = typeof ptoLedgerEntries.$inferSelect;
export type InsertPtoLedgerEntry = typeof ptoLedgerEntries.$inferInsert;
export type UpdatePtoLedgerEntry = Partial<Omit<InsertPtoLedgerEntry, 'id' | 'createdAt'>>;

