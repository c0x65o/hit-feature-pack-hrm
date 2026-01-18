# PTO Testing Approach: Feature Pack Harness vs Demo App

## Question

Is `hit run` in a feature pack directory sufficient for testing with environment provisioning, or should we set up a `hit-demo` app that has all feature packs?

## Answer: Feature Pack Harness is Sufficient ✅

### Why Feature Pack Harness Works

**`hit run` in feature pack directory:**

1. **Automatic Provisioning:**
   - Generates a temporary Next.js harness app
   - Includes the feature pack + required dependencies (erp-shell-core, auth-core)
   - Provisions database automatically
   - Runs migrations (including PTO schema)
   - Seeds admin user

2. **Isolated Environment:**
   - Each test run gets a clean database (if you run `hit db clean` first)
   - No interference from other feature packs
   - Fast startup (cached harness generation)

3. **Realistic Testing:**
   - Uses the same code paths as production
   - Includes all middleware, auth, routing
   - Full API and UI available

4. **CI/CD Friendly:**
   - `hit fp test` command handles everything:
     - Starts harness
     - Waits for ready
     - Runs tests
     - Cleans up

### When You Might Need a Demo App

**Consider `hit-demo` app if:**

1. **Cross-Pack Integration:**
   - Testing interactions between multiple feature packs
   - Example: HRM + CRM + Accounting workflows

2. **Complex Multi-Pack Scenarios:**
   - Features that span multiple packs
   - Shared entities across packs

3. **Production-Like Environment:**
   - Testing with all feature packs installed
   - Performance testing with full stack

### Current Recommendation

**For PTO testing: Use Feature Pack Harness**

**Reasons:**
- PTO is self-contained in HRM feature pack
- Workflow integration uses workflow-core (dependency, not separate pack)
- Faster iteration (no need to install all packs)
- Easier to debug (fewer moving parts)

**Test Structure:**
```
hit-feature-pack-hrm/
├── e2e/
│   └── pto-basic.spec.ts      # Basic approval flow
├── playwright.config.ts       # Test config
└── package.json               # Includes @playwright/test
```

**Run Tests:**
```bash
cd hit-feature-packs/hit-feature-pack-hrm
hit fp test                    # Auto-starts harness, runs tests
# OR
hit run                        # Start harness manually
npm run test:e2e              # Run tests in another terminal
```

### Database Provisioning for Tests

**Option 1: Clean Before Each Run (Recommended)**
```bash
# In harness directory (usually .hit/harness-*)
hit db clean --force
hit run
```

**Option 2: Test Isolation**
- Each test creates its own data
- Use unique identifiers (timestamps, UUIDs)
- Clean up in test teardown

**Option 3: Fixtures/Seeds**
- Create test fixtures for common data (leave types, policies)
- Reuse across tests
- Faster than creating from scratch each time

### Example Test Flow

```typescript
test('PTO approval', async ({ page, request }) => {
  // 1. Login (harness provides admin@hitcents.com / admin)
  // 2. Create test data via API:
  //    - Leave type
  //    - PTO policy
  //    - Employees (requester, manager)
  //    - Policy assignment
  // 3. Create PTO request
  // 4. Submit (triggers workflow)
  // 5. Approve tasks (manager → HR)
  // 6. Verify final status
});
```

### Future: More Complex Scenarios

**When to Consider Demo App:**

1. **Multi-User Workflows:**
   - Need multiple auth users (requester, manager, HR)
   - Currently: harness seeds only admin
   - Solution: Create users via API or seed script

2. **Cross-Pack Features:**
   - PTO + Payroll integration
   - PTO + Calendar/Calendar integration
   - Solution: Use demo app with all packs

3. **Performance Testing:**
   - Load testing with many requests
   - Complex approval chains
   - Solution: Demo app or dedicated perf environment

### Conclusion

**For now: Feature Pack Harness is perfect**

- ✅ Fast iteration
- ✅ Isolated testing
- ✅ Automatic provisioning
- ✅ CI/CD ready

**Consider Demo App later if:**
- Need cross-pack integration tests
- Need production-like environment
- Need complex multi-user scenarios

The harness approach scales well and can handle most PTO testing scenarios. Start simple, add complexity as needed.
