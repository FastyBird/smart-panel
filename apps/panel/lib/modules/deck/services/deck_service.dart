import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
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
  SpacesService? _spacesService;

  /// The current deck result.
  DeckResult? _deck;

  /// The current display configuration.
  DisplayModel? _display;

  /// Device categories for the current room (ROOM role only).
  List<DevicesModuleDeviceCategory> _deviceCategories = [];

  /// Number of devices with energy-related channels in the current room.
  int _energyDeviceCount = 0;

  /// Number of sensor readings reported by the backend for the current room.
  int _sensorReadingsCount = 0;

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

  /// Returns the number of devices with energy-related channels.
  int get energyDeviceCount => _energyDeviceCount;

  /// Returns the number of sensor readings reported by the backend.
  int get sensorReadingsCount => _sensorReadingsCount;

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

    // Extract localizations before any async gaps
    final localizations = context != null ? AppLocalizations.of(context) : null;

    // Build initial deck (may not have device categories yet for ROOM role)
    _buildDeck(localizations);
    _isInitialized = true;
    notifyListeners();

    // Listen for dashboard changes
    _dashboardService.addListener(_onDashboardChanged);

    // Listen for device changes (devices added/removed from space)
    _devicesService?.addListener(_onDevicesChanged);

    // Listen for spaces changes (sensor roles assigned/removed)
    try {
      if (locator.isRegistered<SpacesService>()) {
        _spacesService = locator<SpacesService>();
        _spacesService?.addListener(_onSpacesChanged);
      }
    } catch (_) {}

    // For ROOM role, fetch device categories and prefetch domain data asynchronously
    if (display.role == DisplayRole.room && display.roomId != null) {
      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Will fetch devices for roomId: ${display.roomId}',
        );
      }
      _fetchDeviceCategoriesAsync(display.roomId!, localizations);
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
    AppLocalizations? localizations,
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

      // Count devices with energy-related channels
      _energyDeviceCount = countEnergyDevices(devices);

      // Fetch sensor state to check if backend has sensor readings (roles assigned)
      try {
        if (locator.isRegistered<SpacesService>()) {
          final sensorState = await locator<SpacesService>().fetchSensorState(roomId);
          if (_display?.roomId == roomId) {
            _sensorReadingsCount = sensorState?.totalSensors ?? 0;
          }
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint('[DECK SERVICE] Failed to fetch sensor state for domain visibility: $e');
        }
      }

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Got ${_deviceCategories.length} categories: $_deviceCategories'
          '${_energyDeviceCount > 0 ? ', $_energyDeviceCount energy devices' : ''}'
          '${_sensorReadingsCount > 0 ? ', $_sensorReadingsCount sensor readings' : ''}',
        );
      }

      // Rebuild deck with device categories
      _buildDeck(localizations);
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

  /// Called when DevicesService notifies (device added/removed/changed).
  ///
  /// Re-reads device categories and energy device count from cache.
  /// Only rebuilds the deck if domain-relevant data actually changed.
  void _onDevicesChanged() {
    final roomId = _display?.roomId;
    if (roomId == null || _display?.role != DisplayRole.room) return;

    final devices = _devicesService?.getDevicesForRoom(roomId) ?? [];
    final newCategories = devices.map((d) => d.category).toList();
    final newEnergyCount = countEnergyDevices(devices);

    final categoriesChanged = !const ListEquality<DevicesModuleDeviceCategory>()
        .equals(newCategories, _deviceCategories);
    final energyChanged = newEnergyCount != _energyDeviceCount;

    if (categoriesChanged || energyChanged) {
      _deviceCategories = newCategories;
      _energyDeviceCount = newEnergyCount;

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Device change detected, rebuilding deck. '
          'categories: ${_deviceCategories.length}, '
          'energy: $_energyDeviceCount',
        );
      }

      _buildDeck(null);
      notifyListeners();
    }
  }

  /// Called when SpacesService notifies (sensor roles assigned/removed, etc.).
  ///
  /// Re-reads cached sensor state count. Only rebuilds if it changed.
  void _onSpacesChanged() {
    final roomId = _display?.roomId;
    if (roomId == null || _display?.role != DisplayRole.room) return;

    final sensorState = _spacesService?.getSensorState(roomId);
    final newCount = sensorState?.totalSensors ?? 0;

    if (newCount != _sensorReadingsCount) {
      _sensorReadingsCount = newCount;

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Sensor count changed to $_sensorReadingsCount, '
          'rebuilding deck.',
        );
      }

      _buildDeck(null);
      notifyListeners();
    }
  }

  void _buildDeck(AppLocalizations? localizations) {
    if (_display == null) return;

    // Get pages from dashboard service
    final pages = _dashboardService.pages.values.toList();

    // Check energy support from repository
    bool energySupported = false;
    try {
      if (locator.isRegistered<EnergyRepository>()) {
        energySupported = locator<EnergyRepository>().isSupported;
      }
    } catch (_) {}

    // Build the deck
    final input = DeckBuildInput(
      display: _display!,
      pages: pages,
      deviceCategories: _deviceCategories,
      energyDeviceCount: _energyDeviceCount,
      sensorReadingsCount: _sensorReadingsCount,
      roomViewTitle: localizations?.system_view_room ?? 'Room',
      masterViewTitle: localizations?.system_view_master ?? 'Home',
      entryViewTitle: localizations?.system_view_entry ?? 'Entry',
      lightsViewTitle: localizations?.domain_lights ?? 'Lights',
      climateViewTitle: localizations?.domain_climate ?? 'Climate',
      mediaViewTitle: localizations?.domain_media ?? 'Media',
      sensorsViewTitle: localizations?.domain_sensors ?? 'Sensors',
      energyViewTitle: localizations?.domain_energy ?? 'Energy',
      securityViewTitle: localizations?.entry_security ?? 'Security',
      energyScreenTitle: localizations?.domain_energy ?? 'Energy',
      energySupported: energySupported,
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
      // Extract localizations before any async gaps
      final localizations = context != null ? AppLocalizations.of(context) : null;

      // If room changed, reset device categories and refetch
      if (display.role == DisplayRole.room &&
          display.roomId != null &&
          display.roomId != oldRoomId) {
        _deviceCategories = [];
        _energyDeviceCount = 0;
        _sensorReadingsCount = 0;
        _buildDeck(localizations);
        _fetchDeviceCategoriesAsync(display.roomId!, localizations);
        _prefetchDomainData(display.roomId!);
      } else {
        _buildDeck(localizations);
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

  /// Prefetches domain data (lighting, climate, shading, media, sensors) for a room.
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

      // Try to get MediaActivityService for media prefetch
      MediaActivityService? mediaService;
      if (locator.isRegistered<MediaActivityService>()) {
        mediaService = locator<MediaActivityService>();
      }

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Prefetching domain data for roomId: $roomId',
        );
      }

      // Prefetch all domain data in parallel (non-blocking)
      // This ensures data is ready when domain views are opened
      final futures = <Future<void>>[
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
        // Prefetch shading data
        spacesService.fetchCoversTargetsForSpace(roomId).catchError((e) {
          if (kDebugMode) {
            debugPrint(
              '[DECK SERVICE] Failed to prefetch covers targets: $e',
            );
          }
          return;
        }),
        spacesService.fetchCoversState(roomId).catchError((e) {
          if (kDebugMode) {
            debugPrint(
              '[DECK SERVICE] Failed to prefetch covers state: $e',
            );
          }
          return null;
        }),
      ];

      // Prefetch media data if service is available
      if (mediaService != null) {
        futures.add(
          mediaService.fetchAllForSpace(roomId).catchError((e) {
            if (kDebugMode) {
              debugPrint(
                '[DECK SERVICE] Failed to prefetch media activity: $e',
              );
            }
          }),
        );
      }

      Future.wait(futures).then((_) {
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
    _devicesService?.removeListener(_onDevicesChanged);
    _spacesService?.removeListener(_onSpacesChanged);
    super.dispose();
  }
}
