import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/speed_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/air_quality_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/fan_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/filter_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Internal sensor data structure for air purifier device detail.
class _SensorInfo {
  final String id;
  final String label;
  final String value;
  final String? unit;
  final IconData icon;
  final Color? valueColor;
  final ThemeColors? valueThemeColor;
  final bool isWarning;

  const _SensorInfo({
    required this.id,
    required this.label,
    required this.value,
    required this.icon,
    this.unit,
    this.valueColor,
    this.valueThemeColor,
    this.isWarning = false,
  });

  /// Returns the formatted display value with unit
  String get displayValue => unit != null ? '$value$unit' : value;
}

class AirPurifierDeviceDetail extends StatefulWidget {
  final AirPurifierDeviceView _device;
  final VoidCallback? onBack;

  const AirPurifierDeviceDetail({
    super.key,
    required AirPurifierDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<AirPurifierDeviceDetail> createState() =>
      _AirPurifierDeviceDetailState();
}

class _AirPurifierDeviceDetailState extends State<AirPurifierDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  AirPurifierDeviceController? _controller;

  // Debounce timer for speed slider to avoid flooding backend
  Timer? _speedDebounceTimer;
  static const _speedDebounceDuration = Duration(milliseconds: 300);

  @override
  void initState() {
    super.initState();
    _devicesService.addListener(_onDeviceChanged);

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
      _initController();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AirPurifierDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = AirPurifierDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint('[AirPurifierDeviceDetail] Controller error for $propertyId: $error');
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

    final fanChannel = _device.fanChannel;
    final deviceId = _device.id;
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

    // Check mode property (if available)
    final modeProp = fanChannel.modeProp;
    if (modeProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        modeProp.id,
        fanChannel.mode?.value,
      );
    }

    // Check direction property (if available)
    final directionProp = fanChannel.directionProp;
    if (directionProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        directionProp.id,
        fanChannel.direction?.value,
      );
    }

