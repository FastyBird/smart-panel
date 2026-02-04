/// Sensors domain view: room-level list of sensors for a single space/room.
///
/// **Purpose:** One screen per room showing sensor readings (temperature,
/// humidity, air quality, motion, safety, light, energy). Users can filter by
/// category, see summary cards (avg temp/humidity/illuminance), and open
/// device detail from a sensor tile or from an alert banner.
///
/// **Data flow:**
/// - [SpaceStateRepository] provides [SensorStateModel] for the room (readings,
///   environment aggregates). Data is prefetched by [DeckService]; this page
///   loads from cache in [_loadSensorData].
/// - [DevicesService] provides device online status. [SpacesService] provides
///   room name. [DeckService] / [EventBus] for navigation home.
/// - Local state: _sensors (list of [SensorData]), _selectedCategory,
///   _isLoading. A periodic timer refreshes the UI so freshness indicators
///   (fresh/recent/stale) update over time.
///
/// **Key concepts:**
/// - [SensorData] is the view model: id, value, unit, status (normal/warning/
///   alert/offline), trend, freshness, category. Status is derived from
///   safety alerts and motion activity.
/// - Portrait: optional alert banner, summary cards (when "All"), category
///   selector, sensor grid. Landscape: summary row + grid + vertical category
///   selector.
/// - Tapping a sensor opens [DeviceDetailPage] for its device.
///
/// **File structure (for humans and AI):**
/// Search for the exact section header (e.g. "// DATA MODELS", "// LIFECYCLE")
/// to jump to that part of the file. Sections appear in this order:
///
/// - **DATA MODELS** — [SensorStatus], [TrendDirection], [SensorData], [_parseTrend].
/// - **SENSORS DOMAIN VIEW PAGE** — [SensorsDomainViewPage] and state: LIFECYCLE,
///   LISTENERS, DATA LOADING, NAVIGATION, FILTERING & CATEGORIES, BUILD.
/// - **EMPTY STATE** — no sensors message.
/// - **HEADER** — title, subtitle (alert/health counts), home button.
/// - **CATEGORY SELECTOR** — portrait and landscape mode selectors.
/// - **LAYOUTS** — portrait and landscape column layout.
/// - **ALERT BANNER** — single alert CTA when any sensor is in alert.
/// - **SUMMARY CARDS** — environment averages (temp, humidity, illuminance/pressure).
/// - **SENSOR GRID** — section title + grid of sensor cards; card builder, freshness dot, trend icon.
/// - **SENSOR DETAIL** — navigate to device detail.
import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
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
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/deck/types/sensor_category.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/sensor_enum_utils.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/sensor_freshness.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';

// =============================================================================
// DATA MODELS
// =============================================================================

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
  final String? channelCategory;
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

class SensorsDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const SensorsDomainViewPage({super.key, required this.viewItem});

  @override
  State<SensorsDomainViewPage> createState() => _SensorsDomainViewPageState();
}

