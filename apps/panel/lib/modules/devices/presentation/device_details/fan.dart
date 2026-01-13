import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/speed_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:flutter/material.dart';

enum FanMode { low, medium, high, auto }

class FanDeviceState {
  final bool isOn;
  final double speed;
  final FanMode mode;
  final bool oscillation;
  final bool reverseDirection;
  final bool naturalBreeze;
  final Duration? timer;

  const FanDeviceState({
    this.isOn = false,
    this.speed = 0.0,
    this.mode = FanMode.medium,
    this.oscillation = false,
    this.reverseDirection = false,
    this.naturalBreeze = false,
    this.timer,
  });

  FanDeviceState copyWith({
    bool? isOn,
    double? speed,
    FanMode? mode,
    bool? oscillation,
    bool? reverseDirection,
    bool? naturalBreeze,
    Duration? timer,
  }) {
    return FanDeviceState(
      isOn: isOn ?? this.isOn,
      speed: speed ?? this.speed,
      mode: mode ?? this.mode,
      oscillation: oscillation ?? this.oscillation,
      reverseDirection: reverseDirection ?? this.reverseDirection,
      naturalBreeze: naturalBreeze ?? this.naturalBreeze,
      timer: timer ?? this.timer,
    );
  }
}

class FanDeviceDetail extends StatefulWidget {
  final String name;
  final FanDeviceState initialState;
  final VoidCallback? onBack;

  const FanDeviceDetail({
    super.key,
    required this.name,
    required this.initialState,
    this.onBack,
  });

  @override
  State<FanDeviceDetail> createState() => _FanDeviceDetailState();
}

