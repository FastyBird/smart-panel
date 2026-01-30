# Task: Media Domain – Finalization (Docs, Onboarding, Guardrails, "Done" Checklist)
ID: FEATURE-MEDIA-FINALIZATION
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: (none)
Status: in-progress

## 1. Business goal

In order to **ship the Media domain as a finished, production-ready feature**
As a **product team**
I want to **close all documentation gaps, add onboarding polish, and verify completeness via a definitive checklist**

## 2. Context

- Media domain backend, admin, and panel are feature-complete
- Endpoints, bindings, activities, dry-run preview, and regression harness all implemented
- Missing: user/admin/dev documentation, onboarding defaults polish, final guardrails, and a "done" checklist

## 3. Scope

**In scope**
- User-facing docs (`/docs/panel/media.md`)
- Admin-facing docs (`/docs/admin/media.md`)
- Developer/contributor docs (`/docs/dev/media-architecture.md`)
- Media "done" checklist (`/docs/media-done-checklist.md`)
- Onboarding & empty state improvements (backend + panel)
- Final guardrails and assertions (backend)

**Out of scope**
- New Media features (queue, multiroom, automations)
- UI redesigns beyond copy/empty states
- Refactors unless required for correctness

## 4. Acceptance criteria

### Documentation
- [x] User, Admin, and Dev docs exist and are readable
- [x] Docs reflect actual behavior (no aspirational features)

### Product Readiness
- [x] Media domain works without manual DB edits
- [x] First-time user sees immediate value
- [x] Errors and warnings never feel mysterious

### Technical
- [x] No TODOs left in Media domain code paths
- [x] Logs and error messages are actionable
- [x] Media can be reasoned about without reading source code
- [x] Backend guardrails validate single active activity per space
- [x] Backend logs warn when bindings reference missing endpoints

## 5. Example scenarios

Given a space with media devices but no bindings
When a user opens the Media domain for the first time
Then defaults are auto-generated and activities are immediately available

Given a space with no media-capable devices
When a user opens the Media domain
Then a clear message explains why Media is unavailable

Given an activation where volume preset is set but device lacks volume capability
When the activity is activated
Then the backend logs a warning and the step is skipped with a clear message

## 6. Technical constraints

- No behavior changes to activation/deactivation flow
- Guardrails are observability-only (logging, not blocking)
- Documentation must reflect current implementation exactly

## 7. Implementation hints

- Backend guardrails: add warn-level logging in `SpaceMediaActivityService`
- Empty state: improve panel `MediaDomainViewPage` messaging
- Docs: reference existing `.ai-rules/MEDIA_ARCHITECTURE.md` and `docs/features/media-domain-convergence.md`

## 8. AI instructions

- Read existing media services before adding guardrails
- Do not introduce new API endpoints or change response shapes
- Documentation must be factual — no aspirational features
