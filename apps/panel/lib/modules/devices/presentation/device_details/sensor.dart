// Sensor device detail UI: multi-channel sensor list with embedded detail.
// See [SensorDeviceDetail], [SensorDetailPage].
//
// The detail content (chart, stats, event log) is provided by [SensorDetailContent]
// from the shared widgets library, making it reusable across device types.

import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_channels_section.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_detail_content.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_utils.dart';

import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/device_detail_config.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// Re-export SensorData so existing imports of `SensorData` from this file continue to work.
export 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';

// =============================================================================
// SENSOR DEVICE DETAIL (multi-channel list + embedded detail)
// =============================================================================

/// Device detail screen for sensor devices. Shows a single selected sensor
/// channel (temperature, humidity, motion, etc.) with optional channel
/// selector when the device has multiple channels. The body is [SensorDetailPage]
/// in [contentOnly] mode.
class SensorDeviceDetail extends StatefulWidget {
  final SensorDeviceView _device;
  final String? initialChannelId;
  final DeviceDetailConfig? config;

  const SensorDeviceDetail({
    super.key,
    required SensorDeviceView device,
    this.initialChannelId,
    this.config,
  }) : _device = device;

  @override
  State<SensorDeviceDetail> createState() => _SensorDeviceDetailState();
}

class _SensorDeviceDetailState extends State<SensorDeviceDetail> {
  /// Selected channel index for multi-channel sensor devices.
  int _selectedChannelIndex = 0;

  /// Notifier to trigger bottom sheet rebuild when channel selection changes.
  final ValueNotifier<int> _channelListVersion = ValueNotifier(0);

