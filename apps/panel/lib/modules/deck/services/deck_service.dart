import 'package:fastybird_smart_panel/api/models/devices_module_data_device_category.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Service that manages the navigation deck.
///
/// The deck is built from display settings and dashboard pages,
/// combining system views with user-configured pages.
class DeckService extends ChangeNotifier {
  final DashboardService _dashboardService;
  final IntentsService _intentsService;
  final SpacesRepository? _spacesRepository;

  /// The current deck result.
  DeckResult? _deck;

  /// The current display configuration.
  DisplayModel? _display;

  /// Device categories for the current room (ROOM role only).
  List<DeviceCategory> _deviceCategories = [];

  /// Configuration validation error.
  String? _configError;

  /// Whether the deck has been initialized.
  bool _isInitialized = false;

  /// Whether device data is currently being loaded.
  bool _isLoadingDevices = false;

  DeckService({
    required DashboardService dashboardService,
    required IntentsService intentsService,
    SpacesRepository? spacesRepository,
  })  : _dashboardService = dashboardService,
        _intentsService = intentsService,
        _spacesRepository = spacesRepository;

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
  List<DeviceCategory> get deviceCategories => _deviceCategories;

  /// Returns true if device data is currently being loaded.
  bool get isLoadingDevices => _isLoadingDevices;

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

    // Build initial deck (may not have device categories yet for ROOM role)
    _buildDeck(context);
    _isInitialized = true;
    notifyListeners();

    // Listen for dashboard changes
    _dashboardService.addListener(_onDashboardChanged);

    // For ROOM role, fetch device categories asynchronously
    if (display.role == DisplayRole.room && display.roomId != null) {
      _fetchDeviceCategoriesAsync(display.roomId!, context);
    }
  }

  /// Fetches device categories for a room and rebuilds the deck.
  Future<void> _fetchDeviceCategoriesAsync(
    String roomId,
    BuildContext? context,
  ) async {
    if (_spacesRepository == null) {
      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] SpacesRepository not available, '
          'cannot fetch device categories',
        );
      }
      return;
    }

    _isLoadingDevices = true;
    notifyListeners();

    try {
      final response = await _spacesRepository.apiClient
          .getSpacesModuleSpaceDevices(id: roomId);
      final devices = response.data.data;

      // Map API device categories to local DeviceCategory
      _deviceCategories = devices
          .map((d) => _mapApiDeviceCategory(d.category))
          .toList();

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Fetched ${_deviceCategories.length} devices for room $roomId',
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
      notifyListeners();
    }
  }

  /// Maps API device category enum to local DeviceCategory.
  DeviceCategory _mapApiDeviceCategory(DevicesModuleDataDeviceCategory category) {
    switch (category) {
      case DevicesModuleDataDeviceCategory.generic:
        return DeviceCategory.generic;
      case DevicesModuleDataDeviceCategory.airConditioner:
        return DeviceCategory.airConditioner;
      case DevicesModuleDataDeviceCategory.airDehumidifier:
        return DeviceCategory.airDehumidifier;
      case DevicesModuleDataDeviceCategory.airHumidifier:
        return DeviceCategory.airHumidifier;
      case DevicesModuleDataDeviceCategory.airPurifier:
        return DeviceCategory.airPurifier;
      case DevicesModuleDataDeviceCategory.alarm:
        return DeviceCategory.alarm;
      case DevicesModuleDataDeviceCategory.camera:
        return DeviceCategory.camera;
      case DevicesModuleDataDeviceCategory.door:
        return DeviceCategory.door;
      case DevicesModuleDataDeviceCategory.doorbell:
        return DeviceCategory.doorbell;
      case DevicesModuleDataDeviceCategory.fan:
        return DeviceCategory.fan;
      case DevicesModuleDataDeviceCategory.heater:
        return DeviceCategory.heater;
      case DevicesModuleDataDeviceCategory.lighting:
        return DeviceCategory.lighting;
      case DevicesModuleDataDeviceCategory.lock:
        return DeviceCategory.lock;
      case DevicesModuleDataDeviceCategory.media:
        return DeviceCategory.media;
      case DevicesModuleDataDeviceCategory.outlet:
        return DeviceCategory.outlet;
      case DevicesModuleDataDeviceCategory.pump:
        return DeviceCategory.pump;
      case DevicesModuleDataDeviceCategory.robotVacuum:
        return DeviceCategory.robotVacuum;
      case DevicesModuleDataDeviceCategory.sensor:
        return DeviceCategory.sensor;
      case DevicesModuleDataDeviceCategory.speaker:
        return DeviceCategory.speaker;
      case DevicesModuleDataDeviceCategory.sprinkler:
        return DeviceCategory.sprinkler;
      case DevicesModuleDataDeviceCategory.switcher:
        return DeviceCategory.switcher;
      case DevicesModuleDataDeviceCategory.television:
        return DeviceCategory.television;
      case DevicesModuleDataDeviceCategory.thermostat:
        return DeviceCategory.thermostat;
      case DevicesModuleDataDeviceCategory.valve:
        return DeviceCategory.valve;
      case DevicesModuleDataDeviceCategory.windowCovering:
        return DeviceCategory.windowCovering;
      case DevicesModuleDataDeviceCategory.$unknown:
        return DeviceCategory.generic;
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

  @override
  void dispose() {
    _dashboardService.removeListener(_onDashboardChanged);
    super.dispose();
  }
}
