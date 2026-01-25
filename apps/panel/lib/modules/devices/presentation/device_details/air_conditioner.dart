import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/speed_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/fan_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/filter_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Mode enum for A/C device
enum AcMode { heat, cool, off }

/// Internal sensor data structure for air conditioner device detail.
class _SensorInfo {
  final String id;
  final String label;
  final String value;
  final String? unit;
  final IconData icon;
  final Color? valueColor;
  final bool isWarning;

  const _SensorInfo({
    required this.id,
    required this.label,
    required this.value,
    required this.icon,
    this.unit,
    this.valueColor,
    this.isWarning = false,
  });

  /// Returns the formatted display value with unit
  String get displayValue => unit != null ? '$value$unit' : value;
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
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
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
  // causing flickering in SpeedSlider enabled state
  DateTime? _modeChangeTime;
  static const _modeChangeGracePeriod = Duration(milliseconds: 500);

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
            '[AirConditionerDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }

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
    if (kDebugMode) {
      debugPrint('[AirConditionerDeviceDetail] Controller error for $propertyId: $error');
    }

    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AlertBar.showError(context, message: localizations.action_failed);
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
    if (mounted) {
      _checkConvergence();
      _initController();
      setState(() {});
    }
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
    // SpeedSlider flickering (enabled state depends on _currentMode which
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

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

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
    // SpeedSlider flickering during mode transitions
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

