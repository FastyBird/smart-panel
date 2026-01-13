import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/climate_domain_view.dart'
    show ClimateMode, RoomCapability, ClimateDevice;
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// ============================================================================
// DATA MODELS
// ============================================================================

class ClimateDetailState {
  final String roomName;
  final ClimateMode mode;
  final RoomCapability capability;
  final double targetTemp;
  final double currentTemp;
  final List<ClimateDevice> climateDevices;

  const ClimateDetailState({
    required this.roomName,
    this.mode = ClimateMode.off,
    this.capability = RoomCapability.heaterAndCooler,
    this.targetTemp = 22.0,
    this.currentTemp = 21.0,
    this.climateDevices = const [],
  });

  ClimateDetailState copyWith({
    String? roomName,
    ClimateMode? mode,
    RoomCapability? capability,
    double? targetTemp,
    double? currentTemp,
    List<ClimateDevice>? climateDevices,
  }) {
    return ClimateDetailState(
      roomName: roomName ?? this.roomName,
      mode: mode ?? this.mode,
      capability: capability ?? this.capability,
      targetTemp: targetTemp ?? this.targetTemp,
      currentTemp: currentTemp ?? this.currentTemp,
      climateDevices: climateDevices ?? this.climateDevices,
    );
  }

  String get modeLabel {
    switch (mode) {
      case ClimateMode.off:
        return 'Off';
      case ClimateMode.heat:
        return 'Heating';
      case ClimateMode.cool:
        return 'Cooling';
    }
  }
}

// ============================================================================
// CLIMATE ROLE DETAIL PAGE
// ============================================================================

class ClimateRoleDetailPage extends StatefulWidget {
  final String roomName;
  final ClimateMode initialMode;
  final double initialTargetTemp;
  final double currentTemp;

  const ClimateRoleDetailPage({
    super.key,
    required this.roomName,
    this.initialMode = ClimateMode.heat,
    this.initialTargetTemp = 22.0,
    this.currentTemp = 20.3,
  });

  @override
  State<ClimateRoleDetailPage> createState() => _ClimateRoleDetailPageState();
}