    // Check locked property (if available)
    final lockedProp = fanChannel.lockedProp;
    if (lockedProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        lockedProp.id,
        fanChannel.locked,
      );
    }

    // Check naturalBreeze property (if available)
    final naturalBreezeProp = fanChannel.naturalBreezeProp;
    if (naturalBreezeProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        naturalBreezeProp.id,
        fanChannel.naturalBreeze,
      );
    }

    // Check timer property (if available)
    final timerProp = fanChannel.timerProp;
    if (timerProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        timerProp.id,
        fanChannel.timer,
        tolerance: fanChannel.timerStep > 0 ? fanChannel.timerStep.toDouble() : 1.0,
      );
    }
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  AirPurifierDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is AirPurifierDeviceView) {
      return updated;
    }
    return widget._device;
  }

  // Computed getters for device state

  FanModeValue? get _mode {
    final fanChannel = _device.fanChannel;
    return fanChannel.hasMode ? fanChannel.mode : null;
  }

  double get _normalizedSpeed {
    final fanChannel = _device.fanChannel;
    if (!fanChannel.hasSpeed || !fanChannel.isSpeedNumeric) return 0.0;

    final speedProp = fanChannel.speedProp;
    final controlState = _deviceControlStateService;

    double actualSpeed = fanChannel.speed;

    // Check for pending/optimistic value first
    if (speedProp != null &&
        controlState != null &&
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

    final range = fanChannel.maxSpeed - fanChannel.minSpeed;
    if (range <= 0) return 0.0;
    return (actualSpeed - fanChannel.minSpeed) / range;
  }

  bool get _hasAqiData {
    final aqChannel = _device.airQualityChannel;
    final pmChannel = _device.airParticulateChannel;
    return (aqChannel != null && (aqChannel.hasLevel || aqChannel.hasAqi)) ||
        (pmChannel != null && pmChannel.hasConcentration);
  }

  int get _aqi {
    final aqChannel = _device.airQualityChannel;
    final pmChannel = _device.airParticulateChannel;

    if (aqChannel != null && (aqChannel.hasLevel || aqChannel.hasAqi)) {
      if (aqChannel.hasAqi) {
        return aqChannel.aqi;
      }
      if (aqChannel.hasLevel) {
        return AirQualityUtils.calculateAqiFromLevel(aqChannel.level);
      }
    } else if (pmChannel != null && pmChannel.hasConcentration) {
      final mode = pmChannel.hasMode ? pmChannel.mode : AirParticulateModeValue.pm25;
      return AirQualityUtils.calculateAqi(pmChannel.concentration, mode);
    }
    return 0;
  }

  AirQualityLevelValue? get _aqiLevel {
    final aqChannel = _device.airQualityChannel;
    if (aqChannel != null && aqChannel.hasLevel) {
      return aqChannel.level;
    }
    return null;
  }

  int get _pm25 {
    final pmChannel = _device.airParticulateChannel;
    if (pmChannel != null && pmChannel.hasConcentration) {
      return pmChannel.concentration.toInt();
    }
    return 0;
  }

  double get _filterLife {
    if (_device.hasFilter) {
      return _device.filterLifeRemaining / 100.0;
    }
    return 1.0;
  }

  bool get _childLock {
    final fanChannel = _device.fanChannel;
    return fanChannel.hasLocked ? fanChannel.locked : false;
  }

  void _setSpeedValue(double normalizedSpeed) {
    final controller = _controller;
    final fanChannel = _device.fanChannel;
    final speedProp = fanChannel.speedProp;
    if (controller == null || !fanChannel.hasSpeed || !fanChannel.isSpeedNumeric || speedProp == null) return;

    // Convert normalized 0-1 value to actual device speed range
    final range = fanChannel.maxSpeed - fanChannel.minSpeed;
    if (range <= 0) return;
    final rawSpeed = fanChannel.minSpeed + (normalizedSpeed * range);

    // Round to step value (guard against division by zero)
    final step = fanChannel.speedStep;
    final steppedSpeed = step > 0 ? (rawSpeed / step).round() * step : rawSpeed;

    // Clamp to valid range
    final actualSpeed = steppedSpeed.clamp(fanChannel.minSpeed, fanChannel.maxSpeed);

    // Set PENDING state immediately for responsive UI (for slider visual feedback)
    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      speedProp.id,
      actualSpeed,
    );
    setState(() {});

    // Cancel any pending debounce timer
    _speedDebounceTimer?.cancel();

    // Debounce the API call to avoid flooding backend
    _speedDebounceTimer = Timer(_speedDebounceDuration, () {
      if (!mounted) return;

      controller.fan.setSpeed(actualSpeed);
    });
  }

  void _setSpeedLevel(FanSpeedLevelValue level) {
    final controller = _controller;
    if (controller == null) return;

    controller.fan.setSpeedLevel(level);
    setState(() {});
  }

  void _setFanPower(bool value) {
    final controller = _controller;
    if (controller == null) return;

    controller.setPower(value);
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

  Widget _buildSpeedControl(
    AppLocalizations localizations,
    bool isDark,
    Color airColor,
    bool useVerticalLayout,
    double tileHeight,
  ) {
    final fanChannel = _device.fanChannel;
    final isEnabled = _device.isOn;

    if (fanChannel.isSpeedEnum) {
      // Enum-based speed (off, low, medium, high, turbo, auto)
      final availableLevels = fanChannel.availableSpeedLevels;
      if (availableLevels.isEmpty) return const SizedBox.shrink();

      final options = availableLevels.map((level) {
        return ValueOption(
          value: level,
          label: FanUtils.getSpeedLevelLabel(localizations, level),
        );
      }).toList();

      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: ValueSelectorRow<FanSpeedLevelValue>(
          currentValue: fanChannel.speedLevel,
          label: localizations.device_fan_speed,
          icon: MdiIcons.speedometer,
          sheetTitle: localizations.device_fan_speed,
          activeColor: airColor,
          options: options,
          displayFormatter: (level) => level != null
              ? FanUtils.getSpeedLevelLabel(localizations, level)
              : localizations.fan_speed_off,
          columns: availableLevels.length > 4 ? 3 : availableLevels.length,
          layout: useVerticalLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          showChevron: _screenService.isLargeScreen,
          onChanged: isEnabled ? (level) {
            if (level != null) _setSpeedLevel(level);
          } : null,
        ),
      );
    } else {
      // Numeric speed (0-100%)
      final isLandscape = _screenService.isLandscape;

      // Landscape (all sizes): Use ValueSelectorRow button
      if (isLandscape) {
        return SizedBox(
          height: tileHeight,
          width: double.infinity,
          child: ValueSelectorRow<double>(
            currentValue: _normalizedSpeed,
            label: localizations.device_fan_speed,
            icon: MdiIcons.speedometer,
            sheetTitle: localizations.device_fan_speed,
            activeColor: airColor,
            options: _getSpeedOptions(localizations),
            displayFormatter: (v) => _formatSpeed(localizations, v),
            columns: 4,
            layout: ValueSelectorRowLayout.compact,
            showChevron: _screenService.isLargeScreen,
            onChanged: isEnabled ? (v) => _setSpeedValue(v ?? 0) : null,
          ),
        );
      } else {
        // Portrait (all sizes): Use SpeedSlider
        return SpeedSlider(
          value: _normalizedSpeed,
          themeColor: ThemeColors.success,
          enabled: isEnabled,
          steps: [
            localizations.fan_speed_off,
            localizations.fan_speed_low,
            localizations.fan_speed_medium,
            localizations.fan_speed_high,
          ],
          onChanged: _setSpeedValue,
        );
      }
    }
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  String _getAqiLabel(AppLocalizations localizations) {
    // Use level label if available, otherwise calculate from AQI value
    if (_aqiLevel != null) {
      return AirQualityUtils.getAirQualityLevelLabel(localizations, _aqiLevel);
    }
    return AirQualityUtils.getAqiLabel(localizations, _aqi);
  }

  String _getModeLabel(AppLocalizations localizations) {
    if (_mode == null) return localizations.air_quality_level_unknown;
    return FanUtils.getModeLabel(localizations, _mode!);
  }

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
                          ? _buildLandscape(context, isDark)
                          : _buildPortrait(context, isDark);
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
    final airColor = DeviceColors.air(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: _device.name,
      subtitle: _device.isOn
          ? '${_getModeLabel(localizations)} • ${_getAqiLabel(localizations)}'
          : localizations.on_state_off,
      subtitleColor: _device.isOn ? airColor : secondaryColor,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: widget.onBack,
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: _device.isOn
                  ? DeviceColors.airLight9(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
            ),
            child: Icon(
              MdiIcons.airFilter,
              color: _device.isOn ? airColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscape(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final airColor = DeviceColors.air(isDark);
    final isLargeScreen = _screenService.isLargeScreen;

    final sensors = _getSensors(localizations, isDark);
    final controlsSection = _buildLandscapeControlsSection(localizations, isDark, airColor);

    return DeviceDetailLandscapeLayout(
      mainContent: isLargeScreen
          ? _buildControlCard(context, isDark, airColor)
          : _buildCompactControlCard(context, isDark, airColor),
      secondaryContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sensors at top with label
          if (sensors.isNotEmpty) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            AppSpacings.spacingMdVertical,
            _buildSensorsSection(isDark, sensors),
            AppSpacings.spacingLgVertical,
          ],
          // Controls section with label
          if (controlsSection is! SizedBox) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            AppSpacings.spacingMdVertical,
            controlsSection,
          ],
        ],
      ),
    );
  }

  Widget _buildPortrait(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final airColor = DeviceColors.air(isDark);

    final hasSpeed = _device.fanChannel.hasSpeed;
    final sensorsSection = _buildSensorsWithLabel(context, isDark, localizations);
    final controlsSection = _buildFanOptionsSection(localizations, isDark, airColor, false);

    return DeviceDetailPortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Main control card with power button and mode selector
          _buildControlCard(context, isDark, airColor),
          // Speed slider under main box
          if (hasSpeed) ...[
            AppSpacings.spacingMdVertical,
            _buildSpeedSliderForPortrait(localizations, isDark, airColor),
          ],
          // Sensors section with label
          if (sensorsSection is! SizedBox) ...[
            AppSpacings.spacingLgVertical,
            sensorsSection,
          ],
          // Controls section with label
          if (controlsSection is! SizedBox) ...[
            AppSpacings.spacingLgVertical,
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            AppSpacings.spacingMdVertical,
            controlsSection,
          ],
        ],
      ),
    );
  }

  Widget _buildControlCard(
      BuildContext context, bool isDark, Color airColor) {
    final localizations = AppLocalizations.of(context)!;
    // Use lighter bg in dark mode for better contrast with button
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final borderColor = DeviceColors.airLight7(isDark);

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        children: [
          DevicePowerButton(
            isOn: _device.isOn,
            activeColor: airColor,
            activeBgColor: DeviceColors.airLight9(isDark),
            glowColor: DeviceColors.airLight5(isDark),
            showInfoText: false,
            onTap: () => _setFanPower(!_device.isOn),
          ),
          if (_hasAqiData) ...[
            AppSpacings.spacingMdVertical,
            _buildAirQualityBar(context, isDark),
          ],
          AppSpacings.spacingLgVertical,
          _buildModeSelector(localizations, isDark, airColor),
        ],
      ),
    );
  }

  Widget _buildModeSelector(AppLocalizations localizations, bool isDark, Color activeColor) {
    final fanChannel = _device.fanChannel;
    if (!fanChannel.hasMode) {
      return const SizedBox.shrink();
    }

    final availableModes = fanChannel.availableModes;
    if (availableModes.isEmpty) {
      return const SizedBox.shrink();
    }

    // selectedMode can be null if device is reset or sends invalid value
    final selectedMode = _mode;

    return ModeSelector<FanModeValue>(
      modes: _getFanModeOptions(localizations),
      selectedValue: selectedMode,
      onChanged: _setFanMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: ModeSelectorColor.success,
      scrollable: true,
    );
  }

  List<ModeOption<FanModeValue>> _getFanModeOptions(AppLocalizations localizations) {
    final fanChannel = _device.fanChannel;
    final availableModes = fanChannel.availableModes;

    // Map available modes to ModeOption with appropriate icons
    return availableModes.map((mode) {
      return ModeOption(
        value: mode,
        icon: FanUtils.getModeIcon(mode),
        label: FanUtils.getModeLabel(localizations, mode),
      );
    }).toList();
  }

  List<ValueOption<FanTimerPresetValue?>> _getTimerPresetOptions(
    AppLocalizations localizations,
  ) {
    final fanChannel = _device.fanChannel;
    final availablePresets = fanChannel.availableTimerPresets;

    if (availablePresets.isEmpty) {
      return [];
    }

    return availablePresets.map((preset) {
      return ValueOption(
        value: preset,
        label: FanUtils.getTimerPresetLabel(localizations, preset),
      );
    }).toList();
  }

  String _formatTimerPreset(AppLocalizations localizations, FanTimerPresetValue? preset) {
    if (preset == null || preset == FanTimerPresetValue.off) {
      return localizations.fan_timer_off;
    }
    return FanUtils.getTimerPresetLabel(localizations, preset);
  }

  List<ValueOption<int>> _getNumericTimerOptions(AppLocalizations localizations) {
    final fanChannel = _device.fanChannel;
    final minTimer = fanChannel.minTimer;
    final maxTimer = fanChannel.maxTimer;

    // Generate options based on device range
    final options = <ValueOption<int>>[];
    options.add(ValueOption(value: 0, label: localizations.fan_timer_off));

    // Add preset-like values within range
    final presets = [30, 60, 120, 240, 480, 720]; // minutes
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

  List<ValueOption<double>> _getSpeedOptions(AppLocalizations localizations) {
    return [
      ValueOption(value: 0.0, label: localizations.fan_speed_off),
      ValueOption(value: 0.33, label: localizations.fan_speed_low),
      ValueOption(value: 0.66, label: localizations.fan_speed_medium),
      ValueOption(value: 1.0, label: localizations.fan_speed_high),
    ];
  }

  String _formatSpeed(AppLocalizations localizations, double? speed) {
    if (speed == null || speed == 0) return localizations.fan_speed_off;
    if (speed <= 0.33) return localizations.fan_speed_low;
    if (speed <= 0.66) return localizations.fan_speed_medium;
    return localizations.fan_speed_high;
  }

  Widget _buildTimerControl(
    AppLocalizations localizations,
    Color airColor,
    bool useVerticalLayout,
    double tileHeight,
  ) {
    final fanChannel = _device.fanChannel;

    if (fanChannel.isTimerEnum) {
      // Enum-based timer (off, 30m, 1h, 2h, etc.)
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
          activeColor: airColor,
          options: options,
          displayFormatter: (p) => _formatTimerPreset(localizations, p),
          columns: options.length > 4 ? 4 : options.length,
          layout: useVerticalLayout
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
      // Numeric timer (minutes)
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
          activeColor: airColor,
          options: options,
          displayFormatter: (m) => _formatNumericTimer(localizations, m),
          columns: options.length > 4 ? 4 : options.length,
          layout: useVerticalLayout
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

  /// Compact control card with vertical icon-only mode selector on the right
  Widget _buildCompactControlCard(
      BuildContext context, bool isDark, Color airColor) {
    final localizations = AppLocalizations.of(context)!;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final borderColor = DeviceColors.airLight7(isDark);

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Calculate in design units (unscaled) since DevicePowerButton scales internally
          // Same calculation as fan for consistent button sizes
          final modeIconsWidth = 50.0;
          final spacing = 24.0; // AppSpacings.pXl equivalent
          // Convert constraints to design units by dividing by scale factor
          final scaleFactor = _screenService.scale(1.0, density: _visualDensityService.density);
          final availableWidth = constraints.maxWidth / scaleFactor;
          final availableForButton = availableWidth - modeIconsWidth - spacing;
          // Use available width as fallback when height is infinite
          final availableHeight = constraints.maxHeight.isFinite
              ? constraints.maxHeight / scaleFactor
              : availableForButton;
          final buttonSize =
              math.min(availableForButton, availableHeight).clamp(100.0, 160.0);

          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              DevicePowerButton(
                isOn: _device.isOn,
                activeColor: airColor,
                activeBgColor: DeviceColors.airLight9(isDark),
                glowColor: DeviceColors.airLight5(isDark),
                showInfoText: false,
                size: buttonSize,
                onTap: () => _setFanPower(!_device.isOn),
              ),
              if (_device.fanChannel.hasMode &&
                  _device.fanChannel.availableModes.isNotEmpty) ...[
                AppSpacings.spacingXlHorizontal,
                ModeSelector<FanModeValue>(
                  modes: _getFanModeOptions(localizations),
                  selectedValue: _mode,
                  onChanged: _setFanMode,
                  orientation: ModeSelectorOrientation.vertical,
                  showLabels: false,
                  color: ModeSelectorColor.success,
                  scrollable: true,
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _buildAirQualityBar(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final trackColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;

    Color getAqiColor() {
      if (_aqi < 50) return DeviceColors.air(isDark);
      if (_aqi < 100) {
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      }
      return isDark ? AppColorsDark.danger : AppColorsLight.danger;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              localizations.device_air_quality_index,
              style: TextStyle(
                color: secondaryColor,
                fontSize: AppFontSize.small,
              ),
            ),
            Text(
              '${_getAqiLabel(localizations)} ($_aqi)',
              style: TextStyle(
                color: getAqiColor(),
                fontSize: AppFontSize.base,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        AppSpacings.spacingSmVertical,
        Container(
          height: _scale(8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            color: trackColor,
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final position =
                  (_aqi / 200).clamp(0.0, 1.0) * constraints.maxWidth;
              return Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppBorderRadius.base),
                      gradient: LinearGradient(
                        colors: [
                          DeviceColors.air(isDark),
                          isDark
                              ? AppColorsDark.warning
                              : AppColorsLight.warning,
                          isDark ? AppColorsDark.danger : AppColorsLight.danger,
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left: position - _scale(2),
                    top: -_scale(4),
                    child: Container(
                      width: _scale(4),
                      height: _scale(16),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppTextColorDark.primary
                            : AppTextColorLight.primary,
                        borderRadius: BorderRadius.circular(AppBorderRadius.small),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  /// Builds the list of sensor info for the air purifier.
  List<_SensorInfo> _getSensors(AppLocalizations localizations, bool isDark) {
    final airColor = DeviceColors.air(isDark);
    final sensors = <_SensorInfo>[];

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 1: SAFETY-CRITICAL (life-threatening)
    // ═══════════════════════════════════════════════════════════════════════

    // CO tile - carbon monoxide (can be lethal, highest priority)
    final coChannel = _device.carbonMonoxideChannel;
    if (coChannel != null) {
      if (coChannel.hasConcentration) {
        sensors.add(_SensorInfo(
          id: 'co',
          label: localizations.device_co,
          value: NumberFormatUtils.defaultFormat.formatDecimal(coChannel.concentration, decimalPlaces: 1),
          unit: 'ppm',
          icon: MdiIcons.moleculeCo,
          valueColor: SensorColors.alert(isDark),
          isWarning: coChannel.concentration > 35, // Warn if CO exceeds 35 ppm (EPA 1-hour limit)
        ));
      } else if (coChannel.hasDetected) {
        final isDetected = coChannel.detected;
        sensors.add(_SensorInfo(
          id: 'co',
          label: localizations.device_co,
          value: isDetected
              ? localizations.gas_detected
              : localizations.gas_clear,
          icon: MdiIcons.moleculeCo,
          valueColor: SensorColors.alert(isDark),
          isWarning: isDetected,
        ));
      }
    }

    // Leak sensor tile - water damage prevention
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
        valueColor: SensorColors.alert(isDark),
        isWarning: isLeaking,
      ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 2: PRIMARY AIR QUALITY INDICATORS
    // ═══════════════════════════════════════════════════════════════════════

    // PM tile - particulate matter (main AQI component)
    final pmChannel = _device.airParticulateChannel;
    if (pmChannel != null) {
      final pmMode = pmChannel.hasMode ? pmChannel.mode : AirParticulateModeValue.pm25;
      if (pmChannel.hasConcentration) {
        sensors.add(_SensorInfo(
          id: 'pm',
          label: AirQualityUtils.getParticulateLabel(localizations, pmMode),
          value: NumberFormatUtils.defaultFormat.formatInteger(_pm25),
          unit: 'µg/m³',
          icon: MdiIcons.blur,
          valueColor: airColor,
        ));
      } else if (pmChannel.hasDetected) {
        final isDetected = pmChannel.detected;
        sensors.add(_SensorInfo(
          id: 'pm',
          label: AirQualityUtils.getParticulateLabel(localizations, pmMode),
          value: isDetected
              ? localizations.air_quality_unhealthy
              : localizations.air_quality_healthy,
          icon: MdiIcons.blur,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // VOC tile - volatile organic compounds
    final vocChannel = _device.volatileOrganicCompoundsChannel;
    if (vocChannel != null) {
      if (vocChannel.hasLevel && vocChannel.level != null) {
        sensors.add(_SensorInfo(
          id: 'voc',
          label: localizations.device_voc,
          value: AirQualityUtils.getVocLevelLabel(localizations, vocChannel.level),
          icon: MdiIcons.molecule,
          valueColor: airColor,
        ));
      } else if (vocChannel.hasConcentration) {
        sensors.add(_SensorInfo(
          id: 'voc',
          label: localizations.device_voc,
          value: AirQualityUtils.calculateVocLevelFromConcentration(localizations, vocChannel.concentration),
          icon: MdiIcons.molecule,
          valueColor: airColor,
        ));
      } else if (vocChannel.hasDetected) {
        final isDetected = vocChannel.detected;
        sensors.add(_SensorInfo(
          id: 'voc',
          label: localizations.device_voc,
          value: isDetected
              ? localizations.air_quality_unhealthy
              : localizations.air_quality_healthy,
          icon: MdiIcons.molecule,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // CO₂ tile - carbon dioxide (indoor air quality indicator)
    final co2Channel = _device.carbonDioxideChannel;
    if (co2Channel != null && co2Channel.hasConcentration) {
      sensors.add(_SensorInfo(
        id: 'co2',
        label: localizations.device_co2,
        value: NumberFormatUtils.defaultFormat.formatInteger(co2Channel.concentration.toInt()),
        unit: 'ppm',
        icon: MdiIcons.moleculeCo2,
        valueColor: airColor,
        isWarning: co2Channel.concentration > 1000, // Warn if CO₂ exceeds 1000 ppm
      ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 3: SECONDARY GASES / POLLUTANTS
    // ═══════════════════════════════════════════════════════════════════════

    // O₃ tile - ozone
    final o3Channel = _device.ozoneChannel;
    if (o3Channel != null) {
      if (o3Channel.hasLevel && o3Channel.level != null) {
        sensors.add(_SensorInfo(
          id: 'o3',
          label: localizations.device_o3,
          value: AirQualityUtils.getOzoneLevelLabel(localizations, o3Channel.level),
          icon: MdiIcons.weatherSunny,
          valueColor: airColor,
        ));
      } else if (o3Channel.hasConcentration) {
        sensors.add(_SensorInfo(
          id: 'o3',
          label: localizations.device_o3,
          value: NumberFormatUtils.defaultFormat.formatInteger(o3Channel.concentration.toInt()),
          unit: 'µg/m³',
          icon: MdiIcons.weatherSunny,
          valueColor: airColor,
          isWarning: o3Channel.concentration > 100, // Warn if exceeds WHO 8-hour limit
        ));
      } else if (o3Channel.hasDetected) {
        final isDetected = o3Channel.detected;
        sensors.add(_SensorInfo(
          id: 'o3',
          label: localizations.device_o3,
          value: isDetected
              ? localizations.gas_detected
              : localizations.gas_clear,
          icon: MdiIcons.weatherSunny,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // NO₂ tile - nitrogen dioxide
    final no2Channel = _device.nitrogenDioxideChannel;
    if (no2Channel != null) {
      if (no2Channel.hasConcentration) {
        sensors.add(_SensorInfo(
          id: 'no2',
          label: localizations.device_no2,
          value: NumberFormatUtils.defaultFormat.formatInteger(no2Channel.concentration.toInt()),
          unit: 'µg/m³',
          icon: MdiIcons.molecule,
          valueColor: airColor,
          isWarning: no2Channel.concentration > 200, // Warn if exceeds WHO 1-hour limit
        ));
      } else if (no2Channel.hasDetected) {
        final isDetected = no2Channel.detected;
        sensors.add(_SensorInfo(
          id: 'no2',
          label: localizations.device_no2,
          value: isDetected
              ? localizations.gas_detected
              : localizations.gas_clear,
          icon: MdiIcons.molecule,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // SO₂ tile - sulphur dioxide
    final so2Channel = _device.sulphurDioxideChannel;
    if (so2Channel != null) {
      if (so2Channel.hasLevel && so2Channel.level != null) {
        sensors.add(_SensorInfo(
          id: 'so2',
          label: localizations.device_so2,
          value: AirQualityUtils.getSulphurDioxideLevelLabel(localizations, so2Channel.level),
          icon: MdiIcons.molecule,
          valueColor: airColor,
        ));
      } else if (so2Channel.hasConcentration) {
        sensors.add(_SensorInfo(
          id: 'so2',
          label: localizations.device_so2,
          value: NumberFormatUtils.defaultFormat.formatInteger(so2Channel.concentration.toInt()),
          unit: 'µg/m³',
          icon: MdiIcons.molecule,
          valueColor: airColor,
          isWarning: so2Channel.concentration > 500, // Warn if exceeds WHO 10-min limit
        ));
      } else if (so2Channel.hasDetected) {
        final isDetected = so2Channel.detected;
        sensors.add(_SensorInfo(
          id: 'so2',
          label: localizations.device_so2,
          value: isDetected
              ? localizations.gas_detected
              : localizations.gas_clear,
          icon: MdiIcons.molecule,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 4: MAINTENANCE
    // ═══════════════════════════════════════════════════════════════════════

    // Filter tile - maintenance indicator
    final filterChannel = _device.filterChannel;
    if (filterChannel != null) {
      if (filterChannel.hasLifeRemaining) {
        sensors.add(_SensorInfo(
          id: 'filter',
          label: localizations.device_filter_life,
          value: '${(_filterLife * 100).toInt()}',
          unit: '%',
          icon: MdiIcons.airFilter,
          valueColor: SensorColors.alert(isDark),
          isWarning: _filterLife < 0.3 || _device.isFilterNeedsReplacement,
        ));
      } else if (filterChannel.hasStatus) {
        sensors.add(_SensorInfo(
          id: 'filter',
          label: localizations.device_filter_status,
          value: FilterUtils.getStatusLabel(localizations, filterChannel.status),
          icon: MdiIcons.airFilter,
          valueColor: SensorColors.alert(isDark),
          isWarning: _device.isFilterNeedsReplacement,
        ));
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 5: ENVIRONMENTAL
    // ═══════════════════════════════════════════════════════════════════════

    // Temperature tile
    final tempChannel = _device.temperatureChannel;
    if (tempChannel != null && tempChannel.hasTemperature) {
      sensors.add(_SensorInfo(
        id: 'temperature',
        label: localizations.device_temperature,
        value: NumberFormatUtils.defaultFormat.formatDecimal(
          tempChannel.temperature,
          decimalPlaces: 1,
        ),
        unit: '°C',
        icon: MdiIcons.thermometer,
        valueColor: SensorColors.temperature(isDark),
      ));
    }

    // Humidity tile
    final humidityChannel = _device.humidityChannel;
    if (humidityChannel != null) {
      sensors.add(_SensorInfo(
        id: 'humidity',
        label: localizations.device_humidity,
        value: NumberFormatUtils.defaultFormat.formatInteger(humidityChannel.humidity),
        unit: '%',
        icon: MdiIcons.waterPercent,
        valueColor: SensorColors.humidity(isDark),
      ));
    }

    // Pressure tile - atmospheric pressure
    final pressureChannel = _device.pressureChannel;
    if (pressureChannel != null) {
      sensors.add(_SensorInfo(
        id: 'pressure',
        label: localizations.device_pressure,
        value: NumberFormatUtils.defaultFormat.formatDecimal(pressureChannel.pressure, decimalPlaces: 1),
        unit: 'kPa',
        icon: MdiIcons.gauge,
        valueColor: airColor,
      ));
    }

    return sensors;
  }

  /// Builds sensors section using tile wrappers:
  /// - Portrait: HorizontalScrollWithGradient with HorizontalTileCompact
  /// - Landscape large: GridView.count with VerticalTileLarge
  /// - Landscape small/medium: Column with HorizontalTileStretched
  Widget _buildSensorsSection(bool isDark, List<_SensorInfo> sensors) {
    if (sensors.isEmpty) return const SizedBox.shrink();

    final isLandscape = _screenService.isLandscape;
    final isLargeScreen = _screenService.isLargeScreen;
    final airColor = DeviceColors.air(isDark);

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
            activeColor: sensor.valueThemeColor ?? ThemeColors.success,
            showWarningBadge: sensor.isWarning,
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
            activeColor: sensor.valueThemeColor ?? ThemeColors.success,
            showWarningBadge: sensor.isWarning,
          );
        }).toList(),
      );
    }

    // Landscape small/medium: Column with HorizontalTileStretched
    return Column(
      children: sensors.asMap().entries.map((entry) {
        final index = entry.key;
        final sensor = entry.value;
        final isLast = index == sensors.length - 1;
        return Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
          child: HorizontalTileStretched(
            icon: sensor.icon,
            name: sensor.displayValue,
            status: sensor.label,
            activeColor: sensor.valueThemeColor ?? ThemeColors.success,
            showWarningBadge: sensor.isWarning,
          ),
        );
      }).toList(),
    );
  }

  /// Builds sensors section with label.
  Widget _buildSensorsWithLabel(
    BuildContext context,
    bool isDark,
    AppLocalizations localizations,
  ) {
    final sensors = _getSensors(localizations, isDark);
    if (sensors.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          title: localizations.device_sensors,
          icon: MdiIcons.eyeSettings,
        ),
        AppSpacings.spacingMdVertical,
        _buildSensorsSection(isDark, sensors),
      ],
    );
  }

  /// Builds the speed slider for portrait layout.
  Widget _buildSpeedSliderForPortrait(
    AppLocalizations localizations,
    bool isDark,
    Color airColor,
  ) {
    final fanChannel = _device.fanChannel;
    if (!fanChannel.hasSpeed) return const SizedBox.shrink();

    final isEnabled = _device.isOn;

    if (fanChannel.isSpeedEnum) {
      // Enum-based speed (off, low, medium, high, turbo, auto)
      final availableLevels = fanChannel.availableSpeedLevels;
      if (availableLevels.isEmpty) return const SizedBox.shrink();

      // Portrait: Use SpeedSlider with defined steps
      final steps = availableLevels
          .map((level) => FanUtils.getSpeedLevelLabel(localizations, level))
          .toList();

      // Calculate normalized value from current speed level index
      final currentLevel = fanChannel.speedLevel;
      final currentIndex = currentLevel != null
          ? availableLevels.indexOf(currentLevel)
          : 0;
      final normalizedValue = availableLevels.length > 1
          ? currentIndex / (availableLevels.length - 1)
          : 0.0;

      return SpeedSlider(
        value: normalizedValue.clamp(0.0, 1.0),
        themeColor: ThemeColors.success,
        enabled: isEnabled,
        steps: steps,
        onChanged: (value) {
          // Convert slider value to speed level index
          final index = ((value * (availableLevels.length - 1)).round())
              .clamp(0, availableLevels.length - 1);
          _setSpeedLevel(availableLevels[index]);
        },
      );
    } else {
      // Numeric speed (0-100%) - use SpeedSlider for portrait
      return SpeedSlider(
        value: _normalizedSpeed,
        themeColor: ThemeColors.success,
        enabled: isEnabled,
        steps: [
          localizations.fan_speed_off,
          localizations.fan_speed_low,
          localizations.fan_speed_medium,
          localizations.fan_speed_high,
        ],
        onChanged: _setSpeedValue,
      );
    }
  }

  /// Builds the fan options controls (oscillation, direction, natural breeze, child lock, timer).
  Widget _buildFanOptionsSection(
    AppLocalizations localizations,
    bool isDark,
    Color airColor,
    bool useVerticalLayout,
  ) {
    final fanChannel = _device.fanChannel;
    final tileHeight = _scale(AppTileHeight.horizontal);

    // Helper to wrap control with fixed height
    Widget wrapControl(Widget child) {
      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: child,
      );
    }

    final children = <Widget>[];

    // Oscillation / Swing tile - only show if fan has swing property
    if (fanChannel.hasSwing) {
      children.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.syncIcon,
        name: localizations.device_oscillation,
        status: fanChannel.swing
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.swing,
        activeColor: ThemeColors.success,
        onTileTap: () => _setFanSwing(!fanChannel.swing),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Direction tile - only show if fan has direction property
    if (fanChannel.hasDirection) {
      children.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.swapVertical,
        name: localizations.device_direction,
        status: fanChannel.direction != null
            ? FanUtils.getDirectionLabel(localizations, fanChannel.direction!)
            : localizations.fan_direction_clockwise,
        isActive: fanChannel.direction == FanDirectionValue.counterClockwise,
        activeColor: ThemeColors.success,
        onTileTap: () {
          final isReversed = fanChannel.direction == FanDirectionValue.counterClockwise;
          final newDirection = isReversed
              ? FanDirectionValue.clockwise
              : FanDirectionValue.counterClockwise;
          _setFanDirection(newDirection);
        },
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Natural Breeze tile - only show if fan has natural breeze property
    if (fanChannel.hasNaturalBreeze) {
      children.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.weatherWindy,
        name: localizations.device_natural_breeze,
        status: fanChannel.naturalBreeze
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.naturalBreeze,
        activeColor: ThemeColors.success,
        onTileTap: () => _setFanNaturalBreeze(!fanChannel.naturalBreeze),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Child Lock tile - only show if fan has locked property
    if (fanChannel.hasLocked) {
      children.add(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.lock,
        name: localizations.device_child_lock,
        status: _childLock
            ? localizations.thermostat_lock_locked
            : localizations.thermostat_lock_unlocked,
        isActive: _childLock,
        activeColor: ThemeColors.success,
        onTileTap: () => _setFanLocked(!_childLock),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: true,
      )));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Timer - only show if fan has timer property
    if (fanChannel.hasTimer) {
      children.add(_buildTimerControl(localizations, airColor, useVerticalLayout, tileHeight));
    }

    if (children.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }

  /// Builds the controls section for landscape (speed first, then options).
  Widget _buildLandscapeControlsSection(
    AppLocalizations localizations,
    bool isDark,
    Color airColor,
  ) {
    final fanChannel = _device.fanChannel;
    final useVerticalLayout = _screenService.isSmallScreen || _screenService.isMediumScreen;
    final tileHeight = _scale(AppTileHeight.horizontal);

    final children = <Widget>[];

    // Speed control if available
    if (fanChannel.hasSpeed) {
      children.add(_buildSpeedControl(localizations, isDark, airColor, useVerticalLayout, tileHeight));
      children.add(AppSpacings.spacingMdVertical);
    }

    // Build rest of options
    final optionsSection = _buildFanOptionsSection(localizations, isDark, airColor, useVerticalLayout);
    if (optionsSection is! SizedBox) {
      children.add(optionsSection);
    }

    if (children.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }
}
