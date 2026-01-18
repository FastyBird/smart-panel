import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/info_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/speed_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/air_quality_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/fan_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/filter_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_purifier.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class PurifierDeviceState {
  final bool isOn;
  final FanModeValue? mode;
  final double speed;
  final int aqi;
  final AirQualityLevelValue? aqiLevel;
  final bool hasAqiData;
  final int pm25;
  final double filterLife;
  final bool childLock;

  const PurifierDeviceState({
    this.isOn = false,
    this.mode,
    this.speed = 0.0,
    this.aqi = 0,
    this.aqiLevel,
    this.hasAqiData = false,
    this.pm25 = 0,
    this.filterLife = 1.0,
    this.childLock = false,
  });
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
      if (mounted) setState(() {});
    });
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

  Future<void> _setPropertyValue(
    ChannelPropertyView? property,
    dynamic value,
  ) async {
    if (property == null) return;

    final localizations = AppLocalizations.of(context);

    try {
      bool res = await _devicesService.setPropertyValue(
        property.id,
        value,
      );

      if (!res && mounted && localizations != null) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (localizations != null) {
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }
    }
  }

  // Computed state from device data
  PurifierDeviceState get _state {
    final fanChannel = _device.fanChannel;
    final pmChannel = _device.airParticulateChannel;

    // Normalize speed from device range to 0-1
    // Check for pending state first (optimistic UI)
    double normalizedSpeed = 0.0;
    if (fanChannel.hasSpeed && fanChannel.isSpeedNumeric) {
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
      if (range > 0) {
        normalizedSpeed = (actualSpeed - fanChannel.minSpeed) / range;
      }
    }

    // Get AQI - prefer air quality channel, fall back to air particulate
    int pm = 0;
    int aqi = 0;
    AirQualityLevelValue? aqiLevel;
    bool hasAqiData = false;
    final aqChannel = _device.airQualityChannel;

    if (aqChannel != null && (aqChannel.hasLevel || aqChannel.hasAqi)) {
      // Use air quality channel
      hasAqiData = true;

      // Use level for the label
      if (aqChannel.hasLevel) {
        aqiLevel = aqChannel.level;
        // If no AQI value, calculate from level
        if (!aqChannel.hasAqi) {
          aqi = AirQualityUtils.calculateAqiFromLevel(aqChannel.level);
        }
      }

      // Use AQI value for bar position if available
      if (aqChannel.hasAqi) {
        aqi = aqChannel.aqi;
      }

      // Still get PM value if available for display
      if (pmChannel != null && pmChannel.hasDensity) {
        pm = pmChannel.density.toInt();
      }
    } else if (pmChannel != null && pmChannel.hasDensity) {
      // Fallback to air particulate - calculate AQI from PM density
      hasAqiData = true;
      pm = pmChannel.density.toInt();
      aqi = AirQualityUtils.calculateAqi(pmChannel.density, pmChannel.mode);
    }

    // Get filter life from filter channel
    double filterLife = 1.0;
    if (_device.hasFilter) {
      filterLife = _device.filterLifeRemaining / 100.0;
    }

    return PurifierDeviceState(
      isOn: _device.isOn,
      mode: fanChannel.hasMode ? fanChannel.mode : null,
      speed: normalizedSpeed,
      aqi: aqi,
      aqiLevel: aqiLevel,
      hasAqiData: hasAqiData,
      pm25: pm,
      filterLife: filterLife,
      childLock: fanChannel.hasLocked ? fanChannel.locked : false,
    );
  }

  void _setSpeedValue(double normalizedSpeed) {
    final fanChannel = _device.fanChannel;
    final speedProp = fanChannel.speedProp;
    if (!fanChannel.hasSpeed || !fanChannel.isSpeedNumeric || speedProp == null) return;

    // Convert normalized 0-1 value to actual device speed range
    final range = fanChannel.maxSpeed - fanChannel.minSpeed;
    final rawSpeed = fanChannel.minSpeed + (normalizedSpeed * range);

    // Round to step value
    final step = fanChannel.speedStep;
    final steppedSpeed = (rawSpeed / step).round() * step;

    // Clamp to valid range
    final actualSpeed = steppedSpeed.clamp(fanChannel.minSpeed, fanChannel.maxSpeed);

    // Set PENDING state immediately for responsive UI
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
    _speedDebounceTimer = Timer(_speedDebounceDuration, () async {
      if (!mounted) return;

      await _setPropertyValue(speedProp, actualSpeed);

      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          speedProp.id,
        );
      }
    });
  }

  void _setSpeedLevel(FanSpeedLevelValue level) {
    final fanChannel = _device.fanChannel;
    if (!fanChannel.hasSpeed || !fanChannel.isSpeedEnum) return;
    _setPropertyValue(fanChannel.speedProp, level.value);
  }

  Widget _buildSpeedControl(
    AppLocalizations localizations,
    bool isDark,
    Color airColor,
    bool useVerticalLayout,
  ) {
    final fanChannel = _device.fanChannel;
    final isEnabled = _state.isOn;

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

      return ValueSelectorRow<FanSpeedLevelValue>(
        currentValue: fanChannel.speedLevel,
        label: 'Fan Speed',
        icon: Icons.speed,
        sheetTitle: 'Fan Speed',
        activeColor: airColor,
        options: options,
        displayFormatter: (level) => level != null
            ? FanUtils.getSpeedLevelLabel(localizations, level)
            : localizations.fan_speed_off,
        isActiveValue: (level) => level != null && level != FanSpeedLevelValue.off,
        columns: availableLevels.length > 4 ? 3 : availableLevels.length,
        layout: useVerticalLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: isEnabled ? (level) {
          if (level != null) _setSpeedLevel(level);
        } : null,
      );
    } else {
      // Numeric speed (0-100%)
      if (useVerticalLayout) {
        return ValueSelectorRow<double>(
          currentValue: _state.speed,
          label: 'Fan Speed',
          icon: Icons.speed,
          sheetTitle: 'Fan Speed',
          activeColor: airColor,
          options: _getSpeedOptions(localizations),
          displayFormatter: (v) => _formatSpeed(localizations, v),
          isActiveValue: (v) => v != null && v > 0,
          columns: 4,
          layout: ValueSelectorRowLayout.compact,
          onChanged: isEnabled ? (v) => _setSpeedValue(v ?? 0) : null,
        );
      } else {
        return SpeedSlider(
          value: _state.speed,
          activeColor: airColor,
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
    if (_state.aqiLevel != null) {
      return AirQualityUtils.getAirQualityLevelLabel(localizations, _state.aqiLevel);
    }
    return AirQualityUtils.getAqiLabel(localizations, _state.aqi);
  }

  String _getModeLabel(AppLocalizations localizations) {
    if (_state.mode == null) return localizations.air_quality_level_unknown;
    return FanUtils.getModeLabel(localizations, _state.mode!);
  }

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
                      ? _buildLandscape(context, isDark)
                      : _buildPortrait(context, isDark);
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
    final airColor = DeviceColors.air(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: _device.name,
      subtitle: _state.isOn
          ? '${_getModeLabel(localizations)} • ${_getAqiLabel(localizations)}'
          : localizations.on_state_off,
      subtitleColor: _state.isOn ? airColor : secondaryColor,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: widget.onBack,
          ),
          AppSpacings.spacingMdHorizontal,
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: _state.isOn
                  ? DeviceColors.airLight9(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              Icons.air,
              color: _state.isOn ? airColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscape(BuildContext context, bool isDark) {
    final airColor = DeviceColors.air(isDark);
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final isLargeScreen = _screenService.isLargeScreen;

    // Large screen: control card only in left column
    if (isLargeScreen) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 1,
            child: Padding(
              padding: AppSpacings.paddingLg,
              child: _buildControlCard(context, isDark, airColor),
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
                    _buildStatus(context, isDark),
                  ],
                ),
              ),
            ),
          ),
        ],
      );
    }

    // Small/medium: compact layout with stretch (like climate domain)
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: 2,
          child: Padding(
            padding: AppSpacings.paddingLg,
            child: _buildCompactControlCard(context, isDark, airColor),
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
                  _buildStatus(context, isDark),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPortrait(BuildContext context, bool isDark) {
    final airColor = DeviceColors.air(isDark);

    return SingleChildScrollView(
      padding: AppSpacings.paddingMd,
      child: Column(
        children: [
          _buildControlCard(context, isDark, airColor),
          AppSpacings.spacingMdVertical,
          _buildStatus(context, isDark),
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
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        children: [
          DevicePowerButton(
            isOn: _state.isOn,
            activeColor: airColor,
            activeBgColor: DeviceColors.airLight9(isDark),
            glowColor: DeviceColors.airLight5(isDark),
            showInfoText: false,
            onTap: () => _setPropertyValue(
              _device.fanChannel.onProp,
              !_state.isOn,
            ),
          ),
          if (_state.hasAqiData) ...[
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

    // Use current mode or fall back to first available mode
    final selectedMode = _state.mode ?? availableModes.first;

    return ModeSelector<FanModeValue>(
      modes: _getFanModeOptions(localizations),
      selectedValue: selectedMode,
      onChanged: (mode) => _setPropertyValue(fanChannel.modeProp, mode.value),
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
  ) {
    final fanChannel = _device.fanChannel;

    if (fanChannel.isTimerEnum) {
      // Enum-based timer (off, 30m, 1h, 2h, etc.)
      final options = _getTimerPresetOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return ValueSelectorRow<FanTimerPresetValue?>(
        currentValue: fanChannel.timerPreset,
        label: 'Timer',
        icon: Icons.timer_outlined,
        sheetTitle: 'Auto-Off Timer',
        activeColor: airColor,
        options: options,
        displayFormatter: (p) => _formatTimerPreset(localizations, p),
        isActiveValue: (preset) =>
            preset != null && preset != FanTimerPresetValue.off,
        columns: options.length > 4 ? 4 : options.length,
        layout: useVerticalLayout
            ? ValueSelectorRowLayout.compact
            : ValueSelectorRowLayout.horizontal,
        onChanged: (preset) {
          if (preset != null) {
            _setPropertyValue(fanChannel.timerProp, preset.value);
          }
        },
      );
    } else {
      // Numeric timer (minutes)
      final options = _getNumericTimerOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return ValueSelectorRow<int>(
        currentValue: fanChannel.timer,
        label: 'Timer',
        icon: Icons.timer_outlined,
        sheetTitle: 'Auto-Off Timer',
        activeColor: airColor,
        options: options,
        displayFormatter: (m) => _formatNumericTimer(localizations, m),
        isActiveValue: (minutes) => minutes != null && minutes > 0,
        columns: options.length > 4 ? 4 : options.length,
        layout: useVerticalLayout
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
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
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
                isOn: _state.isOn,
                activeColor: airColor,
                activeBgColor: DeviceColors.airLight9(isDark),
                glowColor: DeviceColors.airLight5(isDark),
                showInfoText: false,
                size: buttonSize,
                onTap: () => _setPropertyValue(
                  _device.fanChannel.onProp,
                  !_state.isOn,
                ),
              ),
              if (_device.fanChannel.hasMode &&
                  _device.fanChannel.availableModes.isNotEmpty) ...[
                AppSpacings.spacingXlHorizontal,
                ModeSelector<FanModeValue>(
                  modes: _getFanModeOptions(localizations),
                  selectedValue: _state.mode ?? _device.fanChannel.availableModes.first,
                  onChanged: (mode) => _setPropertyValue(
                    _device.fanChannel.modeProp,
                    mode.value,
                  ),
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
      if (_state.aqi < 50) return DeviceColors.air(isDark);
      if (_state.aqi < 100) {
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
              'Air Quality Index',
              style: TextStyle(
                color: secondaryColor,
                fontSize: AppFontSize.small,
              ),
            ),
            Text(
              '${_getAqiLabel(localizations)} (${_state.aqi})',
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
                  (_state.aqi / 200).clamp(0.0, 1.0) * constraints.maxWidth;
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

  /// Builds sensor tiles in a grid layout with max 3 tiles per row.
  Widget _buildSensorTilesGrid(List<Widget> tiles) {
    const int tilesPerRow = 3;
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

  Widget _buildStatus(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final airColor = DeviceColors.air(isDark);
    final useVerticalLayout = _screenService.isLandscape &&
        (_screenService.isSmallScreen || _screenService.isMediumScreen);

    // Build info tiles dynamically based on available channels
    final infoTiles = <Widget>[];

    // PM tile - only show if air particulate channel exists and has density
    final pmChannel = _device.airParticulateChannel;
    if (pmChannel != null && pmChannel.hasDensity) {
      infoTiles.add(InfoTile(
        label: AirQualityUtils.getParticulateLabel(localizations, pmChannel.mode),
        value: '${_state.pm25}',
        unit: 'µg/m³',
        valueColor: airColor,
      ));
    }

    // VOC tile - show level (from property or calculated from density)
    final vocChannel = _device.volatileOrganicCompoundsChannel;
    if (vocChannel != null && (vocChannel.hasLevel || vocChannel.hasDensity)) {
      String vocLabel;
      if (vocChannel.hasLevel) {
        vocLabel = AirQualityUtils.getVocLevelLabel(localizations, vocChannel.level);
      } else {
        vocLabel = AirQualityUtils.calculateVocLevelFromDensity(localizations, vocChannel.density);
      }
      infoTiles.add(InfoTile(
        label: 'VOC',
        value: vocLabel,
        valueColor: airColor,
      ));
    }

    // Filter tile - show life remaining or status
    final filterChannel = _device.filterChannel;
    if (filterChannel != null) {
      if (filterChannel.hasLifeRemaining) {
        // Show life remaining percentage
        infoTiles.add(InfoTile(
          label: 'Filter Life',
          value: '${(_state.filterLife * 100).toInt()}',
          unit: '%',
          isWarning: _state.filterLife < 0.3 || _device.isFilterNeedsReplacement,
        ));
      } else if (filterChannel.hasStatus) {
        // Show status if no life remaining property
        infoTiles.add(InfoTile(
          label: 'Filter',
          value: FilterUtils.getStatusLabel(localizations, filterChannel.status),
          isWarning: _device.isFilterNeedsReplacement,
        ));
      }
    }

    // Temperature tile - only show if temperature channel exists
    final tempChannel = _device.temperatureChannel;
    if (tempChannel != null && tempChannel.hasTemperature) {
      infoTiles.add(InfoTile(
        label: 'Temp',
        value: NumberFormatUtils.defaultFormat.formatDecimal(
          tempChannel.temperature,
          decimalPlaces: 1,
        ),
        unit: '°C',
        valueColor: airColor,
      ));
    }

    // Humidity tile - only show if humidity channel exists
    final humidityChannel = _device.humidityChannel;
    if (humidityChannel != null) {
      infoTiles.add(InfoTile(
        label: 'Humidity',
        value: '${humidityChannel.humidity}',
        unit: '%',
        valueColor: airColor,
      ));
    }

    // CO₂ tile - only show if carbon dioxide channel exists and has density
    final co2Channel = _device.carbonDioxideChannel;
    if (co2Channel != null && co2Channel.hasDensity) {
      infoTiles.add(InfoTile(
        label: 'CO₂',
        value: NumberFormatUtils.defaultFormat.formatInteger(co2Channel.density.toInt()),
        unit: 'ppm',
        valueColor: airColor,
        isWarning: co2Channel.density > 1000, // Warn if CO₂ exceeds 1000 ppm
      ));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (infoTiles.isNotEmpty) ...[
          if (useVerticalLayout)
            ...infoTiles
                .expand((tile) => [
                      SizedBox(width: double.infinity, child: tile),
                      AppSpacings.spacingSmVertical,
                    ])
                .take(infoTiles.length * 2 - 1)
          else
            _buildSensorTilesGrid(infoTiles),
          AppSpacings.spacingMdVertical,
        ],
        // Speed control - only show if fan has speed property
        if (_device.fanChannel.hasSpeed) ...[
          _buildSpeedControl(localizations, isDark, airColor, useVerticalLayout),
          AppSpacings.spacingMdVertical,
        ],
        // Child Lock tile - only show if fan has locked property
        if (_device.fanChannel.hasLocked) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.lock,
            name: 'Child Lock',
            status: _state.childLock
                ? localizations.thermostat_lock_locked
                : localizations.thermostat_lock_unlocked,
            isActive: _state.childLock,
            activeColor: airColor,
            onTileTap: () => _setPropertyValue(
              _device.fanChannel.lockedProp,
              !_state.childLock,
            ),
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
        // Timer - only show if fan has timer property
        if (_device.fanChannel.hasTimer)
          _buildTimerControl(localizations, airColor, useVerticalLayout),
      ],
    );
  }
}
