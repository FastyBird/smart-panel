# Task: Extension Marketplace Install/Uninstall via Interactive Sessions

ID: FEATURE-EXTENSION-MARKETPLACE-SESSIONS
Type: feature
Scope: backend, admin
Size: large
Parent: EPIC-EXTENSION-ACTIONS
Status: planned

## 1. Business goal

In order to install and manage third-party extensions without using the terminal,
As a Smart Panel administrator,
I want to browse available extensions in a marketplace, and install/uninstall them through interactive sessions that show dependency resolution, download progress, and configuration steps.

## 2. Context

The extension SDK already supports third-party extensions discovered from `node_modules`. This task adds a marketplace UI and uses interactive sessions for the install/uninstall workflow.

**Prerequisites:**
- FEATURE-INTERACTIVE-SESSION-PROTOCOL — WebSocket session infrastructure
- FEATURE-INTERACTIVE-SESSION-ADMIN-UI — Terminal UI component
- npm registry or custom registry for extension discovery

**Workflow:**
1. Browse marketplace → select extension → click Install
2. Interactive session: resolve dependencies → confirm → download → install → configure → restart affected services
3. Uninstall: confirm → check dependents → remove → cleanup → restart

## 3. Scope

**In scope**

- Marketplace browse/search UI in admin
- Extension detail page in marketplace (README, version, author, compatibility)
- Install interactive session: dependency check → confirm → npm install → register → restart
- Uninstall interactive session: dependent check → confirm → npm uninstall → cleanup → restart
- Update interactive session: version check → changelog → confirm → update → migrate → restart
- Extension compatibility checking (SDK version)

**Out of scope**

- Custom extension registry (uses npm registry initially)
- Extension store/billing
- Auto-update mechanism
- Extension sandboxing/security review
- Extension signing/verification

## 4. Acceptance criteria

- [ ] Marketplace page lists available extensions from configured registry
- [ ] Extension detail page shows README, version, compatibility, install button
- [ ] Install session resolves dependencies and shows confirmation before proceeding
- [ ] Install progress streams in real-time (download, extract, register)
- [ ] Uninstall session checks for dependents and warns before removing
- [ ] Update session shows changelog and confirms before proceeding
- [ ] Incompatible extensions show warning with SDK version mismatch
- [ ] Failed installs clean up partial state
- [ ] Backend restart handled gracefully with user notification

## 5. Technical constraints

- Must work with pnpm workspace structure
- Extension install requires application restart (must be handled gracefully)
- Must validate SDK version compatibility before install
- Registry source must be configurable (npm, custom URL)
- Must not break existing bundled/core extensions

## 6. AI instructions

- Read this file entirely before making any code changes
- This is a large feature — start with implementation plan
- Implement after all Phase 2 and Phase 3 tasks are complete
- Study existing extension discovery in `extensions-discovery.ts`
- Study npm programmatic API for install/uninstall
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
