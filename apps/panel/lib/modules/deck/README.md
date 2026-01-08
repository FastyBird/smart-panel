# Deck Module

The Deck module implements the Spaces + Deck + Intents architecture for the Panel app. It provides role-based navigation where each display shows a system view based on its role (room/master/entry), domain views for device categories, and user-configured dashboard pages.

## Module Structure

```
modules/deck/
  constants.dart          # Module constants (LightingConstants)
  export.dart             # Public API re-exports
  module.dart             # Service registration (DeckModuleService)

  mappers/                # Widget builders and type converters
    deck_item.dart        # buildDeckItemWidget()
    system_view.dart      # buildSystemViewWidget()

  models/                 # Data classes
    deck_item.dart        # DeckItem, SystemViewItem, DomainViewItem, DashboardPageItem
    deck_result.dart      # DeckResult
    intent_result.dart    # IntentResult
    lighting/             # Lighting-specific models
      role_control_state.dart
      role_group.dart
      role_mixed_state.dart

  presentation/           # UI pages
    deck.dart             # DeckDashboardScreen (main entry)
    config_error.dart     # ConfigErrorScreen
    domain_pages/         # Device category pages
      domain_view.dart
      lights_domain_view.dart
    system_pages/         # Role-based overview pages
      room_overview.dart
      master_overview.dart
      entry_overview.dart

  services/               # Business logic
    deck_builder.dart     # buildDeck() pure function
    deck_service.dart     # DeckService state management
    intents_service.dart  # IntentsService action routing
    room_domain_classifier.dart
    room_overview_model_builder.dart
    system_views_builder.dart

  types/                  # Enums and type definitions
    deck_item_type.dart
    domain_type.dart      # DomainType (lights, climate, media, sensors)
    intent_type.dart      # IntentType, IntentResultStatus
    navigate_event.dart   # NavigateToDeckItemEvent
    system_view_type.dart # SystemViewType (room, master, entry)
    lighting/             # Lighting-specific types
      light_role_mode.dart
      role_ui_state.dart
      simple_property_type.dart

  utils/                  # Helper functions
    lighting.dart         # findLightChannel, getLightRoleName, getLightRoleIcon
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Display Settings                      │
│  • role: room/master/entry                              │
│  • roomId: UUID (required for room role)                │
│  • homeMode: auto/explicit                              │
│  • homePageId: UUID (for explicit mode)                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Deck Builder                          │
│  Pure function: (DisplayModel, Pages) → DeckResult      │
│  • Generates system view based on role                  │
│  • Generates domain views for device categories         │
│  • Sorts pages by order                                 │
│  • Determines startIndex based on homeMode              │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     Deck Result                          │
│  • items: [SystemViewItem, DomainViewItem,              │
│            DashboardPageItem, ...]                      │
│  • startIndex: int (where to start navigation)          │
│  • didFallback: bool (if explicit home not found)       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              DeckDashboardScreen (UI)                    │
│  • PageView with horizontal swipe navigation            │
│  • System view at index 0                               │
│  • Domain views (lights, climate, etc.)                 │
│  • Dashboard pages at later indices                     │
│  • Dot indicators at bottom                             │
└─────────────────────────────────────────────────────────┘
```

## Key Components

### Domain Models

- **DeckItem** (sealed class): Base class for items in the navigation deck
  - **SystemViewItem**: Role-specific overview (room/master/entry)
  - **DomainViewItem**: Device category page (lights/climate/media/sensors)
  - **DashboardPageItem**: User-configured dashboard page

- **DeckResult**: Result of building a deck
  - `items`: Ordered list of deck items
  - `startIndex`: Where to start navigation
  - `didFallback`: True if homePageId was not found
  - `warningMessage`: Optional warning about configuration

### Services

- **DeckModuleService**: Module entry point, registers services in GetIt
- **DeckBuilder** (`buildDeck`): Pure function that builds the deck from display settings
- **DeckService**: Manages deck state and responds to display/page changes
- **IntentsService**: Unified action routing for navigation, scenes, and device control

### System Pages

- **RoomOverviewPage**: Room-centric view with device domains, scenes, and controls
- **MasterOverviewPage**: Whole-house overview with room list and global scenes
- **EntryOverviewPage**: House modes and security status

### Domain Pages

- **LightsDomainViewPage**: Lighting devices grouped by role with quick controls
- **DomainViewPage**: Placeholder for climate, media, sensors (to be implemented)

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
    case DomainViewItem domainView:
      print('Domain: ${domainView.domainType}');
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

| Role   | Required Fields | System View        |
|--------|-----------------|-------------------|
| room   | roomId          | RoomOverviewPage  |
| master | -               | MasterOverviewPage |
| entry  | -               | EntryOverviewPage |

### Home Mode

- **auto**: Start on the system view (index 0)
- **explicit**: Start on the specified homePageId (or fallback to system view if not found)

## Events

- **NavigateToDeckItemEvent**: Request navigation to a specific deck item (in `types/navigate_event.dart`)

## Configuration Validation

The `validateDisplayConfig` function returns an error message if:
- Role is `room` but `roomId` is null

## Testing

Unit tests are in `test/modules/deck/services/deck_builder_test.dart`

Run tests:
```bash
flutter test test/modules/deck/
```
