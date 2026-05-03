This is an School Managment System

## E2E Test Script (local testing only)

There is a convenience script for local end-to-end testing that creates sample records (teacher, blog, notice), exercises admin delete routes, and verifies the deletions in the database.

- Location: `scripts/e2e-sample-delete.js`
- Purpose: Quick manual/regression test for delete flows (teacher, blog, notice). The script logs in as the `admin` user (username/password: `admin`/`admin` in default test data) and performs the actions.

Usage

1. Ensure your dev server is running locally (the script makes HTTP requests to `http://localhost:3000`). Start with:

```bash
node app.js
```

2. Run the E2E script manually:

```bash
npm run test:e2e
```

Safety & Notes

- TEST-ONLY: This script is intended for local development and debugging. It creates and deletes data; do NOT run it against production databases.
- The script uses the admin account; ensure authentication credentials are appropriate for your test environment.
- The script is kept in `scripts/` and the npm helper `test:e2e` is added to `package.json` so it is easy to run but not executed automatically.

If you want the script moved to a `tests/` directory or wrapped with additional environment guards, tell me and I can update it.