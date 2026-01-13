import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/info_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/speed_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:flutter/material.dart';

enum PurifierMode { auto, sleep, turbo, manual }

class PurifierDeviceState {
  final bool isOn;
  final PurifierMode mode;
  final double speed;
  final int aqi;
  final int pm25;
  final String vocLevel;
  final double filterLife;
  final bool childLock;
  final Duration? timer;

  const PurifierDeviceState({
    this.isOn = false,
    this.mode = PurifierMode.auto,
    this.speed = 0.45,
    this.aqi = 42,
    this.pm25 = 12,
    this.vocLevel = 'Good',
    this.filterLife = 0.78,
    this.childLock = false,
    this.timer,
  });

  PurifierDeviceState copyWith({
    bool? isOn,
    PurifierMode? mode,
    double? speed,
    int? aqi,
    int? pm25,
    String? vocLevel,
    double? filterLife,
    bool? childLock,
    Duration? timer,
  }) {
    return PurifierDeviceState(
      isOn: isOn ?? this.isOn,
      mode: mode ?? this.mode,
      speed: speed ?? this.speed,
      aqi: aqi ?? this.aqi,
      pm25: pm25 ?? this.pm25,
      vocLevel: vocLevel ?? this.vocLevel,
      filterLife: filterLife ?? this.filterLife,
      childLock: childLock ?? this.childLock,
      timer: timer ?? this.timer,
    );
  }

  String get aqiLabel {
    if (aqi < 50) return 'Good';
    if (aqi < 100) return 'Moderate';
    return 'Unhealthy';
  }
}

class AirPurifierDeviceDetail extends StatefulWidget {
  final String name;
  final PurifierDeviceState initialState;
  final VoidCallback? onBack;

  const AirPurifierDeviceDetail({
    super.key,
    required this.name,
    required this.initialState,
    this.onBack,
  });

  @override
  State<AirPurifierDeviceDetail> createState() =>
      _AirPurifierDeviceDetailState();
}

