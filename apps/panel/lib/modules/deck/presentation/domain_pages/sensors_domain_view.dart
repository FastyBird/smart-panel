// Sensors domain view: room-level list of sensors for a single space/room.
//
// **Purpose:** One screen per room showing sensor readings (temperature,
// humidity, air quality, motion, safety, light, energy). Users can filter by
// category, see summary cards (avg temp/humidity/illuminance), and open
// device detail from a sensor tile or from an alert banner.
//
// **Data flow:**
// - [SpaceStateRepository] provides [SensorStateModel] for the room (readings,
//   environment aggregates). Data is prefetched by [DeckService]; this page
//   loads from cache in [_loadSensorData].
// - [DevicesService] provides device online status. [SpacesService] provides
//   room name. [DeckService] / [EventBus] for navigation home.
// - Local state: _sensors (list of [SensorData]), _selectedCategory,
//   _isLoading. A periodic timer refreshes the UI so freshness indicators
//   (fresh/recent/stale) update over time.
//
// **Key concepts:**
// - [SensorData] is the view model: id, value, unit, status (normal/warning/
//   alert/offline), trend, freshness, category. Status is derived from
//   safety alerts and motion activity.
// - Portrait: optional alert banner, summary cards (when "All"), category
//   selector, sensor grid. Landscape: summary row + grid + vertical category
//   selector.
// - Tapping a sensor opens [DeviceDetailPage] for its device.
//
// **File structure (for humans and AI):**
// Search for the exact section header (e.g. "// CONSTANTS", "// DATA MODELS",
// "// LIFECYCLE") to jump to that part of the file. Sections appear in this order:
//
// - **CONSTANTS** — [_SensorsViewConstants]: freshness refresh interval.
// - **DATA MODELS** — [SensorStatus], [TrendDirection], [SensorData], [_parseTrend].
// - **SENSORS DOMAIN VIEW PAGE** — [SensorsDomainViewPage] and state: HELPERS,
//   LIFECYCLE, LISTENERS, DATA LOADING, NAVIGATION, FILTERING & CATEGORIES, BUILD.
// - **EMPTY STATE** — no sensors message.
// - **HEADER** — title, subtitle (alert/health counts), home button.
// - **CATEGORY SELECTOR** — portrait and landscape mode selectors.
// - **LAYOUTS** — portrait and landscape column layout.
// - **ALERT BANNER** — single alert CTA when any sensor is in alert.
// - **SUMMARY CARDS** — environment averages (temp, humidity, illuminance/pressure).
// - **SENSOR GRID** — section title + grid of sensor cards; card builder, freshness dot, trend icon.
// - **SENSOR DETAIL** — navigate to device detail.

import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_banner.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/domain_data_loader.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/deck/types/sensor_category.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_freshness.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';

// =============================================================================
// CONSTANTS
// =============================================================================
// Used for periodic UI refresh so freshness indicators (fresh/recent/stale) update.

class _SensorsViewConstants {
  /// Interval for refreshing the page so [SensorFreshness] and dot colors update.
  static const Duration freshnessRefreshInterval = Duration(seconds: 30);
}

// =============================================================================
// DATA MODELS
// =============================================================================
// Local enums and view model for sensor tiles. [SensorData] is built from
// [SpaceStateRepository] / [SensorStateModel] in [_loadSensorData].

/// Display status for a sensor: normal, warning (e.g. motion active), alert (safety), or offline.
enum SensorStatus {
  normal,
  warning,
  alert,
  offline,
}

/// Trend direction for numeric readings: rising, falling, or stable.
enum TrendDirection {
  up,
  down,
  stable,
}

/// View model for a single sensor tile: identity, value, unit, status, trend, freshness, category.
/// Built from [SensorReadingModel] and [SensorStateModel] in [_loadSensorData].
class SensorData {
  final String id;
  final String deviceId;
  final String? propertyId;
  final String name;
  final String location;
  final SensorCategory category;
  final String value;
  final String unit;
  final SensorStatus status;
  final TrendDirection trend;
  final DateTime lastUpdated;
  final bool isBinary;
  final DevicesModuleChannelCategory? channelCategory;
  final List<SensorAdditionalReadingModel> additionalReadings;
  final bool deviceOnline;

  const SensorData({
    required this.id,
    required this.deviceId,
    this.propertyId,
    required this.name,
    required this.location,
    required this.category,
    required this.value,
    required this.unit,
    this.status = SensorStatus.normal,
    this.trend = TrendDirection.stable,
    required this.lastUpdated,
    this.isBinary = false,
    this.channelCategory,
    this.additionalReadings = const [],
    this.deviceOnline = true,
  });

  /// Data age freshness (fresh/recent/stale) — purely time-based
  SensorFreshness get freshness {
    if (value == '--') return SensorFreshness.stale;
    return SensorFreshnessUtils.evaluate(lastUpdated, category);
  }

