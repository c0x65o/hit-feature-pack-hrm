## HRM Feature Pack E2E (Playwright)

### Prereqs
- A running harness (from this feature pack directory): `hit run`
- Playwright installed in this package:
  - `npm install`
  - `npx playwright install` (installs browsers)

### Run
- **Run tests (headless)**:
  - `PLAYWRIGHT_BASE_URL=http://localhost:3333 npm run test:e2e`

- **Run tests via HIT CLI** (automatically starts harness):
  - `hit fp test hrm`
  - Or from this directory: `hit fp test`

- **Run with UI**:
  - `npm run test:e2e:ui`

### Credentials
Harness mode seeds an admin user by default:
- `ADMIN_EMAIL=admin@hitcents.com`
- `ADMIN_PASSWORD=admin`

Override by exporting `ADMIN_EMAIL` / `ADMIN_PASSWORD` before running.

### Test Structure

**Current Tests:**
- `e2e/pto-basic.spec.ts` - Basic PTO request creation and approval flow

**Test Scenarios:**
1. Create leave type, policy, employees
2. Create and submit PTO request
3. Approve through workflow (manager → HR)
4. Verify final status

### Database Setup

The harness automatically:
- Provisions database
- Runs migrations (including PTO schema)
- Seeds admin user

For a clean test run:
```bash
cd <harness-dir>  # Usually .hit/harness-* or similar
hit db clean --force
hit run
```

### Future Test Scenarios

1. **Balance Tracking:** Test balance deduction on approval
2. **Accrual:** Test accrual calculation and balance updates
3. **Multiple Policies:** Test policy resolution for different employees
4. **Complex Approvals:** Multi-level, conditional routing
5. **Edge Cases:** Overlapping requests, insufficient balance, etc.

### Notes

- Tests use API calls for setup (creating leave types, policies, employees)
- UI interactions test the actual user flows
- Workflow integration requires auth users for manager/HR roles (currently uses admin)
- Consider creating test fixtures for common setup (leave types, policies, employees)
