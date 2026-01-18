/**
 * Stub for @/lib/feature-pack-schemas
 *
 * This is a type-only stub for feature pack compilation.
 * At runtime, the consuming application provides the actual implementation
 * which is auto-generated from feature pack schemas.
 */

export {
  employees,
  type Employee,
  type InsertEmployee,
  type UpdateEmployee,
  positions,
  type Position,
  type InsertPosition,
  type UpdatePosition,
  holidays,
  type Holiday,
  type InsertHoliday,
  type UpdateHoliday,
  leaveTypes,
  type LeaveType,
  type InsertLeaveType,
  type UpdateLeaveType,
  ptoPolicies,
  type PtoPolicy,
  type InsertPtoPolicy,
  type UpdatePtoPolicy,
  ptoPolicyAssignments,
  type PtoPolicyAssignment,
  type InsertPtoPolicyAssignment,
  type UpdatePtoPolicyAssignment,
  ptoRequests,
  type PtoRequest,
  type InsertPtoRequest,
  type UpdatePtoRequest,
  ptoBalances,
  type PtoBalance,
  type InsertPtoBalance,
  type UpdatePtoBalance,
  ptoLedgerEntries,
  type PtoLedgerEntry,
  type InsertPtoLedgerEntry,
  type UpdatePtoLedgerEntry,
} from '../schema/hrm';

// Cross-pack tables used by HRM server routes during compilation.
//
// IMPORTANT: do NOT import the real tables from other packs here. During feature pack
// compilation, that can pull in a different copy/version of drizzle-orm and make
// the types incompatible (two separate node_modules trees).
//
// At runtime, the consuming application's generated schemas module provides the
// real merged implementations.
export const userOrgAssignments: any = {} as any;
export const orgEntityScopes: any = {} as any;
