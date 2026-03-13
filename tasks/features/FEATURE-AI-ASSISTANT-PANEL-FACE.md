# Task: AI Assistant Face - Extended Features
ID: FEATURE-AI-ASSISTANT-PANEL-FACE
Type: feature
Scope: panel
Size: small
Parent: EPIC-AI-BUDDY-FACE
Created: 2026-03-13
Status: planned

## 1. Business goal

In order to enhance the face widget with additional customization and integration options
As a panel user
I want to customize the face appearance, add it as a dashboard tile, and configure its behavior

## 2. Context

- **Prerequisite**: Complete FEATURE-AI-ASSISTANT-PANEL-FACE-MVP first
- Builds on top of the MVP face widget
- All core face rendering and buddy integration is done in the MVP
- This task adds polish, configurability, and additional integration points

## 3. Scope

**In scope**

- Additional emotion presets beyond the initial 12
- Face appearance customization (eye style, color scheme, face shape)
- Face as a dashboard tile (embeddable in dashboard grid)
- Text bubble overlay (show last buddy message near the face)
- Admin-configurable face behavior (inactivity timeout, default emotion)
- Accessibility considerations (reduced motion mode)

**Out of scope**

- Core face rendering (done in MVP)
- Buddy module changes
- Backend changes

## 4. Acceptance criteria

- [ ] At least 6 additional emotion presets (18+ total)
- [ ] Face appearance customizable via settings
- [ ] Face embeddable as a dashboard tile
- [ ] Optional text bubble shows recent buddy message
- [ ] Reduced motion mode respects system accessibility settings

## 5. Technical constraints

- Build on top of MVP code - extend, don't rewrite
- Follow existing dashboard tile plugin patterns
- No new dependencies

## 6. AI instructions (for Junie / AI)

- Complete FEATURE-AI-ASSISTANT-PANEL-FACE-MVP first
- Read MVP code thoroughly before extending
- Keep customization options simple and tested
