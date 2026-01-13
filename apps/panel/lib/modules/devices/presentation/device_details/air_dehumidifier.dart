import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/info_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/speed_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:flutter/material.dart';

enum DehumidifierMode { auto, continuous, laundry }

class DehumidifierDeviceState {
  final bool isOn;
  final double targetHumidity;
  final double currentHumidity;
  final DehumidifierMode mode;
  final double fanSpeed; // 0.0 = Low, 1.0 = High
  final double tankLevel;
  final Duration? timer;

  const DehumidifierDeviceState({
    this.isOn = false,
    this.targetHumidity = 0.45,
    this.currentHumidity = 0.58,
    this.mode = DehumidifierMode.auto,
    this.fanSpeed = 1.0,
    this.tankLevel = 0.78,
    this.timer,
  });

  DehumidifierDeviceState copyWith({
    bool? isOn,
    double? targetHumidity,
    double? currentHumidity,
    DehumidifierMode? mode,
    double? fanSpeed,
    double? tankLevel,
    Duration? timer,
  }) {
    return DehumidifierDeviceState(
      isOn: isOn ?? this.isOn,
      targetHumidity: targetHumidity ?? this.targetHumidity,
      currentHumidity: currentHumidity ?? this.currentHumidity,
      mode: mode ?? this.mode,
      fanSpeed: fanSpeed ?? this.fanSpeed,
      tankLevel: tankLevel ?? this.tankLevel,
      timer: timer ?? this.timer,
    );
  }

  bool get isRunning => isOn && currentHumidity > targetHumidity;
  bool get tankWarning => tankLevel > 0.75;
  String get fanSpeedLabel => fanSpeed >= 0.5 ? 'High' : 'Low';
}

class AirDehumidifierDeviceDetail extends StatefulWidget {
  final String name;
  final DehumidifierDeviceState initialState;
  final VoidCallback? onBack;

  const AirDehumidifierDeviceDetail({
    super.key,
    required this.name,
    required this.initialState,
    this.onBack,
  });

  @override
  State<AirDehumidifierDeviceDetail> createState() =>
      _AirDehumidifierDeviceDetailState();
}

