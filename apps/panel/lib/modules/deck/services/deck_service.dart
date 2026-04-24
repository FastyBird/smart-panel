import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/export.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Service that manages the navigation deck.
///
/// The deck is built from display settings and dashboard pages,
/// combining system views with user-configured pages.
class DeckService extends ChangeNotifier {
  final DashboardService _dashboardService;
  final IntentsService _intentsService;
  final DevicesService? _devicesService;
  SpacesService? _spacesService;
  MediaActivityService? _mediaService;

  /// The current deck result.
  DeckResult? _deck;

  /// The current display configuration.
  DisplayModel? _display;

  /// Device categories for the current room (ROOM space type only).
  List<DevicesModuleDeviceCategory> _deviceCategories = [];

  /// Number of devices with energy-related channels in the current room.
  int _energyDeviceCount = 0;

  /// Number of sensor readings reported by the backend for the current room.
  int _sensorReadingsCount = 0;

  /// Configuration counts for domain visibility (null = not yet loaded).
  int? _lightTargetsCount;
  int? _climateTargetsCount;
  int? _coversTargetsCount;
  int? _mediaBindingsCount;

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

  /// Returns true if the deck has been initialized.
  bool get isInitialized => _isInitialized;

  /// Returns all deck items.
  List<DeckItem> get items => _deck?.items ?? [];

  /// Returns the start index for initial navigation.
  int get startIndex => _deck?.startIndex ?? 0;

  /// Returns the start item.
  DeckItem? get startItem => _deck?.startItem;

  /// Returns device categories for the current room (ROOM space type only).
  List<DevicesModuleDeviceCategory> get deviceCategories => _deviceCategories;

  /// Returns the number of devices with energy-related channels.
  int get energyDeviceCount => _energyDeviceCount;

  /// Returns the number of sensor readings reported by the backend.
  int get sensorReadingsCount => _sensorReadingsCount;

  /// Returns true if device data is currently being loaded.
  bool get isLoadingDevices => _isLoadingDevices;

  /// Returns the space the display is currently assigned to, or null if
  /// the display has no space or the spaces service isn't available yet.
  SpaceView? get _assignedSpace {
    final spaceId = _display?.spaceId;
    if (spaceId == null) return null;
    return _spacesService?.getSpace(spaceId);
  }

  bool get _isAssignedToRoom => _assignedSpace?.isRoom ?? false;

