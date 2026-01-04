# Task: Space-aware idle mode for panel
ID: FEATURE-PANEL-IDLE-MODE-SPACE-AWARE
Type: feature
Scope: panel
Size: medium
Parent: EPIC-SPACES-FIRST-UX
Status: done

## 1. Business goal

In order to provide a seamless user experience when returning from idle (screensaver/lock screen),
As a panel user,
I want the dashboard to remember which page/space I was viewing and return to it after idle.

## 2. Context

- Current behavior: When the panel goes idle and shows the screensaver/lock screen, returning always resets to the home page
- Problem: Users lose their navigation context when the panel returns from idle
- Solution: Track the current page ID in DashboardService and restore it when the dashboard initializes

## 3. Scope

**In scope**
- Track current page ID in DashboardService during the session
- Restore to tracked page when returning from idle (screensaver/lock screen)
- Fall back to resolved home page if no tracked page exists

**Out of scope**
- Persisting page tracking across app restarts
- Tracking navigation within settings or other screens

## 4. Acceptance criteria

- [x] DashboardService tracks the current page ID during the session
- [x] When user navigates to a page, the page ID is tracked
- [x] When returning from screensaver/lock screen, dashboard restores to the tracked page
- [x] Falls back to resolved home page if tracked page is no longer valid
- [x] Page tracking is updated when pages are removed/clamped

## 5. Technical constraints

- No new dependencies required
- Uses existing DashboardService singleton pattern
- Compatible with existing push/pop navigation for screensaver/lock screen

## 6. Implementation

### Files modified

1. `apps/panel/lib/modules/dashboard/service.dart`
   - Added `_currentPageId` field to track current page
   - Added `currentPageId` getter
   - Added `setCurrentPageId()` method
   - Added `clearCurrentPageId()` method

2. `apps/panel/lib/features/dashboard/presentation/dashboard.dart`
   - Added `_dashboardService` reference
   - Updated `_getInitialPageIndex()` to prioritize tracked page over home page
   - Added `_updateTrackedPage()` helper method
   - Track page on initialization, page change, and page clamping
