import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/info_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/speed_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
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
      setState(() {});
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

  Future<void> _setPropertyValue(
    ChannelPropertyView? property,
    dynamic value,
  ) async {
    if (property == null) return;

    final localizations = AppLocalizations.of(context);

    try {
      bool res = await _devicesService.setPropertyValue(property.id, value);

      if (!res && mounted && localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    } catch (e) {
      if (!mounted) return;
      if (localizations != null) {
        AlertBar.showError(context, message: localizations.action_failed);
      }
    }
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
        coolerOnProp != null &&
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
    final setpointProp = _activeSetpointProp;
    final channelId = _activeSetpointChannelId;
    final controlState = _deviceControlStateService;

    // Check for pending/optimistic value first
    if (setpointProp != null &&
        channelId != null &&
        controlState != null &&
        controlState.isLocked(_device.id, channelId, setpointProp.id)) {
      final desiredValue = controlState.getDesiredValue(
        _device.id,
        channelId,
        setpointProp.id,
      );
      if (desiredValue is num) {
        return desiredValue.toDouble();
      }
    }

    // Get setpoint based on current mode
    switch (_currentMode) {
      case AcMode.heat:
        return _device.heaterChannel?.temperature ?? 21.0;
      case AcMode.cool:
        return _device.coolerChannel.temperature;
      case AcMode.off:
        // When off, show cooling setpoint as default
        return _device.coolerChannel.temperature;
    }
  }

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(AcMode mode) async {
    // Set grace period to prevent control state listener from causing
    // SpeedSlider flickering during mode transitions
    _modeChangeTime = DateTime.now();

    final coolerOnProp = _device.coolerChannel.onProp;
    final heaterOnProp = _device.heaterChannel?.onProp;
    final fanOnProp = _device.fanChannel.onProp;

    // Set PENDING state immediately for responsive UI
    if (coolerOnProp != null) {
      _deviceControlStateService?.setPending(
        _device.id,
        _device.coolerChannel.id,
        coolerOnProp.id,
        mode == AcMode.cool,
      );
    }
    if (heaterOnProp != null && _device.heaterChannel != null) {
      _deviceControlStateService?.setPending(
        _device.id,
        _device.heaterChannel!.id,
        heaterOnProp.id,
        mode == AcMode.heat,
      );
    }
    // Fan on/off based on mode
    _deviceControlStateService?.setPending(
      _device.id,
      _device.fanChannel.id,
      fanOnProp.id,
      mode != AcMode.off,
    );
    setState(() {});

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
        if (coolerOnProp != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _device.coolerChannel.id,
            propertyId: coolerOnProp.id,
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
      case AcMode.cool:
        // Turn on cooler, turn off heater, turn on fan
        if (coolerOnProp != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _device.coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: true,
          ));
        }
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
        if (coolerOnProp != null) {
          commands.add(PropertyCommandItem(
            deviceId: _device.id,
            channelId: _device.coolerChannel.id,
            propertyId: coolerOnProp.id,
            value: false,
          ));
        }
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

    // Send all commands as a single batch
    if (commands.isNotEmpty) {
      final localizations = AppLocalizations.of(context);

      try {
        bool res = await _devicesService.setMultiplePropertyValues(
          properties: commands,
        );

        if (!res && mounted && localizations != null) {
          AlertBar.showError(context, message: localizations.action_failed);
        }
      } catch (e) {
        if (mounted && localizations != null) {
          AlertBar.showError(context, message: localizations.action_failed);
        }
      }
    }

    // Transition to settling state
    if (coolerOnProp != null) {
      _deviceControlStateService?.setSettling(
        _device.id,
        _device.coolerChannel.id,
        coolerOnProp.id,
      );
    }
    if (heaterOnProp != null && _device.heaterChannel != null) {
      _deviceControlStateService?.setSettling(
        _device.id,
        _device.heaterChannel!.id,
        heaterOnProp.id,
      );
    }
    _deviceControlStateService?.setSettling(
      _device.id,
      _device.fanChannel.id,
      fanOnProp.id,
    );
  }

  void _onSetpointChanged(double value) {
    final setpointProp = _activeSetpointProp;
    final channelId = _activeSetpointChannelId;
    if (setpointProp == null || channelId == null) return;

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
    _setpointDebounceTimer = Timer(_setpointDebounceDuration, () async {
      if (!mounted) return;

      await _setPropertyValue(setpointProp, clampedValue);

      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          channelId,
          setpointProp.id,
        );
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
    final fanChannel = _device.fanChannel;
    final speedProp = fanChannel.speedProp;
    if (!fanChannel.hasSpeed || !fanChannel.isSpeedNumeric || speedProp == null) return;

    final range = fanChannel.maxSpeed - fanChannel.minSpeed;
    if (range <= 0) return;

    final rawSpeed = fanChannel.minSpeed + (normalizedSpeed * range);
    final step = fanChannel.speedStep;
    final steppedSpeed = step > 0 ? (rawSpeed / step).round() * step : rawSpeed;
    final actualSpeed = steppedSpeed.clamp(fanChannel.minSpeed, fanChannel.maxSpeed);

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      speedProp.id,
      actualSpeed,
    );
    setState(() {});

    _speedDebounceTimer?.cancel();
    _speedDebounceTimer = Timer(_speedDebounceDuration, () async {
      if (!mounted) return;
      _setPropertyValue(speedProp, actualSpeed);
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          speedProp.id,
        );
      }
    });
  }

  void _setFanSpeedLevel(FanSpeedLevelValue level) {
    final fanChannel = _device.fanChannel;
    if (!fanChannel.hasSpeed || !fanChannel.isSpeedEnum) return;
    _setPropertyValue(fanChannel.speedProp, level.value);
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

    return SingleChildScrollView(
      padding: AppSpacings.paddingLg,
      child: Column(
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
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final isLargeScreen = _screenService.isLargeScreen;
    final modeColor = _getModeColor(isDark);

    // Large screen: equal columns
    if (isLargeScreen) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 1,
            child: Padding(
              padding: AppSpacings.paddingLg,
              child: _buildPrimaryControlCard(context, isDark,
                  dialSize: _scale(200)),
            ),
          ),
          Container(width: _scale(1), color: borderColor),
          Expanded(
            flex: 1,
            child: Container(
              color: cardColor,
              padding: AppSpacings.paddingLg,
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildStatusSection(localizations, isDark, modeColor),
                    AppSpacings.spacingMdVertical,
                    _buildFanControls(localizations, isDark, modeColor, false),
                  ],
                ),
              ),
            ),
          ),
        ],
      );
    }

    // Small/medium: 2:1 ratio with stretched dial
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: 2,
          child: Padding(
            padding: AppSpacings.paddingLg,
            child: _buildCompactDialWithModes(context, isDark),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        Expanded(
          flex: 1,
          child: Container(
            color: cardColor,
            padding: AppSpacings.paddingLg,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildStatusSection(localizations, isDark, modeColor),
                  AppSpacings.spacingMdVertical,
                  _buildFanControls(localizations, isDark, modeColor, true),
                ],
              ),
            ),
          ),
        ),
      ],
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
    final useVerticalLayout = _screenService.isLandscape &&
        (_screenService.isSmallScreen || _screenService.isMediumScreen);

    // Build info tiles list
    final infoTiles = <Widget>[];

    // Temperature (always present)
    infoTiles.add(InfoTile(
      label: localizations.device_current_temperature,
      value: NumberFormatUtils.defaultFormat.formatDecimal(
        _currentTemperature,
        decimalPlaces: 1,
      ),
      unit: '°C',
      valueColor: modeColor,
    ));

    // Humidity (optional)
    if (humidityChannel != null) {
      infoTiles.add(InfoTile(
        label: localizations.device_current_humidity,
        value: NumberFormatUtils.defaultFormat
            .formatInteger(humidityChannel.humidity),
        unit: '%',
      ));
    }

    // Contact sensor (optional) - shows window/door status
    // detected = true means window is open
    if (contactChannel != null) {
      final isOpen = contactChannel.detected;
      infoTiles.add(InfoTile(
        label: localizations.contact_sensor_window,
        value: isOpen
            ? localizations.contact_sensor_open
            : localizations.contact_sensor_closed,
        isWarning: isOpen,
      ));
    }

    // Leak sensor (optional) - shows water leak status
    // detected = true means leak detected
    final leakChannel = _device.leakChannel;
    if (leakChannel != null) {
      final isLeaking = leakChannel.detected;
      infoTiles.add(InfoTile(
        label: localizations.leak_sensor_water,
        value: isLeaking
            ? localizations.leak_sensor_detected
            : localizations.leak_sensor_dry,
        isWarning: isLeaking,
      ));
    }

    // Filter (optional) - show life remaining or status
    final filterChannel = _device.filterChannel;
    if (filterChannel != null) {
      if (filterChannel.hasLifeRemaining) {
        // Show life remaining percentage
        final filterLife = _device.filterLifeRemaining / 100.0;
        infoTiles.add(InfoTile(
          label: localizations.device_filter_life,
          value: '${(filterLife * 100).toInt()}',
          unit: '%',
          isWarning: filterLife < 0.3 || _device.isFilterNeedsReplacement,
        ));
      } else if (filterChannel.hasStatus) {
        // Show status if no life remaining property
        infoTiles.add(InfoTile(
          label: localizations.device_filter_status,
          value: FilterUtils.getStatusLabel(localizations, filterChannel.status),
          isWarning: _device.isFilterNeedsReplacement,
        ));
      }
    }

    if (infoTiles.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (useVerticalLayout)
          ...infoTiles
              .expand((tile) => [
                    SizedBox(width: double.infinity, child: tile),
                    AppSpacings.spacingSmVertical,
                  ])
              .take(infoTiles.length * 2 - 1)
        else
          _buildInfoTilesGrid(infoTiles),
      ],
    );
  }

  Widget _buildInfoTilesGrid(List<Widget> tiles) {
    // Dynamic tiles per row based on total count:
    // 1 tile: full width, 2 tiles: 2 per row, 3+ tiles: 3 per row
    final int tilesPerRow = tiles.length == 1
        ? 1
        : tiles.length == 2
            ? 2
            : 3;

    final rows = <Widget>[];

    for (var i = 0; i < tiles.length; i += tilesPerRow) {
      final rowTiles = tiles.skip(i).take(tilesPerRow).toList();

      // Build row with tiles
      final rowChildren = <Widget>[];
      for (var j = 0; j < rowTiles.length; j++) {
        rowChildren.add(Expanded(child: rowTiles[j]));
        if (j < rowTiles.length - 1) {
          rowChildren.add(AppSpacings.spacingSmHorizontal);
        }
      }

      // Add empty spacers if row is not full (to maintain consistent sizing)
      final emptySlots = tilesPerRow - rowTiles.length;
      for (var j = 0; j < emptySlots; j++) {
        rowChildren.add(AppSpacings.spacingSmHorizontal);
        rowChildren.add(const Expanded(child: SizedBox.shrink()));
      }

      rows.add(Row(children: rowChildren));

      // Add spacing between rows
      if (i + tilesPerRow < tiles.length) {
        rows.add(AppSpacings.spacingSmVertical);
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: rows,
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

    // Speed control with mode selector inside
    if (fanChannel.hasSpeed) {
      controls.add(_buildFanSpeedControl(localizations, isDark, modeColor, useCompactLayout));
      controls.add(AppSpacings.spacingMdVertical);
    } else if (fanChannel.hasMode && fanChannel.availableModes.length > 1) {
      // If no speed but has mode, show mode selector standalone
      controls.add(_buildFanModeControl(localizations, modeColor, useCompactLayout));
      controls.add(AppSpacings.spacingMdVertical);
    }

    // Options (swing, direction, natural breeze, timer, locked)
    final options = _buildFanOptions(localizations, isDark, modeColor, useCompactLayout);
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

      return ValueSelectorRow<FanModeValue>(
        currentValue: selectedMode,
        label: localizations.device_fan_mode,
        icon: Icons.air,
        sheetTitle: localizations.device_fan_mode,
        activeColor: activeColor,
        options: options,
        displayFormatter: (mode) => mode != null
            ? FanUtils.getModeLabel(localizations, mode)
            : '',
        isActiveValue: (mode) => mode != null,
        columns: availableModes.length > 4 ? 3 : availableModes.length,
        layout: ValueSelectorRowLayout.compact,
        onChanged: (mode) {
          if (mode != null) {
            _setPropertyValue(fanChannel.modeProp, mode.value);
          }
        },
      );
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
      onChanged: (mode) => _setPropertyValue(fanChannel.modeProp, mode.value),
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

      final speedWidget = ValueSelectorRow<FanSpeedLevelValue>(
        currentValue: fanChannel.speedLevel,
        label: localizations.device_fan_speed,
        icon: Icons.speed,
        sheetTitle: localizations.device_fan_speed,
        activeColor: modeColor,
        options: options,
        displayFormatter: (level) => level != null
            ? FanUtils.getSpeedLevelLabel(localizations, level)
            : localizations.fan_speed_off,
        isActiveValue: (level) => level != null && level != FanSpeedLevelValue.off,
        columns: availableLevels.length > 4 ? 3 : availableLevels.length,
        layout: useCompactLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: _currentMode != AcMode.off
            ? (level) {
                if (level != null) _setFanSpeedLevel(level);
              }
            : null,
      );

      // If fan has mode, add mode selector below (always button since speed is button)
      if (hasMode) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            speedWidget,
            AppSpacings.spacingMdVertical,
            _buildFanModeControl(localizations, modeColor, true),
          ],
        );
      }

      return speedWidget;
    } else {
      final range = fanChannel.maxSpeed - fanChannel.minSpeed;
      if (range <= 0) return const SizedBox.shrink();

      if (useCompactLayout) {
        final speedWidget = ValueSelectorRow<double>(
          currentValue: _fanSpeed,
          label: localizations.device_fan_speed,
          icon: Icons.speed,
          sheetTitle: localizations.device_fan_speed,
          activeColor: modeColor,
          options: _getFanSpeedOptions(localizations),
          displayFormatter: (v) => _formatFanSpeed(localizations, v),
          isActiveValue: (v) => v != null && v > 0,
          columns: 4,
          layout: ValueSelectorRowLayout.compact,
          onChanged: _currentMode != AcMode.off ? (v) => _setFanSpeedValue(v ?? 0) : null,
        );

        // If fan has mode, add mode selector below
        if (hasMode) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              speedWidget,
              AppSpacings.spacingMdVertical,
              _buildFanModeControl(localizations, modeColor, useCompactLayout),
            ],
          );
        }

        return speedWidget;
      } else {
        // Use SpeedSlider widget for landscape layout
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
              ? _buildFanModeControl(localizations, modeColor, false)
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
  ) {
    final fanChannel = _device.fanChannel;
    final options = <Widget>[];

    // Oscillation / Swing
    if (fanChannel.hasSwing) {
      options.add(UniversalTile(
        layout: TileLayout.horizontal,
        icon: Icons.sync,
        name: localizations.device_oscillation,
        status: fanChannel.swing
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.swing,
        activeColor: modeColor,
        onTileTap: () => _setPropertyValue(fanChannel.swingProp, !fanChannel.swing),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      ));
      options.add(AppSpacings.spacingSmVertical);
    }

    // Direction
    if (fanChannel.hasDirection) {
      final isReversed = fanChannel.direction == FanDirectionValue.counterClockwise;
      options.add(UniversalTile(
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
          _setPropertyValue(fanChannel.directionProp, newDirection.value);
        },
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      ));
      options.add(AppSpacings.spacingSmVertical);
    }

    // Natural Breeze
    if (fanChannel.hasNaturalBreeze) {
      options.add(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.weatherWindy,
        name: localizations.device_natural_breeze,
        status: fanChannel.naturalBreeze
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.naturalBreeze,
        activeColor: modeColor,
        onTileTap: () => _setPropertyValue(fanChannel.naturalBreezeProp, !fanChannel.naturalBreeze),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      ));
      options.add(AppSpacings.spacingSmVertical);
    }

    // Child Lock
    if (fanChannel.hasLocked) {
      options.add(UniversalTile(
        layout: TileLayout.horizontal,
        icon: Icons.lock,
        name: localizations.device_child_lock,
        status: fanChannel.locked
            ? localizations.thermostat_lock_locked
            : localizations.thermostat_lock_unlocked,
        isActive: fanChannel.locked,
        activeColor: modeColor,
        onTileTap: () => _setPropertyValue(fanChannel.lockedProp, !fanChannel.locked),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      ));
      options.add(AppSpacings.spacingSmVertical);
    }

    // Timer
    if (fanChannel.hasTimer) {
      options.add(_buildTimerControl(localizations, modeColor, useCompactLayout));
    }

    // Remove trailing spacer
    if (options.isNotEmpty && options.last == AppSpacings.spacingSmVertical) {
      options.removeLast();
    }

    return options;
  }

  Widget _buildTimerControl(
    AppLocalizations localizations,
    Color modeColor,
    bool useCompactLayout,
  ) {
    final fanChannel = _device.fanChannel;

    if (fanChannel.isTimerEnum) {
      final options = _getTimerPresetOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return ValueSelectorRow<FanTimerPresetValue?>(
        currentValue: fanChannel.timerPreset,
        label: localizations.device_timer,
        icon: Icons.timer_outlined,
        sheetTitle: localizations.device_auto_off_timer,
        activeColor: modeColor,
        options: options,
        displayFormatter: (p) => _formatTimerPreset(localizations, p),
        isActiveValue: (preset) =>
            preset != null && preset != FanTimerPresetValue.off,
        columns: options.length > 4 ? 4 : options.length,
        layout: useCompactLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: (preset) {
          if (preset != null) {
            _setPropertyValue(fanChannel.timerProp, preset.value);
          }
        },
      );
    } else {
      final options = _getNumericTimerOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return ValueSelectorRow<int>(
        currentValue: fanChannel.timer,
        label: localizations.device_timer,
        icon: Icons.timer_outlined,
        sheetTitle: localizations.device_auto_off_timer,
        activeColor: modeColor,
        options: options,
        displayFormatter: (m) => _formatNumericTimer(localizations, m),
        isActiveValue: (minutes) => minutes != null && minutes > 0,
        columns: options.length > 4 ? 4 : options.length,
        layout: useCompactLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: (minutes) {
          if (minutes != null) {
            _setPropertyValue(fanChannel.timerProp, minutes);
          }
        },
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
