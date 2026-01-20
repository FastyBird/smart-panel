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
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

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
    if (mounted) {
      setState(() {});
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
        (pmChannel != null && pmChannel.hasDensity);
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
    } else if (pmChannel != null && pmChannel.hasDensity) {
      final mode = pmChannel.hasMode ? pmChannel.mode : AirParticulateModeValue.pm25;
      return AirQualityUtils.calculateAqi(pmChannel.density, mode);
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
    if (pmChannel != null && pmChannel.hasDensity) {
      return pmChannel.density.toInt();
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
    final fanChannel = _device.fanChannel;
    final speedProp = fanChannel.speedProp;
    if (!fanChannel.hasSpeed || !fanChannel.isSpeedNumeric || speedProp == null) return;

    // Convert normalized 0-1 value to actual device speed range
    final range = fanChannel.maxSpeed - fanChannel.minSpeed;
    if (range <= 0) return;
    final rawSpeed = fanChannel.minSpeed + (normalizedSpeed * range);

    // Round to step value (guard against division by zero)
    final step = fanChannel.speedStep;
    final steppedSpeed = step > 0 ? (rawSpeed / step).round() * step : rawSpeed;

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
    final speedProp = fanChannel.speedProp;
    if (!fanChannel.hasSpeed || !fanChannel.isSpeedEnum || speedProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      speedProp.id,
      level.value,
    );
    setState(() {});

    _setPropertyValue(speedProp, level.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          speedProp.id,
        );
      }
    });
  }

  void _setFanPower(bool value) {
    final fanChannel = _device.fanChannel;
    final onProp = fanChannel.onProp;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      onProp.id,
      value,
    );
    setState(() {});

    _setPropertyValue(onProp, value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          onProp.id,
        );
      }
    });
  }

  void _setFanMode(FanModeValue mode) {
    final fanChannel = _device.fanChannel;
    final modeProp = fanChannel.modeProp;
    if (!fanChannel.hasMode || modeProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      modeProp.id,
      mode.value,
    );
    setState(() {});

    _setPropertyValue(modeProp, mode.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          modeProp.id,
        );
      }
    });
  }

  void _setFanSwing(bool value) {
    final fanChannel = _device.fanChannel;
    final swingProp = fanChannel.swingProp;
    if (!fanChannel.hasSwing || swingProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      swingProp.id,
      value,
    );
    setState(() {});

    _setPropertyValue(swingProp, value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          swingProp.id,
        );
      }
    });
  }

  void _setFanDirection(FanDirectionValue direction) {
    final fanChannel = _device.fanChannel;
    final directionProp = fanChannel.directionProp;
    if (!fanChannel.hasDirection || directionProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      directionProp.id,
      direction.value,
    );
    setState(() {});

    _setPropertyValue(directionProp, direction.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          directionProp.id,
        );
      }
    });
  }

  void _setFanNaturalBreeze(bool value) {
    final fanChannel = _device.fanChannel;
    final naturalBreezeProp = fanChannel.naturalBreezeProp;
    if (!fanChannel.hasNaturalBreeze || naturalBreezeProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      naturalBreezeProp.id,
      value,
    );
    setState(() {});

    _setPropertyValue(naturalBreezeProp, value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          naturalBreezeProp.id,
        );
      }
    });
  }

  void _setFanLocked(bool value) {
    final fanChannel = _device.fanChannel;
    final lockedProp = fanChannel.lockedProp;
    if (!fanChannel.hasLocked || lockedProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      lockedProp.id,
      value,
    );
    setState(() {});

    _setPropertyValue(lockedProp, value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          lockedProp.id,
        );
      }
    });
  }

  void _setFanTimerPreset(FanTimerPresetValue preset) {
    final fanChannel = _device.fanChannel;
    final timerProp = fanChannel.timerProp;
    if (!fanChannel.hasTimer || timerProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      timerProp.id,
      preset.value,
    );
    setState(() {});

    _setPropertyValue(timerProp, preset.value).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          timerProp.id,
        );
      }
    });
  }

  void _setFanTimerNumeric(int minutes) {
    final fanChannel = _device.fanChannel;
    final timerProp = fanChannel.timerProp;
    if (!fanChannel.hasTimer || timerProp == null) return;

    _deviceControlStateService?.setPending(
      _device.id,
      fanChannel.id,
      timerProp.id,
      minutes,
    );
    setState(() {});

    _setPropertyValue(timerProp, minutes).then((_) {
      if (mounted) {
        _deviceControlStateService?.setSettling(
          _device.id,
          fanChannel.id,
          timerProp.id,
        );
      }
    });
  }

  Widget _buildSpeedControl(
    AppLocalizations localizations,
    bool isDark,
    Color airColor,
    bool useVerticalLayout,
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

      return ValueSelectorRow<FanSpeedLevelValue>(
        currentValue: fanChannel.speedLevel,
        label: localizations.device_fan_speed,
        icon: Icons.speed,
        sheetTitle: localizations.device_fan_speed,
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
          currentValue: _normalizedSpeed,
          label: localizations.device_fan_speed,
          icon: Icons.speed,
          sheetTitle: localizations.device_fan_speed,
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
          value: _normalizedSpeed,
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
      subtitle: _device.isOn
          ? '${_getModeLabel(localizations)} • ${_getAqiLabel(localizations)}'
          : localizations.on_state_off,
      subtitleColor: _device.isOn ? airColor : secondaryColor,
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
              color: _device.isOn
                  ? DeviceColors.airLight9(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              Icons.air,
              color: _device.isOn ? airColor : mutedColor,
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
  ) {
    final fanChannel = _device.fanChannel;

    if (fanChannel.isTimerEnum) {
      // Enum-based timer (off, 30m, 1h, 2h, etc.)
      final options = _getTimerPresetOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return ValueSelectorRow<FanTimerPresetValue?>(
        currentValue: fanChannel.timerPreset,
        label: localizations.device_timer,
        icon: Icons.timer_outlined,
        sheetTitle: localizations.device_auto_off_timer,
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
            _setFanTimerPreset(preset);
          }
        },
      );
    } else {
      // Numeric timer (minutes)
      final options = _getNumericTimerOptions(localizations);
      if (options.isEmpty) return const SizedBox.shrink();

      return ValueSelectorRow<int>(
        currentValue: fanChannel.timer,
        label: localizations.device_timer,
        icon: Icons.timer_outlined,
        sheetTitle: localizations.device_auto_off_timer,
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
            _setFanTimerNumeric(minutes);
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
    // Ordered by priority: safety-critical > primary air quality > secondary gases > maintenance > environmental
    final infoTiles = <Widget>[];

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 1: SAFETY-CRITICAL (life-threatening)
    // ═══════════════════════════════════════════════════════════════════════

    // CO tile - carbon monoxide (can be lethal, highest priority)
    final coChannel = _device.carbonMonoxideChannel;
    if (coChannel != null) {
      if (coChannel.hasDensity) {
        infoTiles.add(InfoTile(
          label: localizations.device_co,
          value: NumberFormatUtils.defaultFormat.formatDecimal(coChannel.density, decimalPlaces: 1),
          unit: 'ppm',
          valueColor: airColor,
          isWarning: coChannel.density > 35, // Warn if CO exceeds 35 ppm (EPA 1-hour limit)
        ));
      } else if (coChannel.hasDetected) {
        final isDetected = coChannel.detected;
        infoTiles.add(InfoTile(
          label: localizations.device_co,
          value: isDetected
              ? localizations.gas_detected
              : localizations.gas_clear,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // Leak sensor tile - water damage prevention
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

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 2: PRIMARY AIR QUALITY INDICATORS
    // ═══════════════════════════════════════════════════════════════════════

    // PM tile - particulate matter (main AQI component)
    final pmChannel = _device.airParticulateChannel;
    if (pmChannel != null) {
      final pmMode = pmChannel.hasMode ? pmChannel.mode : AirParticulateModeValue.pm25;
      if (pmChannel.hasDensity) {
        infoTiles.add(InfoTile(
          label: AirQualityUtils.getParticulateLabel(localizations, pmMode),
          value: NumberFormatUtils.defaultFormat.formatInteger(_pm25),
          unit: 'µg/m³',
          valueColor: airColor,
        ));
      } else if (pmChannel.hasDetected) {
        final isDetected = pmChannel.detected;
        infoTiles.add(InfoTile(
          label: AirQualityUtils.getParticulateLabel(localizations, pmMode),
          value: isDetected
              ? localizations.air_quality_unhealthy
              : localizations.air_quality_healthy,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // VOC tile - volatile organic compounds
    final vocChannel = _device.volatileOrganicCompoundsChannel;
    if (vocChannel != null) {
      if (vocChannel.hasLevel && vocChannel.level != null) {
        infoTiles.add(InfoTile(
          label: localizations.device_voc,
          value: AirQualityUtils.getVocLevelLabel(localizations, vocChannel.level),
          valueColor: airColor,
        ));
      } else if (vocChannel.hasDensity) {
        infoTiles.add(InfoTile(
          label: localizations.device_voc,
          value: AirQualityUtils.calculateVocLevelFromDensity(localizations, vocChannel.density),
          valueColor: airColor,
        ));
      } else if (vocChannel.hasDetected) {
        final isDetected = vocChannel.detected;
        infoTiles.add(InfoTile(
          label: localizations.device_voc,
          value: isDetected
              ? localizations.air_quality_unhealthy
              : localizations.air_quality_healthy,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // CO₂ tile - carbon dioxide (indoor air quality indicator)
    final co2Channel = _device.carbonDioxideChannel;
    if (co2Channel != null && co2Channel.hasDensity) {
      infoTiles.add(InfoTile(
        label: localizations.device_co2,
        value: NumberFormatUtils.defaultFormat.formatInteger(co2Channel.density.toInt()),
        unit: 'ppm',
        valueColor: airColor,
        isWarning: co2Channel.density > 1000, // Warn if CO₂ exceeds 1000 ppm
      ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRIORITY 3: SECONDARY GASES / POLLUTANTS
    // ═══════════════════════════════════════════════════════════════════════

    // O₃ tile - ozone
    final o3Channel = _device.ozoneChannel;
    if (o3Channel != null) {
      if (o3Channel.hasLevel && o3Channel.level != null) {
        infoTiles.add(InfoTile(
          label: localizations.device_o3,
          value: AirQualityUtils.getOzoneLevelLabel(localizations, o3Channel.level),
          valueColor: airColor,
        ));
      } else if (o3Channel.hasDensity) {
        infoTiles.add(InfoTile(
          label: localizations.device_o3,
          value: NumberFormatUtils.defaultFormat.formatInteger(o3Channel.density.toInt()),
          unit: 'µg/m³',
          valueColor: airColor,
          isWarning: o3Channel.density > 100, // Warn if exceeds WHO 8-hour limit
        ));
      } else if (o3Channel.hasDetected) {
        final isDetected = o3Channel.detected;
        infoTiles.add(InfoTile(
          label: localizations.device_o3,
          value: isDetected
              ? localizations.gas_detected
              : localizations.gas_clear,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // NO₂ tile - nitrogen dioxide
    final no2Channel = _device.nitrogenDioxideChannel;
    if (no2Channel != null) {
      if (no2Channel.hasDensity) {
        infoTiles.add(InfoTile(
          label: localizations.device_no2,
          value: NumberFormatUtils.defaultFormat.formatInteger(no2Channel.density.toInt()),
          unit: 'µg/m³',
          valueColor: airColor,
          isWarning: no2Channel.density > 200, // Warn if exceeds WHO 1-hour limit
        ));
      } else if (no2Channel.hasDetected) {
        final isDetected = no2Channel.detected;
        infoTiles.add(InfoTile(
          label: localizations.device_no2,
          value: isDetected
              ? localizations.gas_detected
              : localizations.gas_clear,
          valueColor: airColor,
          isWarning: isDetected,
        ));
      }
    }

    // SO₂ tile - sulphur dioxide
    final so2Channel = _device.sulphurDioxideChannel;
    if (so2Channel != null) {
      if (so2Channel.hasLevel && so2Channel.level != null) {
        infoTiles.add(InfoTile(
          label: localizations.device_so2,
          value: AirQualityUtils.getSulphurDioxideLevelLabel(localizations, so2Channel.level),
          valueColor: airColor,
        ));
      } else if (so2Channel.hasDensity) {
        infoTiles.add(InfoTile(
          label: localizations.device_so2,
          value: NumberFormatUtils.defaultFormat.formatInteger(so2Channel.density.toInt()),
          unit: 'µg/m³',
          valueColor: airColor,
          isWarning: so2Channel.density > 500, // Warn if exceeds WHO 10-min limit
        ));
      } else if (so2Channel.hasDetected) {
        final isDetected = so2Channel.detected;
        infoTiles.add(InfoTile(
          label: localizations.device_so2,
          value: isDetected
              ? localizations.gas_detected
              : localizations.gas_clear,
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
        infoTiles.add(InfoTile(
          label: localizations.device_filter_life,
          value: '${(_filterLife * 100).toInt()}',
          unit: '%',
          isWarning: _filterLife < 0.3 || _device.isFilterNeedsReplacement,
        ));
      } else if (filterChannel.hasStatus) {
        infoTiles.add(InfoTile(
          label: localizations.device_filter_status,
          value: FilterUtils.getStatusLabel(localizations, filterChannel.status),
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
      infoTiles.add(InfoTile(
        label: localizations.device_temperature,
        value: NumberFormatUtils.defaultFormat.formatDecimal(
          tempChannel.temperature,
          decimalPlaces: 1,
        ),
        unit: '°C',
        valueColor: airColor,
      ));
    }

    // Humidity tile
    final humidityChannel = _device.humidityChannel;
    if (humidityChannel != null) {
      infoTiles.add(InfoTile(
        label: localizations.device_humidity,
        value: NumberFormatUtils.defaultFormat.formatInteger(humidityChannel.humidity),
        unit: '%',
        valueColor: airColor,
      ));
    }

    // Pressure tile - atmospheric pressure
    final pressureChannel = _device.pressureChannel;
    if (pressureChannel != null) {
      infoTiles.add(InfoTile(
        label: localizations.device_pressure,
        value: NumberFormatUtils.defaultFormat.formatDecimal(pressureChannel.measured, decimalPlaces: 1),
        unit: 'kPa',
        valueColor: airColor,
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
        // Oscillation / Swing tile - only show if fan has swing property
        if (_device.fanChannel.hasSwing) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.sync,
            name: localizations.device_oscillation,
            status: _device.fanChannel.swing
                ? localizations.on_state_on
                : localizations.on_state_off,
            isActive: _device.fanChannel.swing,
            activeColor: airColor,
            onTileTap: () => _setFanSwing(!_device.fanChannel.swing),
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
        // Direction tile - only show if fan has direction property
        if (_device.fanChannel.hasDirection) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.swap_vert,
            name: localizations.device_direction,
            status: _device.fanChannel.direction != null
                ? FanUtils.getDirectionLabel(localizations, _device.fanChannel.direction!)
                : localizations.fan_direction_clockwise,
            isActive: _device.fanChannel.direction == FanDirectionValue.counterClockwise,
            activeColor: airColor,
            onTileTap: () {
              final isReversed = _device.fanChannel.direction == FanDirectionValue.counterClockwise;
              final newDirection = isReversed
                  ? FanDirectionValue.clockwise
                  : FanDirectionValue.counterClockwise;
              _setFanDirection(newDirection);
            },
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
        // Natural Breeze tile - only show if fan has natural breeze property
        if (_device.fanChannel.hasNaturalBreeze) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: MdiIcons.weatherWindy,
            name: localizations.device_natural_breeze,
            status: _device.fanChannel.naturalBreeze
                ? localizations.on_state_on
                : localizations.on_state_off,
            isActive: _device.fanChannel.naturalBreeze,
            activeColor: airColor,
            onTileTap: () => _setFanNaturalBreeze(!_device.fanChannel.naturalBreeze),
            showGlow: false,
            showDoubleBorder: false,
            showInactiveBorder: true,
          ),
          AppSpacings.spacingSmVertical,
        ],
        // Child Lock tile - only show if fan has locked property
        if (_device.fanChannel.hasLocked) ...[
          UniversalTile(
            layout: TileLayout.horizontal,
            icon: Icons.lock,
            name: localizations.device_child_lock,
            status: _childLock
                ? localizations.thermostat_lock_locked
                : localizations.thermostat_lock_unlocked,
            isActive: _childLock,
            activeColor: airColor,
            onTileTap: () => _setFanLocked(!_childLock),
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