  /// Whether the initial channel has been resolved from [widget.initialChannelId].
  bool _initialChannelResolved = false;

  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialChannelResolved) {
      _initialChannelResolved = true;
      final allChannels = _getAllSensorChannels();
      if (allChannels.isEmpty) return;
      if (widget.initialChannelId != null) {
        final index = allChannels
            .indexWhere((s) => s.channel.id == widget.initialChannelId);
        if (index >= 0) {
          _selectedChannelIndex = index;
        }
      }
    }
  }

  @override
  void dispose() {
    _channelListVersion.dispose();
    super.dispose();
  }

  // --------------------------------------------------------------------------
  // CHANNEL LIST & SELECTION
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // HEADER & CHANNEL TILE UI
  // --------------------------------------------------------------------------

  /// Status text for a sensor channel tile (e.g. "23.5 °C" or "Detected").
  String _getSensorChannelStatus(BuildContext context, SensorData data) {
    final l = AppLocalizations.of(context)!;

    // Binary detection sensors - use long translation variant
    if (data.isDetection != null) {
      return SensorUtils.translateBinaryState(
          l, data.channel.category, data.isDetection ?? false, short: false);
    }

    // Get formatted value from property
    String? formatted;
    if (data.property != null && data.valueFormatter != null) {
      formatted = data.valueFormatter!(data.property!);
    } else if (data.property != null) {
      formatted = SensorUtils.valueFormatterForCategory(
          data.channel.category)(data.property!);
    }

    if (formatted == null) return '—';

    // Translate enum/string values using long variant
    final translated = SensorUtils.translateSensorValue(
        l, formatted, data.channel.category, short: false);

    // If translated, it's an enum/bool - return without unit
    if (translated != formatted) return translated;

    // Numeric value - append unit if available
    final unit = data.unit;
    if (unit.isNotEmpty) return '$formatted $unit';
    return formatted;
  }

  /// Builds one channel tile for the channels bottom sheet (horizontal layout).
  Widget _buildChannelTile(BuildContext context, SensorData data, int index) {
    final isSelected = index == _selectedChannelIndex;
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal * 0.85);

    return SizedBox(
      height: tileHeight,
      child: UniversalTile(
        layout: TileLayout.horizontal,
        icon: data.icon,
        activeIcon: data.icon,
        name: data.channel.name.isNotEmpty ? data.channel.name : data.label,
        status: _getSensorChannelStatus(context, data),
        isActive: false,
        isOffline: !widget._device.isOnline,
        isSelected: isSelected,
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: false,
        showWarningBadge: data.isAlert ?? false,
        showSelectionIndicator: true,
        onTileTap: () => _handleChannelSelect(index),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
  final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;

    final allChannels = _getAllSensorChannels();
    if (allChannels.isEmpty) {
      return const SizedBox.shrink();
    }

    final selectedSensor = _selectedSensor;
    if (selectedSensor == null) return const SizedBox.shrink();

    final bgColor =
        isDark ? AppBgColorDark.page : AppBgColorLight.page;

    final lastSeenText = widget._device.lastStateChange != null
        ? DatetimeUtils.formatTimeAgo(widget._device.lastStateChange!, localizations)
        : null;

    final body = Stack(
      children: [
        SensorDetailPage(
          sensor: selectedSensor,
          deviceName: widget._device.name,
          isDeviceOnline: widget._device.isOnline,
          contentOnly: true,
        ),
        if (!widget._device.isOnline)
          DeviceOfflineState(
            isDark: isDark,
            lastSeenText: lastSeenText,
          ),
      ],
    );

    if (!(widget.config?.showHeader ?? true)) return body;

    return Scaffold(
      backgroundColor: bgColor,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(child: body),
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
    final showBack = widget.config?.showBackButton ?? true;
    final iconData = widget.config?.iconOverride ?? buildDeviceIcon(widget._device.category, widget._device.icon);

    return PageHeader(
      title: widget.config?.titleOverride ?? title,
      subtitle: subtitle,
      subtitleColor: secondaryColor,
      leading: showBack
          ? Row(
              mainAxisSize: MainAxisSize.min,
              spacing: AppSpacings.pMd,
              children: [
                HeaderIconButton(
                  icon: MdiIcons.arrowLeft,
                  onTap: () => Navigator.of(context).pop(),
                ),
                HeaderMainIcon(
                  icon: iconData,
                  color: ThemeColors.primary,
                ),
              ],
            )
          : HeaderMainIcon(
              icon: iconData,
              color: ThemeColors.primary,
            ),
      trailing: buildCombinedTrailing(config: widget.config, deviceTrailing: _buildHeaderTrailing(context)),
    );
  }

  Widget? _buildHeaderTrailing(BuildContext context) {
    if (!_isMultiChannel) return null;
    final channels = _getAllSensorChannels();
    return HeaderIconButton(
      icon: MdiIcons.accessPointNetwork,
      color: ThemeColors.neutral,
      onTap: widget._device.isOnline ? () {
        final localizations = AppLocalizations.of(context)!;
        DeviceChannelsSection.showChannelsSheet(
          context,
          title: localizations.domain_sensors,
          icon: MdiIcons.accessPointNetwork,
          itemCount: channels.length,
          tileBuilder: (c, i) => _buildChannelTile(c, channels[i], i),
          listenable: _channelListVersion,
        );
      } : null,
    );
  }

  // --------------------------------------------------------------------------
  // SENSOR CHANNEL BUILDERS (by category)
  // --------------------------------------------------------------------------

  List<SensorData> _getEnvironmentalSensors() {
    final l = AppLocalizations.of(context)!;
    final sensors = <SensorData>[];

    if (widget._device.hasTemperature) {
      sensors.add(SensorUtils.buildSensorData(
          widget._device.temperatureChannel!, localizations: l));
    }

    if (widget._device.hasHumidity) {
      sensors.add(SensorUtils.buildSensorData(
          widget._device.humidityChannel!, localizations: l));
    }

    if (widget._device.hasPressure) {
      sensors.add(SensorUtils.buildSensorData(
          widget._device.pressureChannel!, localizations: l));
    }

    if (widget._device.hasIlluminance) {
      sensors.add(SensorUtils.buildSensorData(
          widget._device.illuminanceChannel!, localizations: l));
    }

    return sensors;
  }

  List<SensorData> _getAirQualitySensors() {
    final l = AppLocalizations.of(context)!;
    final sensors = <SensorData>[];

    if (widget._device.hasCarbonDioxide) {
      final channel = widget._device.carbonDioxideChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasCarbonMonoxide) {
      final channel = widget._device.carbonMonoxideChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'Detected' : null,
      ));
    }

    if (widget._device.hasOzone) {
      final channel = widget._device.ozoneChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasNitrogenDioxide) {
      final channel = widget._device.nitrogenDioxideChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasSulphurDioxide) {
      final channel = widget._device.sulphurDioxideChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasVolatileOrganicCompounds) {
      final channel = widget._device.volatileOrganicCompoundsChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasAirParticulate) {
      sensors.add(SensorUtils.buildSensorData(
          widget._device.airParticulateChannel!, localizations: l));
    }

    return sensors;
  }

  List<SensorData> _getDetectionSensors() {
    final l = AppLocalizations.of(context)!;
    final sensors = <SensorData>[];

    if (widget._device.hasMotion) {
      sensors.add(SensorUtils.buildSensorData(
          widget._device.motionChannel!, localizations: l));
    }

    if (widget._device.hasOccupancy) {
      sensors.add(SensorUtils.buildSensorData(
          widget._device.occupancyChannel!, localizations: l));
    }

    if (widget._device.hasContact) {
      final channel = widget._device.contactChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        icon: channel.detected ? MdiIcons.doorOpen : MdiIcons.doorClosed,
      ));
    }

    if (widget._device.hasLeak) {
      final channel = widget._device.leakChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        isAlert: channel.detected,
      ));
    }

    if (widget._device.hasSmoke) {
      final channel = widget._device.smokeChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        isAlert: channel.detected,
      ));
    }

    return sensors;
  }

  List<SensorData> _getDeviceInfoSensors() {
    final l = AppLocalizations.of(context)!;
    final sensors = <SensorData>[];

    if (widget._device.hasBattery) {
      final channel = widget._device.batteryChannel!;
      sensors.add(SensorUtils.buildSensorData(channel,
        localizations: l,
        icon: _getBatteryIcon(channel),
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

// =============================================================================
// SENSOR DETAIL PAGE (thin wrapper around SensorDetailContent)
// =============================================================================

/// Full-screen sensor detail with current value, history chart, period selector,
/// and optional event log for binary sensors. Uses device [SensorData].
///
/// When [contentOnly] is true, only the detail content is built (no scaffold/header).
/// Use this to embed the detail inside another page (e.g. device detail body).
///
/// All rendering and timeseries state is delegated to [SensorDetailContent].
class SensorDetailPage extends StatelessWidget {
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

  ThemeColors get _themeColor =>
      SensorColors.themeColorForCategory(sensor.channel.category);

  @override
  Widget build(BuildContext context) {
    final content = SensorDetailContent(
      sensor: sensor,
      deviceName: deviceName,
      isDeviceOnline: isDeviceOnline,
    );

    if (contentOnly) {
      return content;
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isOffline = isDeviceOnline == false;
    final location = deviceName ?? sensor.channel.name;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: SensorUtils.translateSensorLabel(
                  AppLocalizations.of(context)!, sensor.channel.category),
              subtitle: '$location • ${isOffline ? 'Offline' : 'Online'}',
              leading: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: AppSpacings.pMd,
                children: [
                  HeaderIconButton(
                    icon: MdiIcons.arrowLeft,
                    onTap: () => Navigator.pop(context),
                  ),
                  HeaderMainIcon(
                    icon: sensor.icon,
                    color: _themeColor,
                  ),
                ],
              ),
            ),
            Expanded(child: content),
          ],
        ),
      ),
    );
  }
}