  bool get isStaleOrOffline =>
      isOffline || freshness == SensorFreshness.stale;

  /// Offline means the parent device is not connected
  bool get isOffline => !deviceOnline;

  IconData get icon {
    switch (category) {
      case SensorCategory.temperature:
        return MdiIcons.thermometer;
      case SensorCategory.humidity:
        return MdiIcons.waterPercent;
      case SensorCategory.airQuality:
        return MdiIcons.airFilter;
      case SensorCategory.motion:
        return MdiIcons.motionSensor;
      case SensorCategory.safety:
        return MdiIcons.shieldCheck;
      case SensorCategory.light:
        return MdiIcons.weatherSunny;
      case SensorCategory.energy:
        return MdiIcons.flash;
    }
  }
}

/// Parses API trend string ('rising'/'falling'/'stable') into [TrendDirection].
TrendDirection _parseTrend(String? trend) {
  switch (trend) {
    case 'rising':
      return TrendDirection.up;
    case 'falling':
      return TrendDirection.down;
    case 'stable':
      return TrendDirection.stable;
    default:
      return TrendDirection.stable;
  }
}

// =============================================================================
// SENSORS DOMAIN VIEW PAGE
// =============================================================================
// Stateful page for one room's sensors. State: [_sensors], [_selectedCategory],
// [_isLoading]. Listens to [SpacesService], [SpaceStateRepository], [DevicesService];
// periodic timer refreshes UI for freshness indicators.

class SensorsDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const SensorsDomainViewPage({super.key, required this.viewItem});

  @override
  State<SensorsDomainViewPage> createState() => _SensorsDomainViewPageState();
}

