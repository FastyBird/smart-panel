import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_card.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/card_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_channel_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_utils.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/fan_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart' show buildChannelIcon;
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Mode enum for A/C device
enum AcMode {
  heat,
  cool,
  off;

  String get value => name;
}

/// Internal sensor data structure for air conditioner device detail.
class _SensorInfo {
  final String id;
  final String label;
  final String value;
  final String? unit;
  final IconData icon;
  final ThemeColors? themeColor;
  final bool isWarning;

  /// Optional [SensorData] for navigating to sensor detail page on tap.
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

class AirConditionerDeviceDetail extends StatefulWidget {
  final AirConditionerDeviceView _device;
  final VoidCallback? onBack;

  const AirConditionerDeviceDetail({
    super.key,
    required AirConditionerDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<AirConditionerDeviceDetail> createState() =>
      _AirConditionerDeviceDetailState();
}

class _AirConditionerDeviceDetailState
    extends State<AirConditionerDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  AirConditionerDeviceController? _controller;

  // Debounce timer for setpoint changes to avoid flooding backend
  Timer? _setpointDebounceTimer;
  static const _setpointDebounceDuration = Duration(milliseconds: 300);

  // Debounce timer for fan speed slider
  Timer? _speedDebounceTimer;
  static const _speedDebounceDuration = Duration(milliseconds: 300);

  // Grace period after mode changes to prevent control state listener from
  // causing flickering in CardSlider enabled state
  DateTime? _modeChangeTime;
  static const _modeChangeGracePeriod = Duration(milliseconds: 500);

  @override
  void initState() {
    super.initState();
    _devicesService.addListener(_onDeviceChanged);

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (_) {}

    _initController();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = AirConditionerDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
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
    _speedDebounceTimer?.cancel();
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

    // Check cooler channel properties
    final coolerChannel = _device.coolerChannel;
    {
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

    // Check fan channel properties
    final fanChannel = _device.fanChannel;
    {
      final channelId = fanChannel.id;

      // Check power property
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        fanChannel.onProp.id,
        fanChannel.on,
      );

      // Check speed property (if available)
      final speedProp = fanChannel.speedProp;
      if (speedProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          speedProp.id,
          fanChannel.speed,
          tolerance: fanChannel.speedStep > 0 ? fanChannel.speedStep : 1.0,
        );
      }

      // Check swing property (if available)
      final swingProp = fanChannel.swingProp;
      if (swingProp != null) {
        controlState.checkPropertyConvergence(
          deviceId,
          channelId,
          swingProp.id,
          fanChannel.swing,
        );
      }
    }
  }

  void _onControlStateChanged() {
    if (!mounted) return;

    // Skip rebuilds during grace period after mode changes to prevent
    // CardSlider flickering (enabled state depends on _currentMode which
    // uses control state)
    if (_modeChangeTime != null &&
        DateTime.now().difference(_modeChangeTime!) < _modeChangeGracePeriod) {
      return;
    }

    setState(() {});
  }

  AirConditionerDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is AirConditionerDeviceView) {
      return updated;
    }
    return widget._device;
  }

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

  bool get _hasHeater => _device.heaterChannel != null;

  bool get _isHeating => _device.heaterChannel?.isHeating ?? false;

  bool get _isCooling => _device.coolerChannel.isCooling;

  /// Determine current mode from device state
  /// Mode is derived from cooler.on and heater.on properties
  AcMode get _currentMode {
    final coolerOnProp = _device.coolerChannel.onProp;
    final heaterOnProp = _device.heaterChannel?.onProp;
    final controlState = _deviceControlStateService;

    // Check for pending cooler state
    bool coolerOn = _device.coolerChannel.on;
    if (controlState != null &&
        controlState.isLocked(
            _device.id, _device.coolerChannel.id, coolerOnProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        _device.coolerChannel.id,
        coolerOnProp.id,
      );
      if (desiredValue is bool) {
        coolerOn = desiredValue;
      }
    }

    // Check for pending heater state
    bool heaterOn = _device.heaterChannel?.on ?? false;
    if (controlState != null &&
        heaterOnProp != null &&
        _device.heaterChannel != null &&
        controlState.isLocked(
            _device.id, _device.heaterChannel!.id, heaterOnProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        _device.heaterChannel!.id,
        heaterOnProp.id,
      );
      if (desiredValue is bool) {
        heaterOn = desiredValue;
      }
    }

    // Determine mode from on states
    if (coolerOn) {
      return AcMode.cool;
    }
    if (heaterOn) {
      return AcMode.heat;
    }
    return AcMode.off;
  }

  /// Dial glow is active when:
  /// - cool mode: cooler.status = true (isCooling)
  /// - heat mode: heater.status = true (isHeating)
  bool get _isActive {
    switch (_currentMode) {
      case AcMode.heat:
        return _isHeating;
      case AcMode.cool:
        return _isCooling;
      case AcMode.off:
        return false;
    }
  }

  double get _currentTemperature => _device.temperatureChannel.temperature;

  double get _minSetpoint {
    switch (_currentMode) {
      case AcMode.heat:
        return _device.heaterChannel?.minTemperature ?? 16.0;
      case AcMode.cool:
        return _device.coolerChannel.minTemperature;
      case AcMode.off:
        return _device.coolerChannel.minTemperature;
    }
  }

  double get _maxSetpoint {
    switch (_currentMode) {
      case AcMode.heat:
        return _device.heaterChannel?.maxTemperature ?? 30.0;
      case AcMode.cool:
        return _device.coolerChannel.maxTemperature;
      case AcMode.off:
        return _device.coolerChannel.maxTemperature;
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
      case AcMode.heat:
        return _device.heaterChannel?.temperatureProp;
      case AcMode.cool:
        return _device.coolerChannel.temperatureProp;
      case AcMode.off:
        return null;
    }
  }

  String? get _activeSetpointChannelId {
    switch (_currentMode) {
      case AcMode.heat:
        return _device.heaterChannel?.id;
      case AcMode.cool:
        return _device.coolerChannel.id;
      case AcMode.off:
        return null;
    }
  }

  double get _targetSetpoint {
    final controller = _controller;

    // Get setpoint based on current mode, using controller for optimistic-aware values
    switch (_currentMode) {
      case AcMode.heat:
        return controller?.heatingTemperature ??
            _device.heaterChannel?.temperature ??
            21.0;
      case AcMode.cool:
        return controller?.coolingTemperature ??
            _device.coolerChannel.temperature;
      case AcMode.off:
        // When off, show cooling setpoint as default
        return controller?.coolingTemperature ??
            _device.coolerChannel.temperature;
    }
  }

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(AcMode mode) {
    final controller = _controller;
    if (controller == null) return;

    // Set grace period to prevent control state listener from causing
    // CardSlider flickering during mode transitions
    _modeChangeTime = DateTime.now();

    final coolerOnProp = _device.coolerChannel.onProp;
    final heaterOnProp = _device.heaterChannel?.onProp;
    final fanOnProp = _device.fanChannel.onProp;

    // Build batch command list
    final commands = <PropertyCommandItem>[];

    switch (mode) {
      case AcMode.heat:
        // Turn on heater, turn off cooler, turn on fan
        if (heaterOnProp != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _device.heaterChannel!.id,
            propertyId: heaterOnProp.id,
            value: true,
          ));
        }
        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: _device.coolerChannel.id,
          propertyId: coolerOnProp.id,
          value: false,
        ));
        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: _device.fanChannel.id,
          propertyId: fanOnProp.id,
          value: true,
        ));
        break;
      case AcMode.cool:
        // Turn on cooler, turn off heater, turn on fan
        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: _device.coolerChannel.id,
          propertyId: coolerOnProp.id,
          value: true,
        ));
        if (heaterOnProp != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _device.heaterChannel!.id,
            propertyId: heaterOnProp.id,
            value: false,
          ));
        }
        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: _device.fanChannel.id,
          propertyId: fanOnProp.id,
          value: true,
        ));
        break;
      case AcMode.off:
        // Turn off cooler, heater, and fan
        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: _device.coolerChannel.id,
          propertyId: coolerOnProp.id,
          value: false,
        ));
        if (heaterOnProp != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _device.heaterChannel!.id,
            propertyId: heaterOnProp.id,
            value: false,
          ));
        }
        commands.add(PropertyCommandItem(
          deviceId: _device.id,
          channelId: _device.fanChannel.id,
          propertyId: fanOnProp.id,
          value: false,
        ));
        break;
    }

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

    // Set PENDING state immediately for responsive UI
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

      // Use appropriate controller method based on current mode
      if (_currentMode == AcMode.heat) {
        controller.setHeatingTemperature(clampedValue);
      } else {
        controller.setCoolingTemperature(clampedValue);
      }
    });
  }

  // --------------------------------------------------------------------------
  // FAN SPEED HELPERS
  // --------------------------------------------------------------------------

  double get _fanSpeed {
    final fanChannel = _device.fanChannel;
    final speedProp = fanChannel.speedProp;

    if (!fanChannel.hasSpeed || speedProp == null) return 0.0;

    final controlState = _deviceControlStateService;
    double actualSpeed = fanChannel.speed;

    if (controlState != null &&
        controlState.isLocked(_device.id, fanChannel.id, speedProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        fanChannel.id,
        speedProp.id,
      );
      if (desiredValue is num) {
        actualSpeed = desiredValue.toDouble();
      }
    }

    // Normalize to 0-1 range
    final range = fanChannel.maxSpeed - fanChannel.minSpeed;
    if (range <= 0) return 0.0;
    return (actualSpeed - fanChannel.minSpeed) / range;
  }

  void _setFanSpeedValue(double normalizedSpeed) {
    final controller = _controller;
    final fanChannel = _device.fanChannel;
    final speedProp = fanChannel.speedProp;
    if (controller == null ||
        !fanChannel.hasSpeed ||
        !fanChannel.isSpeedNumeric ||
        speedProp == null) {
      return;
    }

    final range = fanChannel.maxSpeed - fanChannel.minSpeed;
    if (range <= 0) {
      return;
    }

    final rawSpeed = fanChannel.minSpeed + (normalizedSpeed * range);
    final step = fanChannel.speedStep;
    final steppedSpeed = step > 0 ? (rawSpeed / step).round() * step : rawSpeed;
    final actualSpeed = steppedSpeed.clamp(fanChannel.minSpeed, fanChannel.maxSpeed);

    // Set pending state immediately for visual feedback
    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      speedProp.id,
      actualSpeed,
    );
    setState(() {});

    // Debounce the API call
    _speedDebounceTimer?.cancel();
    _speedDebounceTimer = Timer(_speedDebounceDuration, () {
      if (!mounted) return;
      // Controller handles API call, settling, and error handling
      controller.fan.setSpeed(actualSpeed);
    });
  }

  void _setFanSpeedLevel(FanSpeedLevelValue level) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setSpeedLevel(level);
    setState(() {});
  }

  void _setFanMode(FanModeValue mode) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setMode(mode);
    setState(() {});
  }

  void _setFanSwing(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setSwing(value);
    setState(() {});
  }

  void _setFanDirection(FanDirectionValue direction) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setDirection(direction);
    setState(() {});
  }

  void _setFanNaturalBreeze(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setNaturalBreeze(value);
    setState(() {});
  }

  void _setFanLocked(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setLocked(value);
    setState(() {});
  }

  void _setFanTimerPreset(FanTimerPresetValue preset) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setTimerPreset(preset);
    setState(() {});
  }

  void _setFanTimerNumeric(int minutes) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setTimer(minutes);
    setState(() {});
  }

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  String _getStatusLabel(AppLocalizations localizations) {
    if (_currentMode == AcMode.off) {
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

  static ThemeColors _themeColorForMode(AcMode mode) {
    switch (mode) {
      case AcMode.heat:
        return ThemeColors.warning;
      case AcMode.cool:
        return ThemeColors.info;
      case AcMode.off:
        return ThemeColors.neutral;
    }
  }

  DialAccentColor _getDialAccentColor() {
    switch (_getModeColor()) {
      case ThemeColors.warning:
        return DialAccentColor.warning;
      case ThemeColors.info:
        return DialAccentColor.info;
      default:
        return DialAccentColor.neutral;
    }
  }

  List<ModeOption<AcMode>> _getModeOptions(AppLocalizations localizations) {
    final modes = <ModeOption<AcMode>>[];

    // Add heat mode only if device has a heater channel
    if (_hasHeater) {
      modes.add(ModeOption(
        value: AcMode.heat,
        icon: MdiIcons.fireCircle,
        label: localizations.thermostat_mode_heat,
        color: _themeColorForMode(AcMode.heat),
      ));
    }

    // Cooler is required for A/C
    modes.add(ModeOption(
      value: AcMode.cool,
      icon: MdiIcons.snowflake,
      label: localizations.thermostat_mode_cool,
      color: _themeColorForMode(AcMode.cool),
    ));

    // Always add OFF mode
    modes.add(ModeOption(
      value: AcMode.off,
      icon: MdiIcons.power,
      label: localizations.thermostat_mode_off,
      color: _themeColorForMode(AcMode.off),
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
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
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
        spacing: AppSpacings.pMd,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: widget.onBack ?? () => Navigator.of(context).pop(),
          ),
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
    final statusSection = _buildStatusSection(localizations, isDark);
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);
    final fanChannel = _device.fanChannel;

    // Build speed/mode control widget (fan card)
    Widget? speedControl;
    if (fanChannel.hasSpeed) {
      speedControl = _buildFanSpeedControl(context, localizations, isDark, false, tileHeight);
    } else if (fanChannel.hasMode && fanChannel.availableModes.length > 1) {
      speedControl =
          _buildFanModeControl(context, localizations, false, tileHeight);
    }

    // Build fan options (other controls)
    final fanOptions = _buildFanOptions(
        localizations, isDark, modeColorFamily.base, false, tileHeight);

    return DevicePortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          _buildPrimaryControlCard(context, isDark, dialSize: AppSpacings.scale(DeviceDetailDialSizes.portrait)),
          if (speedControl != null) speedControl,
          if (statusSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            statusSection,
          ],
          if (fanOptions.isNotEmpty) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            ...fanOptions,
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
    final statusSection = _buildStatusSection(localizations, isDark);
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);
    final fanChannel = _device.fanChannel;
    final useCompactLayout = !isLargeScreen;

    // Build speed/mode control widget (fan card)
    Widget? speedControl;
    if (fanChannel.hasSpeed) {
      speedControl = _buildFanSpeedControl(context, localizations, isDark, useCompactLayout, tileHeight);
    } else if (fanChannel.hasMode && fanChannel.availableModes.length > 1) {
      speedControl = _buildFanModeControl(context, localizations, useCompactLayout, tileHeight);
    }

    // Build fan options (other controls)
    final fanOptions = _buildFanOptions(localizations, isDark,
        modeColorFamily.base, useCompactLayout, tileHeight);

    return DeviceLandscapeLayout(
      mainContent: isLargeScreen
          ? _buildPrimaryControlCard(context, isDark, dialSize: AppSpacings.scale(DeviceDetailDialSizes.landscape))
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
          if (speedControl != null || fanOptions.isNotEmpty) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            if (speedControl != null) speedControl,
            ...fanOptions,
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
  ) {
    final humidityChannel = _device.humidityChannel;
    final contactChannel = _device.contactChannel;
    final leakChannel = _device.leakChannel;
    final filterChannel = _device.filterChannel;

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

    // Leak sensor (optional)
    if (leakChannel != null) {
      final isLeaking = leakChannel.detected;
      sensors.add(_SensorInfo(
        id: 'leak',
        label: localizations.leak_sensor_water,
        value: SensorUtils.translateBinaryState(localizations, leakChannel.category, isLeaking),
        icon: buildChannelIcon(leakChannel.category),
        themeColor: SensorColors.alert,
        isWarning: isLeaking,
        sensorData: SensorUtils.buildSensorData(leakChannel,
          localizations: localizations,
          isAlert: leakChannel.detected,
        ),
      ));
    }

    // Filter (optional)
    if (filterChannel != null) {
      if (filterChannel.hasLifeRemaining) {
        sensors.add(_SensorInfo(
          id: 'filter_life',
          label: localizations.device_filter_life,
          value: SensorUtils.formatNumericValue(_device.filterLifeRemaining, filterChannel.category),
          unit: SensorUtils.unitForCategory(filterChannel.category),
          icon: buildChannelIcon(filterChannel.category),
          themeColor: SensorColors.filter,
          isWarning: _device.filterLifeRemaining < 30 || _device.isFilterNeedsReplacement,
          sensorData: SensorUtils.buildSensorData(filterChannel, localizations: localizations),
        ));
      } else if (filterChannel.hasStatus) {
        sensors.add(_SensorInfo(
          id: 'filter_status',
          label: localizations.device_filter_status,
          value: SensorUtils.translateFilterStatus(localizations, filterChannel.status),
          icon: buildChannelIcon(filterChannel.category),
          themeColor: SensorColors.filter,
          isWarning: _device.isFilterNeedsReplacement,
          sensorData: SensorUtils.buildSensorData(filterChannel, localizations: localizations),
        ));
      }
    }

    // Electrical energy (optional) - energy consumption
    final electricalEnergyChannel = _device.electricalEnergyChannel;
    if (electricalEnergyChannel != null) {
      sensors.add(_SensorInfo(
        id: 'electrical_energy',
        label: localizations.electrical_energy_consumption_title,
        value: SensorUtils.formatNumericValue(
            _device.electricalEnergyConsumption, electricalEnergyChannel.category),
        unit: SensorUtils.unitForCategory(electricalEnergyChannel.category),
        icon: buildChannelIcon(electricalEnergyChannel.category),
        themeColor: SensorColors.defaultColor,
        sensorData: SensorUtils.buildSensorData(electricalEnergyChannel,
            localizations: localizations),
      ));
    }

    // Electrical power (optional) - power consumption
    final electricalPowerChannel = _device.electricalPowerChannel;
    if (electricalPowerChannel != null) {
      sensors.add(_SensorInfo(
        id: 'electrical_power',
        label: localizations.electrical_power_power_title,
        value: SensorUtils.formatNumericValue(
            _device.electricalPowerPower, electricalPowerChannel.category),
        unit: SensorUtils.unitForCategory(electricalPowerChannel.category),
        icon: buildChannelIcon(electricalPowerChannel.category),
        themeColor: SensorColors.defaultColor,
        sensorData: SensorUtils.buildSensorData(electricalPowerChannel,
            localizations: localizations),
      ));
    }

    if (sensors.isEmpty) {
      return const SizedBox.shrink();
    }

    return _buildSensorsSection(isDark, sensors);
  }

  /// Builds sensors section (same pattern as thermostat).
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

    if (!isLandscape) {
      final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);
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
    final (minSetpoint, maxSetpoint) = _validSetpointRange;
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

    return AppCard(
      width: double.infinity,
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
            enabled: _currentMode == AcMode.heat || _currentMode == AcMode.cool,
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
    final (minSetpoint, maxSetpoint) = _validSetpointRange;
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

    return AppCard(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final modeIconsWidth = AppSpacings.scale(50);
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
                    enabled: _currentMode == AcMode.heat || _currentMode == AcMode.cool,
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
    return ModeSelector<AcMode>(
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

    return ModeSelector<AcMode>(
      modes: _getModeOptions(localizations),
      selectedValue: _currentMode,
      onChanged: _onModeChanged,
      orientation: ModeSelectorOrientation.vertical,
      showLabels: false,
      scrollable: true,
    );
  }

  // --------------------------------------------------------------------------
  // FAN CONTROLS
  // --------------------------------------------------------------------------

  Widget _buildFanModeControl(
    BuildContext context,
    AppLocalizations localizations,
    bool useCompactLayout,
    double? tileHeight,
  ) {
    final fanChannel = _device.fanChannel;
    final availableModes = fanChannel.availableModes;
    // selectedMode can be null if device is reset or sends invalid value
    final selectedMode = fanChannel.mode;

    final modeColorFamily = _getModeColorFamily(context);

    if (useCompactLayout) {
      final options = availableModes.map((mode) {
        return ValueOption(
          value: mode,
          label: FanUtils.getModeLabel(localizations, mode),
        );
      }).toList();

      final valueSelectorRow = ValueSelectorRow<FanModeValue>(
        currentValue: selectedMode,
        label: localizations.device_fan_mode,
        icon: MdiIcons.airFilter,
        sheetTitle: localizations.device_fan_mode,
        activeColor: modeColorFamily.base,
        options: options,
        displayFormatter: (mode) => mode != null
            ? FanUtils.getModeLabel(localizations, mode)
            : '',
        columns: availableModes.length > 4 ? 3 : availableModes.length,
        layout: ValueSelectorRowLayout.compact,
        onChanged: _currentMode != AcMode.off ? (mode) => ((mode != null) ? _setFanMode(mode) : null) : null,
      );

      if (tileHeight != null) {
        return SizedBox(
          height: tileHeight,
          width: double.infinity,
          child: valueSelectorRow,
        );
      }
      return valueSelectorRow;
    }

    return ModeSelector<FanModeValue>(
      modes: availableModes.map((mode) {
        return ModeOption(
          value: mode,
          icon: FanUtils.getModeIcon(mode),
          label: FanUtils.getModeLabel(localizations, mode),
        );
      }).toList(),
      selectedValue: selectedMode,
      onChanged: _setFanMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: _getModeColor(),
      scrollable: true,
    );
  }

  Widget _buildFanSpeedControl(
    BuildContext context,
    AppLocalizations localizations,
    bool isDark,
    bool useCompactLayout,
    double tileHeight,
  ) {
    final fanChannel = _device.fanChannel;

    if (!fanChannel.hasSpeed) {
      return const SizedBox.shrink();
    }

    final modeColorFamily = _getModeColorFamily(context);

    final hasMode = fanChannel.hasMode && fanChannel.availableModes.length > 1;

    if (fanChannel.isSpeedEnum) {
      final availableLevels = fanChannel.availableSpeedLevels;
      if (availableLevels.isEmpty) return const SizedBox.shrink();

      final isLandscape = _screenService.isLandscape;

      // Landscape: Use ValueSelectorRow button
      if (isLandscape) {
        final options = availableLevels.map((level) {
          return ValueOption(
            value: level,
            label: FanUtils.getSpeedLevelLabel(localizations, level),
          );
        }).toList();

        final speedWidget = SizedBox(
          height: tileHeight,
          width: double.infinity,
          child: ValueSelectorRow<FanSpeedLevelValue>(
            currentValue: fanChannel.speedLevel,
            label: localizations.device_fan_speed,
            icon: MdiIcons.speedometer,
            sheetTitle: localizations.device_fan_speed,
            activeColor: modeColorFamily.base,
            options: options,
            displayFormatter: (level) => level != null
                ? FanUtils.getSpeedLevelLabel(localizations, level)
                : localizations.fan_speed_off,
            columns: availableLevels.length > 4 ? 3 : availableLevels.length,
            layout: useCompactLayout
                ? ValueSelectorRowLayout.compact
                : ValueSelectorRowLayout.horizontal,
            onChanged: _currentMode != AcMode.off ? (level) => ((level != null) ? _setFanSpeedLevel(level) : null) : null,
          ),
        );

        // If fan has mode, add mode selector below
        if (hasMode) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: AppSpacings.pMd,
            children: [
              speedWidget,
              _buildFanModeControl(context, localizations, true, tileHeight),
            ],
          );
        }

        return speedWidget;
      } else {
        // Portrait: Use CardSlider with defined steps
        final steps = availableLevels
            .map((level) => FanUtils.getSpeedLevelLabel(localizations, level))
            .toList();

        final isEnabled = _currentMode != AcMode.off;

        // Calculate normalized value from current speed level index
        final currentLevel = fanChannel.speedLevel;
        final currentIndex = currentLevel != null
            ? availableLevels.indexOf(currentLevel)
            : 0;
        final normalizedValue = availableLevels.length > 1
            ? currentIndex / (availableLevels.length - 1)
            : 0.0;

        return CardSlider(
          label: localizations.device_fan_speed,
          icon: MdiIcons.speedometer,
          value: normalizedValue.clamp(0.0, 1.0),
          themeColor: _getModeColor(),
          enabled: isEnabled,
          steps: steps,
          onChanged: (value) {
            // Convert slider value to speed level index
            final index = ((value * (availableLevels.length - 1)).round())
                .clamp(0, availableLevels.length - 1);
            _setFanSpeedLevel(availableLevels[index]);
          },
          footer: hasMode
              ? _buildFanModeControl(context, localizations, false, null)
              : null,
        );
      }
    } else {
      final range = fanChannel.maxSpeed - fanChannel.minSpeed;
      if (range <= 0) return const SizedBox.shrink();

      final isLandscape = _screenService.isLandscape;

      // Landscape (all sizes): Use ValueSelectorRow button
      if (isLandscape) {
        final speedWidget = SizedBox(
          height: tileHeight,
          width: double.infinity,
          child: ValueSelectorRow<double>(
            currentValue: _fanSpeed,
            label: localizations.device_fan_speed,
            icon: MdiIcons.speedometer,
            sheetTitle: localizations.device_fan_speed,
            activeColor: modeColorFamily.base,
            options: _getFanSpeedOptions(localizations),
            displayFormatter: (v) => _formatFanSpeed(localizations, v),
            columns: 4,
            layout: ValueSelectorRowLayout.compact,
            sliderMin: 0.0,
            sliderMax: 1.0,
            sliderDivisions: 20,
            sliderUnit: '%',
            onChanged: _currentMode != AcMode.off ? (v) => _setFanSpeedValue(v ?? 0) : null,
          ),
        );

        // If fan has mode, add mode selector below
        if (hasMode) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: AppSpacings.pMd,
            children: [
              speedWidget,
              _buildFanModeControl(context, localizations, true, tileHeight),
            ],
          );
        }

        return speedWidget;
      } else {
        // Portrait (all sizes): Use CardSlider
        // Mode selector goes inside the slider's bordered box as footer
        final isEnabled = _currentMode != AcMode.off;

        return CardSlider(
          label: localizations.device_fan_speed,
          icon: MdiIcons.speedometer,
          value: _fanSpeed.clamp(0.0, 1.0),
          themeColor: _getModeColor(),
          enabled: isEnabled,
          steps: [
            localizations.fan_speed_off,
            localizations.fan_speed_low,
            localizations.fan_speed_medium,
            localizations.fan_speed_high,
          ],
          onChanged: _setFanSpeedValue,
          footer: hasMode
              ? _buildFanModeControl(context, localizations, false, null)
              : null,
        );
      }
    }
  }

  List<ValueOption<double>> _getFanSpeedOptions(AppLocalizations localizations) {
    return [
      ValueOption(value: 0.0, label: localizations.fan_speed_off),
      ValueOption(value: 0.25, label: '25%'),
      ValueOption(value: 0.5, label: '50%'),
      ValueOption(value: 0.75, label: '75%'),
      ValueOption(value: 1.0, label: '100%'),
    ];
  }

  String _formatFanSpeed(AppLocalizations localizations, double? speed) {
    if (speed == null || speed == 0) return localizations.fan_speed_off;
    return '${(speed * 100).toInt()}%';
  }

  List<Widget> _buildFanOptions(
    AppLocalizations localizations,
    bool isDark,
    Color modeColor,
    bool useCompactLayout,
    double tileHeight,
  ) {
    final fanChannel = _device.fanChannel;
    final options = <Widget>[];

    // Helper to wrap control with fixed height
    Widget wrapControl(Widget child) {
      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: child,
      );
    }

    // Oscillation / Swing
    if (fanChannel.hasSwing) {
      options.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.syncIcon,
        name: localizations.device_oscillation,
        status: fanChannel.swing
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.swing,
        activeColor: _getModeColor(),
        onTileTap: () => _setFanSwing(!fanChannel.swing),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
    }

    // Direction
    if (fanChannel.hasDirection) {
      final isReversed = fanChannel.direction == FanDirectionValue.counterClockwise;
      options.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.swapVertical,
        name: localizations.device_direction,
        status: fanChannel.direction != null
            ? FanUtils.getDirectionLabel(localizations, fanChannel.direction!)
            : localizations.fan_direction_clockwise,
        isActive: isReversed,
        activeColor: _getModeColor(),
        onTileTap: () {
          final newDirection = isReversed
              ? FanDirectionValue.clockwise
              : FanDirectionValue.counterClockwise;
          _setFanDirection(newDirection);
        },
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
    }

    // Natural Breeze
    if (fanChannel.hasNaturalBreeze) {
      options.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.weatherWindy,
        name: localizations.device_natural_breeze,
        status: fanChannel.naturalBreeze
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.naturalBreeze,
        activeColor: _getModeColor(),
        onTileTap: () => _setFanNaturalBreeze(!fanChannel.naturalBreeze),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
    }

    // Child Lock
    if (fanChannel.hasLocked) {
      options.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.lock,
        name: localizations.device_child_lock,
        status: fanChannel.locked
            ? localizations.thermostat_lock_locked
            : localizations.thermostat_lock_unlocked,
        isActive: fanChannel.locked,
        activeColor: _getModeColor(),
        onTileTap: () => _setFanLocked(!fanChannel.locked),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
    }

    // Timer
    if (fanChannel.hasTimer) {
      options.add(_buildTimerControl(localizations, modeColor, useCompactLayout, tileHeight));
    }

    return options;
  }

  Widget _buildTimerControl(
    AppLocalizations localizations,
    Color modeColor,
    bool useCompactLayout,
    double tileHeight,
  ) {
    final fanChannel = _device.fanChannel;

    if (fanChannel.isTimerEnum) {
      final options = _getTimerPresetOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: ValueSelectorRow<FanTimerPresetValue?>(
          currentValue: fanChannel.timerPreset,
          label: localizations.device_timer,
          icon: MdiIcons.timerOutline,
          sheetTitle: localizations.device_auto_off_timer,
          activeColor: modeColor,
          options: options,
          displayFormatter: (p) => _formatTimerPreset(localizations, p),
          columns: options.length > 4 ? 4 : options.length,
          layout: useCompactLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          onChanged: _currentMode != AcMode.off ? (preset) => ((preset != null) ? _setFanTimerPreset(preset) : null) : null,
        ),
      );
    } else {
      final options = _getNumericTimerOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: ValueSelectorRow<int>(
          currentValue: fanChannel.timer,
          label: localizations.device_timer,
          icon: MdiIcons.timerOutline,
          sheetTitle: localizations.device_auto_off_timer,
          activeColor: modeColor,
          options: options,
          displayFormatter: (m) => _formatNumericTimer(localizations, m),
          columns: options.length > 4 ? 4 : options.length,
          layout: useCompactLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          onChanged: _currentMode != AcMode.off ? (minutes) => ((minutes != null) ? _setFanTimerNumeric(minutes) : null) : null,
        ),
      );
    }
  }

  List<ValueOption<FanTimerPresetValue?>> _getTimerPresetOptions(
    AppLocalizations localizations,
  ) {
    final fanChannel = _device.fanChannel;
    final availablePresets = fanChannel.availableTimerPresets;

    if (availablePresets.isEmpty) return [];

    return availablePresets.map((preset) {
      return ValueOption(
        value: preset,
        label: FanUtils.getTimerPresetLabel(localizations, preset),
      );
    }).toList();
  }

  String _formatTimerPreset(
    AppLocalizations localizations,
    FanTimerPresetValue? preset,
  ) {
    if (preset == null || preset == FanTimerPresetValue.off) {
      return localizations.fan_timer_off;
    }
    return FanUtils.getTimerPresetLabel(localizations, preset);
  }

  List<ValueOption<int>> _getNumericTimerOptions(AppLocalizations localizations) {
    final fanChannel = _device.fanChannel;
    final minTimer = fanChannel.minTimer;
    final maxTimer = fanChannel.maxTimer;

    final options = <ValueOption<int>>[];
    options.add(ValueOption(value: 0, label: localizations.fan_timer_off));

    final presets = [30, 60, 120, 240, 480, 720];
    for (final preset in presets) {
      if (preset >= minTimer && preset <= maxTimer) {
        options.add(ValueOption(
          value: preset,
          label: FanUtils.formatMinutes(localizations, preset),
        ));
      }
    }

    return options;
  }

  String _formatNumericTimer(AppLocalizations localizations, int? minutes) {
    if (minutes == null || minutes == 0) return localizations.fan_timer_off;
    return FanUtils.formatMinutes(localizations, minutes);
  }
}