  /// Initializes the deck with display settings.
  ///
  /// Call this during app hydration after display settings are loaded.
  void initialize(DisplayModel display) {
    _display = display;

    if (kDebugMode) {
      debugPrint(
        '[DECK SERVICE] Initialize called. spaceId: ${display.spaceId}',
      );
    }

    // Listen for spaces changes (sensor roles assigned/removed, targets changed)
    // — done BEFORE initial buildDeck so the assigned space (if already cached)
    // can participate in the first render.
    try {
      if (locator.isRegistered<SpacesService>()) {
        _spacesService = locator<SpacesService>();
        _spacesService?.addListener(_onSpacesChanged);
      }
    } catch (_) {}

    // Build initial deck
    if (_buildDeck()) {
      _isInitialized = true;
    }
    notifyListeners();

    // Listen for dashboard changes
    _dashboardService.addListener(_onDashboardChanged);

    // Listen for device changes (devices added/removed from space)
    _devicesService?.addListener(_onDevicesChanged);

    // Listen for media activity changes (bindings added/removed)
    try {
      if (locator.isRegistered<MediaActivityService>()) {
        _mediaService = locator<MediaActivityService>();
        _mediaService?.addListener(_onMediaChanged);
      }
    } catch (_) {}

    // For any assigned space, fetch device categories and prefetch domain
    // data asynchronously. We intentionally don't gate on "space is a room"
    // here: at `initialize()` time the SpacesService cache may still be cold,
    // so `_assignedSpace` can be null even for room displays. The prefetch
    // calls are safe on non-room spaces — the backend just returns empty
    // results, which the deck builder handles as "no domain views".
    final spaceId = display.spaceId;
    if (spaceId != null) {
      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Will fetch devices for spaceId: $spaceId',
        );
      }
      _fetchDeviceCategoriesAsync(spaceId);
      _prefetchDomainData(spaceId);
    } else if (kDebugMode) {
      debugPrint(
        '[DECK SERVICE] NOT fetching domain data — display has no space assignment',
      );
    }
  }

  /// Fetches device categories for a room and rebuilds the deck.
  Future<void> _fetchDeviceCategoriesAsync(String roomId) async {
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
        debugPrint('[DECK SERVICE] Fetching devices for spaceId: $roomId');
      }

      // Get devices for the room from DevicesService
      final devices = _devicesService.getDevicesForRoom(roomId);

      // Verify the room hasn't changed during the operation
      // to avoid race conditions when switching rooms quickly
      if (_display?.spaceId != roomId) {
        if (kDebugMode) {
          debugPrint(
            '[DECK SERVICE] Space changed during fetch '
            '(was: $roomId, now: ${_display?.spaceId}), discarding result',
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
          if (_display?.spaceId == roomId) {
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
      _buildDeck();
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
    if (_display != null) {
      _buildDeck();
      notifyListeners();
    }
  }

  /// Called when DevicesService notifies (device added/removed/changed).
  ///
  /// Re-reads device categories and energy device count from cache.
  /// Only rebuilds the deck if domain-relevant data actually changed.
  void _onDevicesChanged() {
    final spaceId = _display?.spaceId;
    if (spaceId == null || !_isAssignedToRoom) return;

    final devices = _devicesService?.getDevicesForRoom(spaceId) ?? [];
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

      _buildDeck();
      notifyListeners();
    }
  }

  /// Called when SpacesService notifies (sensor roles, targets changed, etc.).
  ///
  /// Re-reads cached sensor state and target counts. Only rebuilds if changed.
  void _onSpacesChanged() {
    final spaceId = _display?.spaceId;
    if (spaceId == null || !_isAssignedToRoom) return;

    final sensorState = _spacesService?.getSensorState(spaceId);
    final newSensorCount = sensorState?.totalSensors ?? 0;

    final newLightTargets = _countConfiguredLights(spaceId);
    final newClimateTargets = _countConfiguredClimate(spaceId);
    final newCoversTargets = _countConfiguredCovers(spaceId);

    final changed = newSensorCount != _sensorReadingsCount ||
        newLightTargets != _lightTargetsCount ||
        newClimateTargets != _climateTargetsCount ||
        newCoversTargets != _coversTargetsCount;

    if (changed) {
      _sensorReadingsCount = newSensorCount;
      _lightTargetsCount = newLightTargets;
      _climateTargetsCount = newClimateTargets;
      _coversTargetsCount = newCoversTargets;

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Spaces data changed '
          '(sensors: $_sensorReadingsCount, lights: $_lightTargetsCount, '
          'climate: $_climateTargetsCount, covers: $_coversTargetsCount), '
          'rebuilding deck.',
        );
      }

      _buildDeck();
      notifyListeners();
    }
  }

  /// Called when MediaActivityService notifies (bindings added/removed).
  ///
  /// Re-reads cached bindings count. Only rebuilds if changed.
  void _onMediaChanged() {
    final spaceId = _display?.spaceId;
    if (spaceId == null || !_isAssignedToRoom) return;

    final newMediaBindings = _mediaService?.getBindings(spaceId).length;

    if (newMediaBindings != _mediaBindingsCount) {
      _mediaBindingsCount = newMediaBindings;

      if (kDebugMode) {
        debugPrint(
          '[DECK SERVICE] Media bindings changed to $_mediaBindingsCount, '
          'rebuilding deck.',
        );
      }

      _buildDeck();
      notifyListeners();
    }
  }

  /// Resolves the current [AppLocalizations] from the active app locale.
  ///
  /// Uses [Intl.defaultLocale] which is synced by [MaterialApp]'s
  /// [localeResolutionCallback]. Falls back to English if not set.
  AppLocalizations _resolveLocalizations() {
    final tag = Intl.defaultLocale;
    if (tag != null) {
      try {
        final parts = tag.split('-');
        return lookupAppLocalizations(
          Locale(parts[0], parts.length > 1 ? parts[1] : null),
        );
      } catch (_) {}
    }
    return lookupAppLocalizations(const Locale('en'));
  }

  /// Builds the deck from current state.
  ///
  /// Returns `true` if the deck was successfully built.
  bool _buildDeck() {
    if (_display == null) return false;

    final localizations = _resolveLocalizations();

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
      space: _assignedSpace,
      pages: pages,
      deviceCategories: _deviceCategories,
      energyDeviceCount: _energyDeviceCount,
      sensorReadingsCount: _sensorReadingsCount,
      lightTargetsCount: _lightTargetsCount,
      climateTargetsCount: _climateTargetsCount,
      coversTargetsCount: _coversTargetsCount,
      mediaBindingsCount: _mediaBindingsCount,
      roomViewTitle: localizations.system_view_room,
      masterViewTitle: localizations.system_view_master,
      entryViewTitle: localizations.system_view_entry,
      lightsViewTitle: localizations.domain_lights,
      climateViewTitle: localizations.domain_climate,
      mediaViewTitle: localizations.domain_media,
      sensorsViewTitle: localizations.domain_sensors,
      energyViewTitle: localizations.domain_energy,
      securityViewTitle: localizations.entry_security,
      energyScreenTitle: localizations.domain_energy,
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

    return true;
  }

  /// Updates the display settings and rebuilds the deck.
  void updateDisplay(DisplayModel display) {
    final oldSpaceId = _display?.spaceId;
    _display = display;

    final spaceId = display.spaceId;
    // If the assigned space changed, reset cached domain data and refetch.
    // Non-room spaces just return empty results — no room-type gate here,
    // since the SpacesService cache may be cold when the display first
    // flips to a new space (see initialize() for the same rationale).
    if (spaceId != null && spaceId != oldSpaceId) {
      _deviceCategories = [];
      _energyDeviceCount = 0;
      _sensorReadingsCount = 0;
      _lightTargetsCount = null;
      _climateTargetsCount = null;
      _coversTargetsCount = null;
      _mediaBindingsCount = null;
      _buildDeck();
      _fetchDeviceCategoriesAsync(spaceId);
      _prefetchDomainData(spaceId);
    } else {
      _buildDeck();
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
    if (_display == null || _display!.spaceId == null) return -1;
    final viewKey = 'domain:${_display!.spaceId}:${domain.name}';
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

  /// Counts light targets that have a valid role assigned.
  /// Matches the lights domain view's "not configured" condition.
  int? _countConfiguredLights(String roomId) {
    final targets = _spacesService?.getLightTargetsForSpace(roomId);
    if (targets == null) return null;
    return targets.where((t) {
      final role = t.role;
      return role != null &&
          role != LightTargetRole.other &&
          role != LightTargetRole.hidden;
    }).length;
  }

  /// Counts climate targets that have an actuator role assigned.
  /// Matches the climate domain view's "not configured" condition.
  int? _countConfiguredClimate(String roomId) {
    final targets = _spacesService?.getClimateTargetsForSpace(roomId);
    if (targets == null) return null;
    return targets.where((t) {
      final role = t.role;
      return role != null && role.isActuator;
    }).length;
  }

  /// Counts covers targets that have a valid role assigned.
  /// Matches the shading domain view's "not configured" condition.
  int? _countConfiguredCovers(String roomId) {
    final targets = _spacesService?.getCoversTargetsForSpace(roomId);
    if (targets == null) return null;
    return targets.where((t) {
      final role = t.role;
      return role != null && role != CoversTargetRole.hidden;
    }).length;
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
          '[DECK SERVICE] Prefetching domain data for spaceId: $roomId',
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
            '[DECK SERVICE] Domain data prefetch complete for spaceId: $roomId',
          );
        }

        // Read config counts from cache now that all fetches are done.
        // SpacesService uses comparison-based notifications — if the cache was
        // empty before fetch and empty after (unconfigured room), it won't
        // notify listeners. So we must proactively read the counts here.
        if (_display?.spaceId != roomId) return;

        final newLightTargets = _countConfiguredLights(roomId);
        final newClimateTargets = _countConfiguredClimate(roomId);
        final newCoversTargets = _countConfiguredCovers(roomId);
        final newMediaBindings = mediaService?.getBindings(roomId).length;

        final changed = newLightTargets != _lightTargetsCount ||
            newClimateTargets != _climateTargetsCount ||
            newCoversTargets != _coversTargetsCount ||
            newMediaBindings != _mediaBindingsCount;

        if (changed) {
          _lightTargetsCount = newLightTargets;
          _climateTargetsCount = newClimateTargets;
          _coversTargetsCount = newCoversTargets;
          _mediaBindingsCount = newMediaBindings;

          if (kDebugMode) {
            debugPrint(
              '[DECK SERVICE] Config counts updated after prefetch '
              '(lights: $_lightTargetsCount, climate: $_climateTargetsCount, '
              'covers: $_coversTargetsCount, media: $_mediaBindingsCount), '
              'rebuilding deck.',
            );
          }

          _buildDeck();
          notifyListeners();
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
    _mediaService?.removeListener(_onMediaChanged);
    super.dispose();
  }
}
