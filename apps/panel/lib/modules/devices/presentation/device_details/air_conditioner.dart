import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/air_conditioner.dart';
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

  // Local state for optimistic UI updates
  AcMode? _pendingMode;
  double? _pendingSetpoint;

  static const double _minSetpoint = 16.0;
  static const double _maxSetpoint = 30.0;

  @override
  void initState() {
    super.initState();
    _devicesService.addListener(_onDeviceChanged);
  }

  @override
  void dispose() {
    _devicesService.removeListener(_onDeviceChanged);
    super.dispose();
  }

  void _onDeviceChanged() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
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

  bool get _isActive => _isHeating || _isCooling;

  AcMode get _currentMode {
    if (_pendingMode != null) {
      return _pendingMode!;
    }
    // Determine mode from device state
    if (_isCooling) {
      return AcMode.cool;
    }
    if (_isHeating) {
      return AcMode.heat;
    }
    return AcMode.off;
  }

  double get _currentTemperature => _device.temperatureChannel.temperature;

  double get _targetSetpoint {
    if (_pendingSetpoint != null) {
      return _pendingSetpoint!;
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

  void _onModeChanged(AcMode mode) {
    setState(() {
      _pendingMode = mode;
      _pendingSetpoint = null; // Clear to use new mode's target temperature
    });

    // TODO: Send mode change command to device
    // For now, just update local state
  }

  void _onSetpointChanged(double value) {
    setState(() {
      _pendingSetpoint = value;
    });

    // TODO: Send setpoint change command to device
    // For now, just update local state
  }

  // --------------------------------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------------------------------

  String _getStatusLabel(AppLocalizations localizations) {
    if (_currentMode == AcMode.off) {
      return localizations.on_state_off;
    }
    if (_isCooling) {
      return localizations.thermostat_state_cooling;
    }
    if (_isHeating) {
      return localizations.thermostat_state_heating;
    }
    return localizations.thermostat_state_idling;
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
        return isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight5;
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

  List<ModeOption<AcMode>> _getModeOptions() {
    final modes = <ModeOption<AcMode>>[];

    // Add heat mode only if device has a heater channel
    if (_hasHeater) {
      modes.add(ModeOption(
        value: AcMode.heat,
        icon: MdiIcons.fireCircle,
        label: 'Heat',
        color: ModeSelectorColor.warning,
      ));
    }

    // Cooler is required for A/C
    modes.add(ModeOption(
      value: AcMode.cool,
      icon: MdiIcons.snowflake,
      label: 'Cool',
      color: ModeSelectorColor.info,
    ));

    // Always add OFF mode
    modes.add(ModeOption(
      value: AcMode.off,
      icon: MdiIcons.power,
      label: 'Off',
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
    return SingleChildScrollView(
      padding: AppSpacings.paddingLg,
      child: Center(
        child: _buildPrimaryControlCard(context, isDark, dialSize: _scale(200)),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(BuildContext context, bool isDark) {
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: dial with vertical mode icons
        Expanded(
          flex: 1,
          child: Padding(
            padding: AppSpacings.paddingLg,
            child: _buildCompactDialWithModes(context, isDark),
          ),
        ),
        Container(width: _scale(1), color: borderColor),
        // Right column: empty for now (could add device info later)
        Expanded(
          flex: 1,
          child: Center(
            child: Text(
              _device.name,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
                fontSize: AppFontSize.base,
              ),
            ),
          ),
        ),
      ],
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
            value: _targetSetpoint,
            currentValue: _currentTemperature,
            minValue: _minSetpoint,
            maxValue: _maxSetpoint,
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
                value: _targetSetpoint,
                currentValue: _currentTemperature,
                minValue: _minSetpoint,
                maxValue: _maxSetpoint,
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
    return ModeSelector<AcMode>(
      modes: _getModeOptions(),
      selectedValue: _currentMode,
      onChanged: _onModeChanged,
      orientation: orientation,
      iconPlacement: ModeSelectorIconPlacement.left,
      showLabels: showLabels,
    );
  }
}