class _SensorsDomainViewPageState extends State<SensorsDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();

  SpacesService? _spacesService;
  SpaceStateRepository? _spaceStateRepository;
  DevicesService? _devicesService;
  EventBus? _eventBus;
  BottomNavModeNotifier? _bottomNavModeNotifier;
  StreamSubscription<DeckPageActivatedEvent>? _pageActivatedSubscription;
  bool _isActivePage = false;

  bool _isLoading = true;
  bool _hasError = false;
  SensorCategory? _selectedCategory;
  Timer? _freshnessTimer;

  List<SensorData> _sensors = [];

  String get _roomId => widget.viewItem.roomId;

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  /// Resolves service from [locator]; optional [onSuccess] adds listener. Returns null on failure.
  T? _tryLocator<T extends Object>(String debugLabel, {void Function(T)? onSuccess}) {
    try {
      final s = locator<T>();
      onSuccess?.call(s);
      return s;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorsDomainViewPage] Failed to get $debugLabel: $e');
      }
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------
  // initState: resolve services, register listeners, load data, start freshness timer.
  // dispose: cancel timer and remove listeners.

  @override
  void initState() {
    super.initState();

    _spacesService = _tryLocator<SpacesService>('SpacesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _spaceStateRepository = _tryLocator<SpaceStateRepository>('SpaceStateRepository', onSuccess: (s) => s.addListener(_onDataChanged));
    _devicesService = _tryLocator<DevicesService>('DevicesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _eventBus = _tryLocator<EventBus>('EventBus');
    _bottomNavModeNotifier = _tryLocator<BottomNavModeNotifier>('BottomNavModeNotifier');

    // Subscribe to page activation events for bottom nav mode registration
    _pageActivatedSubscription = _eventBus?.on<DeckPageActivatedEvent>().listen(_onPageActivated);

    _fetchSensorData();

    _freshnessTimer = Timer.periodic(
      _SensorsViewConstants.freshnessRefreshInterval,
      (_) {
        if (mounted) setState(() {});
      },
    );
  }

  /// Fetches sensor state if not cached, then loads data.
  Future<void> _fetchSensorData() async {
    try {
      // Check if data is already available (cached) before fetching
      final existingState = _spaceStateRepository?.getSensorState(_roomId);

      // Only fetch if data is not already available
      if (existingState == null) {
        await _spacesService?.fetchSensorState(_roomId);
      }

      _loadSensorData();
      if (mounted) {
        setState(() {
          _hasError = false;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorsDomainViewPage] Failed to fetch sensor data: $e');
      }
      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = true;
        });
      }
    }
  }

  /// Retry loading data after an error.
  Future<void> _retryLoad() async {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });
    await _fetchSensorData();
  }

  @override
  void dispose() {
    _pageActivatedSubscription?.cancel();
    _freshnessTimer?.cancel();
    _spacesService?.removeListener(_onDataChanged);
    _spaceStateRepository?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  // --------------------------------------------------------------------------
  // BOTTOM NAV MODE REGISTRATION
  // --------------------------------------------------------------------------

  void _onPageActivated(DeckPageActivatedEvent event) {
    if (!mounted) return;
    _isActivePage = event.itemId == widget.viewItem.id;

    if (_isActivePage) {
      _registerModeConfig();
    }
  }

  void _registerModeConfig() {
    if (!_isActivePage || _isLoading) return;

    final modeOptions = _getCategoryModeOptions();
    if (modeOptions.isEmpty) return;

    final currentOption = modeOptions.firstWhere(
      (o) => o.value == _selectedCategory,
      orElse: () => modeOptions.first,
    );

    _bottomNavModeNotifier?.setConfig(BottomNavModeConfig(
      icon: currentOption.icon,
      label: currentOption.label,
      color: currentOption.color ?? ThemeColors.neutral,
      popupBuilder: _buildModePopupContent,
    ));
  }

  Widget _buildModePopupContent(BuildContext context, VoidCallback dismiss) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modes = _getCategoryModeOptions();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: AppSpacings.pSm),
          child: Text(
            'FILTER',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.0,
              color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
            ),
          ),
        ),
        for (final mode in modes)
          _buildPopupModeItem(
            context,
            mode: mode,
            isActive: _selectedCategory == mode.value,
            onTap: () {
              setState(() => _selectedCategory = mode.value);
              _registerModeConfig();
              dismiss();
            },
          ),
      ],
    );
  }

  Widget _buildPopupModeItem(
    BuildContext context, {
    required ModeOption<SensorCategory?> mode,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      mode.color ?? ThemeColors.neutral,
    );

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: EdgeInsets.symmetric(
          vertical: AppSpacings.pMd,
          horizontal: AppSpacings.pMd,
        ),
        margin: EdgeInsets.only(bottom: AppSpacings.pXs),
        decoration: BoxDecoration(
          color: isActive ? colorFamily.light9 : Colors.transparent,
          borderRadius: BorderRadius.circular(AppBorderRadius.small),
          border: isActive
              ? Border.all(color: colorFamily.light7, width: AppSpacings.scale(1))
              : null,
        ),
        child: Row(
          spacing: AppSpacings.pMd,
          children: [
            Icon(
              mode.icon,
              color: isActive ? colorFamily.base : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
              size: AppSpacings.scale(20),
            ),
            Expanded(
              child: Text(
                mode.label,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                  color: isActive ? colorFamily.base : (isDark ? AppTextColorDark.regular : AppTextColorLight.regular),
                ),
              ),
            ),
            if (isActive)
              Icon(Icons.check, color: colorFamily.base, size: AppSpacings.scale(16)),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LISTENERS
  // --------------------------------------------------------------------------

  void _onDataChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _loadSensorData();
        _registerModeConfig();
      }
    });
  }

  // --------------------------------------------------------------------------
  // DATA LOADING
  // --------------------------------------------------------------------------
  // [_loadSensorData] transforms [SpaceStateRepository] readings into [SensorData].
  // Helpers: [_mapChannelCategory], [_determineSensorStatus], [_formatSensorValue],
  // [_isDiscreteProperty]; binary/format helpers below.

  /// Maps API channel category string to [SensorCategory] for grouping and display.
  SensorCategory _mapChannelCategory(String channelCategory) {
    switch (channelCategory.toLowerCase()) {
      case 'temperature':
        return SensorCategory.temperature;
      case 'humidity':
        return SensorCategory.humidity;
      case 'pressure':
        return SensorCategory.temperature; // Group with temperature for now
      case 'illuminance':
        return SensorCategory.light;
      case 'smoke':
      case 'gas':
      case 'leak':
      case 'carbon_monoxide':
        return SensorCategory.safety;
      case 'motion':
      case 'occupancy':
      case 'contact':
        return SensorCategory.motion;
      case 'air_quality':
      case 'air_particulate':
      case 'carbon_dioxide':
      case 'nitrogen_dioxide':
      case 'ozone':
      case 'sulphur_dioxide':
      case 'volatile_organic_compounds':
        return SensorCategory.airQuality;
      case 'electrical_power':
      case 'electrical_energy':
      case 'electrical_generation':
        return SensorCategory.energy;
      default:
        return SensorCategory.temperature; // Default fallback
    }
  }

  /// Derives [SensorStatus] from safety alerts and motion activity (warning when motion active).
  SensorStatus _determineSensorStatus(
    SensorReadingModel reading,
    SensorStateModel state,
  ) {
    // Check if this sensor has a triggered safety alert
    final hasAlert = state.safetyAlerts.any(
      (alert) => alert.channelId == reading.channelId && alert.triggered,
    );

    if (hasAlert) {
      return SensorStatus.alert;
    }

    // Motion sensors show warning when active
    final category = _mapChannelCategory(reading.channelCategory);
    if (category == SensorCategory.motion) {
      final isActive = reading.value == true ||
          reading.value == 'true' ||
          reading.value == '1' ||
          reading.value == 1;
      if (isActive) {
        return SensorStatus.warning;
      }
    }

    return SensorStatus.normal;
  }


  /// Format sensor value for display
  String _formatSensorValue(dynamic value, String channelCategory) {
    return SensorUtils.formatRawValue(
      value,
      DevicesModuleChannelCategory.fromJson(channelCategory),
    );
  }


  /// True when the channel property is bool or enum (used for binary/state display).
  bool _isDiscreteProperty(String? propertyId) {
    if (propertyId == null) return false;
    try {
      final repo = locator<ChannelPropertiesRepository>();
      final property = repo.getItem(propertyId);
      if (property == null) return false;
      return property.dataType.json == 'bool' || property.dataType.json == 'enum';
    } catch (_) {
      return false;
    }
  }

  /// Loads sensor list from [SpaceStateRepository] for [_roomId]; transforms
  /// readings into [SensorData] and updates [_sensors] and [_isLoading].
  void _loadSensorData() {
    final roomName = _spacesService?.getSpace(_roomId)?.name ?? 'Room';
    final sensorState = _spaceStateRepository?.getSensorState(_roomId);

    if (kDebugMode) {
      debugPrint('[SensorsDomainViewPage] Loading sensor data: sensorState=${sensorState != null}, hasSensors=${sensorState?.hasSensors}, totalSensors=${sensorState?.totalSensors}, readings=${sensorState?.readings.length}');
    }

    if (sensorState == null || !sensorState.hasSensors) {
      if (kDebugMode) {
        debugPrint('[SensorsDomainViewPage] No sensor data available');
      }
      _sensors = [];
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        _registerModeConfig();
      }
      return;
    }

    final List<SensorData> sensors = [];
    for (final roleReadings in sensorState.readings) {
      for (final reading in roleReadings.readings) {
        final category = _mapChannelCategory(reading.channelCategory);
        final status = _determineSensorStatus(reading, sensorState);
        final value = _formatSensorValue(reading.value, reading.channelCategory);

        // Strip room name prefix from device name (we're already on the room page)
        var deviceLabel = reading.deviceName;
        if (deviceLabel.toLowerCase().startsWith(roomName.toLowerCase())) {
          deviceLabel = deviceLabel.substring(roomName.length).trim();
          // Remove leading dash or separator if present
          if (deviceLabel.startsWith('-') || deviceLabel.startsWith('–')) {
            deviceLabel = deviceLabel.substring(1).trim();
          }
        }
        if (deviceLabel.isEmpty) {
          deviceLabel = reading.deviceName;
        }

        final deviceOnline = _devicesService?.getDevice(reading.deviceId)?.isOnline ?? false;

        sensors.add(SensorData(
          id: reading.channelId,
          deviceId: reading.deviceId,
          propertyId: reading.propertyId,
          name: reading.channelName,
          location: deviceLabel,
          category: category,
          value: value,
          unit: reading.unit ?? '',
          status: status,
          trend: _parseTrend(reading.trend),
          lastUpdated: reading.updatedAt ?? DateTime.now(),
          isBinary: _isDiscreteProperty(reading.propertyId),
          channelCategory: DevicesModuleChannelCategory.fromJson(reading.channelCategory),
          additionalReadings: reading.additionalReadings,
          deviceOnline: deviceOnline,
        ));
      }
    }

    _sensors = sensors;

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
      _registerModeConfig();
    }
  }

  /// Aggregated environment data for summary cards (avg temp, humidity, illuminance, pressure).
  SensorEnvironmentModel? get _environment {
    return _spaceStateRepository?.getSensorState(_roomId)?.environment;
  }

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------



  // --------------------------------------------------------------------------
  // FILTERING & CATEGORIES
  // --------------------------------------------------------------------------
  // Category display (colors, labels, icons) and filtered list for mode selector + grid.

  List<SensorData> get _filteredSensors {
    if (_selectedCategory == null) return _sensors;
    return _sensors.where((s) => s.category == _selectedCategory).toList();
  }

  int _countForCategory(SensorCategory? category) {
    if (category == null) return _sensors.length;
    return _sensors.where((s) => s.category == category).length;
  }

  bool get _hasAlerts => _sensors.any((s) => s.status == SensorStatus.alert);

  Color _getCategoryColor(BuildContext context, SensorCategory category) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (category) {
      case SensorCategory.temperature:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case SensorCategory.humidity:
        return isDark ? AppColorsDark.success : AppColorsLight.success;
      case SensorCategory.airQuality:
        return isDark ? AppColorsDark.success : AppColorsLight.success;
      case SensorCategory.motion:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case SensorCategory.safety:
        return isDark ? AppColorsDark.danger : AppColorsLight.danger;
      case SensorCategory.light:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case SensorCategory.energy:
        return isDark ? AppColorsDark.primary : AppColorsLight.primary;
    }
  }

  String _getCategoryLabel(AppLocalizations l, SensorCategory category) {
    switch (category) {
      case SensorCategory.temperature:
        return l.sensor_category_temperature;
      case SensorCategory.humidity:
        return l.sensor_category_humidity;
      case SensorCategory.airQuality:
        return l.sensor_category_air_quality;
      case SensorCategory.motion:
        return l.sensor_category_motion;
      case SensorCategory.safety:
        return l.sensor_category_safety;
      case SensorCategory.light:
        return l.sensor_category_light;
      case SensorCategory.energy:
        return l.sensor_category_energy;
    }
  }

  IconData _getCategoryIcon(SensorCategory category) {
    switch (category) {
      case SensorCategory.temperature:
        return MdiIcons.thermometer;
      case SensorCategory.humidity:
        return MdiIcons.waterPercent;
      case SensorCategory.airQuality:
        return MdiIcons.airFilter;
      case SensorCategory.motion:
        return MdiIcons.motionSensor;
      case SensorCategory.safety:
        return MdiIcons.shieldCheck;
      case SensorCategory.light:
        return MdiIcons.weatherSunny;
      case SensorCategory.energy:
        return MdiIcons.flash;
    }
  }

  ThemeColors _getCategoryModeColor(SensorCategory category) {
    switch (category) {
      case SensorCategory.temperature:
        return ThemeColors.info;
      case SensorCategory.humidity:
        return ThemeColors.success;
      case SensorCategory.airQuality:
        return ThemeColors.teal;
      case SensorCategory.motion:
        return ThemeColors.warning;
      case SensorCategory.safety:
        return ThemeColors.danger;
      case SensorCategory.light:
        return ThemeColors.warning;
      case SensorCategory.energy:
        return ThemeColors.primary;
    }
  }

  /// Returns mode options for the selector: "All" plus each category that has at least one sensor.
  List<ModeOption<SensorCategory?>> _getCategoryModeOptions() {
    // Get categories that have sensors
    final availableCategories = SensorCategory.values
        .where((cat) => _countForCategory(cat) > 0)
        .toList();

    return [
      // "All" option first
      ModeOption<SensorCategory?>(
        value: null,
        icon: MdiIcons.viewGrid,
        label: AppLocalizations.of(context)!.filter_all,
        color: ThemeColors.neutral,
      ),
      // Then available categories
      ...availableCategories.map((cat) => ModeOption<SensorCategory?>(
            value: cat,
            icon: _getCategoryIcon(cat),
            label: _getCategoryLabel(AppLocalizations.of(context)!, cat),
            color: _getCategoryModeColor(cat),
          )),
    ];
  }

  // --------------------------------------------------------------------------
  // BUILD
  // --------------------------------------------------------------------------
  // Scaffold with header; body: empty state or orientation-based layout (portrait/landscape).

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    // Handle loading and error states using DomainStateView
    final loadState = _isLoading
        ? DomainLoadState.loading
        : _hasError
            ? DomainLoadState.error
            : DomainLoadState.loaded;

    if (loadState != DomainLoadState.loaded) {
      return DomainStateView(
        state: loadState,
        onRetry: _retryLoad,
        domainName: localizations.domain_sensors,
        child: const SizedBox.shrink(),
      );
    }

    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
        final isDark = Theme.of(context).brightness == Brightness.dark;

        final alertCount =
            _sensors.where((s) => s.status == SensorStatus.alert).length;

        return Scaffold(
          backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(context, alertCount),
                Expanded(
                  child: _sensors.isEmpty
                      ? _buildEmptyState(context)
                      : OrientationBuilder(
                          builder: (context, orientation) {
                            return orientation == Orientation.landscape
                                ? _buildLandscapeLayout(context)
                                : _buildPortraitLayout(context);
                          },
                        ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // =============================================================================
  // EMPTY STATE
  // =============================================================================
  // Shown when [_sensors] is empty: icon, title, description.

  Widget _buildEmptyState(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
    final warningBgColor =
        isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9;

    return Center(
      child: Padding(
        padding: AppSpacings.paddingXl,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          spacing: AppSpacings.pMd,
          children: [
            Container(
              width: AppSpacings.scale(80),
              height: AppSpacings.scale(80),
              decoration: BoxDecoration(
                color: warningBgColor,
                shape: BoxShape.circle,
              ),
              child: Icon(
                MdiIcons.accessPointNetworkOff,
                size: AppSpacings.scale(48),
                color: warningColor,
              ),
            ),
            Text(
              localizations.sensors_domain_empty_title,
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
                color:
                    isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
              ),
              textAlign: TextAlign.center,
            ),
            Text(
              localizations.sensors_domain_empty_description,
              style: TextStyle(
                fontSize: AppFontSize.base,
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  // =============================================================================
  // HEADER
  // =============================================================================
  // Title, subtitle (alert/health counts or sensor count), leading icon, home button.

  Widget _buildHeader(BuildContext context, int alertCount) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final hasAlerts = alertCount > 0;
    final staleCount = _sensors.where((s) => !s.isOffline && s.freshness == SensorFreshness.stale).length;
    final offlineCount = _sensors.where((s) => s.isOffline).length;
    final hasHealthIssues = staleCount > 0 || offlineCount > 0;

    final accentColor = hasAlerts
        ? (isDark ? AppColorsDark.danger : AppColorsLight.danger)
        : hasHealthIssues
            ? (isDark ? AppColorsDark.warning : AppColorsLight.warning)
            : (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final accentThemeColor = hasAlerts
        ? ThemeColors.danger
        : hasHealthIssues
            ? ThemeColors.warning
            : ThemeColors.primary;

    String subtitle;
    if (hasAlerts) {
      subtitle = localizations.sensors_domain_alerts_active(alertCount);
    } else if (_sensors.isEmpty) {
      subtitle = localizations.sensors_domain_no_sensors;
    } else if (hasHealthIssues) {
      final parts = <String>[];
      if (staleCount > 0) parts.add(localizations.sensors_domain_health_stale(staleCount));
      if (offlineCount > 0) parts.add(localizations.sensors_domain_health_offline(offlineCount));
      subtitle = '${localizations.sensors_domain_sensor_count(_sensors.length)} • ${parts.join(', ')}';
    } else {
      subtitle = '${localizations.sensors_domain_sensor_count(_sensors.length)} • ${localizations.sensors_domain_health_normal}';
    }

    return PageHeader(
      title: AppLocalizations.of(context)!.domain_sensors,
      subtitle: subtitle,
      subtitleColor: (hasAlerts || hasHealthIssues) ? accentColor : null,
      leading: HeaderMainIcon(
        icon: MdiIcons.accessPointNetwork,
        color: accentThemeColor,
      ),
      landscapeAction: const DeckModeChip(),
    );
  }

  // =============================================================================
  // CATEGORY SELECTOR
  // =============================================================================
  // Horizontal mode selector (portrait) or vertical (landscape); options from [_getCategoryModeOptions].


  // =============================================================================
  // PORTRAIT LAYOUT
  // =============================================================================
  // Optional alert banner, summary cards (when "All"), category selector, sensor grid.

  Widget _buildPortraitLayout(BuildContext context) {
    final isAtLeastMedium = _screenService.isAtLeastMedium;
    final isSmallScreen = _screenService.isSmallScreen;
    final sensorsPerRow = isAtLeastMedium ? 3 : 2;

    return PortraitViewLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          if (_hasAlerts) _buildAlertBanner(context),
          if (_selectedCategory == null) ...[
            _buildSummaryCards(context, compact: isSmallScreen),
          ],
          _buildSensorGrid(context, crossAxisCount: sensorsPerRow, childAspectRatio: isSmallScreen ? 1.0 : 0.9),
        ],
      ),
    );
  }

  // =============================================================================
  // LANDSCAPE LAYOUT
  // =============================================================================
  // Summary row (when "All"), sensor grid, vertical category selector.

  Widget _buildLandscapeLayout(BuildContext context) {
    final isLargeScreen = _screenService.isLargeScreen;
    final sensorsPerRow = isLargeScreen ? 4 : (_screenService.isAtLeastMedium ? 3 : 2);

    return LandscapeViewLayout(
      mainContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pLg,
        children: [
          if (_selectedCategory == null) _buildSummaryCards(context),
          _buildSensorGrid(context, crossAxisCount: sensorsPerRow, childAspectRatio: 0.95),
        ],
      ),
      mainContentScrollable: true,
      mainContentPadding: AppSpacings.paddingMd,
    );
  }

  // =============================================================================
  // ALERT BANNER
  // =============================================================================
  // Single CTA when any sensor has [SensorStatus.alert]; tap opens that sensor's device detail.

  Widget _buildAlertBanner(BuildContext context) {
    final alertSensor =
        _sensors.firstWhere((s) => s.status == SensorStatus.alert);
    return AlertBanner(
      title: AppLocalizations.of(context)!.sensor_alert_high_title(alertSensor.name),
      text: AppLocalizations.of(context)!.sensor_alert_exceeded_threshold(alertSensor.name),
      color: SensorColors.danger,
      onTap: () => _openSensorDetail(context, alertSensor),
    );
  }

  // =============================================================================
  // SUMMARY CARDS
  // =============================================================================
  // Row of environment averages from [_environment] (temp, humidity, illuminance/pressure).
  // Compact mode: horizontal scroll tiles; otherwise expanded cards in a row.

  /// Builds summary row items from [_environment] (avg temperature, humidity, illuminance or pressure).
  List<({String name, String status, IconData icon, Color color, ThemeColors? themeColor})> _buildSummaryItems({
    required bool isDark,
    required AppLocalizations localizations,
  }) {
    final env = _environment;
    final items = <({String name, String status, IconData icon, Color color, ThemeColors? themeColor})>[];

    if (env?.averageTemperature != null) {
      items.add((
        name: SensorUtils.formatNumericValueWithUnit(env!.averageTemperature!, DevicesModuleChannelCategory.temperature),
        status: localizations.sensors_domain_avg_temperature,
        icon: MdiIcons.thermometer,
        color: isDark ? AppColorsDark.info : AppColorsLight.info,
        themeColor: ThemeColors.info,
      ));
    }

    if (env?.averageHumidity != null) {
      items.add((
        name: SensorUtils.formatNumericValueWithUnit(env!.averageHumidity!, DevicesModuleChannelCategory.humidity),
        status: localizations.sensors_domain_avg_humidity,
        icon: MdiIcons.waterPercent,
        color: isDark ? AppColorsDark.success : AppColorsLight.success,
        themeColor: ThemeColors.success,
      ));
    }

    if (env?.averageIlluminance != null) {
      items.add((
        name: SensorUtils.formatNumericValueWithUnit(env!.averageIlluminance!, DevicesModuleChannelCategory.illuminance),
        status: localizations.sensor_label_illuminance,
        icon: MdiIcons.weatherSunny,
        color: isDark ? AppColorsDark.warning : AppColorsLight.warning,
        themeColor: ThemeColors.warning,
      ));
    } else if (env?.averagePressure != null) {
      items.add((
        name: SensorUtils.formatNumericValueWithUnit(env!.averagePressure!, DevicesModuleChannelCategory.pressure),
        status: localizations.sensor_label_pressure,
        icon: MdiIcons.gaugeEmpty,
        color: isDark ? AppColorsDark.info : AppColorsLight.info,
        themeColor: ThemeColors.info,
      ));
    }

    return items;
  }

  Widget _buildSummaryCards(BuildContext context, {bool compact = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final items = _buildSummaryItems(isDark: isDark, localizations: localizations);

    if (items.isEmpty) return const SizedBox.shrink();

    // Compact: horizontal scroll tiles (small portrait)
    if (compact) {
      final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);

      return HorizontalScrollWithGradient(
        height: tileHeight,
        layoutPadding: AppSpacings.pLg,
        itemCount: items.length,
        separatorWidth: AppSpacings.pMd,
        itemBuilder: (context, index) {
          final item = items[index];

          return HorizontalTileCompact(
            icon: item.icon,
            name: item.name,
            status: item.status,
            iconAccentColor: item.themeColor,
            onTileTap: () {},
          );
        },
      );
    }

    // Standard: expanded cards in a row
    final cards = <Widget>[];

    for (var i = 0; i < items.length; i++) {
      final item = items[i];
      cards.add(Expanded(
        child: _buildSummaryCard(
          context,
          title: item.status,
          value: item.name,
          icon: item.icon,
          color: item.color,
        ),
      ));
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pMd,
        children: cards,
      ),
    );
  }

  Widget _buildSummaryCard(
    BuildContext context, {
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: isDark ? AppFillColorDark.light : AppBorderColorLight.darker,
          width: AppSpacings.scale(1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pSm,
        children: [
          Row(
            spacing: AppSpacings.pSm,
            children: [
              Icon(icon, size: AppSpacings.scale(18), color: color),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                color: color,
                fontSize: AppSpacings.scale(28),
                fontWeight: FontWeight.w300,
              ),
              maxLines: 1,
            ),
          ),
        ],
      ),
    );
  }

  // =============================================================================
  // SENSOR GRID
  // =============================================================================
  // Section title + count, then grid of [_filteredSensors]. Cards show icon, freshness dot, value, trend.

  Widget _buildSensorGrid(BuildContext context, {required int crossAxisCount, double childAspectRatio = 1.0}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filtered = _filteredSensors;

    final localizations = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      children: [
        SectionTitle(
          icon: MdiIcons.viewGrid,
          title: _selectedCategory == null
              ? localizations.sensors_domain_all_sensors
              : _getCategoryLabel(localizations, _selectedCategory!),
          trailing: Text(
            localizations.sensors_domain_sensor_count(filtered.length),
            style: TextStyle(
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
              fontSize: AppFontSize.extraSmall,
            ),
          ),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            childAspectRatio: childAspectRatio,
            crossAxisSpacing: AppSpacings.pMd,
            mainAxisSpacing: AppSpacings.pMd,
          ),
          itemCount: filtered.length,
          itemBuilder: (context, index) {
            return _buildSensorCard(context, filtered[index]);
          },
        ),
      ],
    );
  }

  Widget _buildSensorCard(BuildContext context, SensorData sensor) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isAlert = sensor.status == SensorStatus.alert && !sensor.isOffline;
    final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
    final categoryColor = _getCategoryColor(context, sensor.category);
    final themeColor = isAlert
        ? SensorColors.danger
        : _getCategoryModeColor(sensor.category);
    final (iconColor: cardIconColor, backgroundColor: cardIconBg) =
        ThemeColorFamily.get(Theme.of(context).brightness, themeColor).iconContainer;

    // Dim only offline (device disconnected) sensors
    final double cardOpacity = sensor.isOffline ? 0.4 : 1.0;

    Widget card = GestureDetector(
      onTap: () => _openSensorDetail(context, sensor),
      child: Container(
        padding: AppSpacings.paddingMd,
        decoration: BoxDecoration(
          color: isAlert
              ? dangerColor.withValues(alpha: isDark ? 0.15 : 0.1)
              : (isDark ? AppFillColorDark.light : AppFillColorLight.blank),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isAlert
                ? dangerColor
                : (isDark
                    ? AppFillColorDark.light
                    : AppBorderColorLight.darker),
            width: AppSpacings.scale(1),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: AppSpacings.pSm,
          children: [
            // Header: Icon + Freshness/Status dot
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: AppSpacings.scale(36),
                  height: AppSpacings.scale(36),
                  decoration: BoxDecoration(
                    color: cardIconBg,
                    borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  ),
                  child: Icon(
                    sensor.icon,
                    size: AppSpacings.scale(20),
                    color: cardIconColor,
                  ),
                ),
                _buildFreshnessDot(context, sensor),
              ],
            ),

            // Name
            Text(
              sensor.name,
              style: TextStyle(
                color: isAlert
                    ? dangerColor
                    : (isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary),
                fontSize: AppFontSize.small,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            // Device name
            Text(
              sensor.location,
              style: TextStyle(
                color: isAlert
                    ? dangerColor.withValues(alpha: 0.7)
                    : (isDark
                        ? AppTextColorDark.placeholder
                        : AppTextColorLight.placeholder),
                fontSize: AppFontSize.extraSmall,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),

            // Value + trend icon
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (!sensor.isBinary) ...[
                    _buildTrendIcon(context, sensor.trend, isAlert),
                    AppSpacings.spacingSmHorizontal,
                  ],
                  RichText(
                    maxLines: 1,
                    text: TextSpan(
                      style: TextStyle(
                        fontSize: AppSpacings.scale(24),
                        fontWeight: FontWeight.w300,
                        color: sensor.isOffline
                            ? (isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder)
                            : isAlert ? dangerColor : categoryColor,
                      ),
                      children: sensor.isOffline
                          ? [
                              TextSpan(
                                text: AppLocalizations.of(context)!.device_status_offline,
                              ),
                            ]
                          : [
                              TextSpan(
                                text: SensorUtils.translateSensorValue(
                                  AppLocalizations.of(context)!,
                                  sensor.value,
                                  sensor.channelCategory,
                                  short: true,
                                ),
                              ),
                              TextSpan(
                                text: sensor.unit,
                                style: TextStyle(
                                  fontSize: AppFontSize.base,
                                  fontWeight: FontWeight.w400,
                                ),
                              ),
                            ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    if (cardOpacity < 1.0) {
      card = Opacity(opacity: cardOpacity, child: card);
    }

    return card;
  }

  Widget _buildFreshnessDot(BuildContext context, SensorData sensor) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Alert > Offline > Freshness
    Color dotColor;
    if (sensor.status == SensorStatus.alert) {
      dotColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
    } else if (sensor.isOffline) {
      dotColor = SensorFreshnessUtils.color(SensorFreshness.offline, isDark);
    } else {
      dotColor = SensorFreshnessUtils.color(sensor.freshness, isDark);
    }

    return Container(
      width: AppSpacings.scale(8),
      height: AppSpacings.scale(8),
      decoration: BoxDecoration(
        color: dotColor,
        shape: BoxShape.circle,
      ),
    );
  }

  Widget _buildTrendIcon(
    BuildContext context,
    TrendDirection direction,
    bool isAlert,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;

    IconData icon;
    Color color;

    switch (direction) {
      case TrendDirection.up:
        icon = MdiIcons.arrowTopRightThick;
        color = isAlert ? dangerColor : (isDark ? AppColorsDark.danger : AppColorsLight.danger);
        break;
      case TrendDirection.down:
        icon = MdiIcons.arrowBottomRightThick;
        color = isAlert ? dangerColor : (isDark ? AppColorsDark.info : AppColorsLight.info);
        break;
      case TrendDirection.stable:
        icon = MdiIcons.arrowRightThick;
        color = isAlert
            ? dangerColor
            : (isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder);
        break;
    }

    return Icon(icon, size: AppSpacings.scale(14), color: color);
  }

  // =============================================================================
  // SENSOR DETAIL
  // =============================================================================
  // Navigate to [DeviceDetailPage] for the sensor's device; preselect channel when device is sensor.

  /// Pushes [DeviceDetailPage] for the sensor's device. When the device category
  /// is sensor, passes [sensor.id] as [DeviceDetailPage.initialChannelId] to
  /// preselect that channel (same as lights domain view).
  void _openSensorDetail(BuildContext context, SensorData sensor) {
    final device = _devicesService?.getDevice(sensor.deviceId);
    final isSensorDevice = device?.category == DevicesModuleDeviceCategory.sensor;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(
          sensor.deviceId,
          initialChannelId: isSensorDevice ? sensor.id : null,
        ),
      ),
    );
  }
}

