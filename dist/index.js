/**
 * @hit/feature-pack-hrm
 *
 * HRM feature pack (pre-1.0: employee identity + directory).
 *
 * This pack uses schema-driven UI. All pages (List, Detail, Edit)
 * are generated automatically from schema/entities/hrm.employee.yaml.
 */
// Navigation config
export { navContributions as nav } from './nav';
// No custom pages; schema-driven only.
