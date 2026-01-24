import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_landscape_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/device_detail_portrait_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
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

  // Selected preset index (null = no preset selected)
  int? _selectedPresetIndex;

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

    return PageHeader(
      title: widget._device.name,
      subtitle: '${_getStatusLabel(context)} • $_position%',
      subtitleColor: _getStatusColor(context),
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
        case WindowCoveringTypeValue.venetianBlind:
          return localizations.window_covering_type_venetian_blind;
        case WindowCoveringTypeValue.verticalBlind:
          return localizations.window_covering_type_vertical_blind;
        case WindowCoveringTypeValue.roller:
          return localizations.window_covering_type_roller;
        case WindowCoveringTypeValue.shutter:
          return localizations.window_covering_type_shutter;
        case WindowCoveringTypeValue.outdoorBlind:
          return localizations.window_covering_type_outdoor_blind;
        case WindowCoveringTypeValue.awning:
          return localizations.window_covering_type_awning;
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
    return DeviceDetailLandscapeLayout(
      mainContentFlex: 2,
      secondaryContentFlex: 1,
      mainContent: _buildMainControlCard(context),
      secondaryContent: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
      secondaryScrollable: false,
    );
  }

  // ===========================================================================
  // PORTRAIT LAYOUT
  // ===========================================================================

  Widget _buildPortraitLayout(BuildContext context) {
    return DeviceDetailPortraitLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildMainControlCard(context),
          AppSpacings.spacingMdVertical,
          if (_device.hasWindowCoveringTilt) ...[
            _buildTiltCard(context),
            AppSpacings.spacingMdVertical,
          ],
          _buildPresetsWithGradient(context),
          AppSpacings.spacingMdVertical,
          _buildInfoRow(context),
        ],
      ),
    );
  }

  /// Builds the presets horizontal scroll with edge gradients that extend
  /// over the layout padding to the screen edges.
  Widget _buildPresetsWithGradient(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;

    // Calculate tile dimensions
    final tileWidth = _screenService.scale(
      AppTileWidth.horizontalMedium,
      density: _visualDensityService.density,
    );
    final tileHeight = tileWidth / AppTileAspectRatio.wide;

    return HorizontalScrollWithGradient(
      height: tileHeight,
      layoutPadding: AppSpacings.pLg,
      itemCount: _presets.length,
      separatorWidth: AppSpacings.pSm,
      itemBuilder: (context, index) {
        final preset = _presets[index];
        final bool isActive = _isPresetActive(index);

        return SizedBox(
          width: tileWidth,
          height: tileHeight,
          child: UniversalTile(
            layout: TileLayout.horizontal,
            icon: preset.icon,
            name: preset.name,
            status: '${preset.position}%',
            isActive: isActive,
            activeColor: primaryColor,
            onTileTap: () => _applyPreset(index),
            showGlow: false,
            showWarningBadge: false,
            showInactiveBorder: isLight,
          ),
        );
      },
    );
  }

  // ===========================================================================
  // MAIN CONTROL CARD
  // ===========================================================================

  Widget _buildMainControlCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      padding: AppSpacings.paddingLg,
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
          _buildPositionSlider(context),
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
          // Type-specific visualization
          _buildCoverVisualization(context, coverHeight),
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

  Widget _buildCoverVisualization(BuildContext context, double coverHeight) {
    try {
      switch (_device.windowCoveringType) {
        case WindowCoveringTypeValue.blind:
        case WindowCoveringTypeValue.venetianBlind:
          return _buildBlindVisualization(context, coverHeight);
        case WindowCoveringTypeValue.curtain:
        case WindowCoveringTypeValue.verticalBlind:
          return _buildCurtainVisualization(context);
        case WindowCoveringTypeValue.roller:
        case WindowCoveringTypeValue.awning:
          return _buildRollerVisualization(context, coverHeight);
        case WindowCoveringTypeValue.shutter:
        case WindowCoveringTypeValue.outdoorBlind:
          return _buildOutdoorBlindVisualization(context, coverHeight);
      }
    } catch (_) {
      // Default to blind visualization if type is unknown
      return _buildBlindVisualization(context, coverHeight);
    }
  }

  Widget _buildBlindVisualization(BuildContext context, double coverHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    // Each slat is 8px + 2px margin = 10px, need more slats to fill container
    final slatCount = (_position < 90 ? (160 * coverHeight / 8).floor() : 0);
    final tiltFactor = _tiltAngle / 90 * 0.5;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(),
      height: _screenService.scale(
            160,
            density: _visualDensityService.density,
          ) *
          coverHeight,
      child: Column(
        children: List.generate(
          slatCount.clamp(0, 18),
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

  Widget _buildCurtainVisualization(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final panelWidth = (100 - _position) / 100 * 0.5;
    final containerWidth = _screenService.scale(
      180,
      density: _visualDensityService.density,
    );
    final containerHeight = _screenService.scale(
      160,
      density: _visualDensityService.density,
    );

    return SizedBox(
      width: containerWidth,
      height: containerHeight,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Left panel
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: (containerWidth - 8) * panelWidth,
            height: containerHeight,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: isLight
                    ? [
                        const Color(0xFFD7CCC8),
                        const Color(0xFFBCAAA4),
                        const Color(0xFFA1887F)
                      ]
                    : [
                        const Color(0xFF5D4037),
                        const Color(0xFF4E342E),
                        const Color(0xFF3E2723)
                      ],
              ),
            ),
            child: _buildCurtainFolds(isLight),
          ),
          // Right panel
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            width: (containerWidth - 8) * panelWidth,
            height: containerHeight,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerRight,
                end: Alignment.centerLeft,
                colors: isLight
                    ? [
                        const Color(0xFFD7CCC8),
                        const Color(0xFFBCAAA4),
                        const Color(0xFFA1887F)
                      ]
                    : [
                        const Color(0xFF5D4037),
                        const Color(0xFF4E342E),
                        const Color(0xFF3E2723)
                      ],
              ),
            ),
            child: _buildCurtainFolds(isLight),
          ),
        ],
      ),
    );
  }

  Widget _buildCurtainFolds(bool isLight) {
    return CustomPaint(
      painter: _CurtainFoldsPainter(isLight: isLight),
      size: Size.infinite,
    );
  }

  Widget _buildRollerVisualization(BuildContext context, double coverHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    // Account for window border (4px on each side = 8px total)
    final containerHeight = _screenService.scale(
      152,
      density: _visualDensityService.density,
    );
    final tubeHeight = _screenService.scale(
      12,
      density: _visualDensityService.density,
    );
    final shadeMaxHeight = containerHeight - tubeHeight;

    return Column(
      children: [
        // Roller housing/cover at top
        Container(
          height: tubeHeight,
          decoration: BoxDecoration(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: isLight
                  ? [const Color(0xFF9E9E9E), const Color(0xFF757575)]
                  : [const Color(0xFF616161), const Color(0xFF424242)],
            ),
          ),
        ),
        // Shade
        AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          height: (shadeMaxHeight * coverHeight).clamp(0.0, shadeMaxHeight),
          margin: const EdgeInsets.symmetric(horizontal: 2),
          decoration: BoxDecoration(
            borderRadius:
                const BorderRadius.vertical(bottom: Radius.circular(4)),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: isLight
                  ? [const Color(0xFFECEFF1), const Color(0xFFCFD8DC)]
                  : [const Color(0xFF455A64), const Color(0xFF37474F)],
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.black.withValues(alpha: isLight ? 0.15 : 0.3),
                offset: const Offset(0, 2),
                blurRadius: 8,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildOutdoorBlindVisualization(
      BuildContext context, double coverHeight) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    // Each slat is 10px + 3px margin = 13px, but with scaling we need more
    final slatCount = (_position < 90 ? (160 * coverHeight / 11).floor() : 0);
    final tiltFactor = _tiltAngle / 90 * 0.5;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      clipBehavior: Clip.hardEdge,
      decoration: const BoxDecoration(),
      height: _screenService.scale(
            160,
            density: _visualDensityService.density,
          ) *
          coverHeight,
      child: Column(
          children: List.generate(
            slatCount.clamp(0, 14),
            (i) => Transform(
              transform: Matrix4.identity()
                ..setEntry(3, 2, 0.001)
                ..rotateX(tiltFactor),
              alignment: Alignment.center,
              child: Container(
                height: _screenService.scale(
                  10,
                  density: _visualDensityService.density,
                ),
                margin: EdgeInsets.only(
                  bottom: 3,
                  left: 3,
                  right: 3,
                ),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: isLight
                        ? [const Color(0xFFA1887F), const Color(0xFF8D6E63)]
                        : [const Color(0xFF6D4C41), const Color(0xFF5D4037)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color:
                          AppColors.black.withValues(alpha: isLight ? 0.15 : 0.3),
                      offset: const Offset(0, 1),
                      blurRadius: 3,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
    );
  }

  Widget _buildPositionSlider(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final localizations = AppLocalizations.of(context);
    final normalizedValue = _position / 100.0;

    return SliderWithSteps(
      value: normalizedValue,
      activeColor: isLight ? AppColorsLight.primary : AppColorsDark.primary,
      steps: [
        localizations?.window_covering_status_closed ?? 'Closed',
        '25%',
        '50%',
        '75%',
        localizations?.window_covering_status_open ?? 'Open',
      ],
      onChanged: (value) {
        final newPosition = (value * 100).round();
        _handlePositionChanged(newPosition.toDouble());
      },
    );
  }

  void _handlePositionChanged(double value) {
    final intValue = value.round();

    // Update local value immediately for smooth slider feedback
    // Clear selected preset when user manually changes position
    setState(() {
      _localPosition = intValue;
      _selectedPresetIndex = null;
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

    final minTilt = _device.windowCoveringMinTilt;
    final maxTilt = _device.windowCoveringMaxTilt;
    final tiltRange = maxTilt - minTilt;
    final normalizedValue = tiltRange > 0 ? (_tiltAngle - minTilt) / tiltRange : 0.5;

    return _TiltSlider(
      value: normalizedValue.clamp(0.0, 1.0),
      activeColor: primaryColor,
      label: localizations?.window_covering_tilt_label ?? 'Tilt Angle',
      valueLabel: '$_tiltAngle°',
      steps: [
        '$minTilt°',
        '${((maxTilt + minTilt) / 2).round()}°',
        '$maxTilt°',
      ],
      onChanged: (value) {
        final newTilt = (minTilt + value * tiltRange).round();
        _handleTiltChanged(newTilt.toDouble());
      },
    );
  }

  void _handleTiltChanged(double value) {
    final intValue = value.round();

    // Update local value immediately for smooth slider feedback
    // Clear selected preset when user manually changes tilt
    setState(() {
      _localTilt = intValue;
      _selectedPresetIndex = null;
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
    final secondaryColor =
        isLight ? AppTextColorLight.secondary : AppTextColorDark.secondary;

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
                child: UniversalTile(
                  layout: TileLayout.horizontal,
                  icon: MdiIcons.blindsHorizontal,
                  name: 'Type',
                  status: _getWindowCoveringTypeName(context),
                  isActive: false,
                  iconAccentColor: secondaryColor,
                  showGlow: false,
                  showWarningBadge: false,
                  showInactiveBorder: isLight,
                ),
              ),
              AppSpacings.spacingSmHorizontal,
              Expanded(
                child: UniversalTile(
                  layout: TileLayout.horizontal,
                  icon: _getStatusIcon(),
                  name: 'Status',
                  status: _getStatusLabel(context),
                  isActive: false,
                  iconAccentColor: _getStatusColor(context),
                  showGlow: false,
                  showWarningBadge: false,
                  showInactiveBorder: isLight,
                ),
              ),
            ],
          ),
          if (_device.hasWindowCoveringObstruction) ...[
            AppSpacings.spacingSmVertical,
            UniversalTile(
              layout: TileLayout.horizontal,
              icon: _device.windowCoveringObstruction
                  ? MdiIcons.alertCircle
                  : MdiIcons.checkCircle,
              name: 'Obstruction',
              status: _device.windowCoveringObstruction ? 'Detected' : 'Clear',
              isActive: false,
              iconAccentColor: _device.windowCoveringObstruction
                  ? (isLight ? AppColorsLight.warning : AppColorsDark.warning)
                  : (isLight ? AppColorsLight.success : AppColorsDark.success),
              showGlow: false,
              showWarningBadge: false,
              showInactiveBorder: isLight,
            ),
          ],
        ],
      ),
    );
  }

  Color _getStatusColor(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    switch (_device.windowCoveringStatus) {
      case WindowCoveringStatusValue.opened:
        return isLight ? AppColorsLight.success : AppColorsDark.success;
      case WindowCoveringStatusValue.closed:
        return isLight ? AppTextColorLight.secondary : AppTextColorDark.secondary;
      case WindowCoveringStatusValue.opening:
      case WindowCoveringStatusValue.closing:
        return isLight ? AppColorsLight.info : AppColorsDark.info;
      case WindowCoveringStatusValue.stopped:
        return isLight ? AppColorsLight.warning : AppColorsDark.warning;
    }
  }

  IconData _getStatusIcon() {
    switch (_device.windowCoveringStatus) {
      case WindowCoveringStatusValue.opened:
        return MdiIcons.blindsOpen;
      case WindowCoveringStatusValue.closed:
        return MdiIcons.blinds;
      case WindowCoveringStatusValue.opening:
        return MdiIcons.arrowUpBold;
      case WindowCoveringStatusValue.closing:
        return MdiIcons.arrowDownBold;
      case WindowCoveringStatusValue.stopped:
        return MdiIcons.pauseCircle;
    }
  }

  Widget _buildInfoRow(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Row(
      children: [
        Expanded(
          child: UniversalTile(
            layout: TileLayout.horizontal,
            icon: _getStatusIcon(),
            name: 'Status',
            status: _getStatusLabel(context),
            isActive: false,
            activeColor: _getStatusColor(context),
            iconAccentColor: _getStatusColor(context),
            showGlow: false,
            showWarningBadge: false,
            showInactiveBorder: isLight,
          ),
        ),
        if (_device.hasWindowCoveringObstruction) ...[
          AppSpacings.spacingSmHorizontal,
          Expanded(
            child: UniversalTile(
              layout: TileLayout.horizontal,
              icon: _device.windowCoveringObstruction
                  ? MdiIcons.alertCircle
                  : MdiIcons.checkCircle,
              name: 'Obstruction',
              status: _device.windowCoveringObstruction ? 'Detected' : 'Clear',
              isActive: false,
              activeColor: _device.windowCoveringObstruction
                  ? (isLight ? AppColorsLight.warning : AppColorsDark.warning)
                  : (isLight ? AppColorsLight.success : AppColorsDark.success),
              iconAccentColor: _device.windowCoveringObstruction
                  ? (isLight ? AppColorsLight.warning : AppColorsDark.warning)
                  : (isLight ? AppColorsLight.success : AppColorsDark.success),
              showGlow: false,
              showWarningBadge: false,
              showInactiveBorder: isLight,
            ),
          ),
        ],
      ],
    );
  }

  // ===========================================================================
  // PRESETS
  // ===========================================================================


  Widget _buildPresetsCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight ? Border.all(color: AppBorderColorLight.base) : null,
      ),
      child: GridView.count(
        crossAxisCount: 3,
        mainAxisSpacing: AppSpacings.pSm,
        crossAxisSpacing: AppSpacings.pSm,
        childAspectRatio: AppTileAspectRatio.wide,
        children: _presets.asMap().entries.map((entry) {
          final index = entry.key;
          final preset = entry.value;
          final bool isActive = _isPresetActive(index);

          return UniversalTile(
            layout: TileLayout.horizontal,
            icon: preset.icon,
            name: preset.name,
            status: '${preset.position}%',
            isActive: isActive,
            activeColor: primaryColor,
            onTileTap: () => _applyPreset(index),
            showGlow: false,
            showWarningBadge: false,
            showInactiveBorder: isLight,
          );
        }).toList(),
      ),
    );
  }

  void _applyPreset(int index) {
    final preset = _presets[index];

    // Store selected preset index
    setState(() {
      _selectedPresetIndex = index;
    });

    _controller?.setPosition(preset.position);
    if (preset.tiltAngle != null && _device.hasWindowCoveringTilt) {
      _controller?.setTilt(preset.tiltAngle!);
    }
  }

  /// Check if a preset is active (selected AND values match)
  bool _isPresetActive(int index) {
    if (_selectedPresetIndex != index) return false;

    final preset = _presets[index];

    // Check position matches
    if (_position != preset.position) return false;

    // Check tilt matches if device supports it and preset has tilt
    if (_device.hasWindowCoveringTilt && preset.tiltAngle != null) {
      if (_tiltAngle != preset.tiltAngle) return false;
    }

    return true;
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

}

// ===========================================================================
// TILT SLIDER WIDGET (SpeedSlider-style UI for tilt control)
// ===========================================================================

/// A tilt slider widget that follows SpeedSlider's visual design.
///
/// Shows label on the left, value in degrees on the right, and a slider below.
class _TiltSlider extends StatelessWidget {
  final double value;
  final Color? activeColor;
  final String label;
  final String valueLabel;
  final List<String> steps;
  final ValueChanged<double>? onChanged;

  const _TiltSlider({
    required this.value,
    this.activeColor,
    required this.label,
    required this.valueLabel,
    required this.steps,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.info : AppColorsLight.info);
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();

    return Container(
      padding: AppSpacings.paddingLg,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
        border: Border.all(
          color: borderColor,
          width: screenService.scale(1, density: visualDensityService.density),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: secondaryColor,
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                valueLabel,
                style: TextStyle(
                  color: textColor,
                  fontSize: AppFontSize.extraLarge,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          AppSpacings.spacingMdVertical,
          SliderWithSteps(
            value: value,
            activeColor: effectiveActiveColor,
            steps: steps,
            onChanged: onChanged,
          ),
        ],
      ),
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

// ===========================================================================
// CURTAIN FOLDS PAINTER
// ===========================================================================

/// CustomPainter that draws vertical fold lines for curtain visualization.
class _CurtainFoldsPainter extends CustomPainter {
  final bool isLight;

  _CurtainFoldsPainter({required this.isLight});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.black.withValues(alpha: isLight ? 0.05 : 0.15)
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    // Draw vertical fold lines
    for (double x = 4; x < size.width; x += 8) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(x, size.height),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
