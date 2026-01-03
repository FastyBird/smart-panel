# Deck Module

The Deck module implements the Spaces + Deck + Intents architecture for the Panel app. It provides role-based navigation where each display shows a system view based on its role (room/master/entry) followed by user-configured dashboard pages.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Display Settings                      │
│  • role: room/master/entry                              │
│  • spaceId: UUID (required for room role)               │
│  • homeMode: auto/explicit                              │
│  • homePageId: UUID (for explicit mode)                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Deck Builder                          │
│  Pure function: (DisplayModel, Pages) → DeckResult      │
│  • Generates system view based on role                  │
│  • Sorts pages by order                                 │
│  • Determines startIndex based on homeMode              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     Deck Result                          │
│  • items: [SystemViewItem, DashboardPageItem, ...]      │
│  • startIndex: int (where to start navigation)          │
│  • didFallback: bool (if explicit home not found)       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              DeckDashboardScreen (UI)                    │
│  • PageView with horizontal swipe navigation            │
│  • System view at index 0                               │
│  • Dashboard pages at index 1+                          │
│  • Dot indicators at bottom                             │
└─────────────────────────────────────────────────────────┘
```

## Key Components

### Domain Models

- **DeckItem** (sealed class): Base class for items in the navigation deck
  - **SystemViewItem**: Role-specific overview (room/master/entry)
  - **DashboardPageItem**: User-configured dashboard page

- **DeckResult**: Result of building a deck
  - `items`: Ordered list of deck items
  - `startIndex`: Where to start navigation
  - `didFallback`: True if homePageId was not found
  - `warningMessage`: Optional warning about configuration

### Services

- **DeckBuilder** (`buildDeck`): Pure function that builds the deck from display settings
- **DeckService**: Manages deck state and responds to display/page changes
- **IntentsService**: Unified action routing for navigation, scenes, and device control

### System Views

- **RoomOverviewPage**: Room-centric view with device counts, scenes, and controls
- **MasterOverviewPage**: Whole-house overview with room list and global scenes
- **EntryOverviewPage**: House modes and security status

## Usage

### Building the Deck

```dart
final input = DeckBuildInput(
  display: displayModel,
  pages: dashboardPages,
  roomViewTitle: 'Room Overview',
  masterViewTitle: 'Home Overview',
  entryViewTitle: 'Entry',
);

final result = buildDeck(input);

// Access deck items
for (final item in result.items) {
  switch (item) {
    case SystemViewItem systemView:
      print('System view: ${systemView.viewType}');
    case DashboardPageItem page:
      print('Page: ${page.title}');
  }
}
```

### Using Intents

```dart
// Navigation
intentsService.navigateToDeckItem('page-123');
intentsService.navigateHome();

// Scene activation
await intentsService.activateScene('scene-456');

// Device control
await intentsService.toggleDevice('property-789');
await intentsService.setDeviceProperty(
  propertyId: 'property-789',
  value: 75,
);
```

## Display Configuration

| Role   | Required Fields | System View |
|--------|-----------------|-------------|
| room   | spaceId         | RoomOverviewPage |
| master | -               | MasterOverviewPage |
| entry  | -               | EntryOverviewPage |

### Home Mode

- **auto**: Start on the system view (index 0)
- **explicit**: Start on the specified homePageId (or fallback to system view if not found)

## Events

- **NavigateToDeckItemEvent**: Request navigation to a specific deck item
- **NavigateToPageEvent**: Legacy event for backwards compatibility

## Configuration Validation

The `validateDisplayConfig` function returns an error message if:
- Role is `room` but `spaceId` is null

## Testing

Unit tests are in `test/modules/deck/services/deck_builder_test.dart`

Run tests:
```bash
flutter test test/modules/deck/
```
