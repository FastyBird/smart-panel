import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/heating_unit.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Mode enum for heating unit device
enum HeaterMode { heat, off }

class HeatingUnitDeviceDetail extends StatefulWidget {
  final HeatingUnitDeviceView _device;
  final VoidCallback? onBack;

  const HeatingUnitDeviceDetail({
    super.key,
    required HeatingUnitDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<HeatingUnitDeviceDetail> createState() =>
      _HeatingUnitDeviceDetailState();
}

class _HeatingUnitDeviceDetailState extends State<HeatingUnitDeviceDetail> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();

  // Local state for optimistic UI updates
  HeaterMode? _pendingMode;
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

  HeatingUnitDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is HeatingUnitDeviceView) {
      return updated;
    }
    return widget._device;
  }

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  // --------------------------------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------------------------------

  bool get _isHeating => _device.heaterChannel.isHeating;

  bool get _isActive => _isHeating;

  HeaterMode get _currentMode {
    if (_pendingMode != null) {
      return _pendingMode!;
    }
    // Determine mode from device state
    if (_isHeating) {
      return HeaterMode.heat;
    }
    return HeaterMode.off;
  }

  double get _currentTemperature => _device.temperatureChannel.temperature;

  double get _targetSetpoint {
    if (_pendingSetpoint != null) {
      return _pendingSetpoint!;
    }
    return _device.heaterChannel.temperature;
  }

  // --------------------------------------------------------------------------
  // MODE AND SETPOINT HANDLERS
  // --------------------------------------------------------------------------

  void _onModeChanged(HeaterMode mode) {
    setState(() {
      _pendingMode = mode;
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
    if (_currentMode == HeaterMode.off) {
      return localizations.on_state_off;
    }
    if (_isHeating) {
      return localizations.thermostat_state_heating;
    }
    return localizations.thermostat_state_idling;
  }

  Color _getModeColor(bool isDark) {
    switch (_currentMode) {
      case HeaterMode.heat:
        return DeviceColors.heating(isDark);
      case HeaterMode.off:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }
  }

  DialAccentColor _getDialAccentColor() {
    switch (_currentMode) {
      case HeaterMode.heat:
        return DialAccentColor.warning;
      case HeaterMode.off:
        return DialAccentColor.neutral;
    }
  }

  List<ModeOption<HeaterMode>> _getModeOptions() {
    return [
      ModeOption(
        value: HeaterMode.heat,
        icon: MdiIcons.fireCircle,
        label: 'Heat',
        color: ModeSelectorColor.warning,
      ),
      ModeOption(
        value: HeaterMode.off,
        icon: MdiIcons.power,
        label: 'Off',
        color: ModeSelectorColor.neutral,
      ),
    ];
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
              child: _buildContent(context, isDark),
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
                  ? DeviceColors.heatingLight9(isDark)
                  : (isDark
                      ? AppFillColorDark.darker
                      : AppFillColorLight.darker),
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              MdiIcons.radiator,
              color: _isActive ? modeColor : mutedColor,
              size: _scale(24),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context, bool isDark) {
    final dialSize = math.min(
      _screenService.screenWidth * 0.7,
      _screenService.screenHeight * 0.4,
    );

    return Center(
      child: SingleChildScrollView(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
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
                enabled: _currentMode != HeaterMode.off,
                modeLabel: _currentMode.name,
                displayFormat: DialDisplayFormat.temperature,
                onChanged: _onSetpointChanged,
              ),
              AppSpacings.spacingMdVertical,
              _buildModeSelector(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildModeSelector(BuildContext context) {
    return ModeSelector<HeaterMode>(
      modes: _getModeOptions(),
      selectedValue: _currentMode,
      onChanged: _onModeChanged,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.left,
    );
  }
}