    // Send all commands through the controller (handles pending, API call, settling/clear)
    if (commands.isNotEmpty) {
      controller.setMultipleProperties(
        commands,
        onError: () {
          if (mounted) {
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
    final tempStr = '${_targetSetpoint.toStringAsFixed(0)}°C';
    if (_isCooling) {
      return localizations.thermostat_state_cooling_to(tempStr);
    }
    if (_isHeating) {
      return localizations.thermostat_state_heating_to(tempStr);
    }
    return localizations.thermostat_state_idle_at(tempStr);
  }

  Color _getModeColor(bool isDark) {
    switch (_currentMode) {
      case AcMode.heat:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case AcMode.cool:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case AcMode.off:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }
  }

  Color _getModeLightColor(bool isDark) {
    switch (_currentMode) {
      case AcMode.heat:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case AcMode.cool:
        return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
      case AcMode.off:
        return isDark ? AppFillColorDark.light : AppFillColorLight.light;
    }
  }

  Color _getModeBorderColor(bool isDark) {
    final modeColor = _getModeColor(isDark);
    if (_currentMode == AcMode.off) {
      return isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    }
    return modeColor.withValues(alpha: 0.3);
  }

  DialAccentColor _getDialAccentColor() {
    switch (_currentMode) {
      case AcMode.heat:
        return DialAccentColor.warning;
      case AcMode.cool:
        return DialAccentColor.info;
      case AcMode.off:
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
        color: ModeSelectorColor.warning,
      ));
    }

    // Cooler is required for A/C
    modes.add(ModeOption(
      value: AcMode.cool,
      icon: MdiIcons.snowflake,
      label: localizations.thermostat_mode_cool,
      color: ModeSelectorColor.info,
    ));

    // Always add OFF mode
    modes.add(ModeOption(
      value: AcMode.off,
      icon: MdiIcons.power,
      label: localizations.thermostat_mode_off,
      color: ModeSelectorColor.neutral,
    ));

    return modes;
  }

  // --------------------------------------------------------------------------
  // BUILD METHODS
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, isDark),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  return orientation == Orientation.landscape
                      ? _buildLandscapeLayout(context, isDark)
                      : _buildPortraitLayout(context, isDark);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final modeColor = _getModeColor(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: _device.name,
      subtitle: _getStatusLabel(localizations),
      subtitleColor: _isActive ? modeColor : secondaryColor,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: widget.onBack ?? () => Navigator.of(context).pop(),
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: _isActive
                  ? _getModeLightColor(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              MdiIcons.airConditioner,
              color: _isActive ? modeColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final modeColor = _getModeColor(isDark);

    return DeviceDetailPortraitLayout(
      contentPadding: AppSpacings.paddingLg,
      content: Column(
        children: [
          _buildPrimaryControlCard(context, isDark, dialSize: _scale(200)),
          AppSpacings.spacingMdVertical,
          _buildStatusSection(localizations, isDark, modeColor),
          AppSpacings.spacingMdVertical,
          _buildFanControls(localizations, isDark, modeColor, false),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final secondaryBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final isLargeScreen = _screenService.isLargeScreen;
    final modeColor = _getModeColor(isDark);

    return DeviceDetailLandscapeLayout(
      secondaryScrollable: false,
      secondaryContentPadding: EdgeInsets.zero,
      mainContent: isLargeScreen
          ? _buildPrimaryControlCard(context, isDark, dialSize: _scale(200))
          : _buildCompactDialWithModes(context, isDark),
      secondaryContent: VerticalScrollWithGradient(
        gradientHeight: AppSpacings.pLg,
        itemCount: 1,
        separatorHeight: 0,
        padding: AppSpacings.paddingLg,
        backgroundColor: secondaryBgColor,
        itemBuilder: (context, index) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStatusSection(localizations, isDark, modeColor),
            AppSpacings.spacingMdVertical,
            _buildFanControls(localizations, isDark, modeColor, !isLargeScreen),
          ],
        ),
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
    sensors.add(_SensorInfo(
      id: 'temperature',
      label: localizations.device_current_temperature,
      value: NumberFormatUtils.defaultFormat.formatDecimal(
        _currentTemperature,
        decimalPlaces: 1,
      ),
      unit: '°C',
      icon: MdiIcons.thermometer,
      valueColor: modeColor,
    ));

    // Humidity (optional)
    if (humidityChannel != null) {
      sensors.add(_SensorInfo(
        id: 'humidity',
        label: localizations.device_current_humidity,
        value: NumberFormatUtils.defaultFormat
            .formatInteger(humidityChannel.humidity),
        unit: '%',
        icon: MdiIcons.waterPercent,
      ));
    }

    // Contact sensor (optional) - shows window/door status
    // detected = true means window is open
    if (contactChannel != null) {
      final isOpen = contactChannel.detected;
      sensors.add(_SensorInfo(
        id: 'contact',
        label: localizations.contact_sensor_window,
        value: isOpen
            ? localizations.contact_sensor_open
            : localizations.contact_sensor_closed,
        icon: MdiIcons.windowOpenVariant,
        isWarning: isOpen,
      ));
    }

    // Leak sensor (optional) - shows water leak status
    // detected = true means leak detected
    final leakChannel = _device.leakChannel;
    if (leakChannel != null) {
      final isLeaking = leakChannel.detected;
      sensors.add(_SensorInfo(
        id: 'leak',
        label: localizations.leak_sensor_water,
        value: isLeaking
            ? localizations.leak_sensor_detected
            : localizations.leak_sensor_dry,
        icon: MdiIcons.pipeLeak,
        isWarning: isLeaking,
      ));
    }

    // Filter (optional) - show life remaining or status
    final filterChannel = _device.filterChannel;
    if (filterChannel != null) {
      if (filterChannel.hasLifeRemaining) {
        // Show life remaining percentage
        final filterLife = _device.filterLifeRemaining / 100.0;
        sensors.add(_SensorInfo(
          id: 'filter_life',
          label: localizations.device_filter_life,
          value: '${(filterLife * 100).toInt()}',
          unit: '%',
          icon: MdiIcons.airFilter,
          isWarning: filterLife < 0.3 || _device.isFilterNeedsReplacement,
        ));
      } else if (filterChannel.hasStatus) {
        // Show status if no life remaining property
        sensors.add(_SensorInfo(
          id: 'filter_status',
          label: localizations.device_filter_status,
          value: FilterUtils.getStatusLabel(localizations, filterChannel.status),
          icon: MdiIcons.airFilter,
          isWarning: _device.isFilterNeedsReplacement,
        ));
      }
    }

    if (sensors.isEmpty) {
      return const SizedBox.shrink();
    }

    return _buildSensorsSection(isDark, sensors, modeColor);
  }

  /// Builds sensors section matching climate domain pattern:
  /// - Portrait: HorizontalScrollWithGradient with UniversalTile (horizontal layout)
  /// - Landscape large: GridView.count with 2 columns using UniversalTile (vertical layout)
  /// - Landscape small/medium: Column with UniversalTile (horizontal layout)
  Widget _buildSensorsSection(bool isDark, List<_SensorInfo> sensors, Color accentColor) {
    if (sensors.isEmpty) return const SizedBox.shrink();

    final isLandscape = _screenService.isLandscape;
    final isLargeScreen = _screenService.isLargeScreen;

    // Portrait: Horizontal scroll with gradient (edge-to-edge)
    if (!isLandscape) {
      final tileWidth = _scale(AppTileWidth.horizontalMedium);
      final tileHeight = _scale(AppTileHeight.horizontal);

      return HorizontalScrollWithGradient(
        height: tileHeight,
        layoutPadding: AppSpacings.pLg,
        itemCount: sensors.length,
        separatorWidth: AppSpacings.pMd,
        itemBuilder: (context, index) {
          final sensor = sensors[index];
          return SizedBox(
            width: tileWidth,
            height: tileHeight,
            child: _buildSensorTile(sensor, TileLayout.horizontal, accentColor),
          );
        },
      );
    }

    // Landscape large: GridView with 2 columns (vertical tile layout)
    if (isLargeScreen) {
      return GridView.count(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacings.pMd,
        crossAxisSpacing: AppSpacings.pMd,
        childAspectRatio: AppTileAspectRatio.square,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        children: sensors
            .map((sensor) =>
                _buildSensorTile(sensor, TileLayout.vertical, accentColor))
            .toList(),
      );
    }

    // Landscape small/medium: Column with fixed-height tiles (horizontal layout)
    final tileHeight = _scale(AppTileHeight.horizontal);

    return Column(
      children: sensors.asMap().entries.map((entry) {
        final index = entry.key;
        final sensor = entry.value;
        final isLast = index == sensors.length - 1;

        return Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
          child: SizedBox(
            height: tileHeight,
            width: double.infinity,
            child: _buildSensorTile(sensor, TileLayout.horizontal, accentColor),
          ),
        );
      }).toList(),
    );
  }

  /// Builds a single sensor tile using UniversalTile.
  Widget _buildSensorTile(
    _SensorInfo sensor,
    TileLayout layout,
    Color accentColor,
  ) {
    return UniversalTile(
      layout: layout,
      icon: sensor.icon,
      name: sensor.displayValue,
      status: sensor.label,
      iconAccentColor: sensor.valueColor ?? accentColor,
      showGlow: false,
      showDoubleBorder: false,
      showWarningBadge: sensor.isWarning,
      showInactiveBorder: true,
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
    final borderColor = _getModeBorderColor(isDark);
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    // Validate min/max - CircularControlDial asserts maxValue > minValue
    var minSetpoint = _minSetpoint;
    var maxSetpoint = _maxSetpoint;
    if (minSetpoint >= maxSetpoint) {
      // Use safe defaults if API returns malformed data
      minSetpoint = 16.0;
      maxSetpoint = 30.0;
    }

    // Clamp target to valid range
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
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
            enabled: _currentMode != AcMode.off,
            modeLabel: _currentMode.name,
            displayFormat: DialDisplayFormat.temperature,
            onChanged: _onSetpointChanged,
          ),
          AppSpacings.spacingMdVertical,
          _buildModeSelector(context, ModeSelectorOrientation.horizontal),
        ],
      ),
    );
  }

