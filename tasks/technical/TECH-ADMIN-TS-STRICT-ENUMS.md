# Task: Admin TypeScript Strictness — Remove unsafe casts and use generated enums
ID: TECH-ADMIN-TS-STRICT-ENUMS
Type: technical
Scope: admin
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to catch type errors at compile time and prevent runtime mismatches between backend and admin
As a developer
I want the admin app to use strict TypeScript types from the generated OpenAPI spec instead of unsafe casts and string literals

## 2. Context

- The admin app currently has **239 `as unknown` / `as never` / `as any` casts** across **102 non-test files**
- Many were introduced during development when the OpenAPI spec wasn't regenerated, and left behind
- The codebase has a defined enum pipeline: backend constants → OpenAPI spec → `openapi.ts` → `openapi.constants.ts` (stable re-exports) → admin code
- Some modules import directly from `openapi.ts` instead of `openapi.constants.ts` (6 files)
- String literals are used where generated enum values should be

**Distribution by module (top offenders):**
- `modules/devices` — 14 casts
- `modules/spaces` — 12 casts
- `modules/dashboard` — 12 casts
- `modules/weather` — 5 casts
- `modules/config` — 5 casts
- `modules/system` — 4 casts
- `modules/scenes` — 4 casts
- `modules/extensions` — 4 casts
- Various plugins — 20+ casts

**Enum pipeline (reference):**
1. Backend: define enum in `*.constants.ts` (e.g., `system.constants.ts`)
2. Backend: use in `@ApiProperty({ enum: MyEnum })` on models/DTOs
3. CI: `pnpm run generate:openapi` → generates enum in `apps/admin/src/openapi.ts`
4. Admin: re-export from `apps/admin/src/openapi.constants.ts` with stable name
5. Admin: import from `openapi.constants.ts` in all modules/components

**Reference files:**
- `apps/admin/src/openapi.constants.ts` — stable re-export mapping
- `apps/admin/src/openapi.ts` — generated (DO NOT EDIT)
- `apps/admin/src/modules/buddy/composables/useBuddyChat.ts` — example of recently cleaned up module

## 3. Scope

**In scope**

- Remove `as unknown`, `as never`, `as any` casts from non-test admin files
- Replace string literals with generated enum imports where applicable
- Ensure all enum imports go through `openapi.constants.ts`, not directly from `openapi.ts`
- Add missing re-exports to `openapi.constants.ts` as needed
- Run `pnpm run generate:openapi` before starting to ensure types are current
- Fix Zod schemas to use `z.nativeEnum()` with generated enums where possible

**Out of scope**

- Backend changes (enums are already defined there)
- Test files — `as any` is acceptable in test mocks
- Generated code (`openapi.ts`)
- Changes that require backend API modifications

## 4. Acceptance criteria

- [x] Zero `as unknown` casts in non-test admin files (currently 239) — **Done: 0 remaining**
- [x] Zero `as never` casts in non-test admin files — **Done: 0 remaining**
- [x] Zero `as any` casts in non-test admin files (except documented exceptions) — **Done: 0 remaining**
- [x] All enum imports go through `openapi.constants.ts`, not directly from `openapi.ts` — **Done**
- [x] String literals replaced with enum values where a generated enum exists — **Done**
- [x] `pnpm --filter ./apps/admin run test:unit` passes — **Done: 1275/1275 pass**
- [x] `pnpm --filter @fastybird/smart-panel-admin lint:js` passes — **Done**
- [x] `pnpm --filter @fastybird/smart-panel-admin type-check` passes — **Done**
- [x] No functional regressions — **Done**

## 5. Technical constraints

- Run `pnpm run generate:openapi` first to ensure all types are current
- Work module-by-module to keep PRs reviewable
- Some casts may be genuinely necessary (e.g., dynamic API responses) — document them with a `// eslint-disable-next-line` and a comment explaining why
- The `openapi.constants.ts` file is manually maintained — add re-exports as needed
- Do not modify `openapi.ts` (generated)

## 6. Implementation hints

- Start with the highest-count modules: devices (14), spaces (12), dashboard (12)
- Many casts are in store files where API responses are parsed — these can often be fixed by using proper Zod schemas with `z.nativeEnum()`
- For `as never` in API client calls: these were fixed in buddy module by using the proper typed OpenAPI client paths — same pattern applies elsewhere
- Use `grep -rn "as unknown\|as never\|as any" apps/admin/src/ --include="*.ts" --include="*.vue" | grep -v "\.spec\.\|\.test\.\|__mocks__"` to track progress
- Consider doing one module per PR for reviewability

## 7. AI instructions

- Read this file entirely before making any code changes.
- Run `pnpm run generate:openapi` before starting.
- Work module-by-module, starting with the highest-count ones.
- For each cast removed, verify the replacement is type-safe by running `type-check`.
- When a cast genuinely can't be removed, add a comment explaining why and suppress the lint rule for that line only.
- Keep each commit focused on one module for easy review.
- Run full test suite after each module to catch regressions early.
