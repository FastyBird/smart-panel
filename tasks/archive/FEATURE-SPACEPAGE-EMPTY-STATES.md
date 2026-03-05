# Task: SpacePage empty states and graceful degradation
ID: FEATURE-SPACEPAGE-EMPTY-STATES
Type: feature
Scope: panel, backend
Size: tiny
Parent: EPIC-SPACES-FIRST-UX
Status: done

## 1. Business goal

In order to ensure the SpacePage never feels broken or unfinished,
As a wall panel user,
I want clear and calm empty states when a Space has no devices or limited capabilities.

## 2. Context

- SpacePage renders sections dynamically based on available devices/capabilities.
- Many real-world spaces (hallway, WC, storage) may have no controllable devices.

## 3. Scope

**In scope**
- Define empty-state rules for:
  - Space with no devices
  - Space with devices but no lights
  - Space with sensors only (read-only)
- Ensure SpacePage rendering never throws due to missing data.

## 4. Acceptance criteria

- [x] SpacePage shows a clear empty state when no sections are available.
- [x] Each missing section degrades gracefully.
