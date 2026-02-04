import 'dart:async';
import 'dart:math';

import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_channels_section.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/sensor_enum_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/services/property_timeseries.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class SensorDeviceDetail extends StatefulWidget {
  final SensorDeviceView _device;
  final String? initialChannelId;

  const SensorDeviceDetail({
    super.key,
    required SensorDeviceView device,
    this.initialChannelId,
  }) : _device = device;

  @override
  State<SensorDeviceDetail> createState() => _SensorDeviceDetailState();
}

class _SensorDeviceDetailState extends State<SensorDeviceDetail> {
  /// Selected channel index for multi-channel sensor devices.
  int _selectedChannelIndex = 0;

  /// Notifier to trigger bottom sheet rebuild when channel selection changes.
  final ValueNotifier<int> _channelListVersion = ValueNotifier(0);

  @override
  void initState() {
    super.initState();
    final allChannels = _getAllSensorChannels();
    if (allChannels.isEmpty) return;
    if (widget.initialChannelId != null) {
      final index =
          allChannels.indexWhere((s) => s.channel.id == widget.initialChannelId);
      if (index >= 0) {
        _selectedChannelIndex = index;
      }
    } else {
      _selectedChannelIndex = 0;
    }
  }

  @override
  void dispose() {
    _channelListVersion.dispose();
    super.dispose();
  }

  /// All sensor channels in display order (environmental, air quality, detection, device info).
  List<SensorData> _getAllSensorChannels() {
    return [
      ..._getEnvironmentalSensors(),
      ..._getAirQualitySensors(),
      ..._getDetectionSensors(),
      ..._getDeviceInfoSensors(),
    ];
  }

  bool get _isMultiChannel {
    final channels = _getAllSensorChannels();
    return channels.length > 1;
  }

  SensorData? get _selectedSensor {
    final channels = _getAllSensorChannels();
    if (channels.isEmpty) return null;
    if (_selectedChannelIndex < 0 || _selectedChannelIndex >= channels.length) {
      return channels.first;
    }
    return channels[_selectedChannelIndex];
  }

  void _handleChannelSelect(int index) {
    if (index != _selectedChannelIndex) {
      setState(() => _selectedChannelIndex = index);
      _channelListVersion.value++;
    }
  }

  /// Status text for a sensor channel tile (e.g. "23.5 °C" or "Detected").
  String _getSensorChannelStatus(SensorData data) {
    if (data.isDetection != null) {
      return (data.isDetection ?? false)
          ? (data.detectedLabel ?? 'Detected')
          : (data.notDetectedLabel ?? 'Not Detected');
    }
    if (data.property != null && data.valueFormatter != null) {
      return data.valueFormatter!(data.property!) ?? '—';
    }
    if (data.property != null) {
      return ValueUtils.formatValue(data.property!) ?? '—';
    }
    return '—';
  }

