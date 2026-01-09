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
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
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

  DevicesService? _devicesService;
  IntentOverlayService? _intentOverlayService;
  DeviceControlStateService? _deviceControlStateService;

  // Track which devices are currently being toggled (prevents double-taps)
  final Set<String> _togglingDevices = {};

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
  }

  @override
  void dispose() {
    _devicesService?.removeListener(_onDevicesDataChanged);
    _intentOverlayService?.removeListener(_onIntentDataChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);

    super.dispose();
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

  /// Get hero device (thermostat > heater > cooler priority)
  DeviceView? _getHeroDevice(List<DeviceView> devices) {
    // Priority: thermostat first, then heater, then cooler
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

  /// Get secondary devices (non-hero devices)
  List<DeviceView> _getSecondaryDevices(
      List<DeviceView> devices, DeviceView? heroDevice) {
    if (heroDevice == null) return devices;
    return devices.where((d) => d.id != heroDevice.id).toList();
  }

  @override
  Widget build(BuildContext context) {
    final devicesService = _devicesService;

    return Scaffold(
      appBar: AppTopBar(
        title: widget.viewItem.title,
        icon: DomainType.climate.icon,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (devicesService == null) {
              return _buildEmptyState(context);
            }

            final climateDevices = _getClimateDevices();

            if (climateDevices.isEmpty) {
              return _buildEmptyState(context);
            }

            final heroDevice = _getHeroDevice(climateDevices);
            final secondaryDevices =
                _getSecondaryDevices(climateDevices, heroDevice);

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
                    ),

                  // Secondary devices section
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
          },
        ),
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
    BoxConstraints constraints,
  ) {
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
              _buildThermostatHero(context, device, devicesService, constraints)
            else if (device is HeaterDeviceView)
              _buildHeaterHero(context, device, devicesService, constraints)
            else if (device is AirConditionerDeviceView)
              _buildCoolerHero(context, device, devicesService, constraints),

            AppSpacings.spacingMdVertical,

            // Status indicator
            _buildStatusIndicator(context, device),
          ],
        ),
      ),
    );
  }

  /// Build thermostat hero with temperature display and mode buttons
  Widget _buildThermostatHero(
    BuildContext context,
    ThermostatDeviceView device,
    DevicesService devicesService,
    BoxConstraints constraints,
  ) {
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
                  context, device, devicesService, dialSize, unit)
              : _buildTemperatureDialDisplay(context, device),
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
    String unit,
  ) {
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
        (value) => _setHeaterTemperature(context, device, value, devicesService),
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
        (value) => _setCoolerTemperature(context, device, value, devicesService),
      );
    }

    return _buildTemperatureDialDisplay(context, device);
  }

  /// Build heater hero with dial
  Widget _buildHeaterHero(
    BuildContext context,
    HeaterDeviceView device,
    DevicesService devicesService,
    BoxConstraints constraints,
  ) {
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
              '°C',
              dialSize,
              (value) =>
                  _setHeaterTemperature(context, device, value, devicesService),
            )
          : _buildHeaterDialDisplay(context, device),
    );
  }

  /// Build cooler (AC) hero with dial
  Widget _buildCoolerHero(
    BuildContext context,
    AirConditionerDeviceView device,
    DevicesService devicesService,
    BoxConstraints constraints,
  ) {
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
              '°C',
              dialSize,
              (value) =>
                  _setCoolerTemperature(context, device, value, devicesService),
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
    Function(double) onChanged,
  ) {
    return RoundedSlider(
      value: currentValue.clamp(minValue, maxValue),
      min: minValue,
      max: maxValue,
      enabled: true,
      availableWidth: dialSize,
      availableHeight: dialSize,
      onValueChanged: (value) => onChanged(value.toDouble()),
      inner: _buildDialCenterContent(context, device, unit),
    );
  }

  /// Build dial center content showing temperatures
  Widget _buildDialCenterContent(
    BuildContext context,
    DeviceView device,
    String unit,
  ) {
    if (device is ThermostatDeviceView) {
      return _buildThermostatDialCenter(context, device, unit);
    } else if (device is HeaterDeviceView) {
      return _buildHeaterDialCenter(context, device, unit);
    } else if (device is AirConditionerDeviceView) {
      return _buildCoolerDialCenter(context, device, unit);
    }
    return SizedBox.shrink();
  }

  /// Build thermostat dial center
  Widget _buildThermostatDialCenter(
    BuildContext context,
    ThermostatDeviceView device,
    String unit,
  ) {
    final currentTemp = device.temperatureChannel.temperature;
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
          '${currentTemp.toStringAsFixed(1)}$unit',
          style: TextStyle(
            fontSize: _screenService.scale(
              32,
              density: _visualDensityService.density,
            ),
            fontWeight: FontWeight.bold,
          ),
        ),
        if (targetTemp != null) ...[
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
            '${targetTemp.toStringAsFixed(1)}$unit',
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
    String unit,
  ) {
    // Current room temp from temperature channel, target from heater channel
    final currentTemp = device.temperatureChannel.temperature;
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
          '${currentTemp.toStringAsFixed(1)}$unit',
          style: TextStyle(
            fontSize: _screenService.scale(
              32,
              density: _visualDensityService.density,
            ),
            fontWeight: FontWeight.bold,
          ),
        ),
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
          '${targetTemp.toStringAsFixed(1)}$unit',
          style: TextStyle(
            fontSize: AppFontSize.large,
            fontWeight: FontWeight.w500,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      ],
    );
  }

  /// Build cooler dial center
  Widget _buildCoolerDialCenter(
    BuildContext context,
    AirConditionerDeviceView device,
    String unit,
  ) {
    final currentTemp = device.temperatureChannel.temperature;
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
          '${currentTemp.toStringAsFixed(1)}$unit',
          style: TextStyle(
            fontSize: _screenService.scale(
              32,
              density: _visualDensityService.density,
            ),
            fontWeight: FontWeight.bold,
          ),
        ),
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
          '${targetTemp.toStringAsFixed(1)}$unit',
          style: TextStyle(
            fontSize: AppFontSize.large,
            fontWeight: FontWeight.w500,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
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
            color: Theme.of(context).colorScheme.primary,
          ),
          AppSpacings.spacingMdVertical,
          Text(
            '${currentTemp.toStringAsFixed(1)}$unit',
            style: TextStyle(
              fontSize: _screenService.scale(
                48,
                density: _visualDensityService.density,
              ),
              fontWeight: FontWeight.bold,
            ),
          ),
          AppSpacings.spacingSmVertical,
          _buildStatusIndicator(context, device),
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
            color: Theme.of(context).colorScheme.primary,
          ),
          AppSpacings.spacingMdVertical,
          Text(
            '${currentTemp.toStringAsFixed(1)}°C',
            style: TextStyle(
              fontSize: _screenService.scale(
                48,
                density: _visualDensityService.density,
              ),
              fontWeight: FontWeight.bold,
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
            color: Theme.of(context).colorScheme.primary,
          ),
          AppSpacings.spacingMdVertical,
          Text(
            '${currentTemp.toStringAsFixed(1)}°C',
            style: TextStyle(
              fontSize: _screenService.scale(
                48,
                density: _visualDensityService.density,
              ),
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
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

  /// Build secondary devices section
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

  /// Build a secondary device tile
  Widget _buildSecondaryDeviceTile(
    BuildContext context,
    DeviceView device,
    DevicesService devicesService,
  ) {
    final deviceType = getClimateDeviceType(device);
    final isToggling = _togglingDevices.contains(device.id);
    final bool isOn = _getDeviceOnState(device);
    final canToggle = _canToggleDevice(device);

    return SizedBox(
      width: 140,
      height: 100,
      child: ButtonTileBox(
        onTap: isToggling ? null : () => _openDeviceDetail(context, device),
        isOn: isOn,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ButtonTileIcon(
              icon: deviceType != null
                  ? getClimateDeviceIcon(deviceType)
                  : MdiIcons.thermometer,
              onTap: (canToggle && !isToggling)
                  ? () => _toggleDevice(context, device, devicesService)
                  : null,
              isOn: isOn,
              rawIconSize: 32,
            ),
            AppSpacings.spacingXsVertical,
            ButtonTileTitle(
              title: device.name,
              isOn: isOn,
            ),
            ButtonTileSubTitle(
              subTitle: Text(_getDeviceStatusText(context, device)),
              isOn: isOn,
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================================
  // Temperature Setting Methods
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
