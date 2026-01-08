/// Deck Feature - Main App Interface
///
/// The Deck is the primary user interface of the Smart Panel app.
/// It provides a swipeable PageView containing:
///
/// - **System Pages**: Role-based overview pages
///   - Room: Shows devices, scenes, and controls for a specific room
///   - Master: Whole-house overview with room list and global scenes
///   - Entry: House modes and security status
///
/// - **Domain Pages**: Device category pages within a room
///   - Lights: Lighting controls grouped by role (Main, Task, Ambient, etc.)
///   - Climate, Media, Sensors: Placeholder pages (to be implemented)
///
/// - **Dashboard Pages**: User-configured pages from the Admin interface
///
/// ## Architecture
///
/// All implementation lives in [modules/deck]:
/// - `services/` - DeckService, DeckBuilder, IntentsService
/// - `models/` - DeckItem (SystemViewItem, DomainViewItem, DashboardPageItem)
/// - `presentation/` - UI pages and screens
/// - `mappers/` - Widget builders for deck items
///
/// ## Entry Point
///
/// [DeckDashboardScreen] is the root widget, used as the `/` route.
/// It consumes [DeckService] via Provider and renders the appropriate
/// pages based on display configuration.
///
/// ## Navigation
///
/// Navigation within the deck uses [NavigateToDeckItemEvent] via EventBus.
/// Domain pages are accessed by tapping domain tiles on system pages.
library;

export 'package:fastybird_smart_panel/modules/deck/presentation/deck.dart';
