import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Window covering device detail page - mock implementation.
///
/// Shows a window covering control interface with position slider,
/// tilt control (if supported), and quick action buttons.
class WindowCoveringDeviceDetail extends StatefulWidget {
  final WindowCoveringDeviceView _device;

  const WindowCoveringDeviceDetail({
    super.key,
    required WindowCoveringDeviceView device,
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

  // Mock state
  late int _position;
  late int _tiltAngle;
  late AnimationController _animationController;

  // Mock presets
  static const _mockPresets = [
    _MockPreset(name: 'Morning', icon: Icons.wb_sunny, position: 100),
    _MockPreset(name: 'Day', icon: Icons.light_mode, position: 75),
    _MockPreset(name: 'Evening', icon: Icons.nights_stay, position: 30),
    _MockPreset(name: 'Night', icon: Icons.bedtime, position: 0),
    _MockPreset(name: 'Privacy', icon: Icons.lock, position: 0, tiltAngle: 45),
    _MockPreset(name: 'Away', icon: Icons.home, position: 0),
  ];

  @override
  void initState() {
    super.initState();
    _position = widget._device.isWindowCoveringPercentage;
    _tiltAngle = widget._device.hasWindowCoveringTilt
        ? widget._device.isWindowCoveringTilt
        : 0;

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isLandscape = constraints.maxWidth > constraints.maxHeight;

        if (isLandscape) {
          return _buildLandscapeLayout(context);
        } else {
          return _buildPortraitLayout(context);
        }
      },
    );
  }

  // ===========================================================================
  // HEADER
  // ===========================================================================

  Widget _buildHeader(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final primaryBgColor =
        isLight ? AppColorsLight.primaryLight9 : AppColorsDark.primaryLight9;

    return PageHeader(
      title: widget._device.name,
      subtitle: widget._device.windowCoveringTypeName,
      backgroundColor: AppColors.blank,
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HeaderIconButton(
            icon: Icons.arrow_back_ios_new,
            onTap: () => Navigator.of(context).pop(),
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
  // LANDSCAPE LAYOUT
  // ===========================================================================

  Widget _buildLandscapeLayout(BuildContext context) {
    return Column(
      children: [
        _buildHeader(context),
        Expanded(
          child: Padding(
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
                      if (widget._device.hasWindowCoveringTilt) ...[
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
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // PORTRAIT LAYOUT
  // ===========================================================================

  Widget _buildPortraitLayout(BuildContext context) {
    return Column(
      children: [
        _buildHeader(context),
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacings.paddingMd,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildMainControlCard(context),
                AppSpacings.spacingMdVertical,
                if (widget._device.hasWindowCoveringTilt) ...[
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
          ),
        ),
      ],
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

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
      child: Row(
        children: [
          Text(
            'Closed',
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
                min: 0,
                max: 100,
                onChanged: (value) {
                  setState(() => _position = value.round());
                },
              ),
            ),
          ),
          Text(
            'Open',
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

  Widget _buildQuickActions(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Expanded(
          child: _buildQuickActionButton(
            context,
            label: 'Open',
            icon: MdiIcons.chevronUp,
            isActive: false,
            onTap: () => setState(() => _position = 100),
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Expanded(
          child: _buildQuickActionButton(
            context,
            label: 'Stop',
            icon: MdiIcons.stop,
            isActive: true,
            onTap: () {},
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Expanded(
          child: _buildQuickActionButton(
            context,
            label: 'Close',
            icon: MdiIcons.chevronDown,
            isActive: false,
            onTap: () => setState(() => _position = 0),
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
          _buildCardTitle(context, 'Tilt Angle', Icons.rotate_90_degrees_cw),
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
                            'Tilt',
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
                          min: -90,
                          max: 90,
                          onChanged: (value) {
                            setState(() => _tiltAngle = value.round());
                          },
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
                  widget._device.windowCoveringTypeName,
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
                  'Idle',
                  isLight ? AppColorsLight.warning : AppColorsDark.warning,
                ),
              ),
            ],
          ),
          AppSpacings.spacingSmVertical,
          Row(
            children: [
              Expanded(
                child: _buildInfoTile(
                  context,
                  'Connection',
                  widget._device.isOnline ? 'Online' : 'Offline',
                  widget._device.isOnline
                      ? (isLight ? AppColorsLight.success : AppColorsDark.success)
                      : (isLight ? AppColorsLight.danger : AppColorsDark.danger),
                ),
              ),
              AppSpacings.spacingSmHorizontal,
              const Expanded(child: SizedBox.shrink()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Row(
      children: [
        Expanded(
          child: _buildInfoTileCompact(
            context,
            'Status',
            'Idle',
            isLight ? AppColorsLight.warning : AppColorsDark.warning,
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Expanded(
          child: _buildInfoTileCompact(
            context,
            'Connection',
            widget._device.isOnline ? 'Online' : 'Offline',
            widget._device.isOnline
                ? (isLight ? AppColorsLight.success : AppColorsDark.success)
                : (isLight ? AppColorsLight.danger : AppColorsDark.danger),
          ),
        ),
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
              label == 'Status' ? MdiIcons.clock : MdiIcons.checkCircle,
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
              children: _mockPresets.map((preset) {
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
        itemCount: _mockPresets.length,
        separatorBuilder: (_, __) => AppSpacings.spacingSmHorizontal,
        itemBuilder: (context, index) {
          return SizedBox(
            width: _screenService.scale(
              140,
              density: _visualDensityService.density,
            ),
            child: _buildPresetCard(context, _mockPresets[index]),
          );
        },
      ),
    );
  }

  Widget _buildPresetButton(BuildContext context, _MockPreset preset) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final bool isActive = _position == preset.position;

    return GestureDetector(
      onTap: () {
        setState(() => _position = preset.position);
        if (preset.tiltAngle != null) {
          setState(() => _tiltAngle = preset.tiltAngle!);
        }
      },
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

  Widget _buildPresetCard(BuildContext context, _MockPreset preset) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final bool isActive = _position == preset.position;

    return GestureDetector(
      onTap: () {
        setState(() => _position = preset.position);
        if (preset.tiltAngle != null) {
          setState(() => _tiltAngle = preset.tiltAngle!);
        }
      },
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
// MOCK DATA MODEL
// ===========================================================================

class _MockPreset {
  final String name;
  final IconData icon;
  final int position;
  final int? tiltAngle;

  const _MockPreset({
    required this.name,
    required this.icon,
    required this.position,
    this.tiltAngle,
  });
}

// ===========================================================================
// EXTENSION FOR DEVICE TYPE NAME
// ===========================================================================

extension _WindowCoveringDeviceViewExtension on WindowCoveringDeviceView {
  String get windowCoveringTypeName {
    switch (windowCoveringType.name) {
      case 'curtain':
        return 'Curtain';
      case 'blind':
        return 'Blind';
      case 'roller':
        return 'Roller Shade';
      case 'outdoorBlind':
        return 'Outdoor Blind';
      default:
        return 'Window Covering';
    }
  }
}