class _SensorsDomainViewPageState extends State<SensorsDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SpacesService? _spacesService;
  SpaceStateRepository? _spaceStateRepository;
  DevicesService? _devicesService;
  DeckService? _deckService;
  EventBus? _eventBus;

  bool _isLoading = true;
  SensorCategory? _selectedCategory;
  Timer? _freshnessTimer;

  List<SensorData> _sensors = [];

  String get _roomId => widget.viewItem.roomId;

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

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

  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------

  @override
  void initState() {
    super.initState();

    _spacesService = _tryLocator<SpacesService>('SpacesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _spaceStateRepository = _tryLocator<SpaceStateRepository>('SpaceStateRepository', onSuccess: (s) => s.addListener(_onDataChanged));
    _devicesService = _tryLocator<DevicesService>('DevicesService', onSuccess: (s) => s.addListener(_onDataChanged));
    _deckService = _tryLocator<DeckService>('DeckService');
    _eventBus = _tryLocator<EventBus>('EventBus');

    _loadSensorData();

    _freshnessTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) {
        if (mounted) setState(() {});
      },
    );
  }

  @override
  void dispose() {
    _freshnessTimer?.cancel();
    _spacesService?.removeListener(_onDataChanged);
    _spaceStateRepository?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  // -------------------------------------------------------------------------
  // LISTENERS
  // -------------------------------------------------------------------------

  void _onDataChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _loadSensorData();
      }
    });
  }

  // -------------------------------------------------------------------------
  // DATA LOADING
  // -------------------------------------------------------------------------

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

  static const _formatter = NumberFormatUtils.defaultFormat;

  /// Get short label for binary sensor state (for tiles)
  static String _getBinaryLabel(String channelCategory, bool isActive) {
    switch (channelCategory.toLowerCase()) {
      case 'motion':
      case 'occupancy':
        return isActive ? 'Detected' : 'Clear';
      case 'contact':
        return isActive ? 'Open' : 'Closed';
      case 'smoke':
      case 'gas':
      case 'leak':
      case 'carbon_monoxide':
        return isActive ? 'Detected' : 'Clear';
      default:
        return isActive ? 'Active' : 'Inactive';
    }
  }

  /// Check if a dynamic value represents a boolean true
  static bool _isBooleanTrue(dynamic value) {
    if (value is bool) return value;
    if (value == 'true' || value == '1' || value == 1) return true;
    return false;
  }

  /// Format sensor value for display
  String _formatSensorValue(dynamic value, String channelCategory) {
    if (value == null) return '--';

    // Boolean sensors
    if (value is bool || value == 'true' || value == 'false' || value == '1' || value == '0') {
      return _getBinaryLabel(channelCategory, _isBooleanTrue(value));
    }

    // Numeric values
    if (value is num) {
      if (value is double) {
        return _formatter.formatDecimal(value, decimalPlaces: 1);
      }
      return _formatter.formatInteger(value.toInt());
    }

    return value.toString();
  }

  /// Translates a pre-formatted sensor value (e.g. binary labels) via [SensorEnumUtils].
  /// Call at display time when [BuildContext] is available for [AppLocalizations].
  static String translateSensorValue(
    AppLocalizations l,
    String value,
    String? channelCategory, {
    bool short = true,
  }) {
    if (channelCategory == null || channelCategory.isEmpty) return value;
    // Only translate non-numeric, non-placeholder values
    if (value == '--' || value.isEmpty) return value;
    if (double.tryParse(value.replaceAll(',', '')) != null) return value;
    final translated = SensorEnumUtils.translatePrimary(
      l, channelCategory, value, short: short,
    );
    return translated ?? value;
  }

  /// Check if a property has a discrete (non-numeric) data type — bool or enum
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

  /// Loads sensor list from [SpaceStateRepository] for [_roomId]; transforms readings into [SensorData].
  void _loadSensorData() {
    final roomName = _spacesService?.getSpace(_roomId)?.name ?? 'Room';
    final sensorState = _spaceStateRepository?.getSensorState(_roomId);

    if (kDebugMode) {
      debugPrint('[SensorsDomainViewPage] Loading sensor data: sensorState=${sensorState != null}, hasSensors=${sensorState?.hasSensors}, totalSensors=${sensorState?.totalSensors}, readings=${sensorState?.readings.length}');
    }

    if (sensorState == null || !sensorState.hasSensors) {
      // No sensor data available yet
      if (kDebugMode) {
        debugPrint('[SensorsDomainViewPage] No sensor data available');
      }
      _sensors = [];
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
      return;
    }

    // Transform API data to view models
    final List<SensorData> sensors = [];

    for (final roleReadings in sensorState.readings) {
      for (final reading in roleReadings.readings) {
        final category = _mapChannelCategory(reading.channelCategory);
        final status = _determineSensorStatus(reading, sensorState);
        final value = _formatSensorValue(reading.value, reading.channelCategory);

        // Strip room name prefix from device name since we're already on the room page
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
          channelCategory: reading.channelCategory,
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
    }
  }

  /// Aggregated environment data for summary cards (avg temp, humidity, illuminance, pressure).
  SensorEnvironmentModel? get _environment {
    return _spaceStateRepository?.getSensorState(_roomId)?.environment;
  }

  // -------------------------------------------------------------------------
  // NAVIGATION
  // -------------------------------------------------------------------------

  void _navigateToHome() {
    final deck = _deckService?.deck;
    if (deck == null || deck.items.isEmpty) {
      Navigator.pop(context);
      return;
    }

    final homeIndex = deck.startIndex;
    if (homeIndex >= 0 && homeIndex < deck.items.length) {
      final homeItem = deck.items[homeIndex];
      _eventBus?.fire(NavigateToDeckItemEvent(homeItem.id));
    }
  }

  // -------------------------------------------------------------------------
  // FILTERING & CATEGORIES
  // -------------------------------------------------------------------------

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

  String _getCategoryLabel(SensorCategory category) {
    switch (category) {
      case SensorCategory.temperature:
        return 'Temperature';
      case SensorCategory.humidity:
        return 'Humidity';
      case SensorCategory.airQuality:
        return 'Air Quality';
      case SensorCategory.motion:
        return 'Motion';
      case SensorCategory.safety:
        return 'Safety';
      case SensorCategory.light:
        return 'Light';
      case SensorCategory.energy:
        return 'Energy';
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
            label: _getCategoryLabel(cat),
            color: _getCategoryModeColor(cat),
          )),
    ];
  }

  // -------------------------------------------------------------------------
  // BUILD
  // -------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
        final isDark = Theme.of(context).brightness == Brightness.dark;

        if (_isLoading) {
          return Scaffold(
            backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
            body: const Center(child: CircularProgressIndicator()),
          );
        }

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

  Widget _buildEmptyState(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Center(
      child: Padding(
        padding: AppSpacings.paddingXl,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: _scale(80),
              height: _scale(80),
              decoration: BoxDecoration(
                color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
                borderRadius: BorderRadius.circular(AppBorderRadius.round),
              ),
              child: Icon(
                MdiIcons.accessPointNetworkOff,
                size: _scale(40),
                color: isDark
                    ? AppTextColorDark.placeholder
                    : AppTextColorLight.placeholder,
              ),
            ),
            AppSpacings.spacingLgVertical,
            Text(
              'No Sensors',
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.primary
                    : AppTextColorLight.primary,
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
              ),
            ),
            AppSpacings.spacingSmVertical,
            Text(
              'No sensors are assigned to this room yet.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
                fontSize: AppFontSize.base,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // =============================================================================
  // HEADER
  // =============================================================================

  Widget _buildHeader(BuildContext context, int alertCount) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
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
      subtitle = '$alertCount Alert${alertCount > 1 ? 's' : ''} Active';
    } else if (_sensors.isEmpty) {
      subtitle = 'No sensors configured';
    } else if (hasHealthIssues) {
      final parts = <String>[];
      if (staleCount > 0) parts.add('$staleCount stale');
      if (offlineCount > 0) parts.add('$offlineCount offline');
      subtitle = '${_sensors.length} sensor${_sensors.length > 1 ? 's' : ''} • ${parts.join(', ')}';
    } else {
      subtitle = '${_sensors.length} sensor${_sensors.length > 1 ? 's' : ''} • All normal';
    }

    return PageHeader(
      title: AppLocalizations.of(context)!.domain_sensors,
      subtitle: subtitle,
      subtitleColor: (hasAlerts || hasHealthIssues) ? accentColor : null,
      leading: HeaderMainIcon(
        icon: MdiIcons.accessPointNetwork,
        color: accentThemeColor,
      ),
      trailing: HeaderIconButton(
        icon: MdiIcons.homeOutline,
        onTap: _navigateToHome,
      ),
    );
  }

  // =============================================================================
  // CATEGORY SELECTOR
  // =============================================================================

  Widget _buildCategorySelector(BuildContext context) {
    final modeOptions = _getCategoryModeOptions();
    return ModeSelector<SensorCategory?>(
      modes: modeOptions,
      selectedValue: _selectedCategory,
      onChanged: (category) => setState(() => _selectedCategory = category),
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.top,
      showLabels: true,
      scrollable: true,
      minButtonWidth: 88,
    );
  }

  // =============================================================================
  // PORTRAIT LAYOUT
  // =============================================================================

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
      modeSelector: _buildCategorySelector(context),
    );
  }

  // =============================================================================
  // LANDSCAPE LAYOUT
  // =============================================================================

  Widget _buildLandscapeLayout(BuildContext context) {
    final isLargeScreen = _screenService.isLargeScreen;
    final sensorsPerRow = isLargeScreen ? 4 : (_screenService.isAtLeastMedium ? 3 : 2);

    return LandscapeViewLayout(
      mainContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_selectedCategory == null) _buildSummaryCards(context),
          if (_selectedCategory == null) AppSpacings.spacingLgVertical,
          _buildSensorGrid(context, crossAxisCount: sensorsPerRow),
        ],
      ),
      mainContentScrollable: true,
      modeSelector: _buildLandscapeCategorySelector(context, showLabels: isLargeScreen),
      modeSelectorShowLabels: isLargeScreen,
    );
  }

  /// Build vertical category selector for landscape layout
  Widget _buildLandscapeCategorySelector(
    BuildContext context, {
    bool showLabels = false,
  }) {
    final modeOptions = _getCategoryModeOptions();
    return ModeSelector<SensorCategory?>(
      modes: modeOptions,
      selectedValue: _selectedCategory,
      onChanged: (category) => setState(() => _selectedCategory = category),
      orientation: ModeSelectorOrientation.vertical,
      iconPlacement: ModeSelectorIconPlacement.top,
      showLabels: showLabels,
    );
  }

  // =============================================================================
  // ALERT BANNER
  // =============================================================================

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

  /// Builds summary row items from [_environment] (avg temperature, humidity, illuminance or pressure).
  List<({String name, String status, IconData icon, Color color, ThemeColors? themeColor})> _buildSummaryItems({required bool isDark}) {
    final env = _environment;
    final items = <({String name, String status, IconData icon, Color color, ThemeColors? themeColor})>[];

    if (env?.averageTemperature != null) {
      items.add((
        name: '${_formatter.formatDecimal(env!.averageTemperature!, decimalPlaces: 1)}°C',
        status: 'Avg Temperature',
        icon: MdiIcons.thermometer,
        color: isDark ? AppColorsDark.info : AppColorsLight.info,
        themeColor: ThemeColors.info,
      ));
    }

    if (env?.averageHumidity != null) {
      items.add((
        name: '${_formatter.formatInteger(env!.averageHumidity!.round())}%',
        status: 'Avg Humidity',
        icon: MdiIcons.waterPercent,
        color: isDark ? AppColorsDark.success : AppColorsLight.success,
        themeColor: ThemeColors.success,
      ));
    }

    if (env?.averageIlluminance != null) {
      items.add((
        name: '${_formatter.formatInteger(env!.averageIlluminance!.round())} lux',
        status: 'Illuminance',
        icon: MdiIcons.weatherSunny,
        color: isDark ? AppColorsDark.warning : AppColorsLight.warning,
        themeColor: ThemeColors.warning,
      ));
    } else if (env?.averagePressure != null) {
      items.add((
        name: '${_formatter.formatInteger(env!.averagePressure!.round())} hPa',
        status: 'Pressure',
        icon: MdiIcons.gaugeEmpty,
        color: isDark ? AppColorsDark.info : AppColorsLight.info,
        themeColor: ThemeColors.info,
      ));
    }

    return items;
  }

  Widget _buildSummaryCards(BuildContext context, {bool compact = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final items = _buildSummaryItems(isDark: isDark);

    if (items.isEmpty) return const SizedBox.shrink();

    // Compact: horizontal scroll tiles (small portrait)
    if (compact) {
      final tileHeight = _scale(AppTileHeight.horizontal);

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
      if (i > 0) cards.add(AppSpacings.spacingMdHorizontal);
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
          color: isDark ? AppFillColorDark.light : AppBorderColorLight.light,
          width: _scale(1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: _scale(18), color: color),
              AppSpacings.spacingSmHorizontal,
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
          AppSpacings.spacingSmVertical,
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              value,
              style: TextStyle(
                color: color,
                fontSize: _scale(28),
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

  Widget _buildSensorGrid(BuildContext context, {required int crossAxisCount, double childAspectRatio = 1.0}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filtered = _filteredSensors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      children: [
        SectionTitle(
          icon: MdiIcons.viewGrid,
          title: _selectedCategory == null
              ? 'All sensors'
              : _getCategoryLabel(_selectedCategory!),
          trailing: Text(
            '${filtered.length} sensors',
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
                    : AppBorderColorLight.light),
            width: _scale(1),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: Icon + Freshness/Status dot
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: _scale(36),
                  height: _scale(36),
                  decoration: BoxDecoration(
                    color: cardIconBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    sensor.icon,
                    size: _scale(20),
                    color: cardIconColor,
                  ),
                ),
                _buildFreshnessDot(context, sensor),
              ],
            ),
            AppSpacings.spacingMdVertical,

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
            AppSpacings.spacingSmVertical,

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
                    SizedBox(width: _scale(4)),
                  ],
                  RichText(
                    maxLines: 1,
                    text: TextSpan(
                      style: TextStyle(
                        fontSize: _scale(24),
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
                                text: _SensorsDomainViewPageState.translateSensorValue(
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
      width: _scale(8),
      height: _scale(8),
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

    return Icon(icon, size: _scale(14), color: color);
  }

  // =============================================================================
  // SENSOR DETAIL
  // =============================================================================

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

