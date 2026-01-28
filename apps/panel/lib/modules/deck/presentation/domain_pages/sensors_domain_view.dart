import 'package:event_bus/event_bus.dart';
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
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
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
  final double? minValue;
  final double? maxValue;
  final double? avgValue;
  final double? highThreshold;
  final double? lowThreshold;

  const SensorData({
    required this.id,
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
    this.minValue,
    this.maxValue,
    this.avgValue,
    this.highThreshold,
    this.lowThreshold,
  });

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

class SensorActivityItem {
  final String title;
  final String subtitle;
  final SensorCategory category;
  final DateTime timestamp;

  const SensorActivityItem({
    required this.title,
    required this.subtitle,
    required this.category,
    required this.timestamp,
  });

  String get timeAgo {
    final diff = DateTime.now().difference(timestamp);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hr ago';
    return '${diff.inDays} days ago';
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

  // Sensor data from API
  List<SensorData> _sensors = [];
  List<SensorActivityItem> _activity = [];

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

  /// Format sensor value for display
  String _formatSensorValue(dynamic value, String channelCategory) {
    if (value == null) return '--';

    // Boolean sensors (motion, occupancy, safety)
    if (value is bool) {
      return value ? 'Active' : 'Inactive';
    }
    if (value == 'true' || value == '1') return 'Active';
    if (value == 'false' || value == '0') return 'Inactive';

    // Numeric values
    if (value is num) {
      if (value is double) {
        return _formatter.formatDecimal(value, decimalPlaces: 1);
      }
      return _formatter.formatInteger(value.toInt());
    }

    return value.toString();
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
      _activity = [];
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

        sensors.add(SensorData(
          id: reading.channelId,
          propertyId: reading.propertyId,
          name: reading.channelName,
          location: deviceLabel,
          category: category,
          value: value,
          unit: reading.unit ?? '',
          status: status,
          trend: TrendDirection.stable, // Trend data not available from API yet
          lastUpdated: DateTime.now(),
        ));
      }
    }

    // Build activity list from recent events (safety alerts, motion detection)
    final List<SensorActivityItem> activity = [];

    // Add motion/occupancy events
    if (sensorState.motionDetected) {
      activity.add(SensorActivityItem(
        title: 'Motion detected',
        subtitle: roomName,
        category: SensorCategory.motion,
        timestamp: DateTime.now(),
      ));
    }

    if (sensorState.occupancyDetected) {
      activity.add(SensorActivityItem(
        title: 'Occupancy detected',
        subtitle: roomName,
        category: SensorCategory.motion,
        timestamp: DateTime.now(),
      ));
    }

    // Add safety alert events
    for (final alert in sensorState.safetyAlerts.where((a) => a.triggered)) {
      activity.add(SensorActivityItem(
        title: '${_formatAlertType(alert.channelCategory)} Alert',
        subtitle: alert.deviceName,
        category: SensorCategory.safety,
        timestamp: DateTime.now(),
      ));
    }

    _sensors = sensors;
    _activity = activity;

    if (mounted) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  /// Format alert type for display
  String _formatAlertType(String channelCategory) {
    switch (channelCategory.toLowerCase()) {
      case 'smoke':
        return 'Smoke';
      case 'gas':
        return 'Gas';
      case 'leak':
        return 'Water Leak';
      case 'carbon_monoxide':
        return 'CO';
      default:
        return 'Safety';
    }
  }

  /// Get aggregated environment data for summary cards
  SensorEnvironmentModel? get _environment {
    return _spaceStateRepository?.getSensorState(_roomId)?.environment;
  }