class _AirPurifierDeviceDetailState extends State<AirPurifierDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late PurifierDeviceState _state;

  @override
  void initState() {
    super.initState();
    _state = widget.initialState;
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

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
    final airColor = DeviceColors.air(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: widget.name,
      subtitle: _state.isOn
          ? '${_state.mode.name[0].toUpperCase()}${_state.mode.name.substring(1)} • ${_state.aqiLabel}'
          : 'Off',
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
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
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
                    _buildStatus(isDark),
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
                  _buildStatus(isDark),
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
          _buildStatus(isDark),
        ],
      ),
    );
  }

  Widget _buildControlCard(
      BuildContext context, bool isDark, Color airColor) {
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
            onTap: () =>
                setState(() => _state = _state.copyWith(isOn: !_state.isOn)),
          ),
          AppSpacings.spacingMdVertical,
          _buildAirQualityBar(context, isDark),
          AppSpacings.spacingLgVertical,
          _buildModeSelector(isDark, airColor),
        ],
      ),
    );
  }

  Widget _buildModeSelector(bool isDark, Color activeColor) {
    return ModeSelector<PurifierMode>(
      modes: _getPurifierModeOptions(),
      selectedValue: _state.mode,
      onChanged: (mode) => setState(() => _state = _state.copyWith(mode: mode)),
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: ModeSelectorColor.success,
      scrollable: true,
    );
  }

  List<ModeOption<PurifierMode>> _getPurifierModeOptions() {
    return [
      ModeOption(value: PurifierMode.auto, icon: Icons.auto_mode, label: 'Auto'),
      ModeOption(value: PurifierMode.sleep, icon: Icons.bedtime, label: 'Sleep'),
      ModeOption(value: PurifierMode.turbo, icon: Icons.bolt, label: 'Turbo'),
      ModeOption(value: PurifierMode.manual, icon: Icons.tune, label: 'Manual'),
    ];
  }

  List<ValueOption<Duration?>> _getTimerOptions() {
    return [
      ValueOption(value: null, label: 'Off'),
      ValueOption(value: const Duration(minutes: 30), label: '30m'),
      ValueOption(value: const Duration(hours: 1), label: '1h'),
      ValueOption(value: const Duration(hours: 2), label: '2h'),
      ValueOption(value: const Duration(hours: 4), label: '4h'),
      ValueOption(value: const Duration(hours: 6), label: '6h'),
      ValueOption(value: const Duration(hours: 8), label: '8h'),
      ValueOption(value: const Duration(hours: 12), label: '12h'),
    ];
  }

  List<ValueOption<double>> _getSpeedOptions() {
    return [
      ValueOption(value: 0.0, label: 'Silent'),
      ValueOption(value: 0.33, label: 'Low'),
      ValueOption(value: 0.66, label: 'Med'),
      ValueOption(value: 1.0, label: 'High'),
    ];
  }

  String _formatSpeed(double? speed) {
    if (speed == null || speed == 0) return 'Silent';
    if (speed <= 0.33) return 'Low';
    if (speed <= 0.66) return 'Med';
    return 'High';
  }

  String _formatDuration(Duration? d) {
    if (d == null) return 'Off';
    final hours = d.inHours;
    final minutes = d.inMinutes % 60;
    if (hours > 0 && minutes > 0) return '${hours}h ${minutes}m';
    if (hours > 0) return '${hours}h';
    return '${minutes}m';
  }

  /// Compact control card with vertical icon-only mode selector on the right
  Widget _buildCompactControlCard(
      BuildContext context, bool isDark, Color airColor) {
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
                onTap: () => setState(
                    () => _state = _state.copyWith(isOn: !_state.isOn)),
              ),
              AppSpacings.spacingXlHorizontal,
              ModeSelector<PurifierMode>(
                modes: _getPurifierModeOptions(),
                selectedValue: _state.mode,
                onChanged: (mode) =>
                    setState(() => _state = _state.copyWith(mode: mode)),
                orientation: ModeSelectorOrientation.vertical,
                showLabels: false,
                color: ModeSelectorColor.success,
                scrollable: true,
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildAirQualityBar(BuildContext context, bool isDark) {
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
              '${_state.aqiLabel} (${_state.aqi})',
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
            borderRadius: BorderRadius.circular(_scale(4)),
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
                      borderRadius: BorderRadius.circular(_scale(4)),
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
                        borderRadius: BorderRadius.circular(_scale(2)),
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

  Widget _buildStatus(bool isDark) {
    final airColor = DeviceColors.air(isDark);
    final useVerticalLayout = _screenService.isLandscape &&
        (_screenService.isSmallScreen || _screenService.isMediumScreen);

    final infoTiles = [
      InfoTile(
        label: 'PM2.5',
        value: '${_state.pm25}',
        unit: 'µg/m³',
        valueColor: airColor,
      ),
      InfoTile(
        label: 'VOC',
        value: _state.vocLevel,
        valueColor: airColor,
      ),
      InfoTile(
        label: 'Filter Life',
        value: '${(_state.filterLife * 100).toInt()}',
        unit: '%',
        isWarning: _state.filterLife < 0.3,
      ),
    ];

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
          Row(
            children: [
              Expanded(child: infoTiles[0]),
              AppSpacings.spacingSmHorizontal,
              Expanded(child: infoTiles[1]),
              AppSpacings.spacingSmHorizontal,
              Expanded(child: infoTiles[2]),
            ],
          ),
        AppSpacings.spacingMdVertical,
        if (useVerticalLayout)
          ValueSelectorRow<double>(
            currentValue: _state.speed,
            label: 'Fan Speed',
            icon: Icons.speed,
            sheetTitle: 'Fan Speed',
            activeColor: airColor,
            options: _getSpeedOptions(),
            displayFormatter: _formatSpeed,
            isActiveValue: (v) => _state.mode == PurifierMode.manual && v != null && v > 0,
            columns: 4,
            layout: ValueSelectorRowLayout.compact,
            onChanged: _state.mode == PurifierMode.manual
                ? (v) => setState(() => _state = _state.copyWith(speed: v ?? 0))
                : null,
          )
        else
          SpeedSlider(
            value: _state.speed,
            activeColor: airColor,
            enabled: _state.mode == PurifierMode.manual,
            steps: const ['Silent', 'Low', 'Med', 'High'],
            onChanged: (v) =>
                setState(() => _state = _state.copyWith(speed: v)),
          ),
        AppSpacings.spacingMdVertical,
        UniversalTile(
          layout: TileLayout.horizontal,
          icon: Icons.lock,
          name: 'Child Lock',
          status: _state.childLock ? 'Enabled' : 'Disabled',
          isActive: _state.childLock,
          activeColor: airColor,
          onTileTap: () =>
              setState(() => _state = _state.copyWith(childLock: !_state.childLock)),
          showGlow: false,
          showDoubleBorder: false,
          showInactiveBorder: true,
        ),
        AppSpacings.spacingSmVertical,
        ValueSelectorRow<Duration?>(
          currentValue: _state.timer,
          label: 'Timer',
          icon: Icons.timer_outlined,
          sheetTitle: 'Auto-Off Timer',
          activeColor: airColor,
          options: _getTimerOptions(),
          displayFormatter: _formatDuration,
          isActiveValue: (d) => d != null,
          layout: useVerticalLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          onChanged: (d) => setState(() => _state = _state.copyWith(timer: d)),
        ),
      ],
    );
  }
}
