import 'dart:async';

import 'package:fastybird_smart_panel/api/models/spaces_module_climate_intent_delta.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/button_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/rounded_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart'
    hide IntentOverlayService;
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_dehumidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_humidifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/cooler.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/heater.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/temperature.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:fastybird_smart_panel/modules/weather/types/configuration.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// ============================================================================
// Climate Device Type Classification
// ============================================================================

/// Classification of climate devices for UI rendering
enum ClimateDeviceType {
  thermostat,
  heater,
  cooler,
  fan,
  humidifier,
  dehumidifier,
  purifier,
}

/// Get the climate device type from a device view
ClimateDeviceType? getClimateDeviceType(DeviceView device) {
  if (device is ThermostatDeviceView) return ClimateDeviceType.thermostat;
  if (device is HeaterDeviceView) return ClimateDeviceType.heater;
  if (device is AirConditionerDeviceView) return ClimateDeviceType.cooler;
  if (device is FanDeviceView) return ClimateDeviceType.fan;
  if (device is AirHumidifierDeviceView) return ClimateDeviceType.humidifier;
  if (device is AirDehumidifierDeviceView) return ClimateDeviceType.dehumidifier;
  if (device is AirPurifierDeviceView) return ClimateDeviceType.purifier;
  return null;
}

/// Check if device type is a "hero" device (shown prominently with dial)
bool isHeroClimateDevice(ClimateDeviceType type) {
  return type == ClimateDeviceType.thermostat ||
      type == ClimateDeviceType.heater ||
      type == ClimateDeviceType.cooler;
}

/// Get icon for climate device type
IconData getClimateDeviceIcon(ClimateDeviceType type) {
  switch (type) {
    case ClimateDeviceType.thermostat:
      return MdiIcons.thermostat;
    case ClimateDeviceType.heater:
      return MdiIcons.fireCircle;
    case ClimateDeviceType.cooler:
      return MdiIcons.snowflake;
    case ClimateDeviceType.fan:
      return MdiIcons.fan;
    case ClimateDeviceType.humidifier:
      return MdiIcons.airHumidifier;
    case ClimateDeviceType.dehumidifier:
      return MdiIcons.airHumidifierOff;
    case ClimateDeviceType.purifier:
      return MdiIcons.airPurifier;
  }
}

// ============================================================================
// Climate Domain Page
// ============================================================================

/// Climate domain page - displays climate devices with hero thermostat design.
///
/// Features:
/// - Hero section with circular dial for primary thermostat/heater/AC
/// - Mode selection buttons for thermostats
/// - Secondary tiles for fans, humidifiers, purifiers
/// - Current and target temperature display
/// - Status indicators (heating/cooling/idle)
class ClimateDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const ClimateDomainViewPage({super.key, required this.viewItem});

  @override
  State<ClimateDomainViewPage> createState() => _ClimateDomainViewPageState();
}

