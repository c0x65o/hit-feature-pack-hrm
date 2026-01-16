import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex, boolean, foreignKey } from 'drizzle-orm/pg-core';
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