class _AirDehumidifierDeviceDetailState
    extends State<AirDehumidifierDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late DehumidifierDeviceState _state;

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
    final humidityColor = DeviceColors.humidity(isDark);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return PageHeader(
      title: widget.name,
      subtitle: _state.isOn
          ? 'Target ${(_state.targetHumidity * 100).toInt()}% • ${_state.isRunning ? "Running" : "Idle"}'
          : 'Off',
      subtitleColor: _state.isOn ? humidityColor : secondaryColor,
      backgroundColor: Colors.transparent,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: widget.onBack,
          ),
          SizedBox(width: _scale(12)),
          Container(
            width: _scale(44),
            height: _scale(44),
            decoration: BoxDecoration(
              color: _state.isOn
                  ? DeviceColors.humidityLight9(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              Icons.water_drop_outlined,
              color: _state.isOn ? humidityColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
      trailing: GestureDetector(
        onTap: () => setState(() => _state = _state.copyWith(isOn: !_state.isOn)),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: _scale(48),
          height: _scale(32),
          decoration: BoxDecoration(
            color: _state.isOn
                ? humidityColor
                : (isDark
                    ? AppFillColorDark.light
                    : AppFillColorLight.light),
            borderRadius: BorderRadius.circular(AppBorderRadius.round),
            border: (!_state.isOn && !isDark)
                ? Border.all(color: AppBorderColorLight.base, width: _scale(1))
                : null,
          ),
          child: Icon(
            Icons.power_settings_new,
            size: _scale(18),
            color: _state.isOn
                ? Colors.white
                : (isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary),
          ),
        ),
      ),
    );
  }

  Widget _buildLandscape(BuildContext context, bool isDark) {
    final humidityColor = DeviceColors.humidity(isDark);
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    final isLargeScreen = _screenService.isLargeScreen;

    if (isLargeScreen) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 1,
            child: Padding(
              padding: AppSpacings.paddingLg,
              child: _buildControlCard(isDark, humidityColor),
            ),
          ),
          Container(width: _scale(1), color: borderColor),
          Expanded(
            flex: 1,
            child: Container(
              color: cardColor,
              padding: AppSpacings.paddingLg,
              child: SingleChildScrollView(
                child: _buildStatus(isDark),
              ),
            ),
          ),
        ],
      );
    }

    // Compact layout for small/medium screens
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: 2,
          child: Padding(
            padding: AppSpacings.paddingLg,
            child: _buildCompactControlCard(context, isDark, humidityColor),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        Expanded(
          flex: 1,
          child: Container(
            color: cardColor,
            padding: AppSpacings.paddingLg,
            child: SingleChildScrollView(
              child: _buildStatus(isDark),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildControlCard(bool isDark, Color humidityColor) {
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final controlBorderColor =
        _state.isOn ? DeviceColors.humidityLight7(isDark) : borderColor;
    // Use darker bg in dark mode for better contrast with dial inner background
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: controlBorderColor, width: _scale(1)),
      ),
      child: Column(
        children: [
          CircularControlDial(
            value: _state.targetHumidity,
            currentValue: _state.currentHumidity,
            minValue: 0.3,
            maxValue: 0.7,
            step: 0.01,
            size: _scale(200),
            accentType: DialAccentColor.teal,
            isActive: _state.isRunning,
            enabled: _state.isOn,
            displayFormat: DialDisplayFormat.percentage,
            majorTickCount: 8,
            onChanged: (v) =>
                setState(() => _state = _state.copyWith(targetHumidity: v)),
          ),
          SizedBox(height: AppSpacings.pLg),
          _buildModeSelector(isDark, humidityColor),
        ],
      ),
    );
  }

  /// Compact control card with dial and vertical icon-only mode selector
  Widget _buildCompactControlCard(
      BuildContext context, bool isDark, Color humidityColor) {
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final controlBorderColor =
        _state.isOn ? DeviceColors.humidityLight7(isDark) : borderColor;
    // Use darker bg in dark mode for better contrast with dial inner background
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: controlBorderColor, width: _scale(1)),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Same dial size calculation as climate detail
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
                value: _state.targetHumidity,
                currentValue: _state.currentHumidity,
                minValue: 0.3,
                maxValue: 0.7,
                step: 0.01,
                size: dialSize,
                accentType: DialAccentColor.teal,
                isActive: _state.isRunning,
                enabled: _state.isOn,
                displayFormat: DialDisplayFormat.percentage,
                majorTickCount: 8,
                onChanged: (v) =>
                    setState(() => _state = _state.copyWith(targetHumidity: v)),
              ),
              AppSpacings.spacingXlHorizontal,
              ModeSelector<DehumidifierMode>(
                modes: _getDehumidifierModeOptions(),
                selectedValue: _state.mode,
                onChanged: (mode) =>
                    setState(() => _state = _state.copyWith(mode: mode)),
                orientation: ModeSelectorOrientation.vertical,
                showLabels: false,
                color: ModeSelectorColor.teal,
                scrollable: true,
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildPortrait(BuildContext context, bool isDark) {
    final humidityColor = DeviceColors.humidity(isDark);
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final controlBorderColor = _state.isOn
        ? DeviceColors.humidityLight7(isDark)
        : borderColor;

    return SingleChildScrollView(
      padding: AppSpacings.paddingMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: AppSpacings.paddingLg,
            decoration: BoxDecoration(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
              borderRadius: BorderRadius.circular(AppBorderRadius.round),
              border: Border.all(color: controlBorderColor, width: _scale(1)),
            ),
            child: Column(
              children: [
                CircularControlDial(
                  value: _state.targetHumidity,
                  currentValue: _state.currentHumidity,
                  minValue: 0.3,
                  maxValue: 0.7,
                  step: 0.01,
                  size: _scale(200),
                  accentType: DialAccentColor.teal,
                  isActive: _state.isRunning,
                  enabled: _state.isOn,
                  displayFormat: DialDisplayFormat.percentage,
                  majorTickCount: 8,
                  onChanged: (v) =>
                      setState(() => _state = _state.copyWith(targetHumidity: v)),
                ),
                SizedBox(height: AppSpacings.pMd),
                _buildModeSelector(isDark, humidityColor),
              ],
            ),
          ),
          SizedBox(height: AppSpacings.pMd),
          _buildStatus(isDark),
        ],
      ),
    );
  }

  Widget _buildModeSelector(bool isDark, Color activeColor) {
    return ModeSelector<DehumidifierMode>(
      modes: _getDehumidifierModeOptions(),
      selectedValue: _state.mode,
      onChanged: (mode) => setState(() => _state = _state.copyWith(mode: mode)),
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
      color: ModeSelectorColor.teal,
      scrollable: true,
    );
  }

  List<ModeOption<DehumidifierMode>> _getDehumidifierModeOptions() {
    return [
      ModeOption(value: DehumidifierMode.auto, icon: Icons.auto_mode, label: 'Auto'),
      ModeOption(value: DehumidifierMode.continuous, icon: Icons.all_inclusive, label: 'Continuous'),
      ModeOption(value: DehumidifierMode.laundry, icon: Icons.dry_cleaning, label: 'Laundry'),
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

  List<ValueOption<double>> _getFanSpeedOptions() {
    return [
      ValueOption(value: 0.0, label: 'Low'),
      ValueOption(value: 1.0, label: 'High'),
    ];
  }

  String _formatFanSpeed(double? speed) {
    if (speed == null || speed < 0.5) return 'Low';
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

  Widget _buildStatus(bool isDark) {
    final humidityColor = DeviceColors.humidity(isDark);
    final useVerticalLayout = _screenService.isLandscape &&
        (_screenService.isSmallScreen || _screenService.isMediumScreen);

    final infoTiles = [
      InfoTile(
        label: 'Current',
        value: '${(_state.currentHumidity * 100).toInt()}',
        unit: '%',
        valueColor: humidityColor,
      ),
      InfoTile(
        label: 'Fan Speed',
        value: _state.fanSpeedLabel,
      ),
      InfoTile(
        label: 'Water Tank',
        value: '${(_state.tankLevel * 100).toInt()}',
        unit: '%',
        isWarning: _state.tankWarning,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (useVerticalLayout)
          ...infoTiles
              .expand((tile) => [
                    SizedBox(width: double.infinity, child: tile),
                    SizedBox(height: _scale(8)),
                  ])
              .take(infoTiles.length * 2 - 1)
        else
          Row(
            children: [
              Expanded(child: infoTiles[0]),
              SizedBox(width: _scale(10)),
              Expanded(child: infoTiles[1]),
              SizedBox(width: _scale(10)),
              Expanded(child: infoTiles[2]),
            ],
          ),
        SizedBox(height: _scale(12)),
        if (useVerticalLayout)
          ValueSelectorRow<double>(
            currentValue: _state.fanSpeed,
            label: 'Fan Speed',
            icon: Icons.speed,
            sheetTitle: 'Fan Speed',
            activeColor: humidityColor,
            options: _getFanSpeedOptions(),
            displayFormatter: _formatFanSpeed,
            isActiveValue: (v) => _state.isOn,
            columns: 2,
            layout: ValueSelectorRowLayout.compact,
            onChanged: _state.isOn
                ? (v) => setState(() => _state = _state.copyWith(fanSpeed: v ?? 0))
                : null,
          )
        else
          SpeedSlider(
            value: _state.fanSpeed,
            activeColor: humidityColor,
            steps: const ['Low', 'High'],
            discrete: true,
            enabled: _state.isOn,
            onChanged: (v) => setState(() => _state = _state.copyWith(fanSpeed: v)),
          ),
        SizedBox(height: _scale(12)),
        ValueSelectorRow<Duration?>(
          currentValue: _state.timer,
          label: 'Timer',
          icon: Icons.timer_outlined,
          sheetTitle: 'Auto-Off Timer',
          activeColor: humidityColor,
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
