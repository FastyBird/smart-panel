# Cover groups and composed HomeKit acceptance

ID: FEATURE-VIRTUAL-COVER-HOMEKIT
Type: feature
Scope: backend, spec, Admin/Panel regression tests, docs
Status: in review
Issues: #1452, #1461
Parent: #1447

## Outcome

Complete qualified cover percentage commands and preserve truthful requested/observed thermostat state in HomeKit.
Use the existing group identity, composite dispatch, ownership, deadlines and producer authority. No new command engine.

## Acceptance

- [x] Calibrated native POSITION and supported slat percentage TILT use exact fresh target-at-rest confirmation.
- [x] Degree/percentage metadata remain distinct; no inversion, calibration or angular conversion is invented.
- [x] Pending, late, superseded, faulted and partial cover outcomes preserve actual member observations.
- [x] Managed native/guarded MODE is one atomic command; HomeKit current activity remains qualified feedback.
- [x] Real HAP/native journal tests and existing expiry/restart/remap/legacy/partial component tests pass.
- [x] Backend/client types, generated specs, strict lint and integration checks pass.
- [ ] Exact-head hosted CI and completed nonblocking main CodeRabbit review pass before merge.

## Local validation

- Cover/core/native/HomeKit: 59 suites, 1,193 tests passed across focused and complementary runs.
- Discovery suite, including explicit disable and transient-reading cases: 39 tests passed (included above).
- Initial feature head `0f53af83`: full ordinary HTTP/E2E, 28 suites and 420 tests passed.
- Initial feature head `0f53af83`: full Admin, 3,949 tests passed; Panel device/control/scene selection, 17 tests passed.
- Three mutation controls caused four substantive assertion failures; original source restored.
- Backend/Admin types and strict lint, Flutter analysis, formatting and generated specs checked.

Physical equipment operation, real Apple pairing and alpha publication remain #1463/#1462.
