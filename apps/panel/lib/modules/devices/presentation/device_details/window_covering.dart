import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/controllers/devices/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Window covering device detail page.
///
/// Shows a window covering control interface with position slider,
/// tilt control (if supported), and quick action buttons.
class WindowCoveringDeviceDetail extends StatefulWidget {
  final WindowCoveringDeviceView _device;
  final VoidCallback? onBack;

  const WindowCoveringDeviceDetail({
    super.key,
    required WindowCoveringDeviceView device,
    this.onBack,
  }) : _device = device;

  @override
  State<WindowCoveringDeviceDetail> createState() =>
      _WindowCoveringDeviceDetailState();
}

class _WindowCoveringDeviceDetailState extends State<WindowCoveringDeviceDetail>
    with SingleTickerProviderStateMixin {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final DevicesService _devicesService = locator<DevicesService>();
  DeviceControlStateService? _deviceControlStateService;
  WindowCoveringDeviceController? _controller;

  // Debounce timers for sliders
  Timer? _positionDebounceTimer;
  Timer? _tiltDebounceTimer;

  // Local position/tilt for immediate slider feedback
  int? _localPosition;
  int? _localTilt;

  // Presets configuration
  static const _presets = [
    _Preset(name: 'Morning', icon: Icons.wb_sunny, position: 100),
    _Preset(name: 'Day', icon: Icons.light_mode, position: 75),
    _Preset(name: 'Evening', icon: Icons.nights_stay, position: 30),
    _Preset(name: 'Night', icon: Icons.bedtime, position: 0),
    _Preset(name: 'Privacy', icon: Icons.lock, position: 0, tiltAngle: 45),
    _Preset(name: 'Away', icon: Icons.home, position: 0),
  ];

  @override
  void initState() {
    super.initState();

    _devicesService.addListener(_onDeviceChanged);

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[WindowCoveringDeviceDetail] Failed to get DeviceControlStateService: $e');
      }
    }

    _initController();
  }

  void _initController() {
    final controlState = _deviceControlStateService;
    if (controlState != null) {
      _controller = WindowCoveringDeviceController(
        device: _device,
        controlState: controlState,
        devicesService: _devicesService,
        onError: _onControllerError,
      );
    }
  }

  void _onControllerError(String propertyId, Object error) {
    if (kDebugMode) {
      debugPrint(
          '[WindowCoveringDeviceDetail] Controller error for $propertyId: $error');
    }

    final localizations = AppLocalizations.of(context);
    if (mounted && localizations != null) {
      AlertBar.showError(context, message: localizations.action_failed);
    }

    // Clear local values on error
    _localPosition = null;
    _localTilt = null;

    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _positionDebounceTimer?.cancel();
    _tiltDebounceTimer?.cancel();
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

  void _checkConvergence() {
    final controlState = _deviceControlStateService;
    if (controlState == null) return;

    final deviceId = _device.id;
    final channel = _device.windowCoveringChannel;
    final channelId = channel.id;

    // Check position property
    controlState.checkPropertyConvergence(
      deviceId,
      channelId,
      channel.positionProp.id,
      channel.position,
      tolerance: 1.0,
    );

    // Check tilt property (if available)
    final tiltProp = channel.tiltProp;
    if (tiltProp != null) {
      controlState.checkPropertyConvergence(
        deviceId,
        channelId,
        tiltProp.id,
        channel.tilt,
        tolerance: 1.0,
      );
    }

    // Clear local values when converged
    _localPosition = null;
    _localTilt = null;
  }

  void _onControlStateChanged() {
    if (mounted) setState(() {});
  }

  WindowCoveringDeviceView get _device {
    final updated = _devicesService.getDevice(widget._device.id);
    if (updated is WindowCoveringDeviceView) {
      return updated;
    }
    return widget._device;
  }

  // Get current position (local value takes precedence for smooth slider)
  int get _position => _localPosition ?? _controller?.position ?? _device.isWindowCoveringPercentage;

  // Get current tilt (local value takes precedence for smooth slider)
  int get _tiltAngle => _localTilt ?? _controller?.tilt ?? _device.isWindowCoveringTilt;

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
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final isLandscape = constraints.maxWidth > constraints.maxHeight;

                  if (isLandscape) {
                    return _buildLandscapeLayout(context);
                  } else {
                    return _buildPortraitLayout(context);
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // HEADER
  // ===========================================================================

  Widget _buildHeader(BuildContext context, bool isDark) {
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final primaryBgColor =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return PageHeader(
      title: widget._device.name,
      subtitle: _getWindowCoveringTypeName(context),
      subtitleColor: secondaryColor,
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
            width: _screenService.scale(
              44,
              density: _visualDensityService.density,
            ),
            height: _screenService.scale(
              44,
              density: _visualDensityService.density,
            ),
            decoration: BoxDecoration(
              color: primaryBgColor,
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            ),
            child: Icon(
              MdiIcons.blindsHorizontal,
              color: primaryColor,
              size: _screenService.scale(
                24,
                density: _visualDensityService.density,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  String _getWindowCoveringTypeName(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    if (localizations == null) return '';

    try {
      switch (_device.windowCoveringType) {
        case WindowCoveringTypeValue.curtain:
          return localizations.window_covering_type_curtain;
        case WindowCoveringTypeValue.blind:
          return localizations.window_covering_type_blind;
        case WindowCoveringTypeValue.roller:
          return localizations.window_covering_type_roller;
        case WindowCoveringTypeValue.outdoorBlind:
          return localizations.window_covering_type_outdoor_blind;
      }
    } catch (_) {
      return localizations.window_covering_type_blind;
    }
  }

  String _getStatusLabel(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    if (localizations == null) return '';

    try {
      switch (_device.windowCoveringStatus) {
        case WindowCoveringStatusValue.opened:
          return localizations.window_covering_status_open;
        case WindowCoveringStatusValue.closed:
          return localizations.window_covering_status_closed;
        case WindowCoveringStatusValue.opening:
          return localizations.window_covering_status_opening;
        case WindowCoveringStatusValue.closing:
          return localizations.window_covering_status_closing;
        case WindowCoveringStatusValue.stopped:
          return localizations.window_covering_status_stopped;
      }
    } catch (_) {
      return localizations.window_covering_status_stopped;
    }
  }

  // ===========================================================================
  // LANDSCAPE LAYOUT
  // ===========================================================================

  Widget _buildLandscapeLayout(BuildContext context) {
    return Padding(
      padding: AppSpacings.paddingMd,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Left: Main Control
          Expanded(
            flex: 2,
            child: _buildMainControlCard(context),
          ),
          AppSpacings.spacingMdHorizontal,
          // Right: Tilt, Info, Presets
          SizedBox(
            width: _screenService.scale(
              280,
              density: _visualDensityService.density,
            ),
            child: Column(
              children: [
                if (_device.hasWindowCoveringTilt) ...[
                  _buildTiltCard(context),
                  AppSpacings.spacingMdVertical,
                ],
                _buildInfoCard(context),
                AppSpacings.spacingMdVertical,
                Expanded(child: _buildPresetsCard(context)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // PORTRAIT LAYOUT
  // ===========================================================================

  Widget _buildPortraitLayout(BuildContext context) {
    return SingleChildScrollView(
      padding: AppSpacings.paddingMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMainControlCard(context),
          AppSpacings.spacingMdVertical,
          if (_device.hasWindowCoveringTilt) ...[
            _buildTiltCard(context),
            AppSpacings.spacingMdVertical,
          ],
          _buildSectionTitle(context, 'Presets', MdiIcons.tune),
          AppSpacings.spacingSmVertical,
          _buildPresetsHorizontalScroll(context),
          AppSpacings.spacingLgVertical,
          _buildInfoRow(context),
        ],
      ),
    );
  }

  // ===========================================================================
  // MAIN CONTROL CARD
  // ===========================================================================

  Widget _buildMainControlCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight ? Border.all(color: AppBorderColorLight.base) : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Window Visualization
          _buildWindowVisualization(context),
          AppSpacings.spacingLgVertical,
          // Position Slider
          _buildPositionSliderWithLabels(context),
          AppSpacings.spacingLgVertical,
          // Quick Actions
          _buildQuickActions(context),
        ],
      ),
    );
  }

  Widget _buildWindowVisualization(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final coverHeight = (100 - _position) / 100;

    return Container(
      width: _screenService.scale(
        180,
        density: _visualDensityService.density,
      ),
      height: _screenService.scale(
        160,
        density: _visualDensityService.density,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isLight
              ? [const Color(0xFF87CEEB), const Color(0xFFE0F7FA)]
              : [const Color(0xFF1E3A5F), const Color(0xFF0D1B2A)],
        ),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: isLight ? AppBorderColorLight.base : AppBorderColorDark.base,
          width: 4,
        ),
      ),
      child: Stack(
        children: [
          // Blind slats visualization
          _buildBlindVisualization(context, coverHeight),
          // Position Label
          Positioned(
            bottom: AppSpacings.pSm,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pSm,
                  vertical: AppSpacings.pXs,
                ),
                decoration: BoxDecoration(
                  color: isLight
                      ? AppColors.white.withValues(alpha: 0.9)
                      : AppColors.black.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                ),
                child: Text(
                  '$_position% Open',
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                    color: isLight
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBlindVisualization(BuildContext context, double coverHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final slatCount = (_position < 90 ? (160 * coverHeight / 12).floor() : 0);
    final tiltFactor = _tiltAngle / 90 * 0.5;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      height: _screenService.scale(
            160,
            density: _visualDensityService.density,
          ) *
          coverHeight,
      child: Column(
        children: List.generate(
          slatCount.clamp(0, 12),
          (i) => Transform(
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateX(tiltFactor),
            alignment: Alignment.center,
            child: Container(
              height: _screenService.scale(
                8,
                density: _visualDensityService.density,
              ),
              margin: EdgeInsets.only(
                bottom: 2,
                left: 2,
                right: 2,
              ),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(1),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: isLight
                      ? [const Color(0xFFE8E8E8), const Color(0xFFBDBDBD)]
                      : [const Color(0xFF505050), const Color(0xFF383838)],
                ),
                boxShadow: [
                  BoxShadow(
                    color:
                        AppColors.black.withValues(alpha: isLight ? 0.1 : 0.3),
                    offset: const Offset(0, 1),
                    blurRadius: 2,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPositionSliderWithLabels(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final localizations = AppLocalizations.of(context);

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
      child: Row(
        children: [
          Text(
            localizations?.window_covering_status_closed ?? 'Closed',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: isLight
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
          ),
          Expanded(
            child: SliderTheme(
              data: SliderThemeData(
                trackHeight: _screenService.scale(
                  8,
                  density: _visualDensityService.density,
                ),
                thumbShape: RoundSliderThumbShape(
                  enabledThumbRadius: _screenService.scale(
                    10,
                    density: _visualDensityService.density,
                  ),
                ),
                activeTrackColor:
                    isLight ? AppColorsLight.primary : AppColorsDark.primary,
                inactiveTrackColor:
                    isLight ? AppBorderColorLight.base : AppBorderColorDark.base,
                thumbColor:
                    isLight ? AppColorsLight.primary : AppColorsDark.primary,
                overlayColor:
                    (isLight ? AppColorsLight.primary : AppColorsDark.primary)
                        .withValues(alpha: 0.15),
              ),
              child: Slider(
                value: _position.toDouble(),
                min: _device.windowCoveringMinPercentage.toDouble(),
                max: _device.windowCoveringMaxPercentage.toDouble(),
                onChanged: _handlePositionChanged,
              ),
            ),
          ),
          Text(
            localizations?.window_covering_status_open ?? 'Open',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: isLight
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
          ),
        ],
      ),
    );
  }

  void _handlePositionChanged(double value) {
    final intValue = value.round();

    // Update local value immediately for smooth slider feedback
    setState(() {
      _localPosition = intValue;
    });

    // Debounce the actual command
    _positionDebounceTimer?.cancel();
    _positionDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;
        _controller?.setPosition(intValue);
      },
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Expanded(
          child: _buildQuickActionButton(
            context,
            label: localizations?.window_covering_command_open ?? 'Open',
            icon: MdiIcons.chevronUp,
            isActive: false,
            onTap: () => _controller?.open(),
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Expanded(
          child: _buildQuickActionButton(
            context,
            label: localizations?.window_covering_command_stop ?? 'Stop',
            icon: MdiIcons.stop,
            isActive: _device.isWindowCoveringStopped,
            onTap: () => _controller?.stop(),
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Expanded(
          child: _buildQuickActionButton(
            context,
            label: localizations?.window_covering_command_close ?? 'Close',
            icon: MdiIcons.chevronDown,
            isActive: false,
            onTap: () => _controller?.close(),
          ),
        ),
      ],
    );
  }

  Widget _buildQuickActionButton(
    BuildContext context, {
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        decoration: BoxDecoration(
          color: isActive
              ? (isLight ? AppColorsLight.primary : AppColorsDark.primary)
              : (isLight
                  ? AppFillColorLight.base
                  : AppFillColorDark.base),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: isActive || !isLight
              ? null
              : Border.all(color: AppBorderColorLight.base),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: _screenService.scale(
                20,
                density: _visualDensityService.density,
              ),
              color: isActive
                  ? AppColors.white
                  : (isLight
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular),
            ),
            AppSpacings.spacingXsHorizontal,
            Text(
              label,
              style: TextStyle(
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.w500,
                color: isActive
                    ? AppColors.white
                    : (isLight
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // TILT CONTROL
  // ===========================================================================

  Widget _buildTiltCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final localizations = AppLocalizations.of(context);

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight ? Border.all(color: AppBorderColorLight.base) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle(
            context,
            localizations?.window_covering_tilt_label ?? 'Tilt Angle',
            Icons.rotate_90_degrees_cw,
          ),
          AppSpacings.spacingMdVertical,
          Container(
            padding: AppSpacings.paddingMd,
            decoration: BoxDecoration(
              color: isLight
                  ? AppFillColorLight.base
                  : AppFillColorDark.base,
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
            ),
            child: Row(
              children: [
                Container(
                  width: _screenService.scale(
                    40,
                    density: _visualDensityService.density,
                  ),
                  height: _screenService.scale(
                    40,
                    density: _visualDensityService.density,
                  ),
                  decoration: BoxDecoration(
                    color: primaryColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppBorderRadius.small),
                  ),
                  child: Icon(
                    MdiIcons.rotateLeft,
                    color: primaryColor,
                    size: _screenService.scale(
                      22,
                      density: _visualDensityService.density,
                    ),
                  ),
                ),
                AppSpacings.spacingMdHorizontal,
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            localizations?.window_covering_tilt_label ?? 'Tilt',
                            style: TextStyle(
                              fontSize: AppFontSize.small,
                              color: isLight
                                  ? AppTextColorLight.secondary
                                  : AppTextColorDark.secondary,
                            ),
                          ),
                          Text(
                            '$_tiltAngle°',
                            style: TextStyle(
                              fontSize: AppFontSize.small,
                              fontWeight: FontWeight.w600,
                              color: primaryColor,
                            ),
                          ),
                        ],
                      ),
                      AppSpacings.spacingXsVertical,
                      SliderTheme(
                        data: SliderThemeData(
                          trackHeight: _screenService.scale(
                            8,
                            density: _visualDensityService.density,
                          ),
                          thumbShape: RoundSliderThumbShape(
                            enabledThumbRadius: _screenService.scale(
                              10,
                              density: _visualDensityService.density,
                            ),
                          ),
                          activeTrackColor: primaryColor,
                          inactiveTrackColor: isLight
                              ? AppBorderColorLight.base
                              : AppBorderColorDark.base,
                          thumbColor: primaryColor,
                        ),
                        child: Slider(
                          value: _tiltAngle.toDouble(),
                          min: _device.windowCoveringMinTilt.toDouble(),
                          max: _device.windowCoveringMaxTilt.toDouble(),
                          onChanged: _handleTiltChanged,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _handleTiltChanged(double value) {
    final intValue = value.round();

    // Update local value immediately for smooth slider feedback
    setState(() {
      _localTilt = intValue;
    });

    // Debounce the actual command
    _tiltDebounceTimer?.cancel();
    _tiltDebounceTimer = Timer(
      const Duration(milliseconds: 150),
      () {
        if (!mounted) return;
        _controller?.setTilt(intValue);
      },
    );
  }

  // ===========================================================================
  // INFO CARD
  // ===========================================================================

  Widget _buildInfoCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight ? Border.all(color: AppBorderColorLight.base) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle(context, 'Device Info', MdiIcons.informationOutline),
          AppSpacings.spacingMdVertical,
          Row(
            children: [
              Expanded(
                child: _buildInfoTile(
                  context,
                  'Type',
                  _getWindowCoveringTypeName(context),
                  isLight
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
              AppSpacings.spacingSmHorizontal,
              Expanded(
                child: _buildInfoTile(
                  context,
                  'Status',
                  _getStatusLabel(context),
                  _getStatusColor(context),
                ),
              ),
            ],
          ),
          if (_device.hasWindowCoveringObstruction) ...[
            AppSpacings.spacingSmVertical,
            _buildInfoTile(
              context,
              'Obstruction',
              _device.windowCoveringObstruction ? 'Detected' : 'Clear',
              _device.windowCoveringObstruction
                  ? (isLight ? AppColorsLight.warning : AppColorsDark.warning)
                  : (isLight ? AppColorsLight.success : AppColorsDark.success),
            ),
          ],
        ],
      ),
    );
  }

  Color _getStatusColor(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    if (_device.isWindowCoveringOpening || _device.isWindowCoveringClosing) {
      return isLight ? AppColorsLight.info : AppColorsDark.info;
    }
    return isLight ? AppColorsLight.warning : AppColorsDark.warning;
  }

  Widget _buildInfoRow(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Row(
      children: [
        Expanded(
          child: _buildInfoTileCompact(
            context,
            'Status',
            _getStatusLabel(context),
            _getStatusColor(context),
          ),
        ),
        if (_device.hasWindowCoveringObstruction) ...[
          AppSpacings.spacingSmHorizontal,
          Expanded(
            child: _buildInfoTileCompact(
              context,
              'Obstruction',
              _device.windowCoveringObstruction ? 'Detected' : 'Clear',
              _device.windowCoveringObstruction
                  ? (isLight ? AppColorsLight.warning : AppColorsDark.warning)
                  : (isLight ? AppColorsLight.success : AppColorsDark.success),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildInfoTile(
    BuildContext context,
    String label,
    String value,
    Color color,
  ) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    IconData getIcon() {
      switch (label) {
        case 'Status':
          return MdiIcons.clock;
        case 'Connection':
          return MdiIcons.checkCircle;
        case 'Type':
          return MdiIcons.blindsHorizontal;
        case 'Obstruction':
          return MdiIcons.alertCircle;
        default:
          return MdiIcons.information;
      }
    }

    return Container(
      padding: AppSpacings.paddingSm,
      decoration: BoxDecoration(
        color: isLight
            ? AppFillColorLight.base
            : AppFillColorDark.base,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        children: [
          Container(
            width: _screenService.scale(
              36,
              density: _visualDensityService.density,
            ),
            height: _screenService.scale(
              36,
              density: _visualDensityService.density,
            ),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppBorderRadius.small),
            ),
            child: Icon(
              getIcon(),
              color: color,
              size: _screenService.scale(
                18,
                density: _visualDensityService.density,
              ),
            ),
          ),
          AppSpacings.spacingSmHorizontal,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    color: isLight
                        ? AppTextColorLight.placeholder
                        : AppTextColorDark.placeholder,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: AppFontSize.small,
                    fontWeight: FontWeight.w600,
                    color: isLight
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoTileCompact(
    BuildContext context,
    String label,
    String value,
    Color color,
  ) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      padding: AppSpacings.paddingSm,
      decoration: BoxDecoration(
        color: isLight
            ? AppFillColorLight.base
            : AppFillColorDark.base,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        children: [
          Container(
            width: _screenService.scale(
              36,
              density: _visualDensityService.density,
            ),
            height: _screenService.scale(
              36,
              density: _visualDensityService.density,
            ),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(AppBorderRadius.small),
            ),
            child: Icon(
              label == 'Status'
                  ? MdiIcons.clock
                  : label == 'Obstruction'
                      ? MdiIcons.alertCircle
                      : MdiIcons.checkCircle,
              color: color,
              size: _screenService.scale(
                18,
                density: _visualDensityService.density,
              ),
            ),
          ),
          AppSpacings.spacingSmHorizontal,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    color: isLight
                        ? AppTextColorLight.placeholder
                        : AppTextColorDark.placeholder,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: AppFontSize.small,
                    fontWeight: FontWeight.w600,
                    color: isLight
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // PRESETS
  // ===========================================================================

  Widget _buildPresetsCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight ? Border.all(color: AppBorderColorLight.base) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle(context, 'Presets', MdiIcons.tune),
          AppSpacings.spacingMdVertical,
          Expanded(
            child: GridView.count(
              crossAxisCount: 3,
              mainAxisSpacing: AppSpacings.pSm,
              crossAxisSpacing: AppSpacings.pSm,
              childAspectRatio: 0.9,
              children: _presets.map((preset) {
                return _buildPresetButton(context, preset);
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPresetsHorizontalScroll(BuildContext context) {
    return SizedBox(
      height: _screenService.scale(
        72,
        density: _visualDensityService.density,
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _presets.length,
        separatorBuilder: (_, __) => AppSpacings.spacingSmHorizontal,
        itemBuilder: (context, index) {
          return SizedBox(
            width: _screenService.scale(
              140,
              density: _visualDensityService.density,
            ),
            child: _buildPresetCard(context, _presets[index]),
          );
        },
      ),
    );
  }

  Widget _buildPresetButton(BuildContext context, _Preset preset) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final bool isActive = _position == preset.position;

    return GestureDetector(
      onTap: () => _applyPreset(preset),
      child: Container(
        decoration: BoxDecoration(
          color: isActive
              ? primaryColor
              : (isLight
                  ? AppFillColorLight.base
                  : AppFillColorDark.base),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: isActive || !isLight
              ? null
              : Border.all(color: AppBorderColorLight.base),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              preset.icon,
              size: _screenService.scale(
                26,
                density: _visualDensityService.density,
              ),
              color: isActive
                  ? AppColors.white
                  : (isLight
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary),
            ),
            AppSpacings.spacingXsVertical,
            Text(
              preset.name,
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                fontWeight: FontWeight.w500,
                color: isActive
                    ? AppColors.white
                    : (isLight
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPresetCard(BuildContext context, _Preset preset) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final bool isActive = _position == preset.position;

    return GestureDetector(
      onTap: () => _applyPreset(preset),
      child: Container(
        padding: EdgeInsets.all(AppSpacings.pSm),
        decoration: BoxDecoration(
          color: isActive
              ? primaryColor.withValues(alpha: 0.15)
              : (isLight
                  ? AppFillColorLight.base
                  : AppFillColorDark.base),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: isActive
              ? Border.all(color: primaryColor)
              : (isLight ? Border.all(color: AppBorderColorLight.base) : null),
        ),
        child: Row(
          children: [
            Container(
              width: _screenService.scale(
                36,
                density: _visualDensityService.density,
              ),
              height: _screenService.scale(
                36,
                density: _visualDensityService.density,
              ),
              decoration: BoxDecoration(
                color: isActive
                    ? primaryColor
                    : (isLight
                        ? AppFillColorLight.light
                        : AppFillColorDark.light),
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
              ),
              child: Icon(
                preset.icon,
                size: _screenService.scale(
                  20,
                  density: _visualDensityService.density,
                ),
                color: isActive
                    ? AppColors.white
                    : (isLight
                        ? AppTextColorLight.secondary
                        : AppTextColorDark.secondary),
              ),
            ),
            AppSpacings.spacingSmHorizontal,
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    preset.name,
                    style: TextStyle(
                      fontSize: AppFontSize.small,
                      fontWeight: FontWeight.w500,
                      color: isLight
                          ? AppTextColorLight.regular
                          : AppTextColorDark.regular,
                    ),
                  ),
                  Text(
                    '${preset.position}%',
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      color: isLight
                          ? AppTextColorLight.placeholder
                          : AppTextColorDark.placeholder,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _applyPreset(_Preset preset) {
    _controller?.setPosition(preset.position);
    if (preset.tiltAngle != null && _device.hasWindowCoveringTilt) {
      _controller?.setTilt(preset.tiltAngle!);
    }
  }

  // ===========================================================================
  // COMMON WIDGETS
  // ===========================================================================

  Widget _buildCardTitle(BuildContext context, String title, IconData icon) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Row(
      children: [
        Icon(
          icon,
          color: isLight
              ? AppTextColorLight.secondary
              : AppTextColorDark.secondary,
          size: _screenService.scale(
            18,
            density: _visualDensityService.density,
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Text(
          title.toUpperCase(),
          style: TextStyle(
            fontSize: AppFontSize.small,
            fontWeight: FontWeight.w600,
            color: isLight
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildSectionTitle(BuildContext context, String title, IconData icon) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Row(
      children: [
        Icon(
          icon,
          color: isLight
              ? AppTextColorLight.secondary
              : AppTextColorDark.secondary,
          size: _screenService.scale(
            18,
            density: _visualDensityService.density,
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Text(
          title.toUpperCase(),
          style: TextStyle(
            fontSize: AppFontSize.small,
            fontWeight: FontWeight.w600,
            color: isLight
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

// ===========================================================================
// PRESET DATA MODEL
// ===========================================================================

class _Preset {
  final String name;
  final IconData icon;
  final int position;
  final int? tiltAngle;

  const _Preset({
    required this.name,
    required this.icon,
    required this.position,
    this.tiltAngle,
  });
}