class _ClimateDomainViewPageState extends State<ClimateDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final _PropertyValueHelper _valueHelper = _PropertyValueHelper();

  SpacesService? _spacesService;
  DevicesService? _devicesService;
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;
  WeatherService? _weatherService;

  // Track which devices are currently being toggled (prevents double-taps)
  final Set<String> _togglingDevices = {};

  // Debounce timer for temperature dial to prevent overwhelming the backend
  Timer? _temperatureDebounceTimer;

  bool _isLoading = true;

  String get _roomId => widget.viewItem.roomId;

  /// Climate device categories
  static const List<DevicesModuleDeviceCategory> _climateCategories = [
    DevicesModuleDeviceCategory.thermostat,
    DevicesModuleDeviceCategory.heater,
    DevicesModuleDeviceCategory.airConditioner,
    DevicesModuleDeviceCategory.fan,
    DevicesModuleDeviceCategory.airHumidifier,
    DevicesModuleDeviceCategory.airDehumidifier,
    DevicesModuleDeviceCategory.airPurifier,
  ];

  @override
  void initState() {
    super.initState();

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onSpacesDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainView] Failed to get SpacesService: $e');
      }
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDevicesDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainView] Failed to get DevicesService: $e');
      }
    }

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainView] Failed to get IntentOverlayService: $e');
      }
    }

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[ClimateDomainView] Failed to get DeviceControlStateService: $e');
      }
    }

    try {
      _weatherService = locator<WeatherService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ClimateDomainView] Failed to get WeatherService: $e');
      }
    }

    // Fetch climate targets for this space
    _fetchClimateTargets();
  }

  Future<void> _fetchClimateTargets() async {
    try {
      await _spacesService?.fetchClimateTargetsForSpace(_roomId);
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _temperatureDebounceTimer?.cancel();
    _spacesService?.removeListener(_onSpacesDataChanged);
    _devicesService?.removeListener(_onDevicesDataChanged);
    _intentOverlayService?.removeListener(_onIntentDataChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);

    super.dispose();
  }

  void _onSpacesDataChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _onDevicesDataChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _onIntentDataChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _onControlStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  /// Get climate devices for the current room
  List<DeviceView> _getClimateDevices() {
    final devicesService = _devicesService;
    if (devicesService == null) return [];

    return devicesService
        .getDevicesForRoom(_roomId)
        .where((device) => _climateCategories.contains(device.category))
        .toList();
  }

  /// Get temperature unit string from weather service configuration.
  /// Falls back to Celsius if weather service is not available.
  String _getTemperatureUnit() {
    final currentDay = _weatherService?.currentDay;
    if (currentDay != null && currentDay.unit == WeatherUnit.fahrenheit) {
      return '°F';
    }
    return '°C';
  }

  /// Format temperature with validation
  /// Returns '--' for invalid/default values (0.0, out of range)
  String _formatTemperature(double temp, String unit, {int decimals = 1}) {
    // Check for invalid/default values
    if (temp == 0.0 || temp < -50 || temp > 100) {
      return '--$unit';
    }
    return '${temp.toStringAsFixed(decimals)}$unit';
  }

  /// Check if temperature value is valid
  bool _isValidTemperature(double temp) {
    return temp != 0.0 && temp >= -50 && temp <= 100;
  }

  /// Get climate targets for the current room
  List<ClimateTargetView> _getClimateTargets() {
    final spacesService = _spacesService;
    if (spacesService == null) return [];

    return spacesService
        .getClimateTargetsForSpace(_roomId)
        .where((t) => t.role != ClimateTargetRole.hidden)
        .toList();
  }

  /// Get the PRIMARY climate target (hero device)
  ClimateTargetView? _getPrimaryTarget(List<ClimateTargetView> targets) {
    // Look for PRIMARY role first
    final primaryTarget = targets
        .where((t) => t.role == ClimateTargetRole.primary)
        .firstOrNull;
    if (primaryTarget != null) return primaryTarget;

    // Fallback: first actuator target with temperature control
    return targets
        .where((t) => t.isActuator && t.hasTemperature)
        .firstOrNull;
  }

  /// Get the temperature sensor target for room temperature display
  ClimateTargetView? _getTemperatureSensorTarget(List<ClimateTargetView> targets) {
    // Look for TEMPERATURE_SENSOR role
    return targets
        .where((t) => t.role == ClimateTargetRole.temperatureSensor)
        .firstOrNull;
  }

  /// Get the humidity sensor target for room humidity display
  ClimateTargetView? _getHumiditySensorTarget(List<ClimateTargetView> targets) {
    // Look for HUMIDITY_SENSOR role
    return targets
        .where((t) => t.role == ClimateTargetRole.humiditySensor)
        .firstOrNull;
  }

  /// Get hero device from PRIMARY target or fallback to type-based priority
  DeviceView? _getHeroDevice(
    List<ClimateTargetView> targets,
    DevicesService devicesService,
  ) {
    // Priority 1: Use PRIMARY role climate target
    final primaryTarget = _getPrimaryTarget(targets);
    if (primaryTarget != null) {
      final device = devicesService.getDevice(primaryTarget.deviceId);
      if (device != null) return device;
    }

    // Priority 2: Fallback to type-based detection from devices in room
    final devices = _getClimateDevices();

    // typed device views (thermostat first, then heater, then cooler)
    for (final device in devices) {
      if (device is ThermostatDeviceView) return device;
    }
    for (final device in devices) {
      if (device is HeaterDeviceView) return device;
    }
    for (final device in devices) {
      if (device is AirConditionerDeviceView) return device;
    }

    return null;
  }

  /// Get secondary climate targets (non-PRIMARY, non-sensor roles)
  List<ClimateTargetView> _getSecondaryTargets(
    List<ClimateTargetView> targets,
    ClimateTargetView? primaryTarget,
  ) {
    return targets
        .where((t) =>
            t.id != primaryTarget?.id &&
            t.role != ClimateTargetRole.temperatureSensor &&
            t.role != ClimateTargetRole.humiditySensor)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final spacesService = _spacesService;
    final devicesService = _devicesService;

    return Scaffold(
      appBar: AppTopBar(
        title: widget.viewItem.title,
        icon: DomainType.climate.icon,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (spacesService == null || devicesService == null) {
              return _buildEmptyState(context);
            }

            if (_isLoading) {
              return const Center(child: CircularProgressIndicator());
            }

            final climateTargets = _getClimateTargets();

            // If no climate targets, fallback to device-based detection
            if (climateTargets.isEmpty) {
              final climateDevices = _getClimateDevices();
              if (climateDevices.isEmpty) {
                return _buildEmptyState(context);
              }

              // Fallback: use old device-based approach
              final heroDevice = _getHeroDevice(climateTargets, devicesService);
              final secondaryDevices = climateDevices
                  .where((d) => d.id != heroDevice?.id)
                  .toList();

              return _buildLegacyLayout(
                context,
                heroDevice,
                secondaryDevices,
                devicesService,
                constraints,
              );
            }

            final primaryTarget = _getPrimaryTarget(climateTargets);
            final heroDevice = _getHeroDevice(climateTargets, devicesService);
            final temperatureSensorTarget =
                _getTemperatureSensorTarget(climateTargets);
            final humiditySensorTarget =
                _getHumiditySensorTarget(climateTargets);
            final secondaryTargets =
                _getSecondaryTargets(climateTargets, primaryTarget);

            return SingleChildScrollView(
              padding: AppSpacings.paddingMd,
              child: Column(
                children: [
                  // Hero section with circular dial
                  if (heroDevice != null)
                    _buildHeroSection(
                      context,
                      heroDevice,
                      devicesService,
                      constraints,
                      temperatureSensorTarget: temperatureSensorTarget,
                      humiditySensorTarget: humiditySensorTarget,
                    ),

                  // Secondary devices section
                  if (secondaryTargets.isNotEmpty) ...[
                    if (heroDevice != null) AppSpacings.spacingLgVertical,
                    _buildSecondaryTargetsSection(
                      context,
                      secondaryTargets,
                      devicesService,
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  /// Build legacy layout when no climate targets available
  Widget _buildLegacyLayout(
    BuildContext context,
    DeviceView? heroDevice,
    List<DeviceView> secondaryDevices,
    DevicesService devicesService,
    BoxConstraints constraints,
  ) {
    return SingleChildScrollView(
      padding: AppSpacings.paddingMd,
      child: Column(
        children: [
          if (heroDevice != null)
            _buildHeroSection(
              context,
              heroDevice,
              devicesService,
              constraints,
              useIntents: false,
            ),
          if (secondaryDevices.isNotEmpty) ...[
            if (heroDevice != null) AppSpacings.spacingLgVertical,
            _buildSecondaryDevicesSection(
              context,
              secondaryDevices,
              devicesService,
            ),
          ],
        ],
      ),
    );
  }

  /// Build empty state when no climate devices
  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.thermometerOff,
            size: _screenService.scale(
              80,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
          ),
          AppSpacings.spacingLgVertical,
          Text(
            'No climate devices',
            style: TextStyle(
              fontSize: AppFontSize.extraLarge,
              fontWeight: FontWeight.bold,
            ),
          ),
          AppSpacings.spacingSmVertical,
          Text(
            'Add climate devices to this room to control them here',
            style: TextStyle(
              fontSize: AppFontSize.base,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  /// Build hero section with circular dial
  Widget _buildHeroSection(
    BuildContext context,
    DeviceView device,
    DevicesService devicesService,
    BoxConstraints constraints, {
    ClimateTargetView? temperatureSensorTarget,
    ClimateTargetView? humiditySensorTarget,
    bool useIntents = true,
  }) {
    // Get room temperature from sensor if available
    final sensorTemperature = _getSensorTemperature(
      temperatureSensorTarget,
      devicesService,
    );
    // Get room humidity from sensor if available
    final sensorHumidity = _getSensorHumidity(
      humiditySensorTarget,
      devicesService,
    );

    return GestureDetector(
      onTap: () => _openDeviceDetail(context, device),
      child: Container(
        padding: AppSpacings.paddingMd,
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.infoLight5.withValues(alpha: 0.3)
              : AppColorsDark.infoLight5.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(AppBorderRadius.round),
        ),
        child: Column(
          children: [
            // Device name
            Text(
              device.name,
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.bold,
              ),
            ),
            AppSpacings.spacingSmVertical,

            // Dial or temperature display based on device type
            if (device is ThermostatDeviceView)
              _buildThermostatHero(
                context,
                device,
                devicesService,
                constraints,
                sensorTemperature: sensorTemperature,
                useIntents: useIntents,
              )
            else if (device is HeaterDeviceView)
              _buildHeaterHero(
                context,
                device,
                devicesService,
                constraints,
                sensorTemperature: sensorTemperature,
                useIntents: useIntents,
              )
            else if (device is AirConditionerDeviceView)
              _buildCoolerHero(
                context,
                device,
                devicesService,
                constraints,
                sensorTemperature: sensorTemperature,
                useIntents: useIntents,
              )
            else
              // Fallback hero for category-based devices (when typed mapping failed)
              _buildFallbackHero(context, device, constraints),

            AppSpacings.spacingMdVertical,

            // Humidity indicator (if sensor available)
            if (sensorHumidity != null)
              _buildHumidityIndicator(context, sensorHumidity),

            // Status indicator
            _buildStatusIndicator(context, device),
          ],
        ),
      ),
    );
  }

  /// Build humidity indicator chip
  Widget _buildHumidityIndicator(BuildContext context, int humidity) {
    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacings.pSm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.waterPercent,
            size: AppFontSize.base,
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
          ),
          SizedBox(width: AppSpacings.pXs),
          Text(
            '$humidity%',
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
          ),
        ],
      ),
    );
  }

  /// Get temperature reading from a temperature sensor target
  double? _getSensorTemperature(
    ClimateTargetView? sensorTarget,
    DevicesService devicesService,
  ) {
    if (sensorTarget == null) return null;

    final device = devicesService.getDevice(sensorTarget.deviceId);
    if (device == null) return null;

    // Sensor targets have a channelId - find the specific temperature channel
    final channelId = sensorTarget.channelId;
    if (channelId != null) {
      // Find the channel by ID and check if it's a temperature channel
      final channel = device.channels.where((c) => c.id == channelId).firstOrNull;
      if (channel is TemperatureChannelView) {
        return channel.temperature;
      }
    }

    // Fallback: look for any temperature channel on the device
    final tempChannel =
        device.channels.whereType<TemperatureChannelView>().firstOrNull;
    if (tempChannel != null) {
      return tempChannel.temperature;
    }

    // For thermostat devices, temperature comes from temperatureChannel
    if (device is ThermostatDeviceView) {
      return device.temperatureChannel.temperature;
    }

    return null;
  }

  /// Get humidity reading from a humidity sensor target
  int? _getSensorHumidity(
    ClimateTargetView? sensorTarget,
    DevicesService devicesService,
  ) {
    if (sensorTarget == null) return null;

    final device = devicesService.getDevice(sensorTarget.deviceId);
    if (device == null) return null;

    // Sensor targets have a channelId - find the specific humidity channel
    final channelId = sensorTarget.channelId;
    if (channelId != null) {
      // Find the channel by ID and check if it's a humidity channel
      final channel = device.channels.where((c) => c.id == channelId).firstOrNull;
      if (channel is HumidityChannelView) {
        return channel.humidity;
      }
    }

    // Fallback: look for any humidity channel on the device
    final humidityChannel =
        device.channels.whereType<HumidityChannelView>().firstOrNull;
    if (humidityChannel != null) {
      return humidityChannel.humidity;
    }

    return null;
  }

  /// Build thermostat hero with temperature display and mode buttons
  Widget _buildThermostatHero(
    BuildContext context,
    ThermostatDeviceView device,
    DevicesService devicesService,
    BoxConstraints constraints, {
    double? sensorTemperature,
    bool useIntents = true,
  }) {
    final thermostatChannel = device.thermostatChannel;
    final unit = thermostatChannel.showInFahrenheit ? '°F' : '°C';

    // Check if device has heater/cooler channel with controllable temperature
    final heaterChannel = device.heaterChannel;
    final coolerChannel = device.coolerChannel;
    final hasControllableTemp =
        (heaterChannel != null && heaterChannel.temperatureProp.isWritable) ||
        (coolerChannel != null && coolerChannel.temperatureProp.isWritable);

    final dialSize = (constraints.maxWidth * 0.5).clamp(150.0, 250.0);

    return Column(
      children: [
        // Circular dial or temperature display
        SizedBox(
          width: dialSize,
          height: dialSize,
          child: hasControllableTemp
              ? _buildThermostatDial(
                  context,
                  device,
                  devicesService,
                  dialSize,
                  unit,
                  sensorTemperature: sensorTemperature,
                  useIntents: useIntents,
                )
              : _buildTemperatureDialDisplay(context, device),
        ),

        // Quick +/- buttons for temperature adjustment
        if (hasControllableTemp)
          _buildQuickTemperatureButtons(
            context,
            device,
            devicesService,
            heaterChannel,
            coolerChannel,
            useIntents: useIntents,
          ),

        AppSpacings.spacingMdVertical,

        // Mode buttons for thermostat
        _buildThermostatModeButtons(context, device, devicesService),
      ],
    );
  }

  /// Build thermostat dial using heater or cooler channel
  Widget _buildThermostatDial(
    BuildContext context,
    ThermostatDeviceView device,
    DevicesService devicesService,
    double dialSize,
    String unit, {
    double? sensorTemperature,
    bool useIntents = true,
  }) {
    // Prefer heater channel, fall back to cooler
    final heaterChannel = device.heaterChannel;
    final coolerChannel = device.coolerChannel;

    if (heaterChannel != null && heaterChannel.temperatureProp.isWritable) {
      return _buildTemperatureDial(
        context,
        device,
        heaterChannel.temperature,
        heaterChannel.minTemperature,
        heaterChannel.maxTemperature,
        unit,
        dialSize,
        useIntents
            ? (value) => _setTemperatureViaIntent(context, value)
            : (value) =>
                _setHeaterTemperature(context, device, value, devicesService),
        sensorTemperature: sensorTemperature,
      );
    } else if (coolerChannel != null &&
        coolerChannel.temperatureProp.isWritable) {
      return _buildTemperatureDial(
        context,
        device,
        coolerChannel.temperature,
        coolerChannel.minTemperature,
        coolerChannel.maxTemperature,
        unit,
        dialSize,
        useIntents
            ? (value) => _setTemperatureViaIntent(context, value)
            : (value) =>
                _setCoolerTemperature(context, device, value, devicesService),
        sensorTemperature: sensorTemperature,
      );
    }

    return _buildTemperatureDialDisplay(context, device);
  }

  /// Build heater hero with dial
  Widget _buildHeaterHero(
    BuildContext context,
    HeaterDeviceView device,
    DevicesService devicesService,
    BoxConstraints constraints, {
    double? sensorTemperature,
    bool useIntents = true,
  }) {
    final heaterChannel = device.heaterChannel;
    final hasSetpoint = heaterChannel.temperatureProp.isWritable;

    final dialSize = (constraints.maxWidth * 0.5).clamp(150.0, 250.0);

    return SizedBox(
      width: dialSize,
      height: dialSize,
      child: hasSetpoint
          ? _buildTemperatureDial(
              context,
              device,
              heaterChannel.temperature,
              heaterChannel.minTemperature,
              heaterChannel.maxTemperature,
              _getTemperatureUnit(),
              dialSize,
              useIntents
                  ? (value) => _setTemperatureViaIntent(context, value)
                  : (value) =>
                      _setHeaterTemperature(context, device, value, devicesService),
              sensorTemperature: sensorTemperature,
            )
          : _buildHeaterDialDisplay(context, device),
    );
  }

  /// Build cooler (AC) hero with dial
  Widget _buildCoolerHero(
    BuildContext context,
    AirConditionerDeviceView device,
    DevicesService devicesService,
    BoxConstraints constraints, {
    double? sensorTemperature,
    bool useIntents = true,
  }) {
    final coolerChannel = device.coolerChannel;
    final hasSetpoint = coolerChannel.temperatureProp.isWritable;

    final dialSize = (constraints.maxWidth * 0.5).clamp(150.0, 250.0);

    return SizedBox(
      width: dialSize,
      height: dialSize,
      child: hasSetpoint
          ? _buildTemperatureDial(
              context,
              device,
              coolerChannel.temperature,
              coolerChannel.minTemperature,
              coolerChannel.maxTemperature,
              _getTemperatureUnit(),
              dialSize,
              useIntents
                  ? (value) => _setTemperatureViaIntent(context, value)
                  : (value) =>
                      _setCoolerTemperature(context, device, value, devicesService),
              sensorTemperature: sensorTemperature,
            )
          : _buildCoolerDialDisplay(context, device),
    );
  }

  /// Build temperature dial with RoundedSlider
  Widget _buildTemperatureDial(
    BuildContext context,
    DeviceView device,
    double currentValue,
    double minValue,
    double maxValue,
    String unit,
    double dialSize,
    Function(double) onChanged, {
    double? sensorTemperature,
  }) {
    return RoundedSlider(
      value: currentValue.clamp(minValue, maxValue),
      min: minValue,
      max: maxValue,
      enabled: true,
      availableWidth: dialSize,
      availableHeight: dialSize,
      onValueChanged: (value) {
        // Debounce the API call to prevent overwhelming the backend
        _temperatureDebounceTimer?.cancel();
        _temperatureDebounceTimer = Timer(
          const Duration(milliseconds: LightingConstants.sliderDebounceMs),
          () => onChanged(value.toDouble()),
        );
      },
      inner: _buildDialCenterContent(
        context,
        device,
        unit,
        sensorTemperature: sensorTemperature,
      ),
    );
  }

  /// Build dial center content showing temperatures
  Widget _buildDialCenterContent(
    BuildContext context,
    DeviceView device,
    String unit, {
    double? sensorTemperature,
  }) {
    if (device is ThermostatDeviceView) {
      return _buildThermostatDialCenter(
        context,
        device,
        unit,
        sensorTemperature: sensorTemperature,
      );
    } else if (device is HeaterDeviceView) {
      return _buildHeaterDialCenter(
        context,
        device,
        unit,
        sensorTemperature: sensorTemperature,
      );
    } else if (device is AirConditionerDeviceView) {
      return _buildCoolerDialCenter(
        context,
        device,
        unit,
        sensorTemperature: sensorTemperature,
      );
    }
    return SizedBox.shrink();
  }

  /// Build thermostat dial center
  Widget _buildThermostatDialCenter(
    BuildContext context,
    ThermostatDeviceView device,
    String unit, {
    double? sensorTemperature,
  }) {
    // Use sensor temperature if available, otherwise device's temperature
    final currentTemp =
        sensorTemperature ?? device.temperatureChannel.temperature;
    // Get target from heater or cooler channel if available
    final heaterChannel = device.heaterChannel;
    final coolerChannel = device.coolerChannel;
    double? targetTemp;
    if (heaterChannel != null) {
      targetTemp = heaterChannel.temperature;
    } else if (coolerChannel != null) {
      targetTemp = coolerChannel.temperature;
    }
    final localizations = AppLocalizations.of(context);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Current temperature
        Text(
          localizations?.space_climate_current_label ?? 'Current',
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
          ),
        ),
        Text(
          _formatTemperature(currentTemp, unit),
          style: TextStyle(
            fontSize: _screenService.scale(
              32,
              density: _visualDensityService.density,
            ),
            fontWeight: FontWeight.bold,
            color: _isValidTemperature(currentTemp)
                ? null
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.disabled
                    : AppTextColorDark.disabled),
          ),
        ),
        if (targetTemp != null && _isValidTemperature(targetTemp)) ...[
          AppSpacings.spacingSmVertical,

          // Target/setpoint temperature
          Text(
            localizations?.space_climate_target_label ?? 'Target',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
          ),
          Text(
            _formatTemperature(targetTemp, unit),
            style: TextStyle(
              fontSize: AppFontSize.large,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ],
      ],
    );
  }

  /// Build heater dial center
  Widget _buildHeaterDialCenter(
    BuildContext context,
    HeaterDeviceView device,
    String unit, {
    double? sensorTemperature,
  }) {
    // Use sensor temperature if available, otherwise device's temperature
    final currentTemp =
        sensorTemperature ?? device.temperatureChannel.temperature;
    final targetTemp = device.heaterChannel.temperature;
    final localizations = AppLocalizations.of(context);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          localizations?.space_climate_current_label ?? 'Current',
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
          ),
        ),
        Text(
          _formatTemperature(currentTemp, unit),
          style: TextStyle(
            fontSize: _screenService.scale(
              32,
              density: _visualDensityService.density,
            ),
            fontWeight: FontWeight.bold,
            color: _isValidTemperature(currentTemp)
                ? null
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.disabled
                    : AppTextColorDark.disabled),
          ),
        ),
        if (_isValidTemperature(targetTemp)) ...[
          AppSpacings.spacingSmVertical,
          Text(
            localizations?.space_climate_target_label ?? 'Target',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
          ),
          Text(
            _formatTemperature(targetTemp, unit),
            style: TextStyle(
              fontSize: AppFontSize.large,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ],
      ],
    );
  }

  /// Build cooler dial center
  Widget _buildCoolerDialCenter(
    BuildContext context,
    AirConditionerDeviceView device,
    String unit, {
    double? sensorTemperature,
  }) {
    // Use sensor temperature if available, otherwise device's temperature
    final currentTemp =
        sensorTemperature ?? device.temperatureChannel.temperature;
    final targetTemp = device.coolerChannel.temperature;
    final localizations = AppLocalizations.of(context);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          localizations?.space_climate_current_label ?? 'Current',
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
          ),
        ),
        Text(
          _formatTemperature(currentTemp, unit),
          style: TextStyle(
            fontSize: _screenService.scale(
              32,
              density: _visualDensityService.density,
            ),
            fontWeight: FontWeight.bold,
            color: _isValidTemperature(currentTemp)
                ? null
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.disabled
                    : AppTextColorDark.disabled),
          ),
        ),
        if (_isValidTemperature(targetTemp)) ...[
          AppSpacings.spacingSmVertical,
          Text(
            localizations?.space_climate_target_label ?? 'Target',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
          ),
          Text(
            _formatTemperature(targetTemp, unit),
            style: TextStyle(
              fontSize: AppFontSize.large,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ],
      ],
    );
  }

  /// Build temperature-only display (when no dial available)
  Widget _buildTemperatureDialDisplay(
    BuildContext context,
    ThermostatDeviceView device,
  ) {
    final currentTemp = device.temperatureChannel.temperature;
    final unit = device.thermostatChannel.showInFahrenheit ? '°F' : '°C';
    final isValid = _isValidTemperature(currentTemp);

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.thermostat,
            size: _screenService.scale(
              48,
              density: _visualDensityService.density,
            ),
            color: isValid
                ? Theme.of(context).colorScheme.primary
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.disabled
                    : AppTextColorDark.disabled),
          ),
          AppSpacings.spacingMdVertical,
          Text(
            _formatTemperature(currentTemp, unit),
            style: TextStyle(
              fontSize: _screenService.scale(
                48,
                density: _visualDensityService.density,
              ),
              fontWeight: FontWeight.bold,
              color: isValid
                  ? null
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.disabled
                      : AppTextColorDark.disabled),
            ),
          ),
        ],
      ),
    );
  }

  /// Build heater display (when no dial available)
  Widget _buildHeaterDialDisplay(
    BuildContext context,
    HeaterDeviceView device,
  ) {
    final currentTemp = device.temperatureChannel.temperature;
    final unit = _getTemperatureUnit();
    final isValid = _isValidTemperature(currentTemp);

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.fireCircle,
            size: _screenService.scale(
              48,
              density: _visualDensityService.density,
            ),
            color: isValid
                ? Theme.of(context).colorScheme.primary
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.disabled
                    : AppTextColorDark.disabled),
          ),
          AppSpacings.spacingMdVertical,
          Text(
            _formatTemperature(currentTemp, unit),
            style: TextStyle(
              fontSize: _screenService.scale(
                48,
                density: _visualDensityService.density,
              ),
              fontWeight: FontWeight.bold,
              color: isValid
                  ? null
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.disabled
                      : AppTextColorDark.disabled),
            ),
          ),
        ],
      ),
    );
  }

  /// Build cooler display (when no dial available)
  Widget _buildCoolerDialDisplay(
    BuildContext context,
    AirConditionerDeviceView device,
  ) {
    final currentTemp = device.temperatureChannel.temperature;
    final unit = _getTemperatureUnit();
    final isValid = _isValidTemperature(currentTemp);

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.snowflake,
            size: _screenService.scale(
              48,
              density: _visualDensityService.density,
            ),
            color: isValid
                ? Theme.of(context).colorScheme.primary
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.disabled
                    : AppTextColorDark.disabled),
          ),
          AppSpacings.spacingMdVertical,
          Text(
            _formatTemperature(currentTemp, unit),
            style: TextStyle(
              fontSize: _screenService.scale(
                48,
                density: _visualDensityService.density,
              ),
              fontWeight: FontWeight.bold,
              color: isValid
                  ? null
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.disabled
                      : AppTextColorDark.disabled),
            ),
          ),
        ],
      ),
    );
  }

  /// Build fallback hero for category-based devices (when typed mapping failed)
  /// This provides a degraded but functional UI for devices that couldn't be
  /// properly mapped to their typed view classes
  Widget _buildFallbackHero(
    BuildContext context,
    DeviceView device,
    BoxConstraints constraints,
  ) {
    final localizations = AppLocalizations.of(context);
    final unit = _getTemperatureUnit();

    // Determine icon based on category
    IconData icon;
    Color iconColor;
    switch (device.category) {
      case DevicesModuleDeviceCategory.thermostat:
        icon = MdiIcons.thermostat;
        iconColor = Theme.of(context).colorScheme.primary;
        break;
      case DevicesModuleDeviceCategory.heater:
        icon = MdiIcons.fireCircle;
        iconColor = Theme.of(context).warning;
        break;
      case DevicesModuleDeviceCategory.airConditioner:
        icon = MdiIcons.snowflake;
        iconColor = Theme.of(context).info;
        break;
      default:
        icon = MdiIcons.thermometer;
        iconColor = Theme.of(context).colorScheme.primary;
    }

    // Check device status
    final isOnline = device.isOnline;
    final isValid = device.isValid;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Device icon with status indicator
        Stack(
          alignment: Alignment.center,
          children: [
            Icon(
              icon,
              size: _screenService.scale(
                80,
                density: _visualDensityService.density,
              ),
              color: isOnline
                  ? iconColor
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.disabled
                      : AppTextColorDark.disabled),
            ),
            if (!isOnline)
              Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  padding: EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.danger
                        : AppColorsDark.danger,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    MdiIcons.cloudOffOutline,
                    size: _screenService.scale(
                      20,
                      density: _visualDensityService.density,
                    ),
                    color: Colors.white,
                  ),
                ),
              ),
          ],
        ),

        AppSpacings.spacingMdVertical,

        // Temperature display (show -- if device is offline or invalid)
        Text(
          isOnline ? '--$unit' : (localizations?.device_status_offline ?? 'Offline'),
          style: TextStyle(
            fontSize: _screenService.scale(
              48,
              density: _visualDensityService.density,
            ),
            fontWeight: FontWeight.bold,
            color: isOnline
                ? null
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.disabled
                    : AppTextColorDark.disabled),
          ),
        ),

        AppSpacings.spacingMdVertical,

        // Configuration warning
        if (!isValid || !isOnline)
          Container(
            padding: AppSpacings.paddingSm,
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.warningLight5
                  : AppColorsDark.warningLight5,
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  MdiIcons.alertCircleOutline,
                  size: AppFontSize.base,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.warning
                      : AppColorsDark.warning,
                ),
                AppSpacings.spacingXsHorizontal,
                Flexible(
                  child: Text(
                    !isOnline
                        ? (localizations?.device_offline_message ??
                            'Device is offline')
                        : (localizations?.device_config_issue ??
                            'Configuration issue'),
                    style: TextStyle(
                      fontSize: AppFontSize.small,
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppColorsLight.warning
                          : AppColorsDark.warning,
                    ),
                  ),
                ),
              ],
            ),
          ),

        AppSpacings.spacingMdVertical,

        // Open device details button
        TextButton.icon(
          onPressed: () => _openDeviceDetail(context, device),
          icon: Icon(MdiIcons.cogOutline),
          label: Text(localizations?.device_details ?? 'Device Details'),
        ),
      ],
    );
  }

  /// Build thermostat mode buttons
  Widget _buildThermostatModeButtons(
    BuildContext context,
    ThermostatDeviceView device,
    DevicesService devicesService,
  ) {
    final currentMode = device.thermostatMode;
    final modeProp = device.thermostatChannel.modeProp;

    if (!modeProp.isWritable) {
      return SizedBox.shrink();
    }

    // Get available modes
    final List<ThermostatModeValue> availableModes = [];

    // Always add off
    availableModes.add(ThermostatModeValue.off);

    // Add available modes
    for (final mode in device.thermostatAvailableModes) {
      if (mode != ThermostatModeValue.off) {
        availableModes.add(mode);
      }
    }

    return Wrap(
      spacing: AppSpacings.pSm,
      runSpacing: AppSpacings.pSm,
      alignment: WrapAlignment.center,
      children: availableModes.map((mode) {
        final isSelected = mode == currentMode;
        return _buildModeButton(
          context,
          mode,
          isSelected,
          () => _setThermostatMode(context, device, mode, devicesService),
        );
      }).toList(),
    );
  }

  /// Build a single mode button
  Widget _buildModeButton(
    BuildContext context,
    ThermostatModeValue mode,
    bool isSelected,
    VoidCallback onTap,
  ) {
    return Material(
      color: isSelected
          ? Theme.of(context).colorScheme.primary
          : Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.infoLight5
              : AppColorsDark.infoLight5,
      borderRadius: BorderRadius.circular(AppBorderRadius.medium),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pSm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _getModeIcon(mode),
                size: AppFontSize.base,
                color: isSelected
                    ? AppColors.white
                    : Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
              ),
              SizedBox(width: 4),
              Text(
                _getLocalizedModeName(context, mode),
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected
                      ? AppColors.white
                      : Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.regular
                          : AppTextColorDark.regular,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Build quick +/- temperature adjustment buttons
  Widget _buildQuickTemperatureButtons(
    BuildContext context,
    ThermostatDeviceView device,
    DevicesService devicesService,
    HeaterChannelView? heaterChannel,
    CoolerChannelView? coolerChannel, {
    bool useIntents = true,
  }) {
    final localizations = AppLocalizations.of(context);

    // Determine which channel to use for adjustment
    double currentTarget;
    double minTemp;
    double maxTemp;
    Future<void> Function(double) setTemperature;

    if (heaterChannel != null && heaterChannel.temperatureProp.isWritable) {
      currentTarget = heaterChannel.temperature;
      minTemp = heaterChannel.minTemperature;
      maxTemp = heaterChannel.maxTemperature;
      setTemperature =
          (value) => _setHeaterTemperature(context, device, value, devicesService);
    } else if (coolerChannel != null && coolerChannel.temperatureProp.isWritable) {
      currentTarget = coolerChannel.temperature;
      minTemp = coolerChannel.minTemperature;
      maxTemp = coolerChannel.maxTemperature;
      setTemperature =
          (value) => _setCoolerTemperature(context, device, value, devicesService);
    } else {
      return SizedBox.shrink();
    }

    const double step = 0.5;
    final bool canDecrease = currentTarget - step >= minTemp;
    final bool canIncrease = currentTarget + step <= maxTemp;

    return Padding(
      padding: EdgeInsets.only(top: AppSpacings.pMd),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Decrease button
          _buildQuickAdjustButton(
            context,
            icon: MdiIcons.minus,
            label: '-${step.toStringAsFixed(1)}°',
            enabled: canDecrease,
            onTap: useIntents
                ? () => _adjustTemperatureViaIntent(context, increase: false)
                : () => setTemperature(currentTarget - step),
          ),

          AppSpacings.spacingMdHorizontal,

          // Current target display
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pSm,
            ),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.infoLight5.withValues(alpha: 0.5)
                  : AppColorsDark.infoLight5.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Text(
              localizations?.space_climate_target_label ?? 'Target',
              style: TextStyle(
                fontSize: AppFontSize.small,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
          ),

          AppSpacings.spacingMdHorizontal,

          // Increase button
          _buildQuickAdjustButton(
            context,
            icon: MdiIcons.plus,
            label: '+${step.toStringAsFixed(1)}°',
            enabled: canIncrease,
            onTap: useIntents
                ? () => _adjustTemperatureViaIntent(context, increase: true)
                : () => setTemperature(currentTarget + step),
          ),
        ],
      ),
    );
  }

  /// Build a single quick adjust button
  Widget _buildQuickAdjustButton(
    BuildContext context, {
    required IconData icon,
    required String label,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return Material(
      color: enabled
          ? (Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.infoLight5
              : AppColorsDark.infoLight5)
          : (Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.infoLight5.withValues(alpha: 0.3)
              : AppColorsDark.infoLight5.withValues(alpha: 0.3)),
      borderRadius: BorderRadius.circular(AppBorderRadius.medium),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pSm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: AppFontSize.base,
                color: enabled
                    ? Theme.of(context).colorScheme.primary
                    : (Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.disabled
                        : AppTextColorDark.disabled),
              ),
              SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                  color: enabled
                      ? Theme.of(context).colorScheme.primary
                      : (Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.disabled
                          : AppTextColorDark.disabled),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Get icon for thermostat mode
  IconData _getModeIcon(ThermostatModeValue mode) {
    switch (mode) {
      case ThermostatModeValue.off:
        return MdiIcons.power;
      case ThermostatModeValue.heat:
        return MdiIcons.fire;
      case ThermostatModeValue.cool:
        return MdiIcons.snowflake;
      case ThermostatModeValue.auto:
        return MdiIcons.autoFix;
      case ThermostatModeValue.manual:
        return MdiIcons.handBackRight;
    }
  }

  /// Get localized mode name
  String _getLocalizedModeName(BuildContext context, ThermostatModeValue mode) {
    final localizations = AppLocalizations.of(context);
    switch (mode) {
      case ThermostatModeValue.off:
        return localizations?.thermostat_mode_off ?? 'Off';
      case ThermostatModeValue.heat:
        return localizations?.thermostat_mode_heat ?? 'Heat';
      case ThermostatModeValue.cool:
        return localizations?.thermostat_mode_cool ?? 'Cool';
      case ThermostatModeValue.auto:
        return localizations?.thermostat_mode_auto ?? 'Auto';
      case ThermostatModeValue.manual:
        return localizations?.thermostat_mode_manual ?? 'Manual';
    }
  }

  /// Build status indicator (heating/cooling/idle)
  Widget _buildStatusIndicator(BuildContext context, DeviceView device) {
    final localizations = AppLocalizations.of(context);

    IconData icon;
    String label;
    Color color;

    bool isHeating = false;
    bool isCooling = false;

    if (device is ThermostatDeviceView) {
      isHeating = device.heaterChannel?.isHeating ?? false;
      isCooling = device.coolerChannel?.isCooling ?? false;
    } else if (device is HeaterDeviceView) {
      isHeating = device.heaterChannel.isHeating;
    } else if (device is AirConditionerDeviceView) {
      isCooling = device.coolerChannel.isCooling;
    }

    if (isHeating) {
      icon = MdiIcons.fire;
      label = localizations?.thermostat_state_heating ?? 'Heating';
      color = Theme.of(context).warning;
    } else if (isCooling) {
      icon = MdiIcons.snowflake;
      label = localizations?.thermostat_state_cooling ?? 'Cooling';
      color = Theme.of(context).info;
    } else {
      icon = MdiIcons.checkCircle;
      label = localizations?.thermostat_state_idling ?? 'Idle';
      color = Theme.of(context).brightness == Brightness.light
          ? AppTextColorLight.secondary
          : AppTextColorDark.secondary;
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: AppFontSize.base, color: color),
        SizedBox(width: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: AppFontSize.small,
            color: color,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  /// Build secondary climate targets section (role-based)
  Widget _buildSecondaryTargetsSection(
    BuildContext context,
    List<ClimateTargetView> targets,
    DevicesService devicesService,
  ) {
    final localizations = AppLocalizations.of(context);

    // Group targets by role for better organization
    final auxiliaryTargets =
        targets.where((t) => t.role == ClimateTargetRole.auxiliary).toList();
    final ventilationTargets =
        targets.where((t) => t.role == ClimateTargetRole.ventilation).toList();
    final humidityTargets =
        targets.where((t) => t.role == ClimateTargetRole.humidityControl).toList();
    final otherTargets = targets
        .where((t) =>
            t.role == ClimateTargetRole.other || t.role == null)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Auxiliary heating/cooling devices
        if (auxiliaryTargets.isNotEmpty) ...[
          _buildRoleSection(
            context,
            localizations?.climate_role_auxiliary ?? 'Auxiliary',
            auxiliaryTargets,
            devicesService,
          ),
          AppSpacings.spacingMdVertical,
        ],

        // Ventilation devices (fans, purifiers)
        if (ventilationTargets.isNotEmpty) ...[
          _buildRoleSection(
            context,
            localizations?.climate_role_ventilation ?? 'Ventilation',
            ventilationTargets,
            devicesService,
          ),
          AppSpacings.spacingMdVertical,
        ],

        // Humidity control devices
        if (humidityTargets.isNotEmpty) ...[
          _buildRoleSection(
            context,
            localizations?.climate_role_humidity ?? 'Humidity Control',
            humidityTargets,
            devicesService,
          ),
          AppSpacings.spacingMdVertical,
        ],

        // Other devices
        if (otherTargets.isNotEmpty)
          _buildRoleSection(
            context,
            localizations?.climate_role_other ?? 'Other Devices',
            otherTargets,
            devicesService,
          ),
      ],
    );
  }

  /// Build a section for a specific climate role
  Widget _buildRoleSection(
    BuildContext context,
    String title,
    List<ClimateTargetView> targets,
    DevicesService devicesService,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: AppFontSize.base,
            fontWeight: FontWeight.w500,
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
          ),
        ),
        AppSpacings.spacingSmVertical,
        Wrap(
          spacing: AppSpacings.pSm,
          runSpacing: AppSpacings.pSm,
          children: targets.map((target) {
            final device = devicesService.getDevice(target.deviceId);
            if (device == null) return const SizedBox.shrink();
            return _buildSecondaryDeviceTile(context, device, devicesService);
          }).toList(),
        ),
      ],
    );
  }

  /// Build secondary devices section (legacy - device based)
  Widget _buildSecondaryDevicesSection(
    BuildContext context,
    List<DeviceView> devices,
    DevicesService devicesService,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header
        Text(
          'Other devices',
          style: TextStyle(
            fontSize: AppFontSize.base,
            fontWeight: FontWeight.w500,
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
          ),
        ),
        AppSpacings.spacingSmVertical,

        // Device tiles in a wrap
        Wrap(
          spacing: AppSpacings.pSm,
          runSpacing: AppSpacings.pSm,
          children: devices.map((device) {
            return _buildSecondaryDeviceTile(context, device, devicesService);
          }).toList(),
        ),
      ],
    );
  }

  /// Build a secondary device tile with improved layout
  Widget _buildSecondaryDeviceTile(
    BuildContext context,
    DeviceView device,
    DevicesService devicesService,
  ) {
    final deviceType = getClimateDeviceType(device);
    final isToggling = _togglingDevices.contains(device.id);
    final bool isOn = _getDeviceOnState(device);
    final canToggle = _canToggleDevice(device);
    final isOnline = device.isOnline;

    // Get temperature info if available
    final temperatureInfo = _getDeviceTemperatureInfo(device);

    return SizedBox(
      width: 160,
      height: 130,
      child: ButtonTileBox(
        onTap: isToggling ? null : () => _openDeviceDetail(context, device),
        isOn: isOn,
        child: Stack(
          children: [
            // Main content
            Padding(
              padding: EdgeInsets.all(AppSpacings.pSm),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top row: Name and icon
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          device.name,
                          style: TextStyle(
                            fontSize: AppFontSize.small,
                            fontWeight: FontWeight.w600,
                            color: isOn
                                ? (Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.primary
                                    : AppTextColorDark.primary)
                                : (Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.secondary
                                    : AppTextColorDark.secondary),
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      ButtonTileIcon(
                        icon: deviceType != null
                            ? getClimateDeviceIcon(deviceType)
                            : MdiIcons.thermometer,
                        onTap: (canToggle && !isToggling)
                            ? () => _toggleDevice(context, device, devicesService)
                            : null,
                        isOn: isOn,
                        rawIconSize: 28,
                      ),
                    ],
                  ),

                  // Middle: Temperature display (if available)
                  if (temperatureInfo != null)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          temperatureInfo.currentFormatted,
                          style: TextStyle(
                            fontSize: _screenService.scale(
                              24,
                              density: _visualDensityService.density,
                            ),
                            fontWeight: FontWeight.bold,
                            fontFamily: 'DIN1451',
                            color: isOnline
                                ? (isOn
                                    ? Theme.of(context).colorScheme.primary
                                    : (Theme.of(context).brightness ==
                                            Brightness.light
                                        ? AppTextColorLight.primary
                                        : AppTextColorDark.primary))
                                : (Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.disabled
                                    : AppTextColorDark.disabled),
                          ),
                        ),
                        if (temperatureInfo.targetFormatted != null)
                          Text(
                            '→ ${temperatureInfo.targetFormatted}',
                            style: TextStyle(
                              fontSize: AppFontSize.extraSmall,
                              color: Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.secondary
                                  : AppTextColorDark.secondary,
                            ),
                          ),
                      ],
                    ),

                  // Bottom: Status
                  Row(
                    children: [
                      Icon(
                        _getDeviceStatusIcon(device),
                        size: AppFontSize.small,
                        color: _getDeviceStatusColor(context, device),
                      ),
                      AppSpacings.spacingXsHorizontal,
                      Expanded(
                        child: Text(
                          _getDeviceStatusText(context, device),
                          style: TextStyle(
                            fontSize: AppFontSize.extraSmall,
                            color: _getDeviceStatusColor(context, device),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Offline indicator
            if (!isOnline)
              Positioned(
                top: 4,
                right: 4,
                child: Container(
                  padding: EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.danger
                        : AppColorsDark.danger,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    MdiIcons.cloudOffOutline,
                    size: 10,
                    color: Colors.white,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Temperature info for a device
  _DeviceTemperatureInfo? _getDeviceTemperatureInfo(DeviceView device) {
    final unit = _getTemperatureUnit();

    if (device is ThermostatDeviceView) {
      final current = device.temperatureChannel.temperature;
      final heater = device.heaterChannel;
      final cooler = device.coolerChannel;
      double? target;
      if (heater != null) {
        target = heater.temperature;
      } else if (cooler != null) {
        target = cooler.temperature;
      }
      return _DeviceTemperatureInfo(
        current: current,
        target: target,
        unit: unit,
      );
    } else if (device is HeaterDeviceView) {
      return _DeviceTemperatureInfo(
        current: device.temperatureChannel.temperature,
        target: device.heaterChannel.temperature,
        unit: unit,
      );
    } else if (device is AirConditionerDeviceView) {
      return _DeviceTemperatureInfo(
        current: device.temperatureChannel.temperature,
        target: device.coolerChannel.temperature,
        unit: unit,
      );
    }

    return null;
  }

  /// Get status icon for device
  IconData _getDeviceStatusIcon(DeviceView device) {
    if (!(device.isOnline)) {
      return MdiIcons.cloudOffOutline;
    }

    if (device is ThermostatDeviceView) {
      if (device.heaterChannel?.isHeating ?? false) return MdiIcons.fire;
      if (device.coolerChannel?.isCooling ?? false) return MdiIcons.snowflake;
    } else if (device is HeaterDeviceView) {
      if (device.heaterChannel.isHeating) return MdiIcons.fire;
    } else if (device is AirConditionerDeviceView) {
      if (device.coolerChannel.isCooling) return MdiIcons.snowflake;
    } else if (device is FanDeviceView) {
      return device.isOn ? MdiIcons.fan : MdiIcons.fanOff;
    } else if (device is AirHumidifierDeviceView) {
      return device.isOn ? MdiIcons.airHumidifier : MdiIcons.airHumidifierOff;
    } else if (device is AirPurifierDeviceView) {
      return device.isOn ? MdiIcons.airPurifier : MdiIcons.airPurifier;
    }

    return MdiIcons.checkCircle;
  }

  /// Get status color for device
  Color _getDeviceStatusColor(BuildContext context, DeviceView device) {
    if (!(device.isOnline)) {
      return Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.danger
          : AppColorsDark.danger;
    }

    if (device is ThermostatDeviceView) {
      if (device.heaterChannel?.isHeating ?? false) {
        return Theme.of(context).warning;
      }
      if (device.coolerChannel?.isCooling ?? false) {
        return Theme.of(context).info;
      }
    } else if (device is HeaterDeviceView) {
      if (device.heaterChannel.isHeating) {
        return Theme.of(context).warning;
      }
    } else if (device is AirConditionerDeviceView) {
      if (device.coolerChannel.isCooling) {
        return Theme.of(context).info;
      }
    }

    return Theme.of(context).brightness == Brightness.light
        ? AppTextColorLight.secondary
        : AppTextColorDark.secondary;
  }

  // ============================================================================
  // Intent-Based Temperature Control Methods
  // ============================================================================

  /// Execute a setpoint set intent (dial changes)
  Future<void> _setTemperatureViaIntent(
    BuildContext context,
    double value,
  ) async {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final localizations = AppLocalizations.of(context);
    final errorMessage = localizations?.action_failed ?? 'Failed to set temperature';

    final success = await spacesService.executeClimateSetpointSet(
      spaceId: _roomId,
      value: value,
    );

    if (!success && mounted) {
      AlertBar.showError(
        this.context,
        message: errorMessage,
      );
    }
  }

  /// Execute a setpoint delta intent (+/- buttons)
  Future<void> _adjustTemperatureViaIntent(
    BuildContext context, {
    required bool increase,
    SpacesModuleClimateIntentDelta delta = SpacesModuleClimateIntentDelta.small,
  }) async {
    final spacesService = _spacesService;
    if (spacesService == null) return;

    final localizations = AppLocalizations.of(context);
    final errorMessage =
        localizations?.action_failed ?? 'Failed to adjust temperature';

    final success = await spacesService.executeClimateSetpointDelta(
      spaceId: _roomId,
      delta: delta,
      increase: increase,
    );

    if (!success && mounted) {
      AlertBar.showError(
        this.context,
        message: errorMessage,
      );
    }
  }

  // ============================================================================
  // Legacy Temperature Setting Methods (fallback for non-intent devices)
  // ============================================================================

  Future<void> _setHeaterTemperature(
    BuildContext context,
    DeviceView device,
    double value,
    DevicesService devicesService,
  ) async {
    // Works for both HeaterDeviceView and ThermostatDeviceView with heater channel
    if (device is HeaterDeviceView) {
      final temperatureProp = device.heaterChannel.temperatureProp;
      await _valueHelper.setPropertyValue(context, temperatureProp, value);
    } else if (device is ThermostatDeviceView) {
      final heaterChannel = device.heaterChannel;
      if (heaterChannel != null) {
        await _valueHelper.setPropertyValue(
            context, heaterChannel.temperatureProp, value);
      }
    }
  }

  Future<void> _setCoolerTemperature(
    BuildContext context,
    DeviceView device,
    double value,
    DevicesService devicesService,
  ) async {
    // Works for both AirConditionerDeviceView and ThermostatDeviceView with cooler channel
    if (device is AirConditionerDeviceView) {
      final temperatureProp = device.coolerChannel.temperatureProp;
      await _valueHelper.setPropertyValue(context, temperatureProp, value);
    } else if (device is ThermostatDeviceView) {
      final coolerChannel = device.coolerChannel;
      if (coolerChannel != null) {
        await _valueHelper.setPropertyValue(
            context, coolerChannel.temperatureProp, value);
      }
    }
  }

  Future<void> _setThermostatMode(
    BuildContext context,
    ThermostatDeviceView device,
    ThermostatModeValue mode,
    DevicesService devicesService,
  ) async {
    final modeProp = device.thermostatChannel.modeProp;

    await _valueHelper.setPropertyValue(
      context,
      modeProp,
      mode.value,
    );
  }

  // ============================================================================
  // Device State Helpers
  // ============================================================================

  /// Check if device can be toggled on/off
  bool _canToggleDevice(DeviceView device) {
    if (device is FanDeviceView) {
      return device.fanChannel.onProp?.isWritable ?? false;
    }
    if (device is AirHumidifierDeviceView) {
      return device.switcherChannel.onProp?.isWritable ?? false;
    }
    if (device is AirPurifierDeviceView) {
      return device.fanChannel.onProp?.isWritable ?? false;
    }
    return false;
  }

  /// Get the on/off state of a device
  bool _getDeviceOnState(DeviceView device) {
    final controlStateService = _deviceControlStateService;

    if (device is ThermostatDeviceView) {
      return device.isOn;
    }
    if (device is HeaterDeviceView) {
      return device.isOn;
    }
    if (device is AirConditionerDeviceView) {
      return device.isOn;
    }
    if (device is FanDeviceView) {
      final onProp = device.fanChannel.onProp;
      if (onProp != null && controlStateService != null) {
        if (controlStateService.isLocked(
            device.id, device.fanChannel.id, onProp.id)) {
          final desiredValue = controlStateService.getDesiredValue(
              device.id, device.fanChannel.id, onProp.id);
          if (desiredValue is bool) return desiredValue;
        }
      }
      return device.isOn;
    }
    if (device is AirHumidifierDeviceView) {
      final onProp = device.switcherChannel.onProp;
      if (onProp != null && controlStateService != null) {
        if (controlStateService.isLocked(
            device.id, device.switcherChannel.id, onProp.id)) {
          final desiredValue = controlStateService.getDesiredValue(
              device.id, device.switcherChannel.id, onProp.id);
          if (desiredValue is bool) return desiredValue;
        }
      }
      return device.isOn;
    }
    if (device is AirDehumidifierDeviceView) {
      return device.isOn;
    }
    if (device is AirPurifierDeviceView) {
      final onProp = device.fanChannel.onProp;
      if (onProp != null && controlStateService != null) {
        if (controlStateService.isLocked(
            device.id, device.fanChannel.id, onProp.id)) {
          final desiredValue = controlStateService.getDesiredValue(
              device.id, device.fanChannel.id, onProp.id);
          if (desiredValue is bool) return desiredValue;
        }
      }
      return device.isOn;
    }

    return false;
  }

  /// Get status text for device
  String _getDeviceStatusText(BuildContext context, DeviceView device) {
    final localizations = AppLocalizations.of(context);

    if (device is ThermostatDeviceView) {
      return _getLocalizedModeName(context, device.thermostatMode);
    }
    if (device is HeaterDeviceView) {
      final isHeating = device.heaterChannel.isHeating;
      return isHeating
          ? (localizations?.thermostat_state_heating ?? 'Heating')
          : (localizations?.thermostat_state_idling ?? 'Idle');
    }
    if (device is AirConditionerDeviceView) {
      final isCooling = device.coolerChannel.isCooling;
      return isCooling
          ? (localizations?.thermostat_state_cooling ?? 'Cooling')
          : (localizations?.thermostat_state_idling ?? 'Idle');
    }
    if (device is FanDeviceView) {
      return device.isOn
          ? (localizations?.on_state_on ?? 'On')
          : (localizations?.on_state_off ?? 'Off');
    }
    if (device is AirHumidifierDeviceView) {
      return device.isOn
          ? (localizations?.on_state_on ?? 'On')
          : (localizations?.on_state_off ?? 'Off');
    }
    if (device is AirDehumidifierDeviceView) {
      return device.isOn
          ? (localizations?.on_state_on ?? 'On')
          : (localizations?.on_state_off ?? 'Off');
    }
    if (device is AirPurifierDeviceView) {
      return device.isOn
          ? (localizations?.on_state_on ?? 'On')
          : (localizations?.on_state_off ?? 'Off');
    }

    return '';
  }

  Future<void> _toggleDevice(
    BuildContext context,
    DeviceView device,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);
    final controlStateService = _deviceControlStateService;

    String? channelId;
    String? propertyId;
    bool actualState = false;

    if (device is FanDeviceView) {
      final onProp = device.fanChannel.onProp;
      if (onProp != null && onProp.isWritable) {
        channelId = device.fanChannel.id;
        propertyId = onProp.id;
        actualState = device.fanChannel.on;
      }
    } else if (device is AirHumidifierDeviceView) {
      final onProp = device.switcherChannel.onProp;
      if (onProp != null && onProp.isWritable) {
        channelId = device.switcherChannel.id;
        propertyId = onProp.id;
        actualState = device.switcherChannel.on;
      }
    } else if (device is AirPurifierDeviceView) {
      final onProp = device.fanChannel.onProp;
      if (onProp != null && onProp.isWritable) {
        channelId = device.fanChannel.id;
        propertyId = onProp.id;
        actualState = device.fanChannel.on;
      }
    }

    if (channelId == null || propertyId == null) return;

    // Use optimistic UI state if available, otherwise use actual state
    bool currentState = actualState;
    if (controlStateService != null &&
        controlStateService.isLocked(device.id, channelId, propertyId)) {
      final desiredValue =
          controlStateService.getDesiredValue(device.id, channelId, propertyId);
      if (desiredValue is bool) {
        currentState = desiredValue;
      }
    }

    final newState = !currentState;

    controlStateService?.setPending(device.id, channelId, propertyId, newState);
    setState(() {
      _togglingDevices.add(device.id);
    });

    _intentOverlayService?.createLocalOverlay(
      deviceId: device.id,
      channelId: channelId,
      propertyId: propertyId,
      value: newState,
      ttlMs: 5000,
    );

    try {
      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: _roomId,
      );

      final success = await devicesService.setMultiplePropertyValues(
        properties: [
          PropertyCommandItem(
            deviceId: device.id,
            channelId: channelId,
            propertyId: propertyId,
            value: newState,
          ),
        ],
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          this.context,
          message: localizations?.action_failed ?? 'Failed to toggle device',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        this.context,
        message: localizations?.action_failed ?? 'Failed to toggle device',
      );
    } finally {
      if (mounted) {
        setState(() {
          _togglingDevices.remove(device.id);
        });
        controlStateService?.setSettling(device.id, channelId, propertyId);
      }
    }
  }

  void _openDeviceDetail(BuildContext context, DeviceView device) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(device.id),
      ),
    );
  }
}

// ============================================================================
// Property Value Helper
// ============================================================================

/// Helper class to set property values with error handling
class _PropertyValueHelper {
  final DevicesService _service = locator<DevicesService>();

  Future<bool> setPropertyValue(
    BuildContext context,
    ChannelPropertyView property,
    dynamic value,
  ) async {
    final localizations = AppLocalizations.of(context)!;

    try {
      bool res = await _service.setPropertyValue(
        property.id,
        value,
      );

      if (!res && context.mounted) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }

      return res;
    } catch (e) {
      if (!context.mounted) return false;

      AlertBar.showError(
        context,
        message: localizations.action_failed,
      );
    }

    return false;
  }
}

// ============================================================================
// Temperature Info Helper
// ============================================================================

/// Helper class to hold temperature information for display
class _DeviceTemperatureInfo {
  final double current;
  final double? target;
  final String unit;

  _DeviceTemperatureInfo({
    required this.current,
    this.target,
    required this.unit,
  });

  /// Format current temperature with validation
  String get currentFormatted {
    // Check for invalid/default values
    if (current == 0.0 || current < -50 || current > 100) {
      return '--$unit';
    }
    return '${current.toStringAsFixed(1)}$unit';
  }

  /// Format target temperature with validation
  String? get targetFormatted {
    if (target == null) return null;
    // Check for invalid/default values
    if (target == 0.0 || target! < -50 || target! > 100) {
      return null;
    }
    return '${target!.toStringAsFixed(1)}$unit';
  }
}
