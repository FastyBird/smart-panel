import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Service that manages the navigation deck.
///
/// The deck is built from display settings and dashboard pages,
/// combining system views with user-configured pages.
class DeckService extends ChangeNotifier {
  final DashboardService _dashboardService;
  final IntentsService _intentsService;

  /// The current deck result.
  DeckResult? _deck;

  /// The current display configuration.
  DisplayModel? _display;

  /// Configuration validation error.
  String? _configError;

  /// Whether the deck has been initialized.
  bool _isInitialized = false;

  DeckService({
    required DashboardService dashboardService,
    required IntentsService intentsService,
  })  : _dashboardService = dashboardService,
        _intentsService = intentsService;

  /// Returns the current deck, or null if not yet built.
  DeckResult? get deck => _deck;

  /// Returns the current display, or null if not set.
  DisplayModel? get display => _display;

  /// Returns the configuration error, or null if valid.
  String? get configError => _configError;

  /// Returns true if the deck has been initialized.
  bool get isInitialized => _isInitialized;

  /// Returns true if there's a configuration error.
  bool get hasConfigError => _configError != null;

  /// Returns all deck items.
  List<DeckItem> get items => _deck?.items ?? [];

  /// Returns the start index for initial navigation.
  int get startIndex => _deck?.startIndex ?? 0;

  /// Returns the start item.
  DeckItem? get startItem => _deck?.startItem;

  /// Initializes the deck with display settings.
  ///
  /// Call this during app hydration after display settings are loaded.
  void initialize(DisplayModel display, {BuildContext? context}) {
    _display = display;

    // Validate display configuration
    _configError = validateDisplayConfig(display);
    if (_configError != null) {
      _isInitialized = false;
      notifyListeners();
      return;
    }

    // Build the deck
    _buildDeck(context);
    _isInitialized = true;
    notifyListeners();

    // Listen for dashboard changes
    _dashboardService.addListener(_onDashboardChanged);
  }

  void _onDashboardChanged() {
    if (_display != null && _configError == null) {
      _buildDeck(null);
      notifyListeners();
    }
  }

  void _buildDeck(BuildContext? context) {
    if (_display == null) return;

    // Get localized titles if context available
    final localizations = context != null ? AppLocalizations.of(context) : null;

    // Get pages from dashboard service
    final pages = _dashboardService.pages.values.toList();

    // Build the deck
    final input = DeckBuildInput(
      display: _display!,
      pages: pages,
      roomViewTitle: localizations?.system_view_room ?? 'Room',
      masterViewTitle: localizations?.system_view_master ?? 'Home',
      entryViewTitle: localizations?.system_view_entry ?? 'Entry',
    );

    _deck = buildDeck(input);

    // Synchronize deck with IntentsService for navigation intents
    _intentsService.setDeck(_deck!);

    if (kDebugMode) {
      debugPrint(
        '[DECK SERVICE] Built deck with ${_deck!.items.length} items, '
        'startIndex=${_deck!.startIndex}, didFallback=${_deck!.didFallback}',
      );

      if (_deck!.warningMessage != null) {
        debugPrint('[DECK SERVICE] Warning: ${_deck!.warningMessage}');
      }
    }
  }

  /// Updates the display settings and rebuilds the deck.
  void updateDisplay(DisplayModel display, {BuildContext? context}) {
    _display = display;
    _configError = validateDisplayConfig(display);

    if (_configError == null) {
      _buildDeck(context);
    }

    notifyListeners();
  }

  /// Finds a deck item by ID.
  DeckItem? findItem(String id) {
    return _deck?.items.where((item) => item.id == id).firstOrNull;
  }

  /// Returns the index of a deck item by ID, or -1 if not found.
  int indexOfItem(String id) {
    final items = _deck?.items ?? [];
    return items.indexWhere((item) => item.id == id);
  }

  @override
  void dispose() {
    _dashboardService.removeListener(_onDashboardChanged);
    super.dispose();
  }
}