  /// Compact dial with vertical icon-only mode selector on the right
  Widget _buildCompactDialWithModes(BuildContext context, bool isDark) {
    final borderColor = _getModeBorderColor(isDark);
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    // Validate min/max - CircularControlDial asserts maxValue > minValue
    var minSetpoint = _minSetpoint;
    var maxSetpoint = _maxSetpoint;
    if (minSetpoint >= maxSetpoint) {
      // Use safe defaults if API returns malformed data
      minSetpoint = 16.0;
      maxSetpoint = 30.0;
    }

    // Clamp target to valid range
    final targetSetpoint = _targetSetpoint.clamp(minSetpoint, maxSetpoint);

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
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
              CircularControlDial(
                value: targetSetpoint,
                currentValue: _currentTemperature,
                minValue: minSetpoint,
                maxValue: maxSetpoint,
                step: 0.5,
                size: dialSize,
                accentType: _getDialAccentColor(),
                isActive: _isActive,
                enabled: _currentMode != AcMode.off,
                modeLabel: _currentMode.name,
                displayFormat: DialDisplayFormat.temperature,
                onChanged: _onSetpointChanged,
              ),
              AppSpacings.spacingXlHorizontal,
              _buildModeSelector(context, ModeSelectorOrientation.vertical,
                  showLabels: false),
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

  // --------------------------------------------------------------------------
  // FAN CONTROLS
  // --------------------------------------------------------------------------

  Widget _buildFanControls(
    AppLocalizations localizations,
    bool isDark,
    Color modeColor,
    bool useCompactLayout,
  ) {
    final fanChannel = _device.fanChannel;
    final controls = <Widget>[];

    // Fixed tile height for consistent control sizing
    final tileHeight = _scale(AppTileHeight.horizontal);

    // Speed control with mode selector inside
    if (fanChannel.hasSpeed) {
      controls.add(_buildFanSpeedControl(localizations, isDark, modeColor, useCompactLayout, tileHeight));
      controls.add(AppSpacings.spacingMdVertical);
    } else if (fanChannel.hasMode && fanChannel.availableModes.length > 1) {
      // If no speed but has mode, show mode selector standalone
      controls.add(_buildFanModeControl(localizations, modeColor, useCompactLayout, tileHeight));
      controls.add(AppSpacings.spacingMdVertical);
    }

    // Options (swing, direction, natural breeze, timer, locked)
    final options = _buildFanOptions(localizations, isDark, modeColor, useCompactLayout, tileHeight);
    if (options.isNotEmpty) {
      controls.addAll(options);
    }

    if (controls.isEmpty) {
      return const SizedBox.shrink();
    }

    // Remove trailing spacer
    if (controls.isNotEmpty && controls.last == AppSpacings.spacingMdVertical) {
      controls.removeLast();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: controls,
    );
  }

  Widget _buildFanModeControl(
    AppLocalizations localizations,
    Color activeColor,
    bool useCompactLayout,
    double? tileHeight,
  ) {
    final fanChannel = _device.fanChannel;
    final availableModes = fanChannel.availableModes;
    // selectedMode can be null if device is reset or sends invalid value
    final selectedMode = fanChannel.mode;

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
        icon: Icons.air,
        sheetTitle: localizations.device_fan_mode,
        activeColor: activeColor,
        options: options,
        displayFormatter: (mode) => mode != null
            ? FanUtils.getModeLabel(localizations, mode)
            : '',
        columns: availableModes.length > 4 ? 3 : availableModes.length,
        layout: ValueSelectorRowLayout.compact,
        showChevron: _screenService.isLargeScreen,
        onChanged: (mode) {
          if (mode != null) {
            _setFanMode(mode);
          }
        },
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
      color: ModeSelectorColor.info,
      scrollable: true,
    );
  }

