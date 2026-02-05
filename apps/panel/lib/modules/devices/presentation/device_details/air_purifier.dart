import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/card_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_channel_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/air_quality_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/fan_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/filter_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/value.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart' show buildChannelIcon;
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
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
  final ThemeColors? valueThemeColor;
  final bool isWarning;
  final SensorData? sensorData;

  const _SensorInfo({
    required this.id,
    required this.label,
    required this.value,
    required this.icon,
    this.unit,
    this.valueThemeColor,
    this.isWarning = false,
    this.sensorData,
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
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AirPurifierDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }

    _initController();
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
      AppToast.showError(context, message: localizations.action_failed);
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

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

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

  // --------------------------------------------------------------------------
  // CONTROL HANDLERS
  // --------------------------------------------------------------------------

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

      final isLandscape = _screenService.isLandscape;

      if (isLandscape) {
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
            onChanged: isEnabled
                ? (level) {
                    if (level != null) _setSpeedLevel(level);
                  }
                : null,
          ),
        );
      } else {
        // Portrait: Use CardSlider with defined steps
        final steps = availableLevels
            .map((level) => FanUtils.getSpeedLevelLabel(localizations, level))
            .toList();

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
          themeColor: _getStatusColor(),
          enabled: isEnabled,
          steps: steps,
          onChanged: (value) {
            final index = ((value * (availableLevels.length - 1)).round())
                .clamp(0, availableLevels.length - 1);
            _setSpeedLevel(availableLevels[index]);
          },
        );
      }
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
        // Portrait (all sizes): Use CardSlider
        return CardSlider(
          label: localizations.device_fan_speed,
          icon: MdiIcons.speedometer,
          value: _normalizedSpeed,
          themeColor: _getStatusColor(),
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

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  ThemeColors _getStatusColor() =>
      _device.isOn ? ThemeColors.success : ThemeColors.neutral;

  ThemeColorFamily _getStatusColorFamily(BuildContext context) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getStatusColor());

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
    final statusColorFamily = _getStatusColorFamily(context);

    String subtitle;
    if (_device.isOn) {
      subtitle = '${_getModeLabel(localizations)} • ${_getAqiLabel(localizations)}';
    } else {
      subtitle = localizations.on_state_off;
    }

    return PageHeader(
      title: _device.name,
      subtitle: subtitle,
      subtitleColor: statusColorFamily.base,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: MdiIcons.arrowLeft,
            onTap: widget.onBack ?? () => Navigator.of(context).pop(),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderMainIcon(icon: buildDeviceIcon(_device.category, _device.icon), color: _getStatusColor()),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscape(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final activeColor = _getStatusColorFamily(context).base;
    final isLargeScreen = _screenService.isLargeScreen;

    final sensors = _getSensors(localizations, isDark);
    final hasDeviceControls =
        _device.fanChannel.hasSpeed || _hasDeviceControlOptions;
    final controlsSection = _buildLandscapeControlsSection(
        context, localizations, isDark, activeColor);

    return DeviceLandscapeLayout(
      mainContent: isLargeScreen
          ? _buildControlCard(context, isDark, activeColor)
          : _buildCompactControlCard(context, isDark, activeColor),
      secondaryContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          if (hasDeviceControls) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            controlsSection,
          ],
          if (sensors.isNotEmpty) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            _buildSensorsSection(isDark, sensors),
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  bool get _hasDeviceControlOptions {
    final fanChannel = _device.fanChannel;
    return fanChannel.hasSwing ||
        fanChannel.hasDirection ||
        fanChannel.hasNaturalBreeze ||
        fanChannel.hasLocked ||
        fanChannel.hasTimer;
  }

  Widget _buildPortrait(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final activeColor = _getStatusColorFamily(context).base;
    final sensors = _getSensors(localizations, isDark);
    final hasSpeed = _device.fanChannel.hasSpeed;

    return DevicePortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          _buildControlCard(context, isDark, activeColor),
          if (hasSpeed)
            _buildSpeedControl(
              localizations,
              isDark,
              activeColor,
              false,
              _scale(AppTileHeight.horizontal),
            ),
          if (_hasDeviceControlOptions) ...[
            SectionTitle(
              title: localizations.device_controls,
              icon: MdiIcons.tuneVertical,
            ),
            _buildFanOptionsSection(context, localizations, isDark, activeColor, false),
          ],
          if (sensors.isNotEmpty) ...[
            SectionTitle(
              title: localizations.device_sensors,
              icon: MdiIcons.eyeSettings,
            ),
            _buildSensorsSection(isDark, sensors),
          ],
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // CONTROL CARD
  // --------------------------------------------------------------------------

  Widget _buildControlCard(
      BuildContext context, bool isDark, Color airColor) {
    final localizations = AppLocalizations.of(context)!;
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final borderColor = _getStatusColorFamily(context).light7;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        spacing: AppSpacings.pMd,
        children: [
          DevicePowerButton(
            isOn: _device.isOn,
            themeColor: _getStatusColor(),
            showInfoText: false,
            onTap: () => _setFanPower(!_device.isOn),
          ),
          if (_hasAqiData) _buildAirQualityBar(context, isDark),
          if (_device.fanChannel.hasMode &&
              _device.fanChannel.availableModes.isNotEmpty)
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
      color: _getStatusColor(),
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
      ValueOption(value: 0.25, label: _formatSpeedPercent(0.25)),
      ValueOption(value: 0.5, label: _formatSpeedPercent(0.5)),
      ValueOption(value: 0.75, label: _formatSpeedPercent(0.75)),
      ValueOption(value: 1.0, label: _formatSpeedPercent(1.0)),
    ];
  }

  String _formatSpeedPercent(double speed) {
    return '${(speed * 100).toInt()}%';
  }

  String _formatSpeed(AppLocalizations localizations, double? speed) {
    if (speed == null || speed == 0) return localizations.fan_speed_off;
    return '${(speed * 100).toInt()}%';
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
    final borderColor = _getStatusColorFamily(context).light7;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          return Row(
            children: [
              Expanded(
                child: Center(
                  child: DevicePowerButton(
                    isOn: _device.isOn,
                    themeColor: _getStatusColor(),
                    showInfoText: false,
                    size: DevicePowerButton.compactSize,
                    onTap: () => _setFanPower(!_device.isOn),
                  ),
                ),
              ),
              if (_device.fanChannel.hasMode &&
                  _device.fanChannel.availableModes.isNotEmpty) ...[
                ModeSelector<FanModeValue>(
                  modes: _getFanModeOptions(localizations),
                  selectedValue: _mode,
                  onChanged: _setFanMode,
                  orientation: ModeSelectorOrientation.vertical,
                  showLabels: false,
                  color: _getStatusColor(),
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
    final successColor = _getStatusColorFamily(context).base;

    Color getAqiColor() {
      if (_aqi < 50) return successColor;
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
                          successColor,
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

  // --------------------------------------------------------------------------
  // SENSORS
  // --------------------------------------------------------------------------

  /// Builds the list of sensor info for the air purifier.
  List<_SensorInfo> _getSensors(AppLocalizations localizations, bool isDark) {
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
          icon: buildChannelIcon(coChannel.category),
          valueThemeColor: SensorColors.alert,
          isWarning: coChannel.concentration > 35, // Warn if CO exceeds 35 ppm (EPA 1-hour limit)
          sensorData: SensorData(
            label: 'Carbon Monoxide',
            icon: buildChannelIcon(coChannel.category),
            channel: coChannel,
            property: coChannel.concentrationProp,
            valueFormatter: (prop) => ValueUtils.formatValue(prop, 1),
          ),
        ));
      } else if (coChannel.hasDetected) {
        final isDetected = coChannel.detected;
        sensors.add(_SensorInfo(
          id: 'co',
          label: localizations.device_co,
          value: isDetected
              ? localizations.gas_detected
              : localizations.gas_clear,
          icon: buildChannelIcon(coChannel.category),
          valueThemeColor: SensorColors.alert,
          isWarning: isDetected,
          sensorData: SensorData(
            label: 'Carbon Monoxide',
            icon: buildChannelIcon(coChannel.category),
            channel: coChannel,
            property: coChannel.detectedProp,
            isDetection: coChannel.detected,
            detectedLabel: 'Detected',
            notDetectedLabel: 'Clear',
            isAlert: coChannel.detected,
          ),
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
        icon: buildChannelIcon(leakChannel.category),
        valueThemeColor: SensorColors.alert,
        isWarning: isLeaking,
        sensorData: SensorData(
          label: 'Leak',
          icon: buildChannelIcon(leakChannel.category),
          channel: leakChannel,
          property: leakChannel.detectedProp,
          isDetection: leakChannel.detected,
          detectedLabel: 'Detected',
          notDetectedLabel: 'Not Detected',
          isAlert: leakChannel.detected,
        ),
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
          icon: buildChannelIcon(pmChannel.category),
          valueThemeColor: SensorColors.airQuality,
          sensorData: SensorData(
            label: 'Particulate Matter',
            icon: buildChannelIcon(pmChannel.category),
            channel: pmChannel,
            property: pmChannel.concentrationProp,
            valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
          ),
        ));
      } else if (pmChannel.hasDetected) {
        final isDetected = pmChannel.detected;
        sensors.add(_SensorInfo(
          id: 'pm',
          label: AirQualityUtils.getParticulateLabel(localizations, pmMode),
          value: isDetected
              ? localizations.air_quality_unhealthy
              : localizations.air_quality_healthy,
          icon: buildChannelIcon(pmChannel.category),
          valueThemeColor: SensorColors.airQuality,
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
          icon: buildChannelIcon(vocChannel.category),
          valueThemeColor: SensorColors.airQuality,
        ));
      } else if (vocChannel.hasConcentration) {
        sensors.add(_SensorInfo(
          id: 'voc',
          label: localizations.device_voc,
          value: AirQualityUtils.calculateVocLevelFromConcentration(localizations, vocChannel.concentration),
          icon: buildChannelIcon(vocChannel.category),
          valueThemeColor: SensorColors.airQuality,
        ));
      } else if (vocChannel.hasDetected) {
        final isDetected = vocChannel.detected;
        sensors.add(_SensorInfo(
          id: 'voc',
          label: localizations.device_voc,
          value: isDetected
              ? localizations.air_quality_unhealthy
              : localizations.air_quality_healthy,
          icon: buildChannelIcon(vocChannel.category),
          valueThemeColor: SensorColors.airQuality,
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
        icon: buildChannelIcon(co2Channel.category),
        valueThemeColor: SensorColors.co2,
        isWarning: co2Channel.concentration > 1000, // Warn if CO₂ exceeds 1000 ppm
        sensorData: SensorData(
          label: 'Carbon Dioxide',
          icon: buildChannelIcon(co2Channel.category),
          channel: co2Channel,
          property: co2Channel.concentrationProp,
          valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        ),
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
          icon: buildChannelIcon(o3Channel.category),
          valueThemeColor: SensorColors.airQuality,
        ));
      } else if (o3Channel.hasConcentration) {
        sensors.add(_SensorInfo(
          id: 'o3',
          label: localizations.device_o3,
          value: NumberFormatUtils.defaultFormat.formatInteger(o3Channel.concentration.toInt()),
          unit: 'µg/m³',
          icon: buildChannelIcon(o3Channel.category),
          valueThemeColor: SensorColors.airQuality,
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
          icon: buildChannelIcon(o3Channel.category),
          valueThemeColor: SensorColors.airQuality,
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
          icon: buildChannelIcon(no2Channel.category),
          valueThemeColor: SensorColors.airQuality,
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
          icon: buildChannelIcon(no2Channel.category),
          valueThemeColor: SensorColors.airQuality,
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
          icon: buildChannelIcon(so2Channel.category),
          valueThemeColor: SensorColors.airQuality,
        ));
      } else if (so2Channel.hasConcentration) {
        sensors.add(_SensorInfo(
          id: 'so2',
          label: localizations.device_so2,
          value: NumberFormatUtils.defaultFormat.formatInteger(so2Channel.concentration.toInt()),
          unit: 'µg/m³',
          icon: buildChannelIcon(so2Channel.category),
          valueThemeColor: SensorColors.airQuality,
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
          icon: buildChannelIcon(so2Channel.category),
          valueThemeColor: SensorColors.airQuality,
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
          icon: buildChannelIcon(filterChannel.category),
          valueThemeColor: SensorColors.filter,
          isWarning: _filterLife < 0.3 || _device.isFilterNeedsReplacement,
        ));
      } else if (filterChannel.hasStatus) {
        sensors.add(_SensorInfo(
          id: 'filter',
          label: localizations.device_filter_status,
          value: FilterUtils.getStatusLabel(localizations, filterChannel.status),
          icon: buildChannelIcon(filterChannel.category),
          valueThemeColor: SensorColors.filter,
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
        icon: buildChannelIcon(tempChannel.category),
        valueThemeColor: SensorColors.temperature,
        sensorData: SensorData(
          label: 'Temperature',
          icon: buildChannelIcon(tempChannel.category),
          channel: tempChannel,
          property: tempChannel.temperatureProp,
          valueFormatter: (prop) => ValueUtils.formatValue(prop, 1),
        ),
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
        icon: buildChannelIcon(humidityChannel.category),
        valueThemeColor: SensorColors.humidity,
        sensorData: SensorData(
          label: 'Humidity',
          icon: buildChannelIcon(humidityChannel.category),
          channel: humidityChannel,
          property: humidityChannel.humidityProp,
          valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        ),
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
        icon: buildChannelIcon(pressureChannel.category),
        valueThemeColor: SensorColors.pressure,
        sensorData: SensorData(
          label: 'Pressure',
          icon: buildChannelIcon(pressureChannel.category),
          channel: pressureChannel,
          property: pressureChannel.pressureProp,
          valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        ),
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
            iconAccentColor: sensor.valueThemeColor ?? _getStatusColor(),
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
            iconAccentColor: sensor.valueThemeColor ?? _getStatusColor(),
            showWarningBadge: sensor.isWarning,
            onTileTap: sensorTapCallback(sensor),
          );
        }).toList(),
      );
    }

    // Landscape small/medium: Column with HorizontalTileStretched
    return Column(
      spacing: AppSpacings.pMd,
      children: sensors.asMap().entries.map((entry) {
        final sensor = entry.value;

        return HorizontalTileStretched(
          icon: sensor.icon,
          name: sensor.displayValue,
          status: sensor.label,
          iconAccentColor: sensor.valueThemeColor ?? _getStatusColor(),
          showWarningBadge: sensor.isWarning,
          onTileTap: sensorTapCallback(sensor),
        );
      }).toList(),
    );
  }

  // --------------------------------------------------------------------------
  // FAN OPTIONS SECTION
  // --------------------------------------------------------------------------

  /// Builds the fan options controls (oscillation, direction, natural breeze, child lock, timer).
  Widget _buildFanOptionsSection(
    BuildContext context,
    AppLocalizations localizations,
    bool isDark,
    Color activeColor,
    bool useVerticalLayout,
  ) {
    final fanChannel = _device.fanChannel;
    final tileHeight = _scale(AppTileHeight.horizontal);
    final statusColor = _getStatusColor();

    // Helper to wrap control with fixed height
    Widget wrapControl(Widget child) {
      return SizedBox(
        height: tileHeight,
        width: double.infinity,
        child: child,
      );
    }

    final options = <Widget>[];

    void addOption(Widget child) {
      if (options.isNotEmpty) {
        options.add(AppSpacings.spacingMdVertical);
      }
      options.add(child);
    }

    // Oscillation / Swing
    if (fanChannel.hasSwing) {
      addOption(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.syncIcon,
        name: localizations.device_oscillation,
        status: fanChannel.swing
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.swing,
        activeColor: statusColor,
        onTileTap: () => _setFanSwing(!fanChannel.swing),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
    }

    // Direction (reverse)
    if (fanChannel.hasDirection) {
      final isReversed =
          fanChannel.direction == FanDirectionValue.counterClockwise;
      addOption(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.swapVertical,
        name: localizations.device_direction,
        status: fanChannel.direction != null
            ? FanUtils.getDirectionLabel(localizations, fanChannel.direction!)
            : localizations.fan_direction_clockwise,
        isActive: isReversed,
        activeColor: statusColor,
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
      addOption(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.weatherWindy,
        name: localizations.device_natural_breeze,
        status: fanChannel.naturalBreeze
            ? localizations.on_state_on
            : localizations.on_state_off,
        isActive: fanChannel.naturalBreeze,
        activeColor: statusColor,
        onTileTap: () => _setFanNaturalBreeze(!fanChannel.naturalBreeze),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
    }

    // Child Lock
    if (fanChannel.hasLocked) {
      addOption(wrapControl(UniversalTile(
        layout: TileLayout.horizontal,
        icon: MdiIcons.lock,
        name: localizations.device_child_lock,
        status: _childLock
            ? localizations.thermostat_lock_locked
            : localizations.thermostat_lock_unlocked,
        isActive: _childLock,
        activeColor: statusColor,
        onTileTap: () => _setFanLocked(!_childLock),
        showGlow: false,
        showDoubleBorder: false,
        showInactiveBorder: _screenService.isLandscape,
      )));
    }

    // Timer
    if (fanChannel.hasTimer) {
      addOption(_buildTimerControl(
          localizations, activeColor, useVerticalLayout, tileHeight));
    }

    if (options.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: options,
    );
  }

  /// Builds the controls section for landscape (speed first, then options).
  Widget _buildLandscapeControlsSection(
    BuildContext context,
    AppLocalizations localizations,
    bool isDark,
    Color activeColor,
  ) {
    final fanChannel = _device.fanChannel;
    final useVerticalLayout =
        _screenService.isSmallScreen || _screenService.isMediumScreen;
    final tileHeight = _scale(AppTileHeight.horizontal);

    final children = <Widget>[];

    if (fanChannel.hasSpeed) {
      children.add(_buildSpeedControl(
          localizations, isDark, activeColor, useVerticalLayout, tileHeight));
      children.add(AppSpacings.spacingMdVertical);
    }

    final optionsSection = _buildFanOptionsSection(
        context, localizations, isDark, activeColor, useVerticalLayout);
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
