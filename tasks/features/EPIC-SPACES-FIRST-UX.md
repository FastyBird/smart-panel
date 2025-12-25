# Task: Spaces-first UX (Spaces module + Space pages + onboarding + MVP intents)
ID: EPIC-SPACES-FIRST-UX
Type: chore
Scope: backend, admin, panel
Size: large
Parent: (none)
Status: in-progress

## 1. Business goal

In order to differentiate Smart Panel from “dashboards and buttons” solutions (HA dashboards, NSPanel, Shelly panels, Tuya panels),
As a product owner / administrator,
I want a Spaces-first experience that requires minimal configuration and provides a room-centric home screen by default.

## 2. Context

- Current architecture:
  - Devices module: device management with channels/properties, state storage, command dispatch.
  - Dashboard module: multiple page types (device detail, tiles, cards/tiles), assigned per display or shared.
  - Displays module: manages multiple wall displays (one backend “brain”, many displays).
  - Integrations are plugin-based (e.g., Home Assistant, Shelly, OpenWeatherMap).
- Users strongly dislike manual UI configuration (e.g., HA default page is unusable, and editing dashboards is work).
- Desired market position: between HA flexibility and Loxone/Control4 product-quality defaults.
- Approach: add a new top-level domain "Spaces" and a new page type “SpacePage” while preserving existing dashboard pages as a power-user mode.

## 3. Scope

**In scope**

- Deliver a complete first iteration of Spaces-first UX by implementing the following child tasks:
  - FEATURE-SPACES-MODULE
  - TECH-SPACES-ONBOARDING-WIZARD
  - FEATURE-DASHBOARD-SPACE-PAGE
  - FEATURE-SPACE-INTENTS-LIGHTING-MVP
- Ensure backward compatibility:
  - existing pages remain intact
  - existing devices/displays keep working without any space assignment
- Provide a clear onboarding path that guides an admin to:
  - define spaces
  - assign devices/displays
  - create at least one SpacePage and set it as Home per display

**Out of scope**

- Advanced device roles (main/task/ambient) and per-role orchestration.
- Cross-space “House overview” pages.
- Advanced theming and templating systems.
- Non-lighting intents (climate modes, scenes, covers) beyond displaying basic status on SpacePage.

## 4. Acceptance criteria

- [ ] Child tasks are completed and meet their acceptance criteria:
  - [x] FEATURE-SPACES-MODULE
  - [ ] TECH-SPACES-ONBOARDING-WIZARD (not yet implemented)
  - [x] FEATURE-DASHBOARD-SPACE-PAGE
  - [x] FEATURE-SPACE-INTENTS-LIGHTING-MVP
- [ ] An admin can complete an end-to-end setup in under ~10 minutes for a typical home:
  - [x] create/confirm spaces
  - [x] assign devices/displays to spaces
  - [x] generate/create SpacePage(s)
  - [x] set SpacePage as Home for each display
- [x] A wall panel user can:
  - [x] see a Space-first home screen
  - [x] control lighting via intent controls (On/Off, Work/Relax/Night, Brightness +/-)
  - [x] swipe to other existing pages (tiles/buttons) if configured
- [x] All changes remain backward compatible (no forced migration of existing dashboards).
- [x] Tests are present for new backend logic and critical UI rendering paths.

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Spaces-first setup from scratch

Given a clean install with devices discovered via integrations  
When an admin runs the Spaces onboarding wizard  
And assigns each display to a space  
And creates a SpacePage for each display’s space  
Then each display opens on its SpacePage by default  
And the user can control lights via intent buttons on the SpacePage

## 6. Technical constraints

- Follow the existing module / service structure in backend/admin/panel.
- Do not introduce new dependencies unless really needed.
- Do not modify generated code.
- Tests are expected for new logic.
- Keep changes scoped to this epic and its child tasks.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

## 7. Implementation hints (optional)

- Implement features incrementally behind a minimal surface area:
  - add `spaceId` as nullable first
  - add SpacePage as additive new page type
  - keep orchestrations capability-driven
- Ensure the panel gracefully handles missing data and unassigned spaces:
  - show informative empty states
  - avoid crashes and blank screens

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it’s skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
