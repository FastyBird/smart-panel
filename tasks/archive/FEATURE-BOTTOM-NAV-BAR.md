# Task: Bottom navigation bar redesign with security integration
ID: FEATURE-BOTTOM-NAV-BAR
Type: feature
Scope: panel, backend
Size: large
Parent: (none)
Status: done

## 1. Business goal

In order to provide intuitive navigation between deck pages on small screens
As a smart panel user
I want a bottom navigation bar in portrait mode that shows all deck pages with smooth transitions and integrated security access.

## 2. Context

- The panel uses a `PageView`-based deck system (`DeckDashboardScreen`) for swiping between pages.
- Domain views (lights, climate, shading, media, sensors) register mode configs via `BottomNavModeNotifier`.
- Security was previously a standalone pushed route, accessible only via a debug FAB.
- Navigation relied on page dots in landscape and had no portrait-specific nav UI.

## 3. Scope

**In scope**

- Custom animated bottom navigation bar for portrait mode
- Fixed Home tab (icon-only) with scrollable domain/security tabs
- Active tab expands to show icon + label with animated pill highlight
- Mode selector button for domain views with mode/intent configs
- "More" button with badge for dashboard pages (opens bottom sheet)
- Security page integrated into the deck PageView
- Crossfade page transition for distant tab jumps (> 1 page)
- Security overlay "show screen" navigates to deck security page
- Remove home buttons from domain view and security page headers

**Out of scope**

- Landscape navigation changes (still uses page dots)
- Security page content changes

## 4. Acceptance criteria

- [x] Bottom nav bar shows in portrait mode with Home (fixed), domain tabs (scrollable), Security tab, and optional More/Mode buttons
- [x] Active tab animates expansion with icon + label on medium+ screens; icon-only on small screens
- [x] Tapping a tab navigates to the corresponding page; adjacent pages slide, distant pages crossfade
- [x] Swiping between pages updates the active tab and auto-scrolls to center it
- [x] Mode button appears when a domain view registers its mode config; tapping opens the mode popup
- [x] More button appears when dashboard pages exist; shows badge count; opens bottom sheet
- [x] Security is a full deck page (swipeable, tab-navigable) with no back/home header buttons when embedded
- [x] Security overlay "show screen" action navigates to the security deck page instead of pushing a route
- [x] Security overlay is suppressed when viewing the security page
- [x] Domain view and security page headers no longer show home navigation buttons
- [x] No mode selector flicker during rapid page changes (event bus race conditions resolved)
- [x] No intermediate page flash when jumping across multiple pages
- [x] flutter analyze passes with no new warnings

## 6. Technical constraints

- `DeckItem` is a sealed class; new item types require updating the exhaustive switch in `buildDeckItemWidget`
- `EventBus` uses async delivery (`sync: false`); domain views must not call `notifier.clear()` on deactivation to avoid listener ordering races
- `PageView.onPageChanged` fires for every intermediate page during `animateToPage`; distant jumps must use `jumpToPage` to avoid spurious events
- `addPostFrameCallback` ensures events fire after widget tree is settled

## 7. Implementation hints

- `DeckBottomNavBar` is a `StatefulWidget` with `ScrollController` and `GlobalKey` for `Scrollable.ensureVisible`
- `AnimatedSize` handles tab width transitions naturally without manual `TextPainter` measurement
- `FadeTransition` with `AnimationController` (150ms) wraps the `PageView` for crossfade jumps
- `SecurityViewItem.generateId()` returns `'security-view'` for stable event-based navigation
- `SecurityOverlayController.setOnSecurityScreen()` is called from `_fireDeckPageActivatedEvent` based on current item type
