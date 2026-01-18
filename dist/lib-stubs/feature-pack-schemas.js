/**
 * Stub for @/lib/feature-pack-schemas
 *
 * This is a type-only stub for feature pack compilation.
 * At runtime, the consuming application provides the actual implementation
 * which is auto-generated from feature pack schemas.
 */
export { employees, positions, holidays, leaveTypes, ptoPolicies, ptoPolicyAssignments, ptoRequests, ptoBalances, ptoLedgerEntries, } from '../schema/hrm';
// Cross-pack tables used by HRM server routes during compilation.
//
// IMPORTANT: do NOT import the real tables from other packs here. During feature pack
// compilation, that can pull in a different copy/version of drizzle-orm and make
// the types incompatible (two separate node_modules trees).
//
// At runtime, the consuming application's generated schemas module provides the
// real merged implementations.
export const userOrgAssignments = {};
export const orgEntityScopes = {};