  /// Builds one channel tile for the channels bottom sheet (horizontal layout).
  Widget _buildChannelTile(BuildContext context, SensorData data, int index) {
    final isSelected = index == _selectedChannelIndex;
    return HorizontalTileStretched(
      icon: data.icon,
      activeIcon: data.icon,
      name: data.channel.name.isNotEmpty ? data.channel.name : data.label,
      status: _getSensorChannelStatus(data),
      isActive: false,
      isOffline: !widget._device.isOnline,
      isSelected: isSelected,
      onIconTap: null,
      onTileTap: () => _handleChannelSelect(index),
      showSelectionIndicator: true,
      showWarningBadge: data.isAlert ?? false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final allChannels = _getAllSensorChannels();
    if (allChannels.isEmpty) {
      return const SizedBox.shrink();
    }

    final selectedSensor = _selectedSensor;
    if (selectedSensor == null) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor =
        isDark ? AppBgColorDark.page : AppBgColorLight.page;

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(
              child: SensorDetailPage(
                sensor: selectedSensor,
                deviceName: widget._device.name,
                isDeviceOnline: widget._device.isOnline,
                contentOnly: true,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    final selectedSensor = _selectedSensor;
    if (selectedSensor == null) return const SizedBox.shrink();

    final title = selectedSensor.channel.name.isNotEmpty
        ? selectedSensor.channel.name
        : selectedSensor.label;
    final subtitle = widget._device.name;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return PageHeader(
      title: title,
      subtitle: subtitle,
      subtitleColor: secondaryColor,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: () => Navigator.of(context).pop(),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderMainIcon(
            icon: buildDeviceIcon(widget._device.category, widget._device.icon),
            color: ThemeColors.primary,
          ),
        ],
      ),
      trailing: _buildHeaderTrailing(context),
    );
  }

  Widget? _buildHeaderTrailing(BuildContext context) {
    if (!_isMultiChannel) return null;
    final channels = _getAllSensorChannels();
    return HeaderIconButton(
      icon: MdiIcons.accessPointNetwork,
      color: ThemeColors.neutral,
      onTap: () {
        final localizations = AppLocalizations.of(context)!;
        DeviceChannelsSection.showChannelsSheet(
          context,
          title: localizations.domain_sensors,
          icon: MdiIcons.accessPointNetwork,
          itemCount: channels.length,
          tileBuilder: (c, i) => _buildChannelTile(c, channels[i], i),
          listenable: _channelListVersion,
        );
      },
    );
  }

  List<SensorData> _getEnvironmentalSensors() {
    final sensors = <SensorData>[];

    if (widget._device.hasTemperature) {
      final channel = widget._device.temperatureChannel!;
      sensors.add(SensorData(
        label: 'Temperature',
        icon: MdiIcons.thermometer,
        channel: channel,
        property: channel.temperatureProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 1),
      ));
    }

    if (widget._device.hasHumidity) {
      final channel = widget._device.humidityChannel!;
      sensors.add(SensorData(
        label: 'Humidity',
        icon: MdiIcons.waterPercent,
        channel: channel,
        property: channel.humidityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    if (widget._device.hasPressure) {
      final channel = widget._device.pressureChannel!;
      sensors.add(SensorData(
        label: 'Pressure',
        icon: MdiIcons.gauge,
        channel: channel,
        property: channel.pressureProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    if (widget._device.hasIlluminance) {
      final channel = widget._device.illuminanceChannel!;
      sensors.add(SensorData(
        label: 'Illuminance',
        icon: MdiIcons.brightness6,
        channel: channel,
        property: channel.illuminanceProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    return sensors;
  }

  List<SensorData> _getAirQualitySensors() {
    final sensors = <SensorData>[];

    if (widget._device.hasCarbonDioxide) {
      final channel = widget._device.carbonDioxideChannel!;
      sensors.add(SensorData(
        label: 'Carbon Dioxide',
        icon: MdiIcons.moleculeCo2,
        channel: channel,
        property: channel.concentrationProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasCarbonMonoxide) {
      final channel = widget._device.carbonMonoxideChannel!;
      sensors.add(SensorData(
        label: 'Carbon Monoxide',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.concentrationProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'Detected' : null,
      ));
    }

    if (widget._device.hasOzone) {
      final channel = widget._device.ozoneChannel!;
      sensors.add(SensorData(
        label: 'Ozone',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.concentrationProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasNitrogenDioxide) {
      final channel = widget._device.nitrogenDioxideChannel!;
      sensors.add(SensorData(
        label: 'Nitrogen Dioxide',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.concentrationProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasSulphurDioxide) {
      final channel = widget._device.sulphurDioxideChannel!;
      sensors.add(SensorData(
        label: 'Sulphur Dioxide',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.concentrationProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasVolatileOrganicCompounds) {
      final channel = widget._device.volatileOrganicCompoundsChannel!;
      sensors.add(SensorData(
        label: 'VOC',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.concentrationProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasAirParticulate) {
      final channel = widget._device.airParticulateChannel!;
      sensors.add(SensorData(
        label: 'Particulate Matter',
        icon: MdiIcons.blur,
        channel: channel,
        property: channel.concentrationProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    return sensors;
  }

  List<SensorData> _getDetectionSensors() {
    final sensors = <SensorData>[];

    if (widget._device.hasMotion) {
      final channel = widget._device.motionChannel!;
      sensors.add(SensorData(
        label: 'Motion',
        icon: MdiIcons.motionSensor,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Detected',
        notDetectedLabel: 'Not Detected',
      ));
    }

    if (widget._device.hasOccupancy) {
      final channel = widget._device.occupancyChannel!;
      sensors.add(SensorData(
        label: 'Occupancy',
        icon: MdiIcons.accountCheck,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Detected',
        notDetectedLabel: 'Not Detected',
      ));
    }

    if (widget._device.hasContact) {
      final channel = widget._device.contactChannel!;
      sensors.add(SensorData(
        label: 'Contact',
        icon: channel.detected ? MdiIcons.doorOpen : MdiIcons.doorClosed,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Open',
        notDetectedLabel: 'Closed',
      ));
    }

    if (widget._device.hasLeak) {
      final channel = widget._device.leakChannel!;
      sensors.add(SensorData(
        label: 'Leak',
        icon: MdiIcons.waterAlert,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Detected',
        notDetectedLabel: 'Not Detected',
        isAlert: channel.detected,
      ));
    }

    if (widget._device.hasSmoke) {
      final channel = widget._device.smokeChannel!;
      sensors.add(SensorData(
        label: 'Smoke',
        icon: MdiIcons.smokingOff,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Detected',
        notDetectedLabel: 'Not Detected',
        isAlert: channel.detected,
      ));
    }

    return sensors;
  }

  List<SensorData> _getDeviceInfoSensors() {
    final sensors = <SensorData>[];

    if (widget._device.hasBattery) {
      final channel = widget._device.batteryChannel!;
      sensors.add(SensorData(
        label: 'Battery',
        icon: _getBatteryIcon(channel),
        channel: channel,
        property: channel.percentageProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.isLow,
        alertLabel: channel.isCharging
            ? 'Charging'
            : channel.isLow
                ? 'Low Battery'
                : null,
      ));
    }

    return sensors;
  }

  IconData _getBatteryIcon(BatteryChannelView channel) {
    if (channel.isCharging) {
      return MdiIcons.batteryCharging;
    }
    final percentage = channel.percentage;
    if (percentage >= 90) return MdiIcons.battery;
    if (percentage >= 70) return MdiIcons.battery80;
    if (percentage >= 50) return MdiIcons.battery60;
    if (percentage >= 30) return MdiIcons.battery40;
    if (percentage >= 10) return MdiIcons.battery20;
    return MdiIcons.batteryAlert;
  }
}

class SensorData {
  final String label;
  final IconData icon;
  final ChannelView channel;
  final ChannelPropertyView? property;
  final String? Function(ChannelPropertyView)? valueFormatter;
  final bool? isDetection;
  final String? detectedLabel;
  final String? notDetectedLabel;
  final bool? isAlert;
  final String? alertLabel;

  SensorData({
    required this.label,
    required this.icon,
    required this.channel,
    this.property,
    this.valueFormatter,
    this.isDetection,
    this.detectedLabel,
    this.notDetectedLabel,
    this.isAlert,
    this.alertLabel,
  });
}

class SensorSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<SensorData> sensors;
  final String? deviceName;
  final bool? isDeviceOnline;
  final String? scrollToChannelId;
  final GlobalKey? scrollToKey;

  const SensorSection({
    super.key,
    required this.title,
    required this.icon,
    required this.sensors,
    this.deviceName,
    this.isDeviceOnline,
    this.scrollToChannelId,
    this.scrollToKey,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(
            bottom: AppSpacings.pSm,
            top: AppSpacings.pMd,
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: screenService.scale(
                  18,
                  density: visualDensityService.density,
                ),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
              AppSpacings.spacingSmHorizontal,
              Text(
                title,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
            ],
          ),
        ),
        Wrap(
          spacing: AppSpacings.pSm,
          runSpacing: AppSpacings.pSm,
          children: sensors
              .map((sensor) {
                final card = SensorCard(
                  sensor: sensor,
                  deviceName: deviceName,
                  isDeviceOnline: isDeviceOnline,
                );
                if (scrollToChannelId != null &&
                    scrollToKey != null &&
                    sensor.channel.id == scrollToChannelId) {
                  return KeyedSubtree(key: scrollToKey, child: card);
                }
                return card;
              })
              .toList(),
        ),
        AppSpacings.spacingMdVertical,
      ],
    );
  }
}

class SensorCard extends StatelessWidget {
  final SensorData sensor;
  final String? deviceName;
  final bool? isDeviceOnline;

  const SensorCard({
    super.key,
    required this.sensor,
    this.deviceName,
    this.isDeviceOnline,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    final localizations = AppLocalizations.of(context)!;

    final isLight = Theme.of(context).brightness == Brightness.light;
    final isAlert = sensor.isAlert ?? false;

    return GestureDetector(
      onTap: sensor.property != null && sensor.isDetection == null
          ? () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => SensorDetailPage(
                    sensor: sensor,
                    deviceName: deviceName,
                    isDeviceOnline: isDeviceOnline,
                  ),
                ),
              )
          : null,
      child: Container(
        constraints: BoxConstraints(
          minWidth: screenService.scale(
            140,
            density: visualDensityService.density,
          ),
        ),
        padding: AppSpacings.paddingMd,
        decoration: BoxDecoration(
          color: isLight
              ? (isAlert
                  ? AppColorsLight.warningLight9
                  : AppFillColorLight.base)
              : (isAlert
                  ? AppColorsDark.warningLight9
                  : AppFillColorDark.base),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isLight
                ? (isAlert ? AppColorsLight.warning : AppBorderColorLight.base)
                : (isAlert ? AppColorsDark.warning : AppBorderColorDark.base),
            width: screenService.scale(
              1,
              density: visualDensityService.density,
            ),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  sensor.icon,
                  size: screenService.scale(
                    20,
                    density: visualDensityService.density,
                  ),
                  color: isAlert
                      ? (isLight
                          ? AppColorsLight.warning
                          : AppColorsDark.warning)
                      : (isLight
                          ? AppColorsLight.primary
                          : AppColorsDark.primary),
                ),
                AppSpacings.spacingSmHorizontal,
                Flexible(
                  child: Text(
                    SensorEnumUtils.translateSensorLabel(localizations, sensor.label),
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w500,
                      color: isLight
                          ? AppTextColorLight.secondary
                          : AppTextColorDark.secondary,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            AppSpacings.spacingSmVertical,
            _buildValue(context, localizations),
            if (sensor.alertLabel != null) ...[
              AppSpacings.spacingXsVertical,
              Text(
                sensor.alertLabel!,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  color:
                      isLight ? AppColorsLight.warning : AppColorsDark.warning,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildValue(BuildContext context, AppLocalizations localizations) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    final isLight = Theme.of(context).brightness == Brightness.light;

    if (sensor.isDetection != null) {
      final isDetected = sensor.isDetection ?? false;
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDetected
                  ? (isLight ? AppColorsLight.success : AppColorsDark.success)
                  : (isLight
                      ? AppTextColorLight.placeholder
                      : AppTextColorDark.placeholder),
            ),
          ),
          AppSpacings.spacingXsHorizontal,
          Text(
            isDetected
                ? (sensor.detectedLabel ?? 'Detected')
                : (sensor.notDetectedLabel ?? 'Not Detected'),
            style: TextStyle(
              fontSize: AppFontSize.base,
              fontWeight: FontWeight.w600,
              color: isLight
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
          ),
        ],
      );
    }

    if (sensor.property == null) {
      return Text(
        localizations.value_not_available,
        style: TextStyle(
          fontSize: AppFontSize.base,
          fontWeight: FontWeight.w600,
          color:
              isLight ? AppTextColorLight.primary : AppTextColorDark.primary,
        ),
      );
    }

    final value = sensor.valueFormatter != null
        ? sensor.valueFormatter!(sensor.property!)
        : ValueUtils.formatValue(sensor.property!);

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          value ?? localizations.value_not_available,
          style: TextStyle(
            fontSize: screenService.scale(
              24,
              density: visualDensityService.density,
            ),
            fontFamily: 'DIN1451',
            fontWeight: FontWeight.w500,
            color:
                isLight ? AppTextColorLight.primary : AppTextColorDark.primary,
          ),
        ),
        if (sensor.property?.unit != null) ...[
          AppSpacings.spacingXsHorizontal,
          Text(
            sensor.property!.unit!,
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: isLight
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
          ),
        ],
      ],
    );
  }

}

// =============================================================================
// SENSOR DETAIL PAGE (full-screen, from deck sensors domain)
// =============================================================================

/// Full-screen sensor detail with current value, history chart, period selector,
/// and optional event log for binary sensors. Uses device [SensorData].
///
/// When [contentOnly] is true, only the detail content is built (no scaffold/header).
/// Use this to embed the detail inside another page (e.g. device detail body).
class SensorDetailPage extends StatefulWidget {
  final SensorData sensor;
  final String? deviceName;
  final bool? isDeviceOnline;

  /// When true, build only the content (charts, value, stats/event log), no scaffold or header.
  final bool contentOnly;

  const SensorDetailPage({
    super.key,
    required this.sensor,
    this.deviceName,
    this.isDeviceOnline,
    this.contentOnly = false,
  });

  @override
  State<SensorDetailPage> createState() => _SensorDetailPageState();
}

class _SensorDetailPageState extends State<SensorDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final PropertyTimeseriesService _timeseriesService =
      locator<PropertyTimeseriesService>();

  int _selectedPeriod = 1; // 0=1H, 1=24H, 2=7D, 3=30D
  bool _isLoadingTimeseries = false;
  PropertyTimeseries? _timeseries;

  bool get _isBinary => widget.sensor.isDetection != null;
  String get _channelId => widget.sensor.channel.id;
  String? get _propertyId => widget.sensor.property?.id;
  String get _currentValue {
    // For binary sensors, use the detection labels
    if (_isBinary) {
      return widget.sensor.isDetection!
          ? (widget.sensor.detectedLabel ?? 'Active')
          : (widget.sensor.notDetectedLabel ?? 'Inactive');
    }
    // For other sensors, use the value formatter or default formatting
    return widget.sensor.property != null
        ? (widget.sensor.valueFormatter != null
            ? (widget.sensor.valueFormatter!(widget.sensor.property!) ?? '--')
            : ValueUtils.formatValue(widget.sensor.property!) ?? '--')
        : '--';
  }
  String get _unit => widget.sensor.property?.unit ?? '';
  bool get _isOffline => widget.isDeviceOnline == false;
  String get _location => widget.deviceName ?? widget.sensor.channel.name;

  TimeRange _getTimeRange() {
    switch (_selectedPeriod) {
      case 0:
        return TimeRange.oneHour;
      case 1:
        return TimeRange.oneDay;
      case 2:
      case 3:
        return TimeRange.sevenDays;
      default:
        return TimeRange.oneDay;
    }
  }

  Future<void> _fetchTimeseries() async {
    if (_propertyId == null) return;
    if (!mounted) return;
    setState(() => _isLoadingTimeseries = true);
    try {
      final result = await _timeseriesService.getTimeseries(
        channelId: _channelId,
        propertyId: _propertyId!,
        timeRange: _getTimeRange(),
      );
      if (mounted) {
        setState(() {
          _timeseries = result;
          _isLoadingTimeseries = false;
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[SensorDetailPage] Timeseries error: $e');
      if (mounted) setState(() => _isLoadingTimeseries = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _fetchTimeseries();
  }

  void _onPeriodChanged(int period) {
    if (_selectedPeriod != period) {
      setState(() => _selectedPeriod = period);
      _fetchTimeseries();
    }
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  ThemeColors _themeColorForLabel() {
    final l = widget.sensor.label.toLowerCase();
    if (l.contains('temperature') || l.contains('pressure')) return ThemeColors.info;
    if (l.contains('humidity')) return ThemeColors.success;
    if (l.contains('motion') || l.contains('occupancy') || l.contains('contact') ||
        l.contains('leak') || l.contains('smoke')) return ThemeColors.warning;
    if (l.contains('carbon') || l.contains('co2') || l.contains('co ')) return ThemeColors.error;
    return ThemeColors.primary;
  }

  Color _getCategoryColor(BuildContext context) {
    final family = ThemeColorFamily.get(
      Theme.of(context).brightness,
      _themeColorForLabel(),
    );
    return family.base;
  }

  Widget _buildContent(BuildContext context) {
    return OrientationBuilder(
      builder: (context, orientation) {
        return orientation == Orientation.landscape
            ? _buildLandscapeLayout(context)
            : _buildPortraitLayout(context);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.contentOnly) {
      return _buildContent(context);
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: _buildContent(context),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return PageHeader(
      title: widget.sensor.label,
      subtitle: '$_location • ${_isOffline ? 'Offline' : 'Online'}',
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: () => Navigator.pop(context),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderMainIcon(
            icon: widget.sensor.icon,
            color: _themeColorForLabel(),
          ),
        ],
      ),
    );
  }

  Widget _buildPortraitLayout(BuildContext context) {
    return DevicePortraitLayout(
      scrollable: false,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pMd,
        children: [
          // Large value section - takes 1 part of available space
          Expanded(
            flex: 1,
            child: Center(child: _buildLargeValue(context)),
          ),
          // Bottom section - takes 2 parts of available space
          Expanded(
            flex: 2,
            child: _isBinary
                ? _buildEventLog(context, flexible: true)
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildStatsRow(context),
                      SizedBox(height: AppSpacings.pMd),
                      Expanded(child: _buildChart(context, flexible: true)),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscapeLayout(BuildContext context) {
    final landscapeSecondary = _isBinary
        ? _buildEventLog(context, withMargin: false, withDecoration: false)
        : _buildChart(context, withMargin: false, withDecoration: false);
    return DeviceLandscapeLayout(
      mainContent: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          spacing: AppSpacings.pMd,
          children: [
            _buildLargeValue(context),
            if (!_isBinary) _buildStatsRowCompact(context),
          ],
        ),
      ),
      secondaryContent: landscapeSecondary,
      largeSecondaryColumn: true,
    );
  }

  Widget _buildLargeValue(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isCompact = _screenService.isSmallScreen;
    final localizations = AppLocalizations.of(context)!;
    final channelCategory = widget.sensor.channel.category.json;
    final displayValue = SensorEnumUtils.translateSensorValue(
      localizations,
      _currentValue,
      channelCategory,
      short: false,
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: RichText(
            text: TextSpan(
              style: TextStyle(
                fontSize: _scale(isCompact ? 56 : 72),
                fontWeight: FontWeight.w200,
                color: _isOffline
                    ? (isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder)
                    : _getCategoryColor(context),
              ),
              children: [
                TextSpan(text: displayValue),
                TextSpan(
                  text: _unit.isNotEmpty ? ' $_unit' : '',
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
          localizations.sensor_ui_current_value(
            SensorEnumUtils.translateSensorLabel(localizations, widget.sensor.label),
          ),
          style: TextStyle(
            color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
            fontSize: AppFontSize.base,
          ),
        ),
      ],
    );
  }

  String _getStatsValue(String type) {
    if (_timeseries == null || _timeseries!.isEmpty) return '--';
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
    return '${NumberFormatUtils.defaultFormat.formatDecimal(value, decimalPlaces: 1)}$_unit';
  }

  String _getPeriodLabel() {
    switch (_selectedPeriod) {
      case 0: return '1h';
      case 1: return '24h';
      case 2: return '7d';
      case 3: return '30d';
      default: return '24h';
    }
  }

  Widget _buildStatsRow(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final periodLabel = _getPeriodLabel();
    return Row(
      children: [
        _buildStatCard(context, localizations.sensor_ui_period_min(periodLabel), _getStatsValue('min'), true),
        AppSpacings.spacingMdHorizontal,
        _buildStatCard(context, localizations.sensor_ui_period_max(periodLabel), _getStatsValue('max'), false),
        AppSpacings.spacingMdHorizontal,
        _buildStatCard(context, localizations.sensor_ui_period_avg(periodLabel), _getStatsValue('avg'), null),
      ],
    );
  }

  Widget _buildStatsRowCompact(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    return Row(
      children: [
        _buildStatCard(context, localizations.sensor_ui_min, _getStatsValue('min'), true),
        AppSpacings.spacingSmHorizontal,
        _buildStatCard(context, localizations.sensor_ui_max, _getStatsValue('max'), false),
        AppSpacings.spacingSmHorizontal,
        _buildStatCard(context, localizations.sensor_ui_avg, _getStatsValue('avg'), null),
      ],
    );
  }

  Widget _buildStatCard(BuildContext context, String label, String value, bool? isMin) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    Color? valueColor;
    if (isMin == true) valueColor = isDark ? AppColorsDark.info : AppColorsLight.info;
    else if (isMin == false) valueColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
    return Expanded(
      child: Container(
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
          children: [
            Text(
              label,
              style: TextStyle(
                color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                fontSize: AppFontSize.extraSmall,
              ),
            ),
            AppSpacings.spacingXsVertical,
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: TextStyle(
                  color: valueColor ?? (isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
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

  Widget _buildEventLog(BuildContext context, {
    bool withMargin = true,
    bool withDecoration = true,
    bool flexible = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    Widget contentArea;
    if (_isLoadingTimeseries) {
      contentArea = Center(
        child: SizedBox(
          width: _scale(24),
          height: _scale(24),
          child: CircularProgressIndicator(strokeWidth: 2, color: _getCategoryColor(context)),
        ),
      );
    } else if (_timeseries != null && _timeseries!.isNotEmpty) {
      contentArea = _buildEventLogEntries(context, inFlex: flexible);
    } else {
      contentArea = Center(
        child: Text(
          localizations.sensor_empty_no_events,
          style: TextStyle(
            color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
            fontSize: AppFontSize.small,
          ),
        ),
      );
    }
    if (flexible) {
      contentArea = Expanded(child: contentArea);
    }
    return Container(
      padding: withDecoration ? AppSpacings.paddingLg : EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
      decoration: withDecoration
          ? BoxDecoration(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
              border: Border.all(
                color: isDark ? AppFillColorDark.light : AppBorderColorLight.light,
                width: _scale(1),
              ),
            )
          : null,
      child: Column(
        mainAxisSize: flexible ? MainAxisSize.max : MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                localizations.sensor_ui_event_log,
                style: TextStyle(
                  color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
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
                    _buildPeriodButton(context, localizations.sensor_ui_period_1h, 0),
                    _buildPeriodButton(context, localizations.sensor_ui_period_24h, 1),
                    _buildPeriodButton(context, localizations.sensor_ui_period_7d, 2),
                    _buildPeriodButton(context, localizations.sensor_ui_period_30d, 3),
                  ],
                ),
              ),
            ],
          ),
          AppSpacings.spacingMdVertical,
          contentArea,
        ],
      ),
    );
  }

  static String _getBinaryLabelLong(String channelCategory, bool isActive) {
    final category = DevicesModuleChannelCategory.fromJson(channelCategory);

    switch (category) {
      case DevicesModuleChannelCategory.motion:
      case DevicesModuleChannelCategory.occupancy:
        return isActive ? 'Detected' : 'Clear';
      case DevicesModuleChannelCategory.contact:
      case DevicesModuleChannelCategory.door:
      case DevicesModuleChannelCategory.doorbell:
        return isActive ? 'Open' : 'Closed';
      case DevicesModuleChannelCategory.smoke:
        return isActive ? 'Smoke detected' : 'Clear';
      case DevicesModuleChannelCategory.gas:
        return isActive ? 'Gas detected' : 'Clear';
      case DevicesModuleChannelCategory.leak:
        return isActive ? 'Leak detected' : 'Clear';
      case DevicesModuleChannelCategory.carbonMonoxide:
        return isActive ? 'CO detected' : 'Clear';
      default:
        return isActive ? 'Active' : 'Inactive';
    }
  }

  Widget _buildEventLogEntries(BuildContext context, {bool inFlex = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final points = _timeseries!.points;
    final events = <TimeseriesPoint>[];
    for (int i = 0; i < points.length; i++) {
      final isActive = points[i].numericValue >= 0.5;
      if (i == 0 || (points[i - 1].numericValue >= 0.5) != isActive) {
        events.add(points[i]);
      }
    }
    final reversedEvents = events.reversed.toList();
    if (reversedEvents.isEmpty) {
      return inFlex
          ? Center(
              child: Text(
                localizations.sensor_empty_no_state_changes,
                style: TextStyle(
                  color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                  fontSize: AppFontSize.small,
                ),
              ),
            )
          : SizedBox(
              height: _scale(160),
              child: Center(
                child: Text(
                  localizations.sensor_empty_no_state_changes,
                  style: TextStyle(
                    color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.small,
                  ),
                ),
              ),
            );
    }
    final channelCategory = widget.sensor.channel.category.json;
    final useShortDate = _selectedPeriod <= 1;
    final dateFormat = useShortDate ? DateFormat.Hm() : DateFormat('MMM d, HH:mm');
    final listView = ListView.separated(
      shrinkWrap: !inFlex,
      padding: EdgeInsets.zero,
      itemCount: reversedEvents.length,
      separatorBuilder: (_, __) => Divider(
        height: _scale(1),
        color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
      ),
      itemBuilder: (context, index) {
        final point = reversedEvents[index];
        final isActive = point.numericValue >= 0.5;
        final stateLabel = _getBinaryLabelLong(channelCategory ?? '', isActive);
        final dangerColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
        final successColor = isDark ? AppColorsDark.success : AppColorsLight.success;
        final dotColor = isActive ? dangerColor : successColor;
        final textColor = isActive ? dangerColor : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);
        return Padding(
          padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
          child: Row(
            children: [
              Container(
                width: _scale(8),
                height: _scale(8),
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              SizedBox(width: AppSpacings.pMd),
              Expanded(
                child: Text(
                  stateLabel,
                  style: TextStyle(color: textColor, fontSize: AppFontSize.small, fontWeight: FontWeight.w500),
                ),
              ),
              Text(
                dateFormat.format(point.time.toLocal()),
                style: TextStyle(
                  color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                  fontSize: AppFontSize.extraSmall,
                ),
              ),
            ],
          ),
        );
      },
    );
    if (inFlex) {
      return listView;
    }
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: _scale(200)),
      child: listView,
    );
  }

  Widget _buildChart(BuildContext context, {bool withMargin = true, bool withDecoration = true, bool flexible = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;

    Widget buildChartContent(double height) {
      if (_isLoadingTimeseries) {
        return Center(
          child: SizedBox(
            width: _scale(24),
            height: _scale(24),
            child: CircularProgressIndicator(strokeWidth: 2, color: _getCategoryColor(context)),
          ),
        );
      }
      if (_timeseries != null && _timeseries!.isNotEmpty) {
        return CustomPaint(
          size: Size(double.infinity, height),
          painter: _SensorChartPainter(
            color: _getCategoryColor(context),
            labelColor: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
            fontSize: AppFontSize.extraSmall,
            timeseries: _timeseries,
          ),
        );
      }
      return Center(
        child: Text(
          localizations.sensor_empty_no_history,
          style: TextStyle(
            color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
            fontSize: AppFontSize.small,
          ),
        ),
      );
    }

    final chartArea = flexible
        ? Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) => buildChartContent(constraints.maxHeight),
            ),
          )
        : SizedBox(
            height: _scale(160),
            child: buildChartContent(_scale(160)),
          );

    return Container(
      padding: withDecoration ? AppSpacings.paddingLg : EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
      decoration: withDecoration
          ? BoxDecoration(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
              border: Border.all(
                color: isDark ? AppFillColorDark.light : AppBorderColorLight.light,
                width: _scale(1),
              ),
            )
          : null,
      child: Column(
        mainAxisSize: flexible ? MainAxisSize.max : MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                localizations.sensor_ui_history,
                style: TextStyle(
                  color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
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
                    _buildPeriodButton(context, localizations.sensor_ui_period_1h, 0),
                    _buildPeriodButton(context, localizations.sensor_ui_period_24h, 1),
                    _buildPeriodButton(context, localizations.sensor_ui_period_7d, 2),
                    _buildPeriodButton(context, localizations.sensor_ui_period_30d, 3),
                  ],
                ),
              ),
            ],
          ),
          _screenService.isLandscape && _screenService.isAtLeastLarge ? AppSpacings.spacingLgVertical : AppSpacings.spacingMdVertical,
          chartArea,
          AppSpacings.spacingSmVertical,
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _getTimeLabels().map((label) => _buildTimeLabel(context, label)).toList(),
          ),
        ],
      ),
    );
  }

  List<String> _getTimeLabels() {
    switch (_selectedPeriod) {
      case 0: return ['-60m', '-45m', '-30m', '-15m', 'Now'];
      case 1: return ['00:00', '06:00', '12:00', '18:00', 'Now'];
      case 2: return ['-7d', '-5d', '-3d', '-1d', 'Now'];
      case 3: return ['-30d', '-22d', '-15d', '-7d', 'Now'];
      default: return ['00:00', '06:00', '12:00', '18:00', 'Now'];
    }
  }

  Widget _buildTimeLabel(BuildContext context, String text) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      text,
      style: TextStyle(
        color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
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
        padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd, vertical: AppSpacings.pXs),
        decoration: BoxDecoration(
          color: isSelected ? (isDark ? AppFillColorDark.light : AppFillColorLight.light) : Colors.transparent,
          borderRadius: BorderRadius.circular(AppBorderRadius.small),
          boxShadow: isSelected ? [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 3, offset: const Offset(0, 1))] : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? (isDark ? AppTextColorDark.primary : AppTextColorLight.primary) : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
            fontSize: AppFontSize.extraSmall,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

// Chart painter for sensor detail (custom line chart)
class _SensorChartPainter extends CustomPainter {
  final Color color;
  final Color labelColor;
  final double fontSize;
  final PropertyTimeseries? timeseries;

  static const double _labelWidth = 40.0;
  static const double _labelGap = 6.0;

  _SensorChartPainter({required this.color, required this.labelColor, this.fontSize = 11, this.timeseries});

  @override
  void paint(Canvas canvas, Size size) {
    final chartLeft = _labelWidth + _labelGap;
    final chartWidth = size.width - chartLeft;
    final chartHeight = size.height;
    double niceMin = 0;
    double niceMax = 1;
    List<double> ticks = [0, 0.5, 1];
    if (timeseries != null && timeseries!.isNotEmpty) {
      ticks = _computeNiceTicks(timeseries!.minValue, timeseries!.maxValue);
      niceMin = ticks.first;
      niceMax = ticks.last;
    }
    final niceRange = niceMax - niceMin;
    final gridPaint = Paint()..color = color.withValues(alpha: 0.1)..strokeWidth = 0.5;
    for (final tick in ticks) {
      final normalized = niceRange == 0 ? 0.5 : (tick - niceMin) / niceRange;
      final y = chartHeight * (1 - normalized);
      canvas.drawLine(Offset(chartLeft, y), Offset(size.width, y), gridPaint);
      if (timeseries != null && timeseries!.isNotEmpty) {
        final label = _formatLabel(tick);
        final textPainter = TextPainter(
          text: TextSpan(text: label, style: TextStyle(color: labelColor, fontSize: fontSize)),
          textDirection: TextDirection.ltr,
        )..layout(maxWidth: _labelWidth);
        textPainter.paint(canvas, Offset(_labelWidth - textPainter.width, y - textPainter.height / 2));
      }
    }
    final points = <Offset>[];
    if (timeseries != null && timeseries!.isNotEmpty) {
      final data = timeseries!.points;
      for (int i = 0; i < data.length; i++) {
        final x = chartLeft + chartWidth * i / (data.length - 1).clamp(1, double.infinity);
        final normalizedValue = niceRange == 0 ? 0.5 : (data[i].numericValue - niceMin) / niceRange;
        final y = chartHeight * (1 - normalizedValue.clamp(0.0, 1.0));
        points.add(Offset(x, y));
      }
    }
    if (points.isEmpty) return;
    final areaPath = Path()..moveTo(chartLeft, chartHeight);
    for (final point in points) areaPath.lineTo(point.dx, point.dy);
    areaPath.lineTo(points.last.dx, chartHeight);
    areaPath.close();
    canvas.drawPath(areaPath, Paint()..color = color.withValues(alpha: 0.1)..style = PaintingStyle.fill);
    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) linePath.lineTo(points[i].dx, points[i].dy);
    canvas.drawPath(linePath, Paint()..color = color..strokeWidth = 2..style = PaintingStyle.stroke);
    if (timeseries != null && timeseries!.isNotEmpty) canvas.drawCircle(points.last, 4, Paint()..color = color);
  }

  static const double ln10 = 2.302585092994046;

  List<double> _computeNiceTicks(double dataMin, double dataMax, {int targetTicks = 5}) {
    if (dataMin == dataMax) {
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

  double _niceStep(double rawStep) {
    if (rawStep <= 0) return 1;
    final magnitude = pow(10, (log(rawStep) / ln10).floor().toDouble());
    final fraction = rawStep / magnitude;
    double niceFraction = fraction <= 1.5 ? 1 : (fraction <= 3 ? 2 : (fraction <= 7 ? 5 : 10));
    return niceFraction * magnitude;
  }

  double _roundToStep(double value, double step) {
    if (step >= 1) return (value / step).round() * step;
    final decimals = -(log(step) / ln10).floor();
    final factor = pow(10, decimals.toDouble());
    return (value * factor).round() / factor;
  }

  String _formatLabel(double value) {
    if (value.abs() >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    if (value == value.roundToDouble()) return value.round().toString();
    return value.toStringAsFixed(1);
  }

  @override
  bool shouldRepaint(covariant _SensorChartPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.timeseries != timeseries;
}

class SensorDetailBottomSheet extends StatefulWidget {
  final SensorData sensor;

  const SensorDetailBottomSheet({
    super.key,
    required this.sensor,
  });

  @override
  State<SensorDetailBottomSheet> createState() =>
      _SensorDetailBottomSheetState();
}

class _SensorDetailBottomSheetState extends State<SensorDetailBottomSheet> {
  final PropertyTimeseriesService _timeseriesService =
      locator<PropertyTimeseriesService>();
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  TimeRange _selectedRange = TimeRange.oneDay;
  PropertyTimeseries? _timeseries;
  bool _isLoading = true;
  bool _hasError = false;
  int _requestCounter = 0;

  @override
  void initState() {
    super.initState();
    _loadTimeseries();
  }

  Future<void> _loadTimeseries() async {
    if (widget.sensor.property == null) return;

    // Increment counter to track this request
    final currentRequest = ++_requestCounter;
    final requestedRange = _selectedRange;

    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    final result = await _timeseriesService.getTimeseries(
      channelId: widget.sensor.channel.id,
      propertyId: widget.sensor.property!.id,
      timeRange: requestedRange,
    );

    // Only update state if this is still the most recent request
    // and the selected range hasn't changed
    if (mounted &&
        currentRequest == _requestCounter &&
        requestedRange == _selectedRange) {
      setState(() {
        _timeseries = result;
        _isLoading = false;
        _hasError = result == null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: BoxDecoration(
        color: isLight ? AppBgColorLight.base : AppBgColorDark.base,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Column(
        children: [
          _buildHeader(context),
          _buildCurrentValue(context),
          _buildTimeRangeSelector(context),
          Expanded(
            child: _buildChart(context),
          ),
          if (_timeseries != null && _timeseries!.isNotEmpty)
            _buildStats(context),
          AppSpacings.spacingLgVertical,
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;
    final localizations = AppLocalizations.of(context)!;

    return Container(
      padding: AppSpacings.paddingMd,
      child: Row(
        children: [
          Icon(
            widget.sensor.icon,
            size: _screenService.scale(
              24,
              density: _visualDensityService.density,
            ),
            color: isLight ? AppColorsLight.primary : AppColorsDark.primary,
          ),
          AppSpacings.spacingMdHorizontal,
          Expanded(
            child: Text(
              SensorEnumUtils.translateSensorLabel(localizations, widget.sensor.label),
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
                color: isLight
                    ? AppTextColorLight.primary
                    : AppTextColorDark.primary,
              ),
            ),
          ),
          IconButton(
            icon: Icon(
              MdiIcons.close,
              color: isLight
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentValue(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isLight = Theme.of(context).brightness == Brightness.light;

    if (widget.sensor.property == null) {
      return const SizedBox.shrink();
    }

    final value = widget.sensor.valueFormatter != null
        ? widget.sensor.valueFormatter!(widget.sensor.property!)
        : ValueUtils.formatValue(widget.sensor.property!);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pSm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(
            localizations.sensor_ui_current,
            style: TextStyle(
              fontSize: AppFontSize.base,
              color: isLight
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
          ),
          AppSpacings.spacingMdHorizontal,
          Text(
            value ?? localizations.value_not_available,
            style: TextStyle(
              fontSize: _screenService.scale(
                40,
                density: _visualDensityService.density,
              ),
              fontFamily: 'DIN1451',
              fontWeight: FontWeight.w500,
              color: isLight
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
          ),
          if (widget.sensor.property?.unit != null) ...[
            AppSpacings.spacingSmHorizontal,
            Text(
              widget.sensor.property!.unit!,
              style: TextStyle(
                fontSize: AppFontSize.large,
                color: isLight
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTimeRangeSelector(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    final labels = {
      TimeRange.oneHour: '1h',
      TimeRange.sixHours: '6h',
      TimeRange.twelveHours: '12h',
      TimeRange.oneDay: '24h',
      TimeRange.sevenDays: '7d',
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pSm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: TimeRange.values.map((range) {
          final isSelected = range == _selectedRange;
          return Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacings.pXs),
            child: GestureDetector(
              onTap: () {
                setState(() {
                  _selectedRange = range;
                });
                _loadTimeseries();
              },
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                  vertical: AppSpacings.pSm,
                ),
                decoration: BoxDecoration(
                  color: isSelected
                      ? (isLight
                          ? AppColorsLight.primary
                          : AppColorsDark.primary)
                      : AppColors.blank,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  border: Border.all(
                    color: isLight
                        ? AppBorderColorLight.base
                        : AppBorderColorDark.base,
                  ),
                ),
                child: Text(
                  labels[range] ?? range.label,
                  style: TextStyle(
                    fontSize: AppFontSize.small,
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isSelected
                        ? AppColors.white
                        : (isLight
                            ? AppTextColorLight.primary
                            : AppTextColorDark.primary),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildChart(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;
    final localizations = AppLocalizations.of(context)!;

    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            AppSpacings.spacingMdVertical,
            Text(
              localizations.sensor_status_loading,
              style: TextStyle(
                color: isLight
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
          ],
        ),
      );
    }

    if (_hasError) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.alertCircle,
              size: 48,
              color: isLight ? AppColorsLight.error : AppColorsDark.error,
            ),
            AppSpacings.spacingMdVertical,
            Text(
              localizations.sensor_status_failed,
              style: TextStyle(
                color: isLight
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
            AppSpacings.spacingMdVertical,
            TextButton(
              onPressed: _loadTimeseries,
              child: Text(localizations.sensor_status_retry),
            ),
          ],
        ),
      );
    }

    if (_timeseries == null || _timeseries!.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.chartLine,
              size: 48,
              color: isLight
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
            AppSpacings.spacingMdVertical,
            Text(
              localizations.sensor_empty_no_data,
              style: TextStyle(
                color: isLight
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: AppSpacings.paddingMd,
      child: SensorTimeseriesChart(
        timeseries: _timeseries!,
        unit: widget.sensor.property?.unit,
        timeRange: _selectedRange,
      ),
    );
  }

  Widget _buildStats(BuildContext context) {
    if (_timeseries == null || _timeseries!.isEmpty) {
      return const SizedBox.shrink();
    }

    final localizations = AppLocalizations.of(context)!;

    return Container(
      padding: AppSpacings.paddingMd,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildStatItem(
            context,
            localizations.sensor_ui_min,
            NumberFormatUtils.defaultFormat.formatDecimal(_timeseries!.minValue, decimalPlaces: 1),
            widget.sensor.property?.unit,
          ),
          _buildStatItem(
            context,
            localizations.sensor_ui_avg,
            NumberFormatUtils.defaultFormat.formatDecimal(_timeseries!.avgValue, decimalPlaces: 1),
            widget.sensor.property?.unit,
          ),
          _buildStatItem(
            context,
            localizations.sensor_ui_max,
            NumberFormatUtils.defaultFormat.formatDecimal(_timeseries!.maxValue, decimalPlaces: 1),
            widget.sensor.property?.unit,
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(
    BuildContext context,
    String label,
    String value,
    String? unit,
  ) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            color: isLight
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
          ),
        ),
        AppSpacings.spacingXsVertical,
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontFamily: 'DIN1451',
                fontWeight: FontWeight.w500,
                color: isLight
                    ? AppTextColorLight.primary
                    : AppTextColorDark.primary,
              ),
            ),
            if (unit != null) ...[
              SizedBox(
                width: _screenService.scale(
                  2,
                  density: _visualDensityService.density,
                ),
              ),
              Text(
                unit,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  color: isLight
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class SensorTimeseriesChart extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final PropertyTimeseries timeseries;
  final String? unit;
  final TimeRange timeRange;

  SensorTimeseriesChart({
    super.key,
    required this.timeseries,
    required this.timeRange,
    this.unit,
  });

  @override
  Widget build(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    if (timeseries.points.isEmpty) {
      return const SizedBox.shrink();
    }

    final spots = timeseries.points.asMap().entries.map((entry) {
      return FlSpot(
        entry.key.toDouble(),
        entry.value.numericValue,
      );
    }).toList();

    final minY = timeseries.minValue;
    final maxY = timeseries.maxValue;
    final range = maxY - minY;
    // Ensure minimum padding when all values are equal
    final padding = range == 0 ? (minY.abs() * 0.1).clamp(1.0, 10.0) : range * 0.1;

    return LineChart(
      LineChartData(
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval:
              _calculateInterval(minY - padding, maxY + padding),
          getDrawingHorizontalLine: (value) {
            return FlLine(
              color: isLight
                  ? AppBorderColorLight.base.withValues(alpha: 0.5)
                  : AppBorderColorDark.base.withValues(alpha: 0.5),
              strokeWidth: _screenService.scale(
                1,
                density: _visualDensityService.density,
              ),
            );
          },
        ),
        titlesData: FlTitlesData(
          show: true,
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 30,
              interval: _calculateTimeInterval(spots.length),
              getTitlesWidget: (value, meta) {
                final index = value.toInt();
                if (index < 0 || index >= timeseries.points.length) {
                  return const SizedBox.shrink();
                }
                final point = timeseries.points[index];
                return Padding(
                  padding: EdgeInsets.only(
                    top: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
                    ),
                  ),
                  child: Text(
                    _formatTimeLabel(point.time),
                    style: TextStyle(
                      color: isLight
                          ? AppTextColorLight.placeholder
                          : AppTextColorDark.placeholder,
                      fontSize: AppFontSize.extraSmall,
                    ),
                  ),
                );
              },
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 45,
              interval: _calculateInterval(minY - padding, maxY + padding),
              getTitlesWidget: (value, meta) {
                return Text(
                  NumberFormatUtils.defaultFormat.formatDecimal(value, decimalPlaces: 1),
                  style: TextStyle(
                    color: isLight
                        ? AppTextColorLight.placeholder
                        : AppTextColorDark.placeholder,
                    fontSize: AppFontSize.extraSmall,
                  ),
                );
              },
            ),
          ),
        ),
        borderData: FlBorderData(show: false),
        minX: 0,
        maxX: spots.length == 1 ? 1.0 : (spots.length - 1).toDouble(),
        minY: minY - padding,
        maxY: maxY + padding,
        lineBarsData: [
          LineChartBarData(
            spots: spots.length == 1
                ? [spots.first, FlSpot(1, spots.first.y)]
                : spots,
            isCurved: spots.length > 2,
            curveSmoothness: 0.3,
            color: isLight ? AppColorsLight.primary : AppColorsDark.primary,
            barWidth: 2,
            isStrokeCapRound: true,
            dotData: FlDotData(show: spots.length <= 2),
            belowBarData: BarAreaData(
              show: true,
              color:
                  (isLight ? AppColorsLight.primary : AppColorsDark.primary)
                      .withValues(alpha: 0.1),
            ),
          ),
        ],
        lineTouchData: LineTouchData(
          enabled: true,
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (touchedSpot) =>
                isLight ? AppFillColorLight.base : AppFillColorDark.base,
            getTooltipItems: (touchedSpots) {
              return touchedSpots.map((spot) {
                final index = spot.x.toInt();
                if (index < 0 || index >= timeseries.points.length) {
                  return null;
                }
                final point = timeseries.points[index];
                return LineTooltipItem(
                  '${NumberFormatUtils.defaultFormat.formatDecimal(point.numericValue, decimalPlaces: 1)}${unit != null ? ' $unit' : ''}\n${_formatDateTime(point.time)}',
                  TextStyle(
                    color: isLight
                        ? AppTextColorLight.primary
                        : AppTextColorDark.primary,
                    fontSize: AppFontSize.small,
                  ),
                );
              }).toList();
            },
          ),
        ),
      ),
    );
  }

  double _calculateInterval(double min, double max) {
    final range = max - min;
    if (range <= 1) return 0.2;
    if (range <= 5) return 1;
    if (range <= 10) return 2;
    if (range <= 50) return 10;
    if (range <= 100) return 20;
    return 50;
  }

  double _calculateTimeInterval(int pointCount) {
    if (pointCount <= 6) return 1;
    if (pointCount <= 12) return 2;
    if (pointCount <= 24) return 4;
    if (pointCount <= 48) return 8;
    return (pointCount / 6).roundToDouble();
  }

  /// Format time label based on selected time range
  String _formatTimeLabel(DateTime time) {
    if (timeRange == TimeRange.sevenDays) {
      // For 7-day range, show day/month and hour
      return '${time.day}/${time.month}\n${time.hour.toString().padLeft(2, '0')}:00';
    } else if (timeRange == TimeRange.oneDay || timeRange == TimeRange.twelveHours) {
      // For 12h-24h range, show just time
      return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    } else {
      // For shorter ranges, show hours and minutes
      return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    }
  }

  String _formatDateTime(DateTime time) {
    return '${time.day}/${time.month} ${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}
