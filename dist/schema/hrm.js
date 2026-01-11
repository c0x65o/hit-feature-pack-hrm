import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
/**
 * Employees
 *
 * Pre-1.0: this is the canonical place for human name (first/last/preferred) in ERP contexts.
 * Auth module stays generic; HRM enriches identity when installed.
 */
export const employees = pgTable('hrm_employees', {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    /** Link to auth user identity (HIT user key is email today). */
    userEmail: varchar('user_email', { length: 255 }).notNull(),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    preferredName: varchar('preferred_name', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
        .defaultNow()
        .notNull()
        .$onUpdate(() => sql `now()`),
}, (table) => ({
    userEmailUniq: uniqueIndex('hrm_employees_user_email_idx').on(table.userEmail),
    nameIdx: index('hrm_employees_name_idx').on(table.lastName, table.firstName),
}));
export const EmployeeSchema = createSelectSchema(employees);
export const InsertEmployeeSchema = createInsertSchema(employees, {
    userEmail: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    preferredName: z.string().min(1).optional(),
});
