import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_channel_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_utils.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart' show buildChannelIcon;
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Local thermostat mode enum - derived from heater/cooler ON states
enum ThermostatMode {
  off,
  heat,
  cool,
  auto;

  String get value => name;
}

/// Internal sensor data structure for thermostat device detail.
class _SensorInfo {
  final String id;
  final String label;
  final String value;
  final String? unit;
  final IconData icon;
  final ThemeColors? themeColor;
  final bool isWarning;
  final SensorData? sensorData;

  const _SensorInfo({
    required this.id,
    required this.label,
    required this.value,
    required this.icon,
    this.unit,
    this.themeColor,
    this.isWarning = false,
    this.sensorData,
  });

  /// Returns the formatted display value with unit
  /// Uses the backend-provided unit from [sensorData] when available,
  /// falling back to the explicit [unit] field.
  String get displayValue {
    final u = (sensorData != null && sensorData!.unit.isNotEmpty)
        ? sensorData!.unit
        : unit;
    return (u != null && u.isNotEmpty) ? '$value$u' : value;
  }
}

class ThermostatDeviceDetail extends StatefulWidget {
  final ThermostatDeviceView _device;
  final VoidCallback? onBack;

  const ThermostatDeviceDetail({
    super.key,
    required ThermostatDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<ThermostatDeviceDetail> createState() => _ThermostatDeviceDetailState();
}

class _ThermostatDeviceDetailState extends State<ThermostatDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  ThermostatDeviceController? _controller;

  // Debounce timer for setpoint changes to avoid flooding backend
  Timer? _setpointDebounceTimer;
  static const _setpointDebounceDuration = Duration(milliseconds: 300);

  @override
  void initState() {
    super.initState();
    _devicesService.addListener(_onDeviceChanged);

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[ThermostatDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }

    _initController();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = ThermostatDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint('[ThermostatDeviceDetail] Controller error for $propertyId: $error');
    }

    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AppToast.showError(context, message: localizations.action_failed);
    }

    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _setpointDebounceTimer?.cancel();
    _devicesService.removeListener(_onDeviceChanged);
    _deviceControlStateService?.removeListener(_onControlStateChanged);
    super.dispose();
  }

  void _onDeviceChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _checkConvergence();
        _initController();
        setState(() {});
      }
    });
  }

  /// Check convergence for all controllable properties.
  ///
  /// When device data updates (from WebSocket), this checks if any properties
  /// in settling state have converged (or diverged from external changes) and
  /// clears the optimistic state appropriately.
  void _checkConvergence() {
    final controlState = _deviceControlStateService;
    if (controlState == null) return;

    final deviceId = _device.id;

    // Check heater channel properties (if available)
    final heaterChannel = _device.heaterChannel;
    if (heaterChannel != null) {
      final channelId = heaterChannel.id;

      // Check power property
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        heaterChannel.onProp.id,
        heaterChannel.on,
      );

      // Check temperature setpoint property
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        heaterChannel.temperatureProp.id,
        heaterChannel.temperature,
        tolerance: 0.5,
      );
    }

    // Check cooler channel properties (if available)
    final coolerChannel = _device.coolerChannel;
    if (coolerChannel != null) {
      final channelId = coolerChannel.id;

      // Check power property
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        coolerChannel.onProp.id,
        coolerChannel.on,
      );

      // Check temperature setpoint property
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        coolerChannel.temperatureProp.id,
        coolerChannel.temperature,
        tolerance: 0.5,
      );
    }
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  ThermostatDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is ThermostatDeviceView) {
      return updated;
    }
    return widget._device;
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

  /// Get current mode from heater/cooler ON states or pending control state
  ThermostatMode get _currentMode {
    final controlState = _deviceControlStateService;
    final heaterChannel = _device.heaterChannel;
    final coolerChannel = _device.coolerChannel;

    // Check for pending/optimistic heater.on value
    bool heaterOn = heaterChannel?.on ?? false;
    if (controlState != null &&
        heaterChannel != null &&
        controlState.isLocked(_device.id, heaterChannel.id, heaterChannel.onProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        heaterChannel.id,
        heaterChannel.onProp.id,
      );
      if (desiredValue is bool) {
        heaterOn = desiredValue;
      }
    }

    // Check for pending/optimistic cooler.on value
    bool coolerOn = coolerChannel?.on ?? false;
    if (controlState != null &&
        coolerChannel != null &&
        controlState.isLocked(_device.id, coolerChannel.id, coolerChannel.onProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        coolerChannel.id,
        coolerChannel.onProp.id,
      );
      if (desiredValue is bool) {
        coolerOn = desiredValue;
      }
    }

    // Derive mode from heater/cooler ON states
    if (heaterOn && coolerOn) {
      return ThermostatMode.auto;
    } else if (heaterOn) {
      return ThermostatMode.heat;
    } else if (coolerOn) {
      return ThermostatMode.cool;
    } else {
      return ThermostatMode.off;
    }
  }

  bool get _isHeating => _device.heaterChannel?.isHeating ?? false;

  bool get _isCooling => _device.coolerChannel?.isCooling ?? false;

  /// Dial glow is active when heater or cooler is actively working
  bool get _isActive {
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _isHeating;
      case ThermostatMode.cool:
        return _isCooling;
      case ThermostatMode.auto:
        return _isHeating || _isCooling;
      case ThermostatMode.off:
        return false;
    }
  }

  double get _currentTemperature => _device.temperatureChannel.temperature;

  double get _minSetpoint {
    // Get min from the appropriate channel based on mode
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _device.heaterChannel?.minTemperature ?? 16.0;
      case ThermostatMode.cool:
        return _device.coolerChannel?.minTemperature ?? 16.0;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // Use heater min as default for display
        return _device.heaterChannel?.minTemperature ?? 16.0;
    }
  }

  double get _maxSetpoint {
    // Get max from the appropriate channel based on mode
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _device.heaterChannel?.maxTemperature ?? 30.0;
      case ThermostatMode.cool:
        return _device.coolerChannel?.maxTemperature ?? 30.0;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // Use heater max as default for display
        return _device.heaterChannel?.maxTemperature ?? 30.0;
    }
  }

  /// Valid min/max setpoint range; uses safe defaults if API returns malformed data.
  (double, double) get _validSetpointRange {
    var min = _minSetpoint;
    var max = _maxSetpoint;
    if (min >= max) {
      min = 16.0;
      max = 30.0;
    }
    return (min, max);
  }

  ChannelPropertyView? get _activeSetpointProp {
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _device.heaterChannel?.temperatureProp;
      case ThermostatMode.cool:
        return _device.coolerChannel?.temperatureProp;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // No setpoint control in auto/off modes
        return null;
    }
  }

  String? get _activeSetpointChannelId {
    switch (_currentMode) {
      case ThermostatMode.heat:
        return _device.heaterChannel?.id;
      case ThermostatMode.cool:
        return _device.coolerChannel?.id;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // No setpoint control in auto/off modes
        return null;
    }
  }

  double get _targetSetpoint {
    final controller = _controller;

    // Get setpoint based on current mode, using controller for optimistic-aware values
    switch (_currentMode) {
      case ThermostatMode.heat:
        return controller?.heatingTemperature ??
            _device.heaterChannel?.temperature ??
            21.0;
      case ThermostatMode.cool:
        return controller?.coolingTemperature ??
            _device.coolerChannel?.temperature ??
            24.0;
      case ThermostatMode.auto:
      case ThermostatMode.off:
        // Show heater setpoint for display purposes
        return controller?.heatingTemperature ??
            _device.heaterChannel?.temperature ??
            21.0;
    }
  }

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(ThermostatMode mode) {
    final controller = _controller;
    final heaterChannel = _device.heaterChannel;
    final coolerChannel = _device.coolerChannel;
    final heaterOnProp = heaterChannel?.onProp;
    final coolerOnProp = coolerChannel?.onProp;

    if (controller == null) return;

    // Build batch command list - mode is controlled via heater.on/cooler.on
    final commands = <PropertyCommandItem>[];

    switch (mode) {
      case ThermostatMode.heat:
        // Turn on heater, turn off cooler
        if (heaterOnProp != null && heaterChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: heaterChannel.id,
            propertyId: heaterOnProp.id,
            value: true,
          ));
        }
        if (coolerOnProp != null && coolerChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: false,
          ));
        }
        break;
      case ThermostatMode.cool:
        // Turn off heater, turn on cooler
        if (heaterOnProp != null && heaterChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: heaterChannel.id,
            propertyId: heaterOnProp.id,
            value: false,
          ));
        }
        if (coolerOnProp != null && coolerChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: true,
          ));
        }
        break;
      case ThermostatMode.auto:
        // Turn on both heater and cooler
        if (heaterOnProp != null && heaterChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: heaterChannel.id,
            propertyId: heaterOnProp.id,
            value: true,
          ));
        }
        if (coolerOnProp != null && coolerChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: true,
          ));
        }
        break;
      case ThermostatMode.off:
        // Turn off both heater and cooler
        if (heaterOnProp != null && heaterChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: heaterChannel.id,
            propertyId: heaterOnProp.id,
            value: false,
          ));
        }
        if (coolerOnProp != null && coolerChannel != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: false,
          ));
        }
        break;
    }

    // Use controller's batch operation
    if (commands.isNotEmpty) {
      controller.setMultipleProperties(
        commands,
        onError: () {
          if (mounted) {
            final localizations = AppLocalizations.of(context);
            if (localizations != null) {
              AppToast.showError(context, message: localizations.action_failed);
            }
            setState(() {});
          }
        },
      );
      setState(() {});
    }
  }

  void _onSetpointChanged(double value) {
    final controller = _controller;
    final setpointProp = _activeSetpointProp;
    final channelId = _activeSetpointChannelId;
    if (controller == null || setpointProp == null || channelId == null) return;

    // Round to step value (0.5)
    final steppedValue = (value * 2).round() / 2;

    // Clamp to valid range
    final clampedValue = steppedValue.clamp(_minSetpoint, _maxSetpoint);

    // Set PENDING state immediately for responsive UI (for dial visual feedback)
    _deviceControlStateService?.setPending(
      _device.id,
      channelId,
      setpointProp.id,
      clampedValue,
    );
    setState(() {});

    // Cancel any pending debounce timer
    _setpointDebounceTimer?.cancel();

    // Debounce the API call to avoid flooding backend
    _setpointDebounceTimer = Timer(_setpointDebounceDuration, () {
      if (!mounted) return;

      // Use controller method based on current mode
      switch (_currentMode) {
        case ThermostatMode.heat:
          controller.setHeatingTemperature(clampedValue);
          break;
        case ThermostatMode.cool:
          controller.setCoolingTemperature(clampedValue);
          break;
        default:
          break;
      }
    });
  }

  void _setThermostatLocked(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.setLocked(value);
    setState(() {});
  }

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  String _getStatusLabel(AppLocalizations localizations) {
    if (_currentMode == ThermostatMode.off) {
      return localizations.on_state_off;
    }
    final tempStr = SensorUtils.formatNumericValueWithUnit(_targetSetpoint, DevicesModuleChannelCategory.temperature);
    if (_isCooling) {
      return localizations.thermostat_state_cooling_to(tempStr);
    }
    if (_isHeating) {
      return localizations.thermostat_state_heating_to(tempStr);
    }
    return localizations.thermostat_state_idle_at(tempStr);
  }

  /// Theme color for the current mode. Single source for all mode-based colors.
  ThemeColors _getModeColor() => _themeColorForMode(_currentMode);

  /// Theme color family for the current mode. Use for borders, bases, etc.
  ThemeColorFamily _getModeColorFamily(BuildContext context) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getModeColor());

  static ThemeColors _themeColorForMode(ThermostatMode mode) {
    switch (mode) {
      case ThermostatMode.heat:
        return ThemeColors.warning;
      case ThermostatMode.cool:
        return ThemeColors.info;
      case ThermostatMode.auto:
        return ThemeColors.success;
      case ThermostatMode.off:
        return ThemeColors.neutral;
    }
  }

  DialAccentColor _getDialAccentColor() {
    switch (_getModeColor()) {
      case ThemeColors.warning:
        return DialAccentColor.warning;
      case ThemeColors.info:
        return DialAccentColor.info;
      case ThemeColors.success:
        return DialAccentColor.success;
      default:
        return DialAccentColor.neutral;
    }
  }

  List<ModeOption<ThermostatMode>> _getModeOptions(
      AppLocalizations localizations) {
    final modes = <ModeOption<ThermostatMode>>[];
    final hasHeater = _device.heaterChannel != null;
    final hasCooler = _device.coolerChannel != null;

    if (hasHeater) {
      modes.add(ModeOption(
        value: ThermostatMode.heat,
        icon: MdiIcons.fireCircle,
        label: localizations.thermostat_mode_heat,
        color: _themeColorForMode(ThermostatMode.heat),
      ));
    }

    if (hasCooler) {
      modes.add(ModeOption(
        value: ThermostatMode.cool,
        icon: MdiIcons.snowflake,
        label: localizations.thermostat_mode_cool,
        color: _themeColorForMode(ThermostatMode.cool),
      ));
    }

    // Always add OFF mode
    modes.add(ModeOption(
      value: ThermostatMode.off,
      icon: MdiIcons.power,
      label: localizations.thermostat_mode_off,
      color: _themeColorForMode(ThermostatMode.off),
    ));

    return modes;
  }

  // --------------------------------------------------------------------------
  // BUILD METHODS
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;

    final lastSeenText = widget._device.lastStateChange != null
        ? DatetimeUtils.formatTimeAgo(widget._device.lastStateChange!, localizations)
        : null;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(
              child: Stack(
                children: [
                  OrientationBuilder(
                    builder: (context, orientation) {
                      return orientation == Orientation.landscape
                          ? _buildLandscapeLayout(context, isDark)
                          : _buildPortraitLayout(context, isDark);
                    },
                  ),
                  if (!widget._device.isOnline)
                    DeviceOfflineState(
                      isDark: isDark,
                      lastSeenText: lastSeenText,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final modeColorFamily = _getModeColorFamily(context);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return PageHeader(
      title: _device.name,
      subtitle: _getStatusLabel(localizations),
      subtitleColor: _isActive ? modeColorFamily.base : secondaryColor,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: widget.onBack ?? () => Navigator.of(context).pop(),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderMainIcon(icon: buildDeviceIcon(_device.category, _device.icon), color: _getModeColor()),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final modeColorFamily = _getModeColorFamily(context);
    final statusSection = _buildStatusSection(localizations, isDark, modeColorFamily.base);
    final controlsSection = _buildControlsSection(localizations, isDark, _getModeColor());

    return DevicePortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          _buildPrimaryControlCard(context, isDark, dialSize: _scale(DeviceDetailDialSizes.portrait)),
          if (statusSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            statusSection,
          ],
          if (controlsSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            controlsSection,
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final isLargeScreen = _screenService.isLargeScreen;
    final modeColorFamily = _getModeColorFamily(context);
    final statusSection = _buildStatusSection(localizations, isDark, modeColorFamily.base);
    final controlsSection = _buildControlsSection(localizations, isDark, _getModeColor());

    return DeviceLandscapeLayout(
      mainContent: isLargeScreen
          ? _buildPrimaryControlCard(context, isDark, dialSize: _scale(DeviceDetailDialSizes.landscape))
          : _buildCompactDialWithModes(context, isDark),
      secondaryContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          if (statusSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            statusSection,
          ],
          if (controlsSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            controlsSection,
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // STATUS SECTION
  // --------------------------------------------------------------------------

  Widget _buildStatusSection(
    AppLocalizations localizations,
    bool isDark,
    Color modeColor,
  ) {
    final humidityChannel = _device.humidityChannel;
    final contactChannel = _device.contactChannel;

    // Build sensor info list
    final sensors = <_SensorInfo>[];

    // Temperature (always present)
    final temperatureChannel = _device.temperatureChannel;
    sensors.add(_SensorInfo(
      id: 'temperature',
      label: localizations.device_current_temperature,
      value: SensorUtils.formatNumericValue(_currentTemperature, temperatureChannel.category),
      unit: SensorUtils.unitForCategory(temperatureChannel.category),
      icon: buildChannelIcon(temperatureChannel.category),
      themeColor: SensorColors.temperature,
      sensorData: SensorUtils.buildSensorData(temperatureChannel,
            localizations: localizations),
    ));

    // Humidity (optional)
    if (humidityChannel != null) {
      sensors.add(_SensorInfo(
        id: 'humidity',
        label: localizations.device_humidity,
        value: SensorUtils.formatNumericValue(humidityChannel.humidity, humidityChannel.category),
        unit: SensorUtils.unitForCategory(humidityChannel.category),
        icon: buildChannelIcon(humidityChannel.category),
        themeColor: SensorColors.humidity,
        sensorData: SensorUtils.buildSensorData(humidityChannel,
            localizations: localizations),
      ));
    }

    // Contact sensor (optional) - shows window/door status
    // detected = true means window is open
    if (contactChannel != null) {
      final isOpen = contactChannel.detected;
      sensors.add(_SensorInfo(
        id: 'contact',
        label: localizations.contact_sensor_window,
        value: SensorUtils.translateBinaryState(localizations, contactChannel.category, isOpen),
        icon: isOpen ? MdiIcons.doorOpen : MdiIcons.doorClosed,
        themeColor: SensorColors.alert,
        isWarning: isOpen,
        sensorData: SensorUtils.buildSensorData(contactChannel,
            localizations: localizations),
      ));
    }

    if (sensors.isEmpty) {
      return const SizedBox.shrink();
    }

    return _buildSensorsSection(isDark, sensors);
  }

  Widget _buildControlsSection(
    AppLocalizations localizations,
    bool isDark,
    ThemeColors? modeThemeColor,
  ) {
    if (!_device.hasThermostatLock) {
      return const SizedBox.shrink();
    }

    final tileHeight = _scale(AppTileHeight.horizontal);

    return Column(
      children: [
        SizedBox(
          height: tileHeight,
          width: double.infinity,
          child: UniversalTile(
            layout: TileLayout.horizontal,
            icon: MdiIcons.lock,
            name: localizations.device_child_lock,
            status: _device.isThermostatLocked
                ? localizations.thermostat_lock_locked
                : localizations.thermostat_lock_unlocked,
            isActive: _device.isThermostatLocked,
            activeColor: modeThemeColor,
            onTileTap: () => _setThermostatLocked(!_device.isThermostatLocked),
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: _screenService.isLandscape,
          ),
        ),
      ],
    );
  }

  /// Builds sensors section using tile wrappers:
  /// - Portrait: HorizontalScrollWithGradient with HorizontalTileCompact
  /// - Landscape large: GridView.count with VerticalTileLarge
  /// - Landscape small/medium: Column with HorizontalTileStretched
  Widget _buildSensorsSection(bool isDark, List<_SensorInfo> sensors) {
    if (sensors.isEmpty) return const SizedBox.shrink();

    final isLandscape = _screenService.isLandscape;
    final isLargeScreen = _screenService.isLargeScreen;

    VoidCallback? sensorTapCallback(_SensorInfo sensor) {
      final data = sensor.sensorData;
      if (data == null) return null;
      return () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => SensorChannelDetailPage(
              sensor: data,
              deviceName: _device.name,
              isDeviceOnline: _device.isOnline,
            ),
          ));
    }

    // Portrait: Horizontal scroll with HorizontalTileCompact
    if (!isLandscape) {
      final tileHeight = _scale(AppTileHeight.horizontal);

      return HorizontalScrollWithGradient(
        height: tileHeight,
        layoutPadding: AppSpacings.pLg,
        itemCount: sensors.length,
        separatorWidth: AppSpacings.pMd,
        itemBuilder: (context, index) {
          final sensor = sensors[index];
          return HorizontalTileCompact(
            icon: sensor.icon,
            name: sensor.displayValue,
            status: sensor.label,
            iconAccentColor: sensor.themeColor,
            showWarningBadge: sensor.isWarning,
            onTileTap: sensorTapCallback(sensor),
          );
        },
      );
    }

    // Landscape large: GridView with VerticalTileLarge
    if (isLargeScreen) {
      return GridView.count(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacings.pMd,
        crossAxisSpacing: AppSpacings.pMd,
        childAspectRatio: AppTileAspectRatio.square,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: sensors.map((sensor) {
          return VerticalTileLarge(
            icon: sensor.icon,
            name: sensor.displayValue,
            status: sensor.label,
            iconAccentColor: sensor.themeColor,
            showWarningBadge: sensor.isWarning,
            onTileTap: sensorTapCallback(sensor),
          );
        }).toList(),
      );
    }

    // Landscape small/medium: Column with HorizontalTileStretched
    return Column(
      spacing: AppSpacings.pMd,
      children: sensors.map((sensor) {
        return HorizontalTileStretched(
            icon: sensor.icon,
            name: sensor.displayValue,
            status: sensor.label,
            iconAccentColor: sensor.themeColor,
            showWarningBadge: sensor.isWarning,
            onTileTap: sensorTapCallback(sensor),
        );
      }).toList(),
    );
  }

  // --------------------------------------------------------------------------
  // PRIMARY CONTROL CARD
  // --------------------------------------------------------------------------

  Widget _buildPrimaryControlCard(
    BuildContext context,
    bool isDark, {
    required double dialSize,
  }) {
    final borderColor = _getModeColorFamily(context).light7;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final (minSetpoint, maxSetpoint) = _validSetpointRange;
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

    return Container(
      width: double.infinity,
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          CircularControlDial(
            value: targetSetpoint,
            currentValue: _currentTemperature,
            minValue: minSetpoint,
            maxValue: maxSetpoint,
            step: 0.5,
            size: dialSize,
            accentType: _getDialAccentColor(),
            isActive: _isActive,
            enabled: _currentMode == ThermostatMode.heat ||
                _currentMode == ThermostatMode.cool,
            modeLabel: _currentMode.value,
            displayFormat: DialDisplayFormat.temperature,
            onChanged: _onSetpointChanged,
          ),
          _buildModeSelector(context, ModeSelectorOrientation.horizontal),
        ],
      ),
    );
  }

  /// Compact dial with vertical icon-only mode selector on the right
  Widget _buildCompactDialWithModes(BuildContext context, bool isDark) {
    final borderColor = _getModeColorFamily(context).light7;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final (minSetpoint, maxSetpoint) = _validSetpointRange;
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final modeIconsWidth = _scale(50);
          final spacing = AppSpacings.pXl;
          final availableForDial =
              constraints.maxWidth - modeIconsWidth - spacing;
          final maxDialHeight = constraints.maxHeight;
          final dialSize =
              math.min(availableForDial, maxDialHeight).clamp(120.0, 400.0);

          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(
                child: Center(
                  child: CircularControlDial(
                    value: targetSetpoint,
                    currentValue: _currentTemperature,
                    minValue: minSetpoint,
                    maxValue: maxSetpoint,
                    step: 0.5,
                    size: dialSize,
                    accentType: _getDialAccentColor(),
                    isActive: _isActive,
                    enabled: _currentMode == ThermostatMode.heat ||
                    _currentMode == ThermostatMode.cool,
                    modeLabel: _currentMode.value,
                    displayFormat: DialDisplayFormat.temperature,
                    onChanged: _onSetpointChanged,
                  ),
                ),
              ),
              _buildVerticalModeSelector(context),
            ],
          );
        },
      ),
    );
  }

  Widget _buildModeSelector(
    BuildContext context,
    ModeSelectorOrientation orientation, {
    bool showLabels = true,
  }) {
    final localizations = AppLocalizations.of(context)!;
    return ModeSelector<ThermostatMode>(
      modes: _getModeOptions(localizations),
      selectedValue: _currentMode,
      onChanged: _onModeChanged,
      orientation: orientation,
      iconPlacement: ModeSelectorIconPlacement.left,
      showLabels: showLabels,
    );
  }

  Widget _buildVerticalModeSelector(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return ModeSelector<ThermostatMode>(
      modes: _getModeOptions(localizations),
      selectedValue: _currentMode,
      onChanged: _onModeChanged,
      orientation: ModeSelectorOrientation.vertical,
      showLabels: false,
      scrollable: true,
    );
  }
}
