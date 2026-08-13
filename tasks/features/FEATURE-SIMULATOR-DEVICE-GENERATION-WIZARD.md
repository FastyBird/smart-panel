# Task: Simulator device generation wizard
ID: FEATURE-SIMULATOR-DEVICE-GENERATION-WIZARD
Type: feature
Scope: admin
Size: medium
Parent: FEATURE-DEVICE-PLUGIN-ADOPTION-WIZARDS
Status: done
Created: 2026-08-13

## 1. Business goal

In order to create realistic test inventories without adding simulated devices one at a time,
as a Smart Panel administrator,
I want a guided Simulator wizard that can generate a bounded batch of devices from one reviewed configuration and
report the outcome for every requested device.

## 2. Product rules

- This is a generation wizard, not an external-device adoption adapter. It must not register `deviceWizardAdapter` or
  appear in the shared discovery/import chooser.
- Keep the existing manual Simulator add/edit forms unchanged for administrators who need direct per-device control.
- Use the existing `GET /plugins/simulator/categories` and `POST /plugins/simulator/generate` endpoints.
- Ask once for category and generation options, derive deterministic names for every requested device, and show the
  full batch before persistence.
- Bound the batch size and request concurrency. One failed device must not roll back successful siblings.
- Show a per-device result and refresh the Devices store once after the batch completes.

## 3. Scope

- Generalize plugin-owned Devices wizard launcher metadata so route-based construction/generation wizards are not
  hard-coded in the Devices view.
- Migrate the existing Virtual Devices launcher to that metadata without changing its route or behavior.
- Register an authenticated Simulator wizard route under the Devices route.
- Add category, options, review, and per-device result states.
- Support device count, name prefix, optional room, required-only channel/property generation, and automatic simulation
  settings already accepted by the backend.
- Add translations in all six supported admin locales and focused route, launcher, composable, and view tests.

## 4. Out of scope

- A new bulk backend endpoint or changes to Simulator generation semantics.
- Scenario generation, space generation, or scene generation.
- Replacing the existing manual Simulator add/edit forms.
- Registering Simulator in the shared discovery/adoption chooser.

## 5. Acceptance criteria

- [x] Enabled Simulator plugins expose a route-based wizard launcher on desktop and small screens.
- [x] Disabled Simulator plugins expose no launcher.
- [x] Virtual Devices uses the same generic route-launcher metadata and keeps its existing behavior.
- [x] The wizard fetches categories once and prevents progress until a category is selected.
- [x] The administrator can configure a batch of 1-20 devices and review every derived name before generation.
- [x] Generation uses at most three concurrent requests and reports success or failure for every requested device.
- [x] Successful generation refreshes the Devices store once, without discarding failed results.
- [x] Created devices can be opened from the results, and the administrator can reset the wizard to generate more.
- [x] Existing Simulator manual forms and shared adoption wizard behavior remain unchanged.
- [x] Focused admin tests, type-check, lint, locale parity, and production build pass.