class _FanDeviceDetailState extends State<FanDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late FanDeviceState _state;

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
    final fanColor = DeviceColors.fan(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: widget.name,
      subtitle: _state.isOn
          ? 'Speed ${(_state.speed * 100).toInt()}%'
          : 'Off',
      subtitleColor: _state.isOn ? fanColor : secondaryColor,
      backgroundColor: Colors.transparent,
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
                  ? DeviceColors.fanLight9(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              Icons.wind_power,
              color: _state.isOn ? fanColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscape(BuildContext context, bool isDark) {
    final fanColor = DeviceColors.fan(isDark);
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
              child: _buildControlCard(isDark, fanColor),
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
                    SpeedSlider(
                      value: _state.speed,
                      activeColor: fanColor,
                      enabled: _state.isOn,
                      onChanged: (v) =>
                          setState(() => _state = _state.copyWith(speed: v)),
                    ),
                    AppSpacings.spacingLgVertical,
                    _buildOptions(isDark),
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
            child: _buildCompactControlCard(context, isDark, fanColor),
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
                  ValueSelectorRow<double>(
                    currentValue: _state.speed,
                    label: 'Fan Speed',
                    icon: Icons.speed,
                    sheetTitle: 'Fan Speed',
                    activeColor: fanColor,
                    options: _getSpeedOptions(),
                    displayFormatter: _formatSpeed,
                    isActiveValue: (v) => v != null && v > 0,
                    columns: 3,
                    layout: ValueSelectorRowLayout.compact,
                    onChanged: (v) =>
                        setState(() => _state = _state.copyWith(speed: v ?? 0)),
                  ),
                  AppSpacings.spacingSmVertical,
                  _buildOptions(isDark),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPortrait(BuildContext context, bool isDark) {
    final fanColor = DeviceColors.fan(isDark);

    return SingleChildScrollView(
      padding: AppSpacings.paddingMd,
      child: Column(
        children: [
          _buildControlCard(isDark, fanColor),
          AppSpacings.spacingMdVertical,
          SpeedSlider(
            value: _state.speed,
            activeColor: fanColor,
            enabled: _state.isOn,
            onChanged: (v) =>
                setState(() => _state = _state.copyWith(speed: v)),
          ),
          AppSpacings.spacingMdVertical,
          _buildOptions(isDark),
        ],
      ),
    );
  }

  Widget _buildControlCard(bool isDark, Color fanColor) {
    // Use lighter bg in dark mode for better contrast with button
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final borderColor = DeviceColors.fanLight7(isDark);

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
            activeColor: fanColor,
            activeBgColor: DeviceColors.fanLight9(isDark),
            glowColor: DeviceColors.fanLight5(isDark),
            showInfoText: false,
            onTap: () => setState(() => _state = _state.copyWith(
              isOn: !_state.isOn,
              speed: _state.isOn ? 0 : 0.6,
            )),
          ),
          AppSpacings.spacingLgVertical,
          _buildModeSelector(isDark, fanColor),
        ],
      ),
    );
  }

  Widget _buildModeSelector(bool isDark, Color activeColor) {
    return ModeSelector<FanMode>(
      modes: _getFanModeOptions(),
      selectedValue: _state.mode,
      onChanged: (mode) => setState(() => _state = _state.copyWith(mode: mode)),
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: ModeSelectorColor.info,
      scrollable: true,
    );
  }

  List<ModeOption<FanMode>> _getFanModeOptions() {
    return [
      ModeOption(value: FanMode.low, icon: Icons.air, label: 'Low'),
      ModeOption(value: FanMode.medium, icon: Icons.waves, label: 'Medium'),
      ModeOption(value: FanMode.high, icon: Icons.storm, label: 'High'),
      ModeOption(value: FanMode.auto, icon: Icons.auto_mode, label: 'Auto'),
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
      ValueOption(value: 0.0, label: 'Off'),
      ValueOption(value: 0.2, label: '20%'),
      ValueOption(value: 0.4, label: '40%'),
      ValueOption(value: 0.6, label: '60%'),
      ValueOption(value: 0.8, label: '80%'),
      ValueOption(value: 1.0, label: '100%'),
    ];
  }

  String _formatSpeed(double? speed) {
    if (speed == null || speed == 0) return 'Off';
    return '${(speed * 100).toInt()}%';
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
      BuildContext context, bool isDark, Color fanColor) {
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;
    final borderColor = DeviceColors.fanLight7(isDark);

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
                activeColor: fanColor,
                activeBgColor: DeviceColors.fanLight9(isDark),
                glowColor: DeviceColors.fanLight5(isDark),
                showInfoText: false,
                size: buttonSize,
                onTap: () => setState(() => _state = _state.copyWith(
                      isOn: !_state.isOn,
                      speed: _state.isOn ? 0 : 0.6,
                    )),
              ),
              AppSpacings.spacingXlHorizontal,
              ModeSelector<FanMode>(
                modes: _getFanModeOptions(),
                selectedValue: _state.mode,
                onChanged: (mode) =>
                    setState(() => _state = _state.copyWith(mode: mode)),
                orientation: ModeSelectorOrientation.vertical,
                showLabels: false,
                color: ModeSelectorColor.info,
                scrollable: true,
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildOptions(bool isDark) {
    final fanColor = DeviceColors.fan(isDark);
    final useCompactLayout = _screenService.isLandscape &&
        (_screenService.isSmallScreen || _screenService.isMediumScreen);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        UniversalTile(
          layout: TileLayout.horizontal,
          icon: Icons.sync,
          name: 'Oscillation',
          status: _state.oscillation ? 'On' : 'Off',
          isActive: _state.oscillation,
          activeColor: fanColor,
          onTileTap: () =>
              setState(() => _state = _state.copyWith(oscillation: !_state.oscillation)),
          showGlow: false,
          showDoubleBorder: false,
          showInactiveBorder: true,
        ),
        AppSpacings.spacingSmVertical,
        UniversalTile(
          layout: TileLayout.horizontal,
          icon: Icons.swap_vert,
          name: 'Reverse',
          status: _state.reverseDirection ? 'On' : 'Off',
          isActive: _state.reverseDirection,
          activeColor: fanColor,
          onTileTap: () =>
              setState(() => _state = _state.copyWith(reverseDirection: !_state.reverseDirection)),
          showGlow: false,
          showDoubleBorder: false,
          showInactiveBorder: true,
        ),
        AppSpacings.spacingSmVertical,
        UniversalTile(
          layout: TileLayout.horizontal,
          icon: Icons.park,
          name: 'Natural Breeze',
          status: _state.naturalBreeze ? 'On' : 'Off',
          isActive: _state.naturalBreeze,
          activeColor: fanColor,
          onTileTap: () =>
              setState(() => _state = _state.copyWith(naturalBreeze: !_state.naturalBreeze)),
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
          activeColor: fanColor,
          options: _getTimerOptions(),
          displayFormatter: _formatDuration,
          isActiveValue: (d) => d != null,
          layout: useCompactLayout
              ? ValueSelectorRowLayout.compact
              : ValueSelectorRowLayout.horizontal,
          onChanged: (d) => setState(() => _state = _state.copyWith(timer: d)),
        ),
      ],
    );
  }
}