  Widget _buildFanSpeedControl(
    AppLocalizations localizations,
    bool isDark,
    Color modeColor,
    bool useCompactLayout,
    double tileHeight,
  ) {
    final fanChannel = _device.fanChannel;

    if (!fanChannel.hasSpeed) {
      return const SizedBox.shrink();
    }

    final hasMode = fanChannel.hasMode && fanChannel.availableModes.length > 1;

    if (fanChannel.isSpeedEnum) {
      final availableLevels = fanChannel.availableSpeedLevels;
      if (availableLevels.isEmpty) return const SizedBox.shrink();

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
          icon: Icons.speed,
          sheetTitle: localizations.device_fan_speed,
          activeColor: modeColor,
          options: options,
          displayFormatter: (level) => level != null
              ? FanUtils.getSpeedLevelLabel(localizations, level)
              : localizations.fan_speed_off,
          columns: availableLevels.length > 4 ? 3 : availableLevels.length,
          layout: useCompactLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          showChevron: _screenService.isLargeScreen,
          onChanged: _currentMode != AcMode.off
              ? (level) {
                  if (level != null) _setFanSpeedLevel(level);
                }
              : null,
        ),
      );

      // If fan has mode, add mode selector below (always button since speed is button)
      if (hasMode) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            speedWidget,
            AppSpacings.spacingMdVertical,
            _buildFanModeControl(localizations, modeColor, true, tileHeight),
          ],
        );
      }

      return speedWidget;
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
            icon: Icons.speed,
            sheetTitle: localizations.device_fan_speed,
            activeColor: modeColor,
            options: _getFanSpeedOptions(localizations),
            displayFormatter: (v) => _formatFanSpeed(localizations, v),
            columns: 4,
            layout: ValueSelectorRowLayout.compact,
            showChevron: _screenService.isLargeScreen,
            onChanged: _currentMode != AcMode.off ? (v) => _setFanSpeedValue(v ?? 0) : null,
          ),
        );

        // If fan has mode, add mode selector below
        if (hasMode) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              speedWidget,
              AppSpacings.spacingMdVertical,
              _buildFanModeControl(localizations, modeColor, true, tileHeight),
            ],
          );
        }

        return speedWidget;
      } else {
        // Portrait (all sizes): Use SpeedSlider
        // Mode selector goes inside the slider's bordered box as footer
        final isEnabled = _currentMode != AcMode.off;

        return SpeedSlider(
          value: _fanSpeed.clamp(0.0, 1.0),
          activeColor: modeColor,
          enabled: isEnabled,
          steps: [
            localizations.fan_speed_off,
            localizations.fan_speed_low,
            localizations.fan_speed_medium,
            localizations.fan_speed_high,
          ],
          onChanged: _setFanSpeedValue,
          footer: hasMode
              ? _buildFanModeControl(localizations, modeColor, false, null)
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
        icon: Icons.sync,
        name: localizations.device_oscillation,
        status: fanChannel.swing
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.swing,
        activeColor: modeColor,
        onTileTap: () => _setFanSwing(!fanChannel.swing),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      options.add(AppSpacings.spacingMdVertical);
    }

    // Direction
    if (fanChannel.hasDirection) {
      final isReversed = fanChannel.direction == FanDirectionValue.counterClockwise;
      options.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: Icons.swap_vert,
        name: localizations.device_direction,
        status: fanChannel.direction != null
            ? FanUtils.getDirectionLabel(localizations, fanChannel.direction!)
            : localizations.fan_direction_clockwise,
        isActive: isReversed,
        activeColor: modeColor,
        onTileTap: () {
          final newDirection = isReversed
              ? FanDirectionValue.clockwise
              : FanDirectionValue.counterClockwise;
          _setFanDirection(newDirection);
        },
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      options.add(AppSpacings.spacingMdVertical);
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
        activeColor: modeColor,
        onTileTap: () => _setFanNaturalBreeze(!fanChannel.naturalBreeze),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      options.add(AppSpacings.spacingMdVertical);
    }

    // Child Lock
    if (fanChannel.hasLocked) {
      options.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: Icons.lock,
        name: localizations.device_child_lock,
        status: fanChannel.locked
            ? localizations.thermostat_lock_locked
            : localizations.thermostat_lock_unlocked,
        isActive: fanChannel.locked,
        activeColor: modeColor,
        onTileTap: () => _setFanLocked(!fanChannel.locked),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      options.add(AppSpacings.spacingMdVertical);
    }

    // Timer
    if (fanChannel.hasTimer) {
      options.add(_buildTimerControl(localizations, modeColor, useCompactLayout, tileHeight));
    }

    // Remove trailing spacer
    if (options.isNotEmpty && options.last == AppSpacings.spacingMdVertical) {
      options.removeLast();
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
          icon: Icons.timer_outlined,
          sheetTitle: localizations.device_auto_off_timer,
          activeColor: modeColor,
          options: options,
          displayFormatter: (p) => _formatTimerPreset(localizations, p),
          columns: options.length > 4 ? 4 : options.length,
          layout: useCompactLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          showChevron: _screenService.isLargeScreen,
          onChanged: (preset) {
            if (preset != null) {
              _setFanTimerPreset(preset);
            }
          },
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
          icon: Icons.timer_outlined,
          sheetTitle: localizations.device_auto_off_timer,
          activeColor: modeColor,
          options: options,
          displayFormatter: (m) => _formatNumericTimer(localizations, m),
          columns: options.length > 4 ? 4 : options.length,
          layout: useCompactLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          showChevron: _screenService.isLargeScreen,
          onChanged: (minutes) {
            if (minutes != null) {
              _setFanTimerNumeric(minutes);
            }
          },
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
