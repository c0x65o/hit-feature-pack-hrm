# PTO System Analysis & Testing Guide

## Overview

The PTO (Paid Time Off) system in the HRM feature pack provides a complete leave management solution with:
- Leave types (Vacation, Sick, etc.)
- PTO policies (accrual rules, balance tracking)
- Policy assignments (per employee, location, department)
- PTO requests with approval workflows
- Balance tracking and ledger entries

## Architecture

### Database Schema

**Core Tables:**
1. `hrm_leave_types` - Types of leave (Vacation, Sick, Personal, etc.)
2. `hrm_pto_policies` - Policy definitions (accrual method, balance mode, rules)
3. `hrm_pto_policy_assignments` - Assign policies to employees/locations/departments
4. `hrm_pto_requests` - Employee leave requests
5. `hrm_pto_balances` - Current balance snapshots
6. `hrm_pto_ledger_entries` - Transaction history (accruals, deductions, adjustments)

**Related Tables:**
- `hrm_employees` - Employee records (has `hire_date`, `job_level` for PTO calculations)
- `hrm_positions` - Job positions (has `level` for approval routing)

### Request Lifecycle

1. **Draft** → Employee creates a PTO request (status: `draft`)
2. **Submit** → Employee submits request (status: `submitted`, triggers workflow)
3. **Approval Workflow** → `hrm.pto.requestApproval` workflow runs:
   - Manager approval (first level manager or location manager)
   - HR approval (role: `hr_admin`)
4. **Approved/Rejected** → Status updated to `approved` or `rejected`
5. **Balance Update** → (Future) Balance deducted when approved

### Workflow: `hrm.pto.requestApproval`

**Location:** `hit-feature-packs/hit-feature-pack-hrm/schema/workflows.yaml`

**Trigger:** Entity action `submit` on `hrm.ptoRequest`

**Flow:**
```
Start → Manager Approval → HR Approval → Approved
                    ↓
                 Rejected
```

**Manager Assignment Rules:**
- Direct manager (1 level up)
- Location manager (org dimension)
- Auto-approve if requester is their own approver

**HR Assignment:**
- Role-based: `hr_admin`

### API Endpoints

**Self-Service (Employee):**
- `GET /api/hrm/pto-requests-self` - List my requests
- `POST /api/hrm/pto-requests-self` - Create a request
- `GET /api/hrm/pto-requests-self/[id]` - Get request detail
- `PUT /api/hrm/pto-requests-self/[id]` - Update request

**Admin:**
- `GET /api/hrm/pto-requests` - List all requests
- `POST /api/hrm/pto-requests` - Create request (admin)
- `GET /api/hrm/pto-requests/[id]` - Get request detail
- `PUT /api/hrm/pto-requests/[id]` - Update request

**Workflow Actions:**
- `POST /api/workflows/runs/[runId]/tasks/[taskId]/approve` - Approve task
- `POST /api/workflows/runs/[runId]/tasks/[taskId]/deny` - Deny task
- `GET /api/workflows/tasks` - List my assigned tasks

### Key Implementation Details

**Policy Resolution:**
When creating a PTO request, the system resolves the policy via:
- `/api/policy/assignments/resolve` endpoint
- Checks employee → location → department → division → group assignments
- Returns the highest priority matching policy

**Employee Auto-Creation:**
If an employee record doesn't exist for a user email, the API auto-creates one:
- Derives first/last name from email
- Sets `isActive: true`
- Links via `userEmail` field

**Workflow Integration:**
- When a request is submitted, a workflow run is created
- Approval tasks are created based on workflow graph
- Tasks are assigned based on assignment rules
- Approving/denying tasks updates the workflow run status
- The PTO request status should be updated when workflow completes (TODO: hook needed)

## Testing Strategy

### Test Environment Setup

**Option 1: Feature Pack Harness (Recommended)**
```bash
cd hit-feature-packs/hit-feature-pack-hrm
hit run
```
- Provisions database automatically
- Runs migrations
- Seeds admin user (`admin@hitcents.com` / `admin`)
- Starts harness on `http://localhost:3333` (or next available port)

**Option 2: Full Application**
```bash
cd applications/hitcents-erp
hit provision  # Provision databases
npm run dev    # Start app
```
- More realistic but slower
- Requires full app setup

### Test Scenarios

#### Basic Approval Flow
1. **Setup:**
   - Create leave type (e.g., "Vacation")
   - Create PTO policy (e.g., "Standard Vacation Policy")
   - Create two employees: requester and manager
   - Assign manager to requester
   - Assign policy to requester

2. **Test:**
   - Login as requester
   - Create PTO request
   - Submit request (triggers workflow)
   - Login as manager
   - Approve manager task
   - Login as HR admin
   - Approve HR task
   - Verify request status is `approved`

#### Balance Tracking
1. **Setup:**
   - Create leave type
   - Create policy with `balance_mode: tracked`
   - Create employee
   - Set initial balance (via ledger entry or balance record)

2. **Test:**
   - Create and approve PTO request
   - Verify balance is deducted
   - Verify ledger entry created

#### Multiple Policies
1. **Setup:**
   - Create two policies (e.g., "Standard" and "Executive")
   - Assign to different employees
   - Test policy resolution

#### Accrual Calculation
1. **Setup:**
   - Create policy with `accrual_method: accrual`
   - Set accrual rules (e.g., 1.25 days/month)
   - Create employee with `hire_date`

2. **Test:**
   - Calculate expected accrual based on tenure
   - Verify balance matches

### E2E Test Structure

**File:** `hit-feature-packs/hit-feature-pack-hrm/e2e/pto-basic.spec.ts`

**Test Cases:**
1. Create leave type
2. Create PTO policy
3. Create employee (requester)
4. Create employee (manager)
5. Assign manager relationship
6. Create PTO request
7. Submit request
8. Approve as manager
9. Approve as HR
10. Verify final status

**Database Cleanup:**
- Each test should clean up its data OR
- Use test isolation (separate test users/employees)
- Consider using `hit db clean` between test runs for full reset

## Implementation Status

### ✅ Implemented
- Database schema (migrations)
- Entity definitions (YAML)
- Self-service API endpoints
- Workflow definition
- Workflow task approval/denial

### ⚠️ Partially Implemented
- Workflow → PTO request status update (needs hook)
- Balance deduction on approval (needs implementation)
- Accrual calculation (needs job/script)

### ❌ Not Yet Implemented
- Balance recalculation from ledger
- Accrual job/automation
- Policy assignment resolution UI
- Balance display in self-service UI

## Future Enhancements

1. **Workflow Hooks:** Update PTO request status when workflow completes
2. **Balance Engine:** Deduct balance on approval, recalculate from ledger
3. **Accrual Job:** Scheduled job to calculate and add accruals
4. **UI Enhancements:** Show balance in request form, policy assignment UI
5. **Complex Scenarios:** Multi-level approvals, conditional routing, escalation

## References

- Schema: `hit-feature-packs/hit-feature-pack-hrm/schema/`
- Migrations: `hit-feature-packs/hit-feature-pack-hrm/migrations/0006_add_pto_entities.sql`
- API: `hit-feature-packs/hit-feature-pack-hrm/src/server/api/pto-requests-self.ts`
- Workflows: `hit-feature-packs/hit-feature-pack-hrm/schema/workflows.yaml`
- Workflow Core: `hit-feature-packs/core/hit-feature-pack-workflow-core/`