  @override
  void dispose() {
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
    final accentColor = hasAlerts
        ? (isDark ? AppColorsDark.danger : AppColorsLight.danger)
        : (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final accentBgColor = hasAlerts
        ? (isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight5)
        : (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5);

    String subtitle;
    if (hasAlerts) {
      subtitle = '$alertCount Alert${alertCount > 1 ? 's' : ''} Active';
    } else if (_sensors.isEmpty) {
      subtitle = 'No sensors configured';
    } else {
      subtitle = '${_sensors.length} sensor${_sensors.length > 1 ? 's' : ''} • All normal';
    }

    return PageHeader(
      title: 'Sensors',
      subtitle: subtitle,
      subtitleColor: hasAlerts ? accentColor : null,
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
    final sensorsPerRow = isLargeScreen ? 3 : 2;

    return LandscapeViewLayout(
      mainContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_selectedCategory == null) _buildSummaryCards(context),
          if (_selectedCategory == null) AppSpacings.spacingLgVertical,
          Expanded(
            child: _buildSensorGrid(context, crossAxisCount: sensorsPerRow),
          ),
        ],
      ),
      modeSelector: _buildLandscapeCategorySelector(context),
      additionalContent: _buildActivityPanel(context),
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
    final dangerBgColor =
        isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight5;

    return Container(
      padding: AppSpacings.paddingMd,
      margin: EdgeInsets.only(bottom: AppSpacings.pLg),
      decoration: BoxDecoration(
        color: dangerBgColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(color: dangerColor.withValues(alpha: 0.3), width: 1),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber, color: dangerColor, size: _scale(24)),
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
  List<({String name, String status, IconData icon, Color color})> _buildSummaryItems() {
    final env = _environment;
    final items = <({String name, String status, IconData icon, Color color})>[];

    if (env?.averageTemperature != null) {
      items.add((
        name: '${_formatter.formatDecimal(env!.averageTemperature!, decimalPlaces: 1)}°C',
        status: 'Avg Temperature',
        icon: MdiIcons.thermometer,
        color: AppColorsLight.info,
      ));
    }

    if (env?.averageHumidity != null) {
      items.add((
        name: '${_formatter.formatInteger(env!.averageHumidity!.round())}%',
        status: 'Avg Humidity',
        icon: MdiIcons.waterPercent,
        color: AppColorsLight.success,
      ));
    }

    if (env?.averageIlluminance != null) {
      items.add((
        name: '${_formatter.formatInteger(env!.averageIlluminance!.round())} lux',
        status: 'Illuminance',
        icon: MdiIcons.weatherSunny,
        color: AppColorsLight.warning,
      ));
    } else if (env?.averagePressure != null) {
      items.add((
        name: '${_formatter.formatInteger(env!.averagePressure!.round())} hPa',
        status: 'Pressure',
        icon: MdiIcons.gaugeEmpty,
        color: AppColorsLight.info,
      ));
    }

    return items;
  }

  Widget _buildSummaryCards(BuildContext context, {bool compact = false}) {
    final items = _buildSummaryItems();

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
    final isDark = Theme.of(context).brightness == Brightness.dark;
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
          color: isDark ? item.color : item.color,
        ),
      ));
    }

    return Row(children: cards);
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
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
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
    final isAlert = sensor.status == SensorStatus.alert;
    final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
    final dangerBgColor =
        isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight5;

    final categoryColor = _getCategoryColor(context, sensor.category);
    final categoryBgColor = _getCategoryLightColor(context, sensor.category);

    return GestureDetector(
      onTap: () => _openSensorDetail(context, sensor),
      child: Container(
        padding: AppSpacings.paddingMd,
        decoration: BoxDecoration(
          color: isAlert
              ? dangerBgColor
              : (isDark ? AppFillColorDark.light : AppFillColorLight.light),
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
            // Header: Icon + Status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: _scale(36),
                  height: _scale(36),
                  decoration: BoxDecoration(
                    color: isAlert ? dangerBgColor : categoryBgColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    sensor.icon,
                    size: _scale(20),
                    color: isAlert ? dangerColor : categoryColor,
                  ),
                ),
                _buildStatusDot(context, sensor.status),
              ],
            ),
            AppSpacings.spacingMdVertical,

            // Name
            Text(
              sensor.name,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
                fontSize: AppFontSize.small,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            // Device name
            Text(
              sensor.location,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.placeholder
                    : AppTextColorLight.placeholder,
                fontSize: AppFontSize.extraSmall,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            AppSpacings.spacingSmVertical,

            // Value
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: RichText(
                maxLines: 1,
                text: TextSpan(
                  style: TextStyle(
                    fontSize: _scale(24),
                    fontWeight: FontWeight.w300,
                    color: isAlert ? dangerColor : categoryColor,
                  ),
                  children: [
                    TextSpan(text: sensor.value),
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
            ),

            // Trend
            if (sensor.trendText != null) ...[
              const Spacer(),
              Row(
                children: [
                  _buildTrendIcon(context, sensor.trend, isAlert),
                  AppSpacings.spacingXsHorizontal,
                  Expanded(
                    child: Text(
                      sensor.trendText!,
                      style: TextStyle(
                        color: isAlert
                            ? dangerColor
                            : (isDark
                                ? AppTextColorDark.placeholder
                                : AppTextColorLight.placeholder),
                        fontSize: AppFontSize.extraSmall,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusDot(BuildContext context, SensorStatus status) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Color color;
    switch (status) {
      case SensorStatus.normal:
        color = isDark ? AppColorsDark.success : AppColorsLight.success;
        break;
      case SensorStatus.warning:
        color = isDark ? AppColorsDark.warning : AppColorsLight.warning;
        break;
      case SensorStatus.alert:
        color = isDark ? AppColorsDark.danger : AppColorsLight.danger;
        break;
      case SensorStatus.offline:
        color = isDark
            ? AppTextColorDark.placeholder
            : AppTextColorLight.placeholder;
        break;
    }

    return Container(
      width: _scale(8),
      height: _scale(8),
      decoration: BoxDecoration(
        color: color,
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

    // If alert, always use danger color regardless of direction
    if (isAlert) {
      IconData icon;
      switch (direction) {
        case TrendDirection.up:
          icon = Icons.arrow_upward;
          break;
        case TrendDirection.down:
          icon = Icons.arrow_downward;
          break;
        case TrendDirection.stable:
          icon = Icons.remove;
          break;
      }
      return Icon(icon, size: _scale(12), color: dangerColor);
    }

    IconData icon;
    Color color;

    switch (direction) {
      case TrendDirection.up:
        icon = Icons.arrow_upward;
        color = isDark ? AppColorsDark.danger : AppColorsLight.danger;
        break;
      case TrendDirection.down:
        icon = Icons.arrow_downward;
        color = isDark ? AppColorsDark.info : AppColorsLight.info;
        break;
      case TrendDirection.stable:
        icon = Icons.remove;
        color = isDark
            ? AppTextColorDark.placeholder
            : AppTextColorLight.placeholder;
        break;
    }

    return Icon(icon, size: _scale(12), color: color);
  }

  // --------------------------------------------------------------------------
  // ACTIVITY PANEL (Landscape)
  // --------------------------------------------------------------------------

  Widget _buildActivityPanel(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Expanded(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SectionTitle(title: 'Recent Activity', icon: Icons.history),
            AppSpacings.spacingMdVertical,
            ..._activity.map((item) => _buildActivityItem(context, item)),
            Divider(
              height: _scale(32),
              color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
            ),
            SectionTitle(title: 'Alerts', icon: Icons.warning_amber),
            AppSpacings.spacingMdVertical,
            if (_hasAlerts)
              ..._sensors
                  .where((s) => s.status == SensorStatus.alert)
                  .map((sensor) => _buildAlertItem(context, sensor))
            else
              Center(
                child: Padding(
                  padding: EdgeInsets.all(AppSpacings.pLg),
                  child: Text(
                    'No active alerts',
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
      ),
    );
  }

  Widget _buildAlertItem(BuildContext context, SensorData sensor) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
    final dangerBgColor =
        isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight5;

    return GestureDetector(
      onTap: () => _openSensorDetail(context, sensor),
      child: Container(
        padding: AppSpacings.paddingSm,
        margin: EdgeInsets.only(bottom: AppSpacings.pSm),
        decoration: BoxDecoration(
          color: dangerBgColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: dangerColor.withValues(alpha: 0.3),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: _scale(32),
              height: _scale(32),
              decoration: BoxDecoration(
                color: dangerColor.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
              ),
              child: Icon(sensor.icon, size: _scale(18), color: dangerColor),
            ),
            AppSpacings.spacingMdHorizontal,
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'High ${sensor.name} Alert',
                    style: TextStyle(
                      color: dangerColor,
                      fontSize: AppFontSize.small,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  AppSpacings.spacingXsVertical,
                  Text(
                    '${sensor.value}${sensor.unit} - Threshold exceeded',
                    style: TextStyle(
                      color: isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary,
                      fontSize: AppFontSize.extraSmall,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              size: _scale(20),
              color: dangerColor,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivityItem(BuildContext context, SensorActivityItem item) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = _getCategoryColor(context, item.category);
    final lightColor = _getCategoryLightColor(context, item.category);

    IconData icon;
    switch (item.category) {
      case SensorCategory.temperature:
        icon = MdiIcons.thermometer;
        break;
      case SensorCategory.humidity:
        icon = MdiIcons.waterPercent;
        break;
      case SensorCategory.airQuality:
        icon = MdiIcons.airFilter;
        break;
      case SensorCategory.motion:
        icon = MdiIcons.motionSensor;
        break;
      case SensorCategory.safety:
        icon = MdiIcons.shieldCheck;
        break;
      case SensorCategory.light:
        icon = MdiIcons.weatherSunny;
        break;
      case SensorCategory.energy:
        icon = MdiIcons.flash;
        break;
    }

    return Container(
      padding: AppSpacings.paddingSm,
      margin: EdgeInsets.only(bottom: AppSpacings.pSm),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.base : AppFillColorLight.base,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        children: [
          Container(
            width: _scale(32),
            height: _scale(32),
            decoration: BoxDecoration(
              color: lightColor,
              borderRadius: BorderRadius.circular(AppBorderRadius.small),
            ),
            child: Icon(icon, size: _scale(18), color: color),
          ),
          AppSpacings.spacingMdHorizontal,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.primary
                        : AppTextColorLight.primary,
                    fontSize: AppFontSize.small,
                  ),
                ),
                AppSpacings.spacingXsVertical,
                Text(
                  item.subtitle,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.placeholder
                        : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
              ],
            ),
          ),
          Text(
            item.timeAgo,
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
  }

  // --------------------------------------------------------------------------
  // SENSOR DETAIL
  // --------------------------------------------------------------------------

  void _openSensorDetail(BuildContext context, SensorData sensor) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _SensorDetailPage(sensor: sensor),
      ),
    );
  }
}

// ============================================================================
// SENSOR DETAIL PAGE
// ============================================================================

class _SensorDetailPage extends StatefulWidget {
  final SensorData sensor;

  const _SensorDetailPage({
    required this.sensor,
  });

  @override
  State<_SensorDetailPage> createState() => _SensorDetailPageState();
}

class _SensorDetailPageState extends State<_SensorDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  PropertyTimeseriesService? _timeseriesService;

  int _selectedPeriod = 1; // 0=1H, 1=24H, 2=7D, 3=30D
  bool _notificationsEnabled = true;
  bool _isLoadingTimeseries = false;
  PropertyTimeseries? _timeseries;
  late double _highThreshold;
  late double _lowThreshold;

  late TextEditingController _highThresholdController;
  late TextEditingController _lowThresholdController;

  @override
  void initState() {
    super.initState();
    _highThreshold = widget.sensor.highThreshold ?? _getDefaultHighThreshold();
    _lowThreshold = widget.sensor.lowThreshold ?? _getDefaultLowThreshold();
    _highThresholdController =
        TextEditingController(text: NumberFormatUtils.defaultFormat.formatInteger(_highThreshold.toInt()));
    _lowThresholdController =
        TextEditingController(text: NumberFormatUtils.defaultFormat.formatInteger(_lowThreshold.toInt()));

    try {
      _timeseriesService = locator<PropertyTimeseriesService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SensorDetailPage] Failed to get PropertyTimeseriesService: $e');
      }
    }

    // Fetch initial time series data
    _fetchTimeseries();
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
    if (widget.sensor.propertyId == null || _timeseriesService == null) {
      return;
    }

    if (mounted) {
      setState(() {
        _isLoadingTimeseries = true;
      });
    }

    try {
      final timeseries = await _timeseriesService!.getTimeseries(
        channelId: widget.sensor.id,
        propertyId: widget.sensor.propertyId!,
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

  double _getDefaultHighThreshold() {
    switch (widget.sensor.category) {
      case SensorCategory.temperature:
        return 28.0;
      case SensorCategory.humidity:
        return 70.0;
      case SensorCategory.airQuality:
        return 1000.0;
      case SensorCategory.light:
        return 1000.0;
      case SensorCategory.energy:
        return 500.0;
      case SensorCategory.motion:
      case SensorCategory.safety:
        return 1.0;
    }
  }

  double _getDefaultLowThreshold() {
    switch (widget.sensor.category) {
      case SensorCategory.temperature:
        return 16.0;
      case SensorCategory.humidity:
        return 30.0;
      case SensorCategory.airQuality:
        return 400.0;
      case SensorCategory.light:
        return 50.0;
      case SensorCategory.energy:
        return 0.0;
      case SensorCategory.motion:
      case SensorCategory.safety:
        return 0.0;
    }
  }

  @override
  void dispose() {
    _highThresholdController.dispose();
    _lowThresholdController.dispose();
    super.dispose();
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  // Theme-aware color getters - computed locally to support theme changes
  Color _getCategoryColor(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (widget.sensor.category) {
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
    switch (widget.sensor.category) {
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
      title: widget.sensor.name,
      subtitle: '${widget.sensor.location} • Online',
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
            icon: widget.sensor.icon,
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
          _buildStatsRow(context),
          _buildChart(context),
          _buildThresholds(context),
        ],
      ),
    );
  }

  Widget _buildLandscapeLayout(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left panel: Large value + Stats
        Container(
          width: _scale(320),
          padding: AppSpacings.paddingLg,
          decoration: BoxDecoration(
            border: Border(
              right: BorderSide(
                color: isDark
                    ? AppBorderColorDark.light
                    : AppBorderColorLight.light,
                width: 1,
              ),
            ),
          ),
          child: Column(
            children: [
              _buildLargeValue(context),
              const Spacer(),
              _buildStatsRowCompact(context),
            ],
          ),
        ),
        // Right panel: Chart + Thresholds
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacings.paddingLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildChart(context, withMargin: false),
                AppSpacings.spacingLgVertical,
                _buildThresholdsLandscape(context),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLargeValue(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.symmetric(vertical: AppSpacings.pXl),
      child: Column(
        children: [
          RichText(
            text: TextSpan(
              style: TextStyle(
                fontSize: _scale(72),
                fontWeight: FontWeight.w200,
                color: _getCategoryColor(context),
              ),
              children: [
                TextSpan(text: widget.sensor.value),
                TextSpan(
                  text: widget.sensor.unit,
                  style: TextStyle(
                    fontSize: _scale(24),
                    fontWeight: FontWeight.w300,
                  ),
                ),
              ],
            ),
          ),
          AppSpacings.spacingSmVertical,
          Text(
            'Current ${widget.sensor.name}',
            style: TextStyle(
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
              fontSize: AppFontSize.base,
            ),
          ),
          AppSpacings.spacingXsVertical,
          Text(
            'Updated ${_formatTimestamp(widget.sensor.lastUpdated)}',
            style: TextStyle(
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
              fontSize: AppFontSize.small,
            ),
          ),
        ],
      ),
    );
  }

  String _formatTimestamp(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return '${diff.inSeconds} seconds ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes} minutes ago';
    return '${diff.inHours} hours ago';
  }

  String _getDefaultValue(String type) {
    // Provide sensible defaults based on sensor type
    switch (widget.sensor.category) {
      case SensorCategory.temperature:
        return type == 'min' ? '19.2' : (type == 'max' ? '24.8' : '22.1');
      case SensorCategory.humidity:
        return type == 'min' ? '35' : (type == 'max' ? '65' : '48');
      case SensorCategory.airQuality:
        return type == 'min' ? '400' : (type == 'max' ? '800' : '612');
      case SensorCategory.light:
        return type == 'min' ? '100' : (type == 'max' ? '800' : '420');
      case SensorCategory.energy:
        return type == 'min' ? '50' : (type == 'max' ? '500' : '245');
      case SensorCategory.motion:
      case SensorCategory.safety:
        return '-';
    }
  }

  /// Get formatted value string for stats
  String _getStatsValue(String type) {
    final unit = widget.sensor.unit;

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
          return '--$unit';
      }
      return '${NumberFormatUtils.defaultFormat.formatDecimal(value, decimalPlaces: 1)}$unit';
    }

    // Fall back to sensor data or default
    final sensorValue = type == 'min'
        ? widget.sensor.minValue
        : (type == 'max' ? widget.sensor.maxValue : widget.sensor.avgValue);

    if (sensorValue != null) {
      return '${NumberFormatUtils.defaultFormat.formatDecimal(sensorValue, decimalPlaces: 1)}$unit';
    }

    return '${_getDefaultValue(type)}$unit';
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
          color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
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
            Text(
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
          ],
        ),
      ),
    );
  }

  Widget _buildChart(BuildContext context, {bool withMargin = true}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: withMargin ? AppSpacings.paddingLg : EdgeInsets.zero,
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(
          color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
                : CustomPaint(
                    size: Size(double.infinity, _scale(160)),
                    painter: _ChartPainter(
                      color: _getCategoryColor(context),
                      timeseries: _timeseries,
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

  Widget _buildThresholds(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacings.pLg,
        0,
        AppSpacings.pLg,
        AppSpacings.pLg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.warning_amber,
                size: _scale(18),
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
              ),
              AppSpacings.spacingSmHorizontal,
              Text(
                'ALERT THRESHOLDS',
                style: TextStyle(
                  color: isDark
                      ? AppTextColorDark.secondary
                      : AppTextColorLight.secondary,
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          AppSpacings.spacingMdVertical,
          _buildThresholdRow(
            context,
            icon: Icons.arrow_upward,
            label: 'High Alert',
            controller: _highThresholdController,
            onChanged: (v) {
              setState(() => _highThreshold = v);
            },
          ),
          AppSpacings.spacingSmVertical,
          _buildThresholdRow(
            context,
            icon: Icons.arrow_downward,
            label: 'Low Alert',
            controller: _lowThresholdController,
            onChanged: (v) {
              setState(() => _lowThreshold = v);
            },
          ),
          AppSpacings.spacingSmVertical,
          _buildNotificationRow(context),
        ],
      ),
    );
  }

  Widget _buildThresholdsLandscape(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.warning_amber,
              size: _scale(18),
              color: isDark
                  ? AppTextColorDark.secondary
                  : AppTextColorLight.secondary,
            ),
            AppSpacings.spacingSmHorizontal,
            Text(
              'ALERT THRESHOLDS',
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        AppSpacings.spacingMdVertical,
        Row(
          children: [
            Expanded(
              child: _buildThresholdRow(
                context,
                icon: Icons.arrow_upward,
                label: 'High Alert',
                controller: _highThresholdController,
                onChanged: (v) {
                  setState(() => _highThreshold = v);
                },
              ),
            ),
            AppSpacings.spacingMdHorizontal,
            Expanded(
              child: _buildThresholdRow(
                context,
                icon: Icons.arrow_downward,
                label: 'Low Alert',
                controller: _lowThresholdController,
                onChanged: (v) {
                  setState(() => _lowThreshold = v);
                },
              ),
            ),
            AppSpacings.spacingMdHorizontal,
            Expanded(child: _buildNotificationRow(context)),
          ],
        ),
      ],
    );
  }

  Widget _buildThresholdRow(
    BuildContext context, {
    required IconData icon,
    required String label,
    required TextEditingController controller,
    required ValueChanged<double> onChanged,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pMd,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            size: _scale(20),
            color: isDark
                ? AppTextColorDark.secondary
                : AppTextColorLight.secondary,
          ),
          AppSpacings.spacingSmHorizontal,
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.primary
                    : AppTextColorLight.primary,
                fontSize: AppFontSize.base,
              ),
            ),
          ),
          SizedBox(
            width: _scale(60),
            child: TextField(
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.primary
                    : AppTextColorLight.primary,
                fontSize: AppFontSize.base,
              ),
              decoration: InputDecoration(
                contentPadding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pSm,
                  vertical: AppSpacings.pSm,
                ),
                filled: true,
                fillColor:
                    isDark ? AppFillColorDark.base : AppFillColorLight.base,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  borderSide: BorderSide.none,
                ),
              ),
              controller: controller,
              keyboardType: TextInputType.number,
              onChanged: (text) {
                final parsed = double.tryParse(text);
                if (parsed != null) onChanged(parsed);
              },
            ),
          ),
          AppSpacings.spacingSmHorizontal,
          Text(
            widget.sensor.unit,
            style: TextStyle(
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
              fontSize: AppFontSize.small,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationRow(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pMd,
      ),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.notifications_outlined,
            size: _scale(20),
            color: isDark
                ? AppTextColorDark.secondary
                : AppTextColorLight.secondary,
          ),
          AppSpacings.spacingSmHorizontal,
          Expanded(
            child: Text(
              'Notifications',
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.primary
                    : AppTextColorLight.primary,
                fontSize: AppFontSize.base,
              ),
            ),
          ),
          GestureDetector(
            onTap: () =>
                setState(() => _notificationsEnabled = !_notificationsEnabled),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: _scale(48),
              height: _scale(28),
              decoration: BoxDecoration(
                color: _notificationsEnabled
                    ? accentColor
                    : (isDark
                        ? AppFillColorDark.base
                        : AppFillColorLight.base),
                borderRadius: BorderRadius.circular(14),
              ),
              child: AnimatedAlign(
                duration: const Duration(milliseconds: 200),
                alignment: _notificationsEnabled
                    ? Alignment.centerRight
                    : Alignment.centerLeft,
                child: Container(
                  width: _scale(22),
                  height: _scale(22),
                  margin: EdgeInsets.all(_scale(3)),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppFillColorDark.light
                        : AppFillColorLight.light,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// CHART PAINTER
// ============================================================================

class _ChartPainter extends CustomPainter {
  final Color color;
  final PropertyTimeseries? timeseries;

  _ChartPainter({required this.color, this.timeseries});

  @override
  void paint(Canvas canvas, Size size) {
    // Grid lines
    final gridPaint = Paint()
      ..color = color.withValues(alpha: 0.1)
      ..strokeWidth = 0.5;

    for (int i = 1; i < 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // Use real time series data if available, otherwise show empty state
    final points = <Offset>[];

    if (timeseries != null && timeseries!.isNotEmpty) {
      // Use real data
      final data = timeseries!.points;
      final minVal = timeseries!.minValue;
      final maxVal = timeseries!.maxValue;
      final range = maxVal - minVal;

      // Add padding to range to avoid points at edges
      final paddedRange = range == 0 ? 1.0 : range * 1.2;
      final paddedMin = minVal - (range * 0.1);

      for (int i = 0; i < data.length; i++) {
        final x = size.width * i / (data.length - 1).clamp(1, double.infinity);
        // Invert Y since canvas Y increases downward
        final normalizedValue = (data[i].numericValue - paddedMin) / paddedRange;
        final y = size.height * (1 - normalizedValue.clamp(0.0, 1.0));
        points.add(Offset(x, y));
      }
    } else {
      // No data - draw flat line in center
      points.add(Offset(0, size.height * 0.5));
      points.add(Offset(size.width, size.height * 0.5));
    }

    if (points.isEmpty) return;

    // Area fill
    final areaPath = Path()..moveTo(0, size.height);
    for (final point in points) {
      areaPath.lineTo(point.dx, point.dy);
    }
    areaPath.lineTo(size.width, size.height);
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

  @override
  bool shouldRepaint(covariant _ChartPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.timeseries != timeseries;
}
