import { pgTable, uuid, varchar, timestamp, index, uniqueIndex, boolean } from 'drizzle-orm/pg-core';
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
    phone: z.string().max(50).optional(),
    address1: z.string().max(255).optional(),
    address2: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
});
