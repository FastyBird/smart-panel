import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Service that manages the navigation deck.
///
/// The deck is built from display settings and dashboard pages,
/// combining system views with user-configured pages.
class DeckService extends ChangeNotifier {
  final DashboardService _dashboardService;
  final IntentsService _intentsService;
  final DevicesService? _devicesService;

  /// The current deck result.
  DeckResult? _deck;

  /// The current display configuration.
  DisplayModel? _display;

  /// Device categories for the current room (ROOM role only).
  List<DevicesModuleDeviceCategory> _deviceCategories = [];

  /// Configuration validation error.
  String? _configError;

  /// Whether the deck has been initialized.
  bool _isInitialized = false;

  /// Whether device data is currently being loaded.
  bool _isLoadingDevices = false;

  DeckService({
    required DashboardService dashboardService,
    required IntentsService intentsService,
    DevicesService? devicesService,
  })  : _dashboardService = dashboardService,
        _intentsService = intentsService,
        _devicesService = devicesService;

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

  /// Returns device categories for the current room (ROOM role only).
  List<DevicesModuleDeviceCategory> get deviceCategories => _deviceCategories;

  /// Returns true if device data is currently being loaded.
  bool get isLoadingDevices => _isLoadingDevices;

  /// Initializes the deck with display settings.
  ///
  /// Call this during app hydration after display settings are loaded.
  void initialize(DisplayModel display, {BuildContext? context}) {
    _display = display;

    if (kDebugMode) {
      debugPrint(
        '[DECK SERVICE] Initialize called. '
        'role: ${display.role}, roomId: ${display.roomId}',
      );
    }

    // Validate display configuration
    _configError = validateDisplayConfig(display);
    if (_configError != null) {
      _isInitialized = false;
      notifyListeners();
      return;
    }

    // Build initial deck (may not have device categories yet for ROOM role)
    _buildDeck(context);
    _isInitialized = true;
    notifyListeners();

    // Listen for dashboard changes
    _dashboardService.addListener(_onDashboardChanged);

    // For ROOM role, fetch device categories and prefetch domain data asynchronously
    if (display.role == DisplayRole.room && display.roomId != null) {
      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Will fetch devices for roomId: ${display.roomId}',
        );
      }
      _fetchDeviceCategoriesAsync(display.roomId!, context);
      _prefetchDomainData(display.roomId!);
    } else if (kDebugMode) {
      debugPrint(
        '[DECK SERVICE] NOT fetching devices. '
        'role: ${display.role}, roomId: ${display.roomId}',
      );
    }
  }

  /// Fetches device categories for a room and rebuilds the deck.
  Future<void> _fetchDeviceCategoriesAsync(
    String roomId,
    BuildContext? context,
  ) async {
    if (_devicesService == null) {
      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] DevicesService not available, '
          'cannot fetch device categories',
        );
      }
      return;
    }

    _isLoadingDevices = true;
    notifyListeners();

    try {
      if (kDebugMode) {
        debugPrint('[DECK SERVICE] Fetching devices for roomId: $roomId');
      }

      // Get devices for the room from DevicesService
      final devices = _devicesService.getDevicesForRoom(roomId);

      // Verify the room hasn't changed during the operation
      // to avoid race conditions when switching rooms quickly
      if (_display?.roomId != roomId) {
        if (kDebugMode) {
          debugPrint(
            '[DECK SERVICE] Room changed during fetch '
            '(was: $roomId, now: ${_display?.roomId}), discarding result',
          );
        }
        return;
      }

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] DevicesService returned ${devices.length} devices. '
          'Categories: ${devices.map((d) => d.category.name).toList()}',
        );
      }

      // Get device categories directly from DeviceView
      _deviceCategories = devices.map((d) => d.category).toList();

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Got ${_deviceCategories.length} categories: $_deviceCategories',
        );
      }

      // Rebuild deck with device categories
      _buildDeck(context);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Failed to fetch device categories: $e',
        );
      }
    } finally {
      _isLoadingDevices = false;
      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Fetch complete, notifying listeners. '
          'deviceCategories: ${_deviceCategories.length}',
        );
      }
      notifyListeners();
    }
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
      deviceCategories: _deviceCategories,
      roomViewTitle: localizations?.system_view_room ?? 'Room',
      masterViewTitle: localizations?.system_view_master ?? 'Home',
      entryViewTitle: localizations?.system_view_entry ?? 'Entry',
      lightsViewTitle: localizations?.domain_lights ?? 'Lights',
      climateViewTitle: localizations?.domain_climate ?? 'Climate',
      mediaViewTitle: localizations?.domain_media ?? 'Media',
      sensorsViewTitle: localizations?.domain_sensors ?? 'Sensors',
    );

    _deck = buildDeck(input);

    // Synchronize deck with IntentsService for navigation intents
    _intentsService.setDeck(_deck!);

    if (kDebugMode) {
      debugPrint(
        '[DECK SERVICE] Built deck with ${_deck!.items.length} items '
        '(${_deck!.domainViews.length} domain views), '
        'startIndex=${_deck!.startIndex}, didFallback=${_deck!.didFallback}',
      );

      if (_deck!.warningMessage != null) {
        debugPrint('[DECK SERVICE] Warning: ${_deck!.warningMessage}');
      }
    }
  }

  /// Updates the display settings and rebuilds the deck.
  void updateDisplay(DisplayModel display, {BuildContext? context}) {
    final oldRoomId = _display?.roomId;
    _display = display;
    _configError = validateDisplayConfig(display);

    if (_configError == null) {
      // If room changed, reset device categories and refetch
      if (display.role == DisplayRole.room &&
          display.roomId != null &&
          display.roomId != oldRoomId) {
        _deviceCategories = [];
        _buildDeck(context);
        _fetchDeviceCategoriesAsync(display.roomId!, context);
        _prefetchDomainData(display.roomId!);
      } else {
        _buildDeck(context);
      }
    }

    notifyListeners();
  }

  /// Gets the deck index for a view key.
  ///
  /// Returns -1 if the view key is not found.
  int getIndexByViewKey(String viewKey) {
    return _deck?.getIndexByViewKey(viewKey) ?? -1;
  }

  /// Navigates to a domain view by type.
  ///
  /// Returns the index to navigate to, or -1 if not found.
  int getDomainViewIndex(DomainType domain) {
    if (_display == null || _display!.roomId == null) return -1;
    final viewKey = 'domain:${_display!.roomId}:${domain.name}';
    return getIndexByViewKey(viewKey);
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

  /// Prefetches domain data (lighting and climate) for a room.
  ///
  /// This is called on app start to ensure domain views load instantly
  /// when navigated to, without waiting for data fetches.
  Future<void> _prefetchDomainData(String roomId) async {
    try {
      // Try to get SpacesService from locator
      if (!locator.isRegistered<SpacesService>()) {
        if (kDebugMode) {
          debugPrint(
            '[DECK SERVICE] SpacesService not available yet, '
            'skipping domain data prefetch',
          );
        }
        return;
      }

      final spacesService = locator<SpacesService>();

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Prefetching domain data for roomId: $roomId',
        );
      }

      // Prefetch lighting and climate data in parallel (non-blocking)
      // This ensures data is ready when domain views are opened
      Future.wait([
        // Prefetch lighting data
        spacesService.fetchLightTargetsForSpace(roomId).catchError((e) {
          if (kDebugMode) {
            debugPrint(
              '[DECK SERVICE] Failed to prefetch light targets: $e',
            );
          }
          return;
        }),
        spacesService.fetchLightingState(roomId).catchError((e) {
          if (kDebugMode) {
            debugPrint(
              '[DECK SERVICE] Failed to prefetch lighting state: $e',
            );
          }
          return null;
        }),
        // Prefetch climate data
        spacesService.fetchClimateTargetsForSpace(roomId).catchError((e) {
          if (kDebugMode) {
            debugPrint(
              '[DECK SERVICE] Failed to prefetch climate targets: $e',
            );
          }
          return;
        }),
        spacesService.fetchClimateState(roomId).catchError((e) {
          if (kDebugMode) {
            debugPrint(
              '[DECK SERVICE] Failed to prefetch climate state: $e',
            );
          }
          return null;
        }),
        // Prefetch sensor data
        spacesService.fetchSensorState(roomId).catchError((e) {
          if (kDebugMode) {
            debugPrint(
              '[DECK SERVICE] Failed to prefetch sensor state: $e',
            );
          }
          return null;
        }),
      ]).then((_) {
        if (kDebugMode) {
          debugPrint(
            '[DECK SERVICE] Domain data prefetch complete for roomId: $roomId',
          );
        }
      });
    } catch (e) {
      // Silently fail - prefetching is optional
      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Domain data prefetch failed: $e',
        );
      }
    }
  }

  @override
  void dispose() {
    _dashboardService.removeListener(_onDashboardChanged);
    super.dispose();
  }
}
