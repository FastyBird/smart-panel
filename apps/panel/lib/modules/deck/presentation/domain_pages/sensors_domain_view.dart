import 'dart:async';
import 'dart:math';

import 'package:event_bus/event_bus.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/sensor_enum_utils.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/sensor_freshness.dart';

// ============================================================================
// DATA MODELS
// ============================================================================

enum SensorCategory {
  temperature,
  humidity,
  airQuality,
  motion,
  safety,
  light,
  energy,
}

enum SensorStatus {
  normal,
  warning,
  alert,
  offline,
}

enum TrendDirection {
  up,
  down,
  stable,
}

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
  final String? trendText;
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
    this.trendText,
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

/// Parse trend string from API into TrendDirection enum
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

// ============================================================================
// SENSORS DOMAIN VIEW PAGE
// ============================================================================

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

  // Sensor data from API
  List<SensorData> _sensors = [];

  String get _roomId => widget.viewItem.roomId;

  @override
  void initState() {
    super.initState();

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorsDomainViewPage] Failed to get SpacesService: $e');
      }
    }

    try {
      _spaceStateRepository = locator<SpaceStateRepository>();
      _spaceStateRepository?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorsDomainViewPage] Failed to get SpaceStateRepository: $e');
      }
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorsDomainViewPage] Failed to get DevicesService: $e');
      }
    }

    try {
      _deckService = locator<DeckService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorsDomainViewPage] Failed to get DeckService: $e');
      }
    }

    try {
      _eventBus = locator<EventBus>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorsDomainViewPage] Failed to get EventBus: $e');
      }
    }

    // Data is prefetched by DeckService, just load from cache
    _loadSensorData();

    // Periodic refresh so freshness indicators update over time
    _freshnessTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) {
        if (mounted) setState(() {});
      },
    );
  }

  /// Map channel category string to SensorCategory
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

  /// Determine sensor status based on safety alerts
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

  /// Get long label for binary sensor state (for event log)
  static String _getBinaryLabelLong(String channelCategory, bool isActive) {
    switch (channelCategory.toLowerCase()) {
      case 'motion':
      case 'occupancy':
        return isActive ? 'Detected' : 'Clear';
      case 'contact':
        return isActive ? 'Open' : 'Closed';
      case 'smoke':
        return isActive ? 'Smoke detected' : 'Clear';
      case 'gas':
        return isActive ? 'Gas detected' : 'Clear';
      case 'leak':
        return isActive ? 'Leak detected' : 'Clear';
      case 'carbon_monoxide':
        return isActive ? 'CO detected' : 'Clear';
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

  /// Translate a pre-formatted sensor value using enum utils.
  /// Call at display time when BuildContext is available.
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

  /// Load sensor data from repository
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

  /// Get aggregated environment data for summary cards
  SensorEnvironmentModel? get _environment {
    return _spaceStateRepository?.getSensorState(_roomId)?.environment;
  }


  @override
  void dispose() {
    _freshnessTimer?.cancel();
    _spacesService?.removeListener(_onDataChanged);
    _spaceStateRepository?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _loadSensorData();
      }
    });
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

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

  List<SensorData> get _filteredSensors {
    if (_selectedCategory == null) return _sensors;
    return _sensors.where((s) => s.category == _selectedCategory).toList();
  }

  int _countForCategory(SensorCategory? category) {
    if (category == null) return _sensors.length;
    return _sensors.where((s) => s.category == category).length;
  }

  bool get _hasAlerts => _sensors.any((s) => s.status == SensorStatus.alert);

  // Theme-aware color getters
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

  Color _getCategoryLightColor(BuildContext context, SensorCategory category) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (category) {
      case SensorCategory.temperature:
        return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
      case SensorCategory.humidity:
        return isDark
            ? AppColorsDark.successLight5
            : AppColorsLight.successLight5;
      case SensorCategory.airQuality:
        return isDark
            ? AppColorsDark.successLight5
            : AppColorsLight.successLight5;
      case SensorCategory.motion:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case SensorCategory.safety:
        return isDark
            ? AppColorsDark.dangerLight5
            : AppColorsLight.dangerLight5;
      case SensorCategory.light:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case SensorCategory.energy:
        return isDark
            ? AppColorsDark.primaryLight5
            : AppColorsLight.primaryLight5;
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

  ModeSelectorColor _getCategoryModeColor(SensorCategory category) {
    switch (category) {
      case SensorCategory.temperature:
        return ModeSelectorColor.info;
      case SensorCategory.humidity:
        return ModeSelectorColor.success;
      case SensorCategory.airQuality:
        return ModeSelectorColor.teal;
      case SensorCategory.motion:
        return ModeSelectorColor.warning;
      case SensorCategory.safety:
        return ModeSelectorColor.danger;
      case SensorCategory.light:
        return ModeSelectorColor.warning;
      case SensorCategory.energy:
        return ModeSelectorColor.primary;
    }
  }

  /// Get mode options for available sensor categories
  List<ModeOption<SensorCategory?>> _getCategoryModeOptions() {
    // Get categories that have sensors
    final availableCategories = SensorCategory.values
        .where((cat) => _countForCategory(cat) > 0)
        .toList();

    return [
      // "All" option first
      ModeOption<SensorCategory?>(
        value: null,
        icon: Icons.grid_view,
        label: 'All',
        color: ModeSelectorColor.neutral,
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

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

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
    final accentBgColor = hasAlerts
        ? (isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight5)
        : hasHealthIssues
            ? (isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight5)
            : (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5);

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
      title: 'Sensors',
      subtitle: subtitle,
      subtitleColor: (hasAlerts || hasHealthIssues) ? accentColor : null,
      backgroundColor: AppColors.blank,
      leading: HeaderDeviceIcon(
        icon: MdiIcons.accessPointNetwork,
        backgroundColor: accentBgColor,
        iconColor: accentColor,
      ),
      trailing: HeaderHomeButton(
        onTap: _navigateToHome,
      ),
    );
  }

  // --------------------------------------------------------------------------
  // CATEGORY SELECTOR
  // --------------------------------------------------------------------------

  Widget _buildCategorySelector(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeOptions = _getCategoryModeOptions();

    // Build status icons for categories with alerts
    final Map<SensorCategory?, (IconData, Color)> statusIcons = {};
    for (final cat in SensorCategory.values) {
      final hasAlert = _sensors.any(
        (s) => s.category == cat && s.status == SensorStatus.alert,
      );
      if (hasAlert) {
        statusIcons[cat] = (
          Icons.warning,
          isDark ? AppColorsDark.danger : AppColorsLight.danger,
        );
      }
    }

    return ModeSelector<SensorCategory?>(
      modes: modeOptions,
      selectedValue: _selectedCategory,
      onChanged: (category) => setState(() => _selectedCategory = category),
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.top,
      scrollable: true,
      statusIcons: statusIcons,
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context) {
    final isAtLeastMedium = _screenService.isAtLeastMedium;
    final isSmallScreen = _screenService.isSmallScreen;
    final sensorsPerRow = isAtLeastMedium ? 3 : 2;

    return PortraitViewLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_hasAlerts) _buildAlertBanner(context),
          if (_selectedCategory == null) ...[
            _buildSummaryCards(context, compact: isSmallScreen),
            AppSpacings.spacingLgVertical,
          ],
          _buildSensorGrid(context, crossAxisCount: sensorsPerRow, childAspectRatio: isSmallScreen ? 1.0 : 0.9),
        ],
      ),
      modeSelector: _buildCategorySelector(context),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

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
      modeSelector: _buildLandscapeCategorySelector(context),
    );
  }

  /// Build vertical category selector for landscape layout
  Widget _buildLandscapeCategorySelector(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeOptions = _getCategoryModeOptions();

    // Build status icons for categories with alerts
    final Map<SensorCategory?, (IconData, Color)> statusIcons = {};
    for (final cat in SensorCategory.values) {
      final hasAlert = _sensors.any(
        (s) => s.category == cat && s.status == SensorStatus.alert,
      );
      if (hasAlert) {
        statusIcons[cat] = (
          Icons.warning,
          isDark ? AppColorsDark.danger : AppColorsLight.danger,
        );
      }
    }

    return ModeSelector<SensorCategory?>(
      modes: modeOptions,
      selectedValue: _selectedCategory,
      onChanged: (category) => setState(() => _selectedCategory = category),
      orientation: ModeSelectorOrientation.vertical,
      iconPlacement: ModeSelectorIconPlacement.top,
      scrollable: true,
      statusIcons: statusIcons,
    );
  }

  // --------------------------------------------------------------------------
  // ALERT BANNER
  // --------------------------------------------------------------------------

  Widget _buildAlertBanner(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final alertSensor =
        _sensors.firstWhere((s) => s.status == SensorStatus.alert);
    final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;

    return Container(
      padding: AppSpacings.paddingMd,
      margin: EdgeInsets.only(bottom: AppSpacings.pLg),
      decoration: BoxDecoration(
        color: dangerColor.withValues(alpha: isDark ? 0.15 : 0.1),
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(color: dangerColor.withValues(alpha: 0.3), width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: _scale(36),
            height: _scale(36),
            decoration: BoxDecoration(
              color: dangerColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.warning_amber, color: dangerColor, size: _scale(20)),
          ),
          AppSpacings.spacingMdHorizontal,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'High ${alertSensor.name} Alert',
                  style: TextStyle(
                    color: dangerColor,
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                AppSpacings.spacingXsVertical,
                Text(
                  '${alertSensor.name} exceeded threshold',
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                    fontSize: AppFontSize.small,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => _openSensorDetail(context, alertSensor),
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.pMd,
                vertical: AppSpacings.pSm,
              ),
              decoration: BoxDecoration(
                color: dangerColor,
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
              ),
              child: Text(
                'View',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // SUMMARY CARDS
  // --------------------------------------------------------------------------

  /// Build summary data items for the environment
  List<({String name, String status, IconData icon, Color color})> _buildSummaryItems({required bool isDark}) {
    final env = _environment;
    final items = <({String name, String status, IconData icon, Color color})>[];

    if (env?.averageTemperature != null) {
      items.add((
        name: '${_formatter.formatDecimal(env!.averageTemperature!, decimalPlaces: 1)}°C',
        status: 'Avg Temperature',
        icon: MdiIcons.thermometer,
        color: isDark ? AppColorsDark.info : AppColorsLight.info,
      ));
    }

    if (env?.averageHumidity != null) {
      items.add((
        name: '${_formatter.formatInteger(env!.averageHumidity!.round())}%',
        status: 'Avg Humidity',
        icon: MdiIcons.waterPercent,
        color: isDark ? AppColorsDark.success : AppColorsLight.success,
      ));
    }

    if (env?.averageIlluminance != null) {
      items.add((
        name: '${_formatter.formatInteger(env!.averageIlluminance!.round())} lux',
        status: 'Illuminance',
        icon: MdiIcons.weatherSunny,
        color: isDark ? AppColorsDark.warning : AppColorsLight.warning,
      ));
    } else if (env?.averagePressure != null) {
      items.add((
        name: '${_formatter.formatInteger(env!.averagePressure!.round())} hPa',
        status: 'Pressure',
        icon: MdiIcons.gaugeEmpty,
        color: isDark ? AppColorsDark.info : AppColorsLight.info,
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
            iconAccentColor: item.color,
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
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
          width: 1,
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

  // --------------------------------------------------------------------------
  // SENSOR GRID
  // --------------------------------------------------------------------------

  Widget _buildSensorGrid(BuildContext context, {required int crossAxisCount, double childAspectRatio = 1.0}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final filtered = _filteredSensors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.grid_view,
              size: _scale(18),
              color: isDark
                  ? AppTextColorDark.secondary
                  : AppTextColorLight.secondary,
            ),
            AppSpacings.spacingSmHorizontal,
            Text(
              _selectedCategory == null
                  ? 'ALL SENSORS'
                  : _getCategoryLabel(_selectedCategory!).toUpperCase(),
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
            const Spacer(),
            Text(
              '${filtered.length} sensors',
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.placeholder
                    : AppTextColorLight.placeholder,
                fontSize: AppFontSize.extraSmall,
              ),
            ),
          ],
        ),
        AppSpacings.spacingMdVertical,
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
    final categoryBgColor = _getCategoryLightColor(context, sensor.category);

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
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(
            color: isAlert
                ? dangerColor
                : (isDark
                    ? AppBorderColorDark.light
                    : AppBorderColorLight.light),
            width: 1,
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
                    color: isAlert ? dangerColor.withValues(alpha: 0.15) : categoryBgColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    sensor.icon,
                    size: _scale(20),
                    color: isAlert ? dangerColor : categoryColor,
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

  // --------------------------------------------------------------------------
  // SENSOR DETAIL
  // --------------------------------------------------------------------------

  void _openSensorDetail(BuildContext context, SensorData sensor) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _SensorDetailPage(
          sensor: sensor,
          roomId: _roomId,
        ),
      ),
    );
  }
}

// ============================================================================
// SENSOR DETAIL PAGE
// ============================================================================

class _SensorDetailPage extends StatefulWidget {
  final SensorData sensor;
  final String roomId;

  const _SensorDetailPage({
    required this.sensor,
    required this.roomId,
  });

  @override
  State<_SensorDetailPage> createState() => _SensorDetailPageState();
}

class _SensorDetailPageState extends State<_SensorDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SpaceStateRepository? _spaceStateRepository;
  SpacesService? _spacesService;
  DevicesService? _devicesService;
  PropertyTimeseriesService? _timeseriesService;
  Timer? _freshnessTimer;

  int _selectedPeriod = 1; // 0=1H, 1=24H, 2=7D, 3=30D
  bool _isLoadingTimeseries = false;
  PropertyTimeseries? _timeseries;

  /// Live sensor data, updated from repository on WebSocket changes
  late SensorData _sensor;

  @override
  void initState() {
    super.initState();

    _sensor = widget.sensor;

    try {
      _spacesService = locator<SpacesService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorDetailPage] Failed to get SpacesService: $e');
      }
    }

    try {
      _devicesService = locator<DevicesService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorDetailPage] Failed to get DevicesService: $e');
      }
    }

    try {
      _spaceStateRepository = locator<SpaceStateRepository>();
      _spaceStateRepository?.addListener(_onStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorDetailPage] Failed to get SpaceStateRepository: $e');
      }
    }

    try {
      _timeseriesService = locator<PropertyTimeseriesService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorDetailPage] Failed to get PropertyTimeseriesService: $e');
      }
    }

    // Fetch initial time series data
    _fetchTimeseries();

    // Periodic refresh so freshness indicators update over time
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
    _spaceStateRepository?.removeListener(_onStateChanged);
    super.dispose();
  }

  void _onStateChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _refreshSensorData();
      }
    });
  }

  /// Find updated reading from live state and rebuild SensorData
  void _refreshSensorData() {
    final sensorState = _spaceStateRepository?.getSensorState(widget.roomId);
    if (sensorState == null) return;

    final roomName = _spacesService?.getSpace(widget.roomId)?.name ?? 'Room';

    for (final roleReadings in sensorState.readings) {
      for (final reading in roleReadings.readings) {
        if (reading.channelId == _sensor.id) {
          // Found matching reading — rebuild SensorData with fresh values
          var deviceLabel = reading.deviceName;
          if (deviceLabel.toLowerCase().startsWith(roomName.toLowerCase())) {
            deviceLabel = deviceLabel.substring(roomName.length).trim();
            if (deviceLabel.startsWith('-') || deviceLabel.startsWith('–')) {
              deviceLabel = deviceLabel.substring(1).trim();
            }
          }
          if (deviceLabel.isEmpty) {
            deviceLabel = reading.deviceName;
          }

          final deviceOnline = _devicesService?.getDevice(reading.deviceId)?.isOnline ?? _sensor.deviceOnline;

          setState(() {
            _sensor = SensorData(
              id: reading.channelId,
              deviceId: reading.deviceId,
              propertyId: reading.propertyId,
              name: reading.channelName,
              location: deviceLabel,
              category: _sensor.category,
              value: _formatReadingValue(reading.value, reading.channelCategory),
              unit: reading.unit ?? '',
              status: _sensor.status,
              trend: _parseTrend(reading.trend),
              lastUpdated: reading.updatedAt ?? DateTime.now(),
              isBinary: _sensor.isBinary,
              channelCategory: _sensor.channelCategory,
              additionalReadings: reading.additionalReadings,
              deviceOnline: deviceOnline,
            );
          });

          // Fetch timeseries if we have propertyId but haven't loaded yet
          if (_sensor.propertyId != null && _timeseries == null && !_isLoadingTimeseries) {
            _fetchTimeseries();
          }
          return;
        }
      }
    }
  }

  /// Format a reading value the same way the list page does
  String _formatReadingValue(dynamic value, String channelCategory) {
    if (value == null) return '--';
    if (value is bool || value == 'true' || value == 'false' || value == '1' || value == '0') {
      return _SensorsDomainViewPageState._getBinaryLabel(channelCategory, _SensorsDomainViewPageState._isBooleanTrue(value));
    }
    if (value is num) {
      return value == value.toInt()
          ? NumberFormatUtils.defaultFormat.formatInteger(value.toInt())
          : NumberFormatUtils.defaultFormat.formatDecimal(value.toDouble(), decimalPlaces: 1);
    }
    return value.toString();
  }

  /// Map selected period to TimeRange
  TimeRange _getTimeRange() {
    switch (_selectedPeriod) {
      case 0:
        return TimeRange.oneHour;
      case 1:
        return TimeRange.oneDay;
      case 2:
        return TimeRange.sevenDays;
      case 3:
        return TimeRange.sevenDays; // 30D uses 7D bucket for now
      default:
        return TimeRange.oneDay;
    }
  }

  /// Fetch time series data for the current sensor and period
  Future<void> _fetchTimeseries() async {
    // Skip if no property ID or no timeseries service
    if (_sensor.propertyId == null || _timeseriesService == null) {
      return;
    }

    if (mounted) {
      setState(() {
        _isLoadingTimeseries = true;
      });
    }

    try {
      final timeseries = await _timeseriesService!.getTimeseries(
        channelId: _sensor.id,
        propertyId: _sensor.propertyId!,
        timeRange: _getTimeRange(),
      );

      if (mounted) {
        setState(() {
          _timeseries = timeseries;
          _isLoadingTimeseries = false;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorDetailPage] Failed to fetch timeseries: $e');
      }
      if (mounted) {
        setState(() {
          _isLoadingTimeseries = false;
        });
      }
    }
  }

  /// Handle period selection change
  void _onPeriodChanged(int period) {
    if (_selectedPeriod != period) {
      setState(() {
        _selectedPeriod = period;
      });
      _fetchTimeseries();
    }
  }


  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  // Theme-aware color getters - computed locally to support theme changes
  Color _getCategoryColor(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (_sensor.category) {
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

  Color _getCategoryBgColor(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (_sensor.category) {
      case SensorCategory.temperature:
        return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
      case SensorCategory.humidity:
        return isDark
            ? AppColorsDark.successLight5
            : AppColorsLight.successLight5;
      case SensorCategory.airQuality:
        return isDark
            ? AppColorsDark.successLight5
            : AppColorsLight.successLight5;
      case SensorCategory.motion:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case SensorCategory.safety:
        return isDark
            ? AppColorsDark.dangerLight5
            : AppColorsLight.dangerLight5;
      case SensorCategory.light:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case SensorCategory.energy:
        return isDark
            ? AppColorsDark.primaryLight5
            : AppColorsLight.primaryLight5;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: OrientationBuilder(
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
  }

  Widget _buildHeader(BuildContext context) {
    return PageHeader(
      title: _sensor.name,
      subtitle: '${_sensor.location} • ${_sensor.isOffline ? 'Offline' : 'Online'}',
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: () => Navigator.pop(context),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderDeviceIcon(
            icon: _sensor.icon,
            backgroundColor: _getCategoryBgColor(context),
            iconColor: _getCategoryColor(context),
          ),
        ],
      ),
    );
  }

  Widget _buildPortraitLayout(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        children: [
          _buildLargeValue(context),
          if (_sensor.isBinary)
            _buildEventLog(context)
          else ...[
            _buildStatsRow(context),
            _buildChart(context),
          ],
          if (_sensor.additionalReadings.isNotEmpty)
            _buildAdditionalReadings(context),
        ],
      ),
    );
  }

  Widget _buildLandscapeLayout(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isSmall = !_screenService.isLargeScreen;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left panel: Large value + Stats
        _buildLandscapeLeftPanel(context, isDark, isSmall),
        // Right panel: Chart or Event Log
        Expanded(
          child: Container(
            color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
            child: _sensor.isBinary
                ? SingleChildScrollView(
                    padding: EdgeInsets.only(top: AppSpacings.pLg),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildEventLog(context, withMargin: false, withDecoration: false),
                      ],
                    ),
                  )
                : Center(
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildChart(context, withMargin: false, withDecoration: false),
                        ],
                      ),
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildLandscapeLeftPanel(BuildContext context, bool isDark, bool isSmall) {
    final content = Container(
      width: isSmall ? null : _scale(320),
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        border: Border(
          right: BorderSide(
            color: isDark
                ? AppBorderColorDark.light
                : AppBorderColorLight.base,
            width: 1,
          ),
        ),
      ),
      child: SingleChildScrollView(
        child: Column(
          children: [
            _buildLargeValue(context),
            if (!_sensor.isBinary)
              _buildStatsRowCompact(context),
            if (_sensor.additionalReadings.isNotEmpty)
              _buildAdditionalReadings(context),
          ],
        ),
      ),
    );

    return isSmall ? Expanded(child: content) : content;
  }

  Widget _buildLargeValue(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isCompact = _screenService.isSmallScreen;

    return Padding(
      padding: EdgeInsets.only(
        top: isCompact ? AppSpacings.pSm : AppSpacings.pXl,
        bottom: isCompact ? AppSpacings.pSm : AppSpacings.pXl,
      ),
      child: Column(
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: RichText(
              text: TextSpan(
                style: TextStyle(
                  fontSize: _scale(isCompact ? 56 : 72),
                  fontWeight: FontWeight.w200,
                  color: _sensor.isOffline
                      ? (isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder)
                      : _getCategoryColor(context),
                ),
                children: _sensor.isOffline
                    ? [
                        TextSpan(
                          text: AppLocalizations.of(context)!.device_status_offline,
                        ),
                      ]
                    : [
                        TextSpan(
                          text: _SensorsDomainViewPageState.translateSensorValue(
                            AppLocalizations.of(context)!,
                            _sensor.value,
                            _sensor.channelCategory,
                            short: false,
                          ),
                        ),
                        TextSpan(
                          text: _sensor.unit,
                          style: TextStyle(
                            fontSize: _scale(isCompact ? 18 : 24),
                            fontWeight: FontWeight.w300,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AppSpacings.spacingSmVertical,
          Text(
            'Current ${_sensor.name}',
            style: TextStyle(
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
              fontSize: AppFontSize.base,
            ),
          ),
          AppSpacings.spacingXsVertical,
          // Freshness label (invisible when offline to avoid duplicate, but preserves layout space)
          Text(
            _sensor.isOffline
                ? ' '
                : SensorFreshnessUtils.label(
                    _sensor.freshness,
                    DateTime.now().difference(_sensor.lastUpdated),
                  ),
            style: TextStyle(
              color: _sensor.isOffline
                  ? Colors.transparent
                  : SensorFreshnessUtils.color(_sensor.freshness, isDark),
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  /// Get formatted value string for stats
  String _getStatsValue(String type) {
    final unit = _sensor.unit;

    // Use time series data if available
    if (_timeseries != null && _timeseries!.isNotEmpty) {
      double value;
      switch (type) {
        case 'min':
          value = _timeseries!.minValue;
          break;
        case 'max':
          value = _timeseries!.maxValue;
          break;
        case 'avg':
          value = _timeseries!.avgValue;
          break;
        default:
          return '--';
      }
      return '${NumberFormatUtils.defaultFormat.formatDecimal(value, decimalPlaces: 1)}$unit';
    }

    return '--';
  }

  /// Get period label for stats
  String _getPeriodLabel() {
    switch (_selectedPeriod) {
      case 0:
        return '1h';
      case 1:
        return '24h';
      case 2:
        return '7d';
      case 3:
        return '30d';
      default:
        return '24h';
    }
  }

  Widget _buildStatsRow(BuildContext context) {
    final periodLabel = _getPeriodLabel();
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
      child: Row(
        children: [
          _buildStatCard(context, '$periodLabel Min', _getStatsValue('min'), true),
          AppSpacings.spacingMdHorizontal,
          _buildStatCard(context, '$periodLabel Max', _getStatsValue('max'), false),
          AppSpacings.spacingMdHorizontal,
          _buildStatCard(context, '$periodLabel Avg', _getStatsValue('avg'), null),
        ],
      ),
    );
  }

  Widget _buildStatsRowCompact(BuildContext context) {
    return Row(
      children: [
        _buildStatCard(context, 'Min', _getStatsValue('min'), true),
        AppSpacings.spacingSmHorizontal,
        _buildStatCard(context, 'Max', _getStatsValue('max'), false),
        AppSpacings.spacingSmHorizontal,
        _buildStatCard(context, 'Avg', _getStatsValue('avg'), null),
      ],
    );
  }

  Widget _buildStatCard(BuildContext context, String label, String value, bool? isMin) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color? valueColor;
    if (isMin == true) {
      valueColor = isDark ? AppColorsDark.info : AppColorsLight.info;
    } else if (isMin == false) {
      valueColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
    }

    return Expanded(
      child: Container(
        padding: AppSpacings.paddingMd,
        decoration: BoxDecoration(
          color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(
            color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
            width: 1,
          ),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.placeholder
                    : AppTextColorLight.placeholder,
                fontSize: AppFontSize.extraSmall,
              ),
            ),
            AppSpacings.spacingXsVertical,
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: TextStyle(
                  color: valueColor ??
                      (isDark
                          ? AppTextColorDark.primary
                          : AppTextColorLight.primary),
                  fontSize: AppFontSize.large,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAdditionalReadings(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(bottom: AppSpacings.pSm),
            child: Text(
              'Additional Properties',
              style: TextStyle(
                fontSize: _scale(13),
                fontWeight: FontWeight.w600,
                color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
              ),
            ),
          ),
          Wrap(
            spacing: AppSpacings.pSm,
            runSpacing: AppSpacings.pSm,
            children: _sensor.additionalReadings.map((ar) {
              final label = _formatPropertyCategory(ar.propertyCategory);
              final valueStr = _formatAdditionalValue(ar.value, ar.propertyCategory, context);
              final unitStr = ar.unit != null && ar.unit!.isNotEmpty ? ' ${ar.unit}' : '';
              final freshness = SensorFreshnessUtils.evaluate(ar.updatedAt, _sensor.category);
              final freshnessColor = SensorFreshnessUtils.color(freshness, isDark);

              return Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                  vertical: AppSpacings.pSm,
                ),
                decoration: BoxDecoration(
                  color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
                  borderRadius: BorderRadius.circular(AppSpacings.pSm),
                  border: Border.all(
                    color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: freshnessColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    SizedBox(width: AppSpacings.pSm),
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: _scale(11),
                        color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
                      ),
                    ),
                    SizedBox(width: AppSpacings.pSm),
                    Text(
                      '$valueStr$unitStr',
                      style: TextStyle(
                        fontSize: _scale(12),
                        fontWeight: FontWeight.w600,
                        color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  String _formatPropertyCategory(String category) {
    return category
        .split('_')
        .map((w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
        .join(' ');
  }

  String _formatAdditionalValue(dynamic value, String propertyCategory, BuildContext context) {
    if (value == null) return '--';
    if (value is num) {
      return value == value.toInt()
          ? NumberFormatUtils.defaultFormat.formatInteger(value.toInt())
          : NumberFormatUtils.defaultFormat.formatDecimal(value.toDouble(), decimalPlaces: 1);
    }
    final strValue = value.toString();
    // Try enum translation for non-numeric string values
    if (value is String && double.tryParse(strValue) == null) {
      final l = AppLocalizations.of(context);
      if (l != null && _sensor.channelCategory != null) {
        final translated = SensorEnumUtils.translate(
          l, _sensor.channelCategory!, propertyCategory, strValue, short: false,
        );
        if (translated != null) return translated;
      }
    }
    return strValue;
  }

  Widget _buildEventLog(BuildContext context, {bool withMargin = true, bool withDecoration = true}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: withMargin ? AppSpacings.paddingLg : EdgeInsets.zero,
      padding: withDecoration
          ? AppSpacings.paddingLg
          : EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
      decoration: withDecoration
          ? BoxDecoration(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
              borderRadius: BorderRadius.circular(AppBorderRadius.round),
              border: Border.all(
                color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
                width: 1,
              ),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: withDecoration ? MainAxisAlignment.start : MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Event Log',
                style: TextStyle(
                  color: isDark
                      ? AppTextColorDark.primary
                      : AppTextColorLight.primary,
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Container(
                padding: EdgeInsets.all(AppSpacings.pXs),
                decoration: BoxDecoration(
                  color: isDark ? AppFillColorDark.base : AppFillColorLight.base,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Row(
                  children: [
                    _buildPeriodButton(context, '1H', 0),
                    _buildPeriodButton(context, '24H', 1),
                    _buildPeriodButton(context, '7D', 2),
                    _buildPeriodButton(context, '30D', 3),
                  ],
                ),
              ),
            ],
          ),
          AppSpacings.spacingMdVertical,
          _isLoadingTimeseries
              ? SizedBox(
                  height: _scale(160),
                  child: Center(
                    child: SizedBox(
                      width: _scale(24),
                      height: _scale(24),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: _getCategoryColor(context),
                      ),
                    ),
                  ),
                )
              : (_timeseries != null && _timeseries!.isNotEmpty)
                  ? _buildEventLogEntries(context)
                  : SizedBox(
                      height: _scale(160),
                      child: Center(
                        child: Text(
                          'No events recorded',
                          style: TextStyle(
                            color: isDark
                                ? AppTextColorDark.placeholder
                                : AppTextColorLight.placeholder,
                            fontSize: AppFontSize.small,
                          ),
                        ),
                      ),
                    ),
        ],
      ),
    );
  }

  Widget _buildEventLogEntries(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final points = _timeseries!.points;

    // Filter to state changes only (skip consecutive same-state points)
    final events = <TimeseriesPoint>[];
    for (int i = 0; i < points.length; i++) {
      final isActive = points[i].numericValue >= 0.5;
      if (i == 0 || (points[i - 1].numericValue >= 0.5) != isActive) {
        events.add(points[i]);
      }
    }

    // Show most recent first
    final reversedEvents = events.reversed.toList();

    if (reversedEvents.isEmpty) {
      return SizedBox(
        height: _scale(160),
        child: Center(
          child: Text(
            'No state changes',
            style: TextStyle(
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
              fontSize: AppFontSize.small,
            ),
          ),
        ),
      );
    }

    // Time format depends on selected period
    final useShortDate = _selectedPeriod <= 1; // 1H or 24H
    final dateFormat = useShortDate
        ? DateFormat.Hm()
        : DateFormat('MMM d, HH:mm');

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: _scale(200)),
      child: ListView.separated(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        itemCount: reversedEvents.length,
        separatorBuilder: (_, __) => Divider(
          height: 1,
          color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
        ),
        itemBuilder: (context, index) {
          final point = reversedEvents[index];
          final isActive = point.numericValue >= 0.5;
          final stateLabel = _SensorsDomainViewPageState._getBinaryLabelLong(
            _sensor.channelCategory ?? '',
            isActive,
          );

          final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
          final successColor = isDark ? AppColorsDark.success : AppColorsLight.success;
          final dotColor = isActive ? dangerColor : successColor;
          final textColor = isActive ? dangerColor : (isDark
              ? AppTextColorDark.secondary
              : AppTextColorLight.secondary);

          return Padding(
            padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
            child: Row(
              children: [
                Container(
                  width: _scale(8),
                  height: _scale(8),
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
                SizedBox(width: AppSpacings.pMd),
                Expanded(
                  child: Text(
                    stateLabel,
                    style: TextStyle(
                      color: textColor,
                      fontSize: AppFontSize.small,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                Text(
                  dateFormat.format(point.time.toLocal()),
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.placeholder
                        : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildChart(BuildContext context, {bool withMargin = true, bool withDecoration = true}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: withMargin ? AppSpacings.paddingLg : EdgeInsets.zero,
      padding: withDecoration
          ? AppSpacings.paddingLg
          : EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
      decoration: withDecoration
          ? BoxDecoration(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
              borderRadius: BorderRadius.circular(AppBorderRadius.round),
              border: Border.all(
                color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
                width: 1,
              ),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: withDecoration ? MainAxisAlignment.start : MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'History',
                style: TextStyle(
                  color: isDark
                      ? AppTextColorDark.primary
                      : AppTextColorLight.primary,
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Container(
                padding: EdgeInsets.all(AppSpacings.pXs),
                decoration: BoxDecoration(
                  color: isDark ? AppFillColorDark.base : AppFillColorLight.base,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Row(
                  children: [
                    _buildPeriodButton(context, '1H', 0),
                    _buildPeriodButton(context, '24H', 1),
                    _buildPeriodButton(context, '7D', 2),
                    _buildPeriodButton(context, '30D', 3),
                  ],
                ),
              ),
            ],
          ),
          AppSpacings.spacingMdVertical,
          SizedBox(
            height: _scale(160),
            child: _isLoadingTimeseries
                ? Center(
                    child: SizedBox(
                      width: _scale(24),
                      height: _scale(24),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: _getCategoryColor(context),
                      ),
                    ),
                  )
                : (_timeseries != null && _timeseries!.isNotEmpty)
                    ? CustomPaint(
                        size: Size(double.infinity, _scale(160)),
                        painter: _ChartPainter(
                          color: _getCategoryColor(context),
                          labelColor: isDark
                              ? AppTextColorDark.secondary
                              : AppTextColorLight.secondary,
                          fontSize: AppFontSize.extraSmall,
                          timeseries: _timeseries,
                        ),
                      )
                    : Center(
                        child: Text(
                          'No history data available',
                          style: TextStyle(
                            color: isDark
                                ? AppTextColorDark.placeholder
                                : AppTextColorLight.placeholder,
                            fontSize: AppFontSize.small,
                          ),
                        ),
                      ),
          ),
          AppSpacings.spacingSmVertical,
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _getTimeLabels()
                .map((label) => _buildTimeLabel(context, label))
                .toList(),
          ),
        ],
      ),
    );
  }

  List<String> _getTimeLabels() {
    switch (_selectedPeriod) {
      case 0: // 1H
        return ['-60m', '-45m', '-30m', '-15m', 'Now'];
      case 1: // 24H
        return ['00:00', '06:00', '12:00', '18:00', 'Now'];
      case 2: // 7D
        return ['-7d', '-5d', '-3d', '-1d', 'Now'];
      case 3: // 30D
        return ['-30d', '-22d', '-15d', '-7d', 'Now'];
      default:
        return ['00:00', '06:00', '12:00', '18:00', 'Now'];
    }
  }

  Widget _buildTimeLabel(BuildContext context, String text) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Text(
      text,
      style: TextStyle(
        color: isDark
            ? AppTextColorDark.placeholder
            : AppTextColorLight.placeholder,
        fontSize: AppFontSize.extraSmall,
      ),
    );
  }

  Widget _buildPeriodButton(BuildContext context, String label, int index) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isSelected = _selectedPeriod == index;

    return GestureDetector(
      onTap: () => _onPeriodChanged(index),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pXs,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? AppFillColorDark.light : AppFillColorLight.light)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(AppBorderRadius.small),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 3,
                    offset: const Offset(0, 1),
                  )
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected
                ? (isDark
                    ? AppTextColorDark.primary
                    : AppTextColorLight.primary)
                : (isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary),
            fontSize: AppFontSize.extraSmall,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// CHART PAINTER
// ============================================================================

class _ChartPainter extends CustomPainter {
  final Color color;
  final Color labelColor;
  final double fontSize;
  final PropertyTimeseries? timeseries;

  static const double _labelWidth = 40.0;
  static const double _labelGap = 6.0;

  _ChartPainter({
    required this.color,
    required this.labelColor,
    this.fontSize = 11,
    this.timeseries,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final chartLeft = _labelWidth + _labelGap;
    final chartWidth = size.width - chartLeft;
    final chartHeight = size.height;

    // Compute nice tick values for Y-axis
    double niceMin = 0;
    double niceMax = 1;
    List<double> ticks = [0, 0.5, 1];

    if (timeseries != null && timeseries!.isNotEmpty) {
      ticks = _computeNiceTicks(timeseries!.minValue, timeseries!.maxValue);
      niceMin = ticks.first;
      niceMax = ticks.last;
    }

    final niceRange = niceMax - niceMin;

    // Y-axis labels and grid lines
    final gridPaint = Paint()
      ..color = color.withValues(alpha: 0.1)
      ..strokeWidth = 0.5;

    for (final tick in ticks) {
      final normalized = niceRange == 0 ? 0.5 : (tick - niceMin) / niceRange;
      final y = chartHeight * (1 - normalized);

      // Grid line
      canvas.drawLine(Offset(chartLeft, y), Offset(size.width, y), gridPaint);

      // Label
      if (timeseries != null && timeseries!.isNotEmpty) {
        final label = _formatLabel(tick);

        final textPainter = TextPainter(
          text: TextSpan(
            text: label,
            style: TextStyle(
              color: labelColor,
              fontSize: fontSize,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout(maxWidth: _labelWidth);

        textPainter.paint(
          canvas,
          Offset(
            _labelWidth - textPainter.width,
            y - textPainter.height / 2,
          ),
        );
      }
    }

    // Plot data points
    final points = <Offset>[];

    if (timeseries != null && timeseries!.isNotEmpty) {
      final data = timeseries!.points;

      for (int i = 0; i < data.length; i++) {
        final x = chartLeft +
            chartWidth * i / (data.length - 1).clamp(1, double.infinity);
        final normalizedValue = niceRange == 0
            ? 0.5
            : (data[i].numericValue - niceMin) / niceRange;
        final y = chartHeight * (1 - normalizedValue.clamp(0.0, 1.0));
        points.add(Offset(x, y));
      }
    }

    if (points.isEmpty) return;

    // Area fill
    final areaPath = Path()..moveTo(chartLeft, chartHeight);
    for (final point in points) {
      areaPath.lineTo(point.dx, point.dy);
    }
    areaPath.lineTo(points.last.dx, chartHeight);
    areaPath.close();

    final areaPaint = Paint()
      ..color = color.withValues(alpha: 0.1)
      ..style = PaintingStyle.fill;
    canvas.drawPath(areaPath, areaPaint);

    // Line
    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      linePath.lineTo(points[i].dx, points[i].dy);
    }

    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    canvas.drawPath(linePath, linePaint);

    // Current point (last data point)
    if (timeseries != null && timeseries!.isNotEmpty) {
      final lastPoint = points.last;
      canvas.drawCircle(lastPoint, 4, Paint()..color = color);
    }
  }

  /// Compute nice rounded tick values for Y-axis
  List<double> _computeNiceTicks(double dataMin, double dataMax, {int targetTicks = 5}) {
    if (dataMin == dataMax) {
      // Flat line — create range around the value
      final v = dataMin;
      if (v == 0) return [-1, -0.5, 0, 0.5, 1];
      final offset = v.abs() * 0.1;
      final step = _niceStep(offset * 2 / (targetTicks - 1));
      final nMin = ((v - offset) / step).floor() * step;
      return List.generate(targetTicks, (i) => _roundToStep(nMin + i * step, step));
    }

    final rawStep = (dataMax - dataMin) / (targetTicks - 1);
    final step = _niceStep(rawStep);

    final niceMin = (dataMin / step).floor() * step;
    final niceMax = (dataMax / step).ceil() * step;

    final ticks = <double>[];
    var tick = niceMin;
    while (tick <= niceMax + step * 0.5) {
      ticks.add(_roundToStep(tick, step));
      tick += step;
    }

    return ticks;
  }

  /// Find a "nice" step size (1, 2, 5 multiplied by power of 10)
  double _niceStep(double rawStep) {
    if (rawStep <= 0) return 1;
    final magnitude = _pow10((log(rawStep) / ln10).floor().toDouble());
    final fraction = rawStep / magnitude;

    double niceFraction;
    if (fraction <= 1.5) {
      niceFraction = 1;
    } else if (fraction <= 3) {
      niceFraction = 2;
    } else if (fraction <= 7) {
      niceFraction = 5;
    } else {
      niceFraction = 10;
    }

    return niceFraction * magnitude;
  }

  double _pow10(double exp) {
    if (exp >= 0) {
      double result = 1;
      for (int i = 0; i < exp.toInt(); i++) {
        result *= 10;
      }
      return result;
    } else {
      double result = 1;
      for (int i = 0; i < (-exp).toInt(); i++) {
        result /= 10;
      }
      return result;
    }
  }

  /// Round value to avoid floating point artifacts
  double _roundToStep(double value, double step) {
    if (step >= 1) return (value / step).round() * step;
    // For fractional steps, round to appropriate decimal places
    final decimals = -(log(step) / ln10).floor();
    final factor = _pow10(decimals.toDouble());
    return (value * factor).round() / factor;
  }

  String _formatLabel(double value) {
    if (value.abs() >= 1000) {
      return '${(value / 1000).toStringAsFixed(1)}k';
    }
    if (value == value.roundToDouble()) {
      return value.round().toString();
    }
    return value.toStringAsFixed(1);
  }

  @override
  bool shouldRepaint(covariant _ChartPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.timeseries != timeseries;
}