class _ClimateRoleDetailPageState extends State<ClimateRoleDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  late ClimateDetailState _state;

  @override
  void initState() {
    super.initState();
    _initializeState();
  }

  void _initializeState() {
    // TODO: Build real state from devices
    _state = ClimateDetailState(
      roomName: widget.roomName,
      mode: widget.initialMode,
      capability: RoomCapability.heaterAndCooler,
      targetTemp: widget.initialTargetTemp,
      currentTemp: widget.currentTemp,
      climateDevices: const [
        ClimateDevice(
          id: 'therm1',
          name: 'Main Thermostat',
          type: 'thermostat',
          isActive: true,
          status: 'Heating',
          isPrimary: true,
        ),
        ClimateDevice(
          id: 'ac1',
          name: 'Living Room AC',
          type: 'ac',
          isActive: false,
          status: 'Standby',
        ),
        ClimateDevice(
          id: 'heater1',
          name: 'Wall Heater',
          type: 'heater',
          isActive: true,
          status: 'On',
        ),
        ClimateDevice(
          id: 'rad1',
          name: 'Bedroom Radiator',
          type: 'radiator',
          isActive: true,
          status: 'Warm',
        ),
        ClimateDevice(
          id: 'floor1',
          name: 'Floor Heating',
          type: 'floor_heating',
          isActive: false,
          status: 'Off',
        ),
      ],
    );
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  void _setMode(ClimateMode mode) {
    setState(() => _state = _state.copyWith(mode: mode));
  }

  void _setTargetTemp(double temp) {
    setState(
        () => _state = _state.copyWith(targetTemp: temp.clamp(16.0, 30.0)));
  }

  // Theme-aware color getters
  Color _getModeColor(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (_state.mode) {
      case ClimateMode.off:
        return isDark
            ? AppTextColorDark.secondary
            : AppTextColorLight.secondary;
      case ClimateMode.heat:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case ClimateMode.cool:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
    }
  }

  Color _getModeLightColor(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (_state.mode) {
      case ClimateMode.off:
        return isDark ? AppFillColorDark.light : AppFillColorLight.light;
      case ClimateMode.heat:
        return isDark
            ? AppColorsDark.warningLight5
            : AppColorsLight.warningLight5;
      case ClimateMode.cool:
        return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
    }
  }

  DialAccentColor _getDialAccentType() {
    switch (_state.mode) {
      case ClimateMode.off:
        return DialAccentColor.neutral;
      case ClimateMode.heat:
        return DialAccentColor.warning;
      case ClimateMode.cool:
        return DialAccentColor.info;
    }
  }

  bool _isDialActive() {
    if (_state.mode == ClimateMode.off) return false;
    if (_state.mode == ClimateMode.heat) {
      return _state.currentTemp < _state.targetTemp;
    }
    return _state.currentTemp > _state.targetTemp;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  return orientation == Orientation.landscape
                      ? _buildLandscapeLayout(context)
                      : _buildPortraitLayout(context);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColor = _getModeColor(context);
    final localizations = AppLocalizations.of(context)!;

    return PageHeader(
      title: localizations.domain_climate,
      subtitle: _state.mode == ClimateMode.off
          ? 'Off'
          : '${_state.modeLabel} to ${_state.targetTemp.toInt()}°',
      subtitleColor: modeColor,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: () => Navigator.pop(context),
          ),
          AppSpacings.spacingMdHorizontal,
          HeaderDeviceIcon(
            icon: MdiIcons.thermostat,
            backgroundColor: _getModeLightColor(context),
            iconColor: modeColor,
          ),
        ],
      ),
      trailing: Container(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        decoration: BoxDecoration(
          color: isDark ? AppFillColorDark.light : AppFillColorLight.darker,
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              MdiIcons.thermometer,
              size: _scale(16),
              color: isDark
                  ? AppTextColorDark.secondary
                  : AppTextColorLight.secondary,
            ),
            AppSpacings.spacingXsHorizontal,
            Text(
              '${_state.currentTemp.toStringAsFixed(1)}°',
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.primary
                    : AppTextColorLight.primary,
                fontSize: AppFontSize.base,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(BuildContext context) {
    final hasDevices = _state.climateDevices.isNotEmpty;

    // Match lighting control panel portrait height (140)
    final devicesHeight = _scale(140);

    // Columns: small 2, medium 3, large 4
    final columns = _screenService.isLargeScreen
        ? 4
        : (_screenService.isMediumScreen ? 3 : 2);

    return Column(
      children: [
        // Dial section - takes available space (expands)
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacings.paddingLg,
            child: _buildPrimaryControlCard(context, dialSize: _scale(200)),
          ),
        ),

        // Devices section at bottom - matches lighting control panel
        if (hasDevices)
          _buildDevicesSection(
            context,
            height: devicesHeight,
            columns: columns,
          ),
      ],
    );
  }

  /// Builds the devices section matching lighting control panel pattern
  Widget _buildDevicesSection(
    BuildContext context, {
    required double height,
    required int columns,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

    return Container(
      height: height,
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: borderColor, width: _scale(1)),
        ),
      ),
      child: Column(
        children: [
          SectionHeader(
            title: 'Climate Devices',
            icon: MdiIcons.devices,
            count: _state.climateDevices.length,
          ),
          Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) {
                // Calculate tile width based on columns
                final horizontalPadding = AppSpacings.pMd * 2;
                final totalSpacing = AppSpacings.pMd * (columns - 1);
                final availableWidth =
                    constraints.maxWidth - horizontalPadding - totalSpacing;
                final tileWidth = availableWidth / columns;

                return ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.pMd,
                    vertical: AppSpacings.pMd,
                  ),
                  itemCount: _state.climateDevices.length,
                  itemBuilder: (context, index) {
                    return Padding(
                      padding: EdgeInsets.only(right: AppSpacings.pMd),
                      child: SizedBox(
                        width: tileWidth,
                        child: _buildDeviceTile(
                          context,
                          _state.climateDevices[index],
                          isVertical: true,
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final isLargeScreen = _screenService.isLargeScreen;

    final hasDevices = _state.climateDevices.isNotEmpty;

    if (isLargeScreen) {
      return _buildLargeLandscapeLayout(
        context,
        isDark: isDark,
        borderColor: borderColor,
        hasDevices: hasDevices,
      );
    }

    return _buildCompactLandscapeLayout(
      context,
      isDark: isDark,
      borderColor: borderColor,
      hasDevices: hasDevices,
    );
  }

  Widget _buildLargeLandscapeLayout(
    BuildContext context, {
    required bool isDark,
    required Color borderColor,
    required bool hasDevices,
  }) {
    final dialSize = _scale(200);
    final tileHeight = _scale(70);

    // Build rows of 2 tiles like lighting control panel
    final rows = <Widget>[];
    for (var i = 0; i < _state.climateDevices.length; i += 2) {
      final rowDevices = _state.climateDevices.skip(i).take(2).toList();
      rows.add(
        Padding(
          padding: EdgeInsets.only(bottom: AppSpacings.pMd),
          child: SizedBox(
            height: tileHeight,
            child: Row(
              children: [
                for (var j = 0; j < 2; j++) ...[
                  if (j > 0) AppSpacings.spacingMdHorizontal,
                  Expanded(
                    child: j < rowDevices.length
                        ? _buildDeviceTile(context, rowDevices[j],
                            isVertical: false)
                        : const SizedBox.shrink(),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left column: dial (1/2 screen)
        Expanded(
          flex: 1,
          child: Center(
            child: SingleChildScrollView(
              padding: AppSpacings.paddingLg,
              child: _buildPrimaryControlCard(context, dialSize: dialSize),
            ),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        // Right column: climate devices (1/2 screen)
        Expanded(
          flex: 1,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (hasDevices) ...[
                SectionHeader(
                  title: 'Climate Devices',
                  icon: MdiIcons.devices,
                  showTopBorder: false,
                  count: _state.climateDevices.length,
                ),
                Expanded(
                  child: ListView(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pMd,
                      vertical: AppSpacings.pMd,
                    ),
                    children: rows,
                  ),
                ),
              ],
              if (!hasDevices)
                Expanded(
                  child: Center(
                    child: Text(
                      'No devices',
                      style: TextStyle(
                        color: isDark
                            ? AppTextColorDark.secondary
                            : AppTextColorLight.secondary,
                        fontSize: AppFontSize.small,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCompactLandscapeLayout(
    BuildContext context, {
    required bool isDark,
    required Color borderColor,
    required bool hasDevices,
  }) {
    final tileHeight = _scale(70);

    // Build rows of 1 tile for narrow panel (matching lighting pattern)
    final rows = <Widget>[];
    for (var i = 0; i < _state.climateDevices.length; i++) {
      rows.add(
        Padding(
          padding: EdgeInsets.only(bottom: AppSpacings.pMd),
          child: SizedBox(
            height: tileHeight,
            child: _buildDeviceTile(
              context,
              _state.climateDevices[i],
              isVertical: false,
            ),
          ),
        ),
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: dial + mode icons (larger - 2/3 of screen)
        Expanded(
          flex: 2,
          child: Padding(
            padding: AppSpacings.paddingLg,
            child: _buildCompactDialWithModes(context),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        // Right column: climate devices (smaller - 1/3 of screen)
        Expanded(
          flex: 1,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (hasDevices) ...[
                SectionHeader(
                  title: 'Climate Devices',
                  icon: MdiIcons.devices,
                  showTopBorder: false,
                  count: _state.climateDevices.length,
                ),
                Expanded(
                  child: ListView(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacings.pMd,
                      vertical: AppSpacings.pMd,
                    ),
                    children: rows,
                  ),
                ),
              ],
              if (!hasDevices)
                Expanded(
                  child: Center(
                    child: Text(
                      'No devices',
                      style: TextStyle(
                        color: isDark
                            ? AppTextColorDark.secondary
                            : AppTextColorLight.secondary,
                        fontSize: AppFontSize.small,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // PRIMARY CONTROL CARD
  // --------------------------------------------------------------------------

  Widget _buildPrimaryControlCard(
    BuildContext context, {
    required double dialSize,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColor = _getModeColor(context);
    final borderColor = _state.mode != ClimateMode.off
        ? modeColor.withValues(alpha: 0.3)
        : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light);
    // Use darker bg in dark mode for better contrast with dial inner background
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        children: [
          CircularControlDial(
            value: _state.targetTemp,
            currentValue: _state.currentTemp,
            minValue: 16.0,
            maxValue: 30.0,
            step: 0.5,
            size: dialSize,
            accentType: _getDialAccentType(),
            isActive: _isDialActive(),
            enabled: _state.mode != ClimateMode.off,
            modeLabel: _state.mode.name,
            displayFormat: DialDisplayFormat.temperature,
            onChanged: _setTargetTemp,
          ),
          AppSpacings.spacingMdVertical,
          _buildModeSelector(context),
        ],
      ),
    );
  }

  Widget _buildModeSelector(BuildContext context) {
    return ModeSelector<ClimateMode>(
      modes: _getClimateModeOptions(),
      selectedValue: _state.mode,
      onChanged: _setMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
    );
  }

  List<ModeOption<ClimateMode>> _getClimateModeOptions() {
    final modes = <ModeOption<ClimateMode>>[];

    if (_state.capability == RoomCapability.heaterOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.heat,
        icon: MdiIcons.fireCircle,
        label: 'Heat',
        color: ModeSelectorColor.warning,
      ));
    }
    if (_state.capability == RoomCapability.coolerOnly ||
        _state.capability == RoomCapability.heaterAndCooler) {
      modes.add(ModeOption(
        value: ClimateMode.cool,
        icon: MdiIcons.snowflake,
        label: 'Cool',
        color: ModeSelectorColor.info,
      ));
    }
    modes.add(ModeOption(
      value: ClimateMode.off,
      icon: Icons.power_settings_new,
      label: 'Off',
      color: ModeSelectorColor.neutral,
    ));

    return modes;
  }

  /// Compact dial with vertical icon-only mode selector on the right
  Widget _buildCompactDialWithModes(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modeColor = _getModeColor(context);
    final borderColor = _state.mode != ClimateMode.off
        ? modeColor.withValues(alpha: 0.3)
        : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light);
    // Use darker bg in dark mode for better contrast with dial inner background
    final cardColor =
        isDark ? AppFillColorDark.lighter : AppFillColorLight.light;

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
                value: _state.targetTemp,
                currentValue: _state.currentTemp,
                minValue: 16.0,
                maxValue: 30.0,
                step: 0.5,
                size: dialSize,
                accentType: _getDialAccentType(),
                isActive: _isDialActive(),
                enabled: _state.mode != ClimateMode.off,
                modeLabel: _state.mode.name,
                displayFormat: DialDisplayFormat.temperature,
                onChanged: _setTargetTemp,
              ),
              AppSpacings.spacingXlHorizontal,
              _buildVerticalModeIcons(context),
            ],
          );
        },
      ),
    );
  }

  Widget _buildVerticalModeIcons(BuildContext context) {
    return ModeSelector<ClimateMode>(
      modes: _getClimateModeOptions(),
      selectedValue: _state.mode,
      onChanged: _setMode,
      orientation: ModeSelectorOrientation.vertical,
      showLabels: false,
    );
  }

  // --------------------------------------------------------------------------
  // CLIMATE DEVICES
  // --------------------------------------------------------------------------

  Widget _buildDeviceTile(BuildContext context, ClimateDevice device,
      {bool isVertical = true}) {
    final modeColor = _getModeColor(context);

    return UniversalTile(
      layout: isVertical ? TileLayout.vertical : TileLayout.horizontal,
      icon: device.icon,
      name: device.name,
      status: device.status ?? (device.isActive ? 'Active' : 'Inactive'),
      isActive: device.isActive,
      activeColor: device.isActive ? modeColor : null,
      showDoubleBorder: false,
      showWarningBadge: false,
      onIconTap: () {
        // TODO: Toggle device
      },
      onTileTap: () {
        // TODO: Open device detail
      },
    );
  }
}
