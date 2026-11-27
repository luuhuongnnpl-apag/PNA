# Security activation checklist
- Firebase Web App configured; GitHub Pages deployment of config succeeded.
- Admin identity: verified Google email only. No credentials for server deploy in repo.
- Emulator test suite uses demo-pna only; no production access, no data upload. 18 tests cover explicit deny, admin grants, class/course scopes, expired/revoked grants and private layout.
- Actual Firebase Rules must be published and checked in academic-advising-center separately. Do not assume emulator success equals live deployment. Do not use real student records until live tests pass.
- Verify current rules before replacing; if existing non-demo data/rules exist, reconcile instead of overwrite.
- Browser login smoke test: admin login, open Page Builder, create dummy block, save cloud, reload, sign out, confirm builder inaccessible. Test a second authorized Google account scoped to fake class. No actual records.
