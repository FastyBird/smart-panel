import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Shading domain view page - shows window covering devices in a room.
///
/// This is a mock implementation that displays sample shading data
/// without connecting to actual device data models.
class ShadingDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const ShadingDomainViewPage({super.key, required this.viewItem});

  @override
  State<ShadingDomainViewPage> createState() => _ShadingDomainViewPageState();
}

class _ShadingDomainViewPageState extends State<ShadingDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  // Mock state for slider interaction
  int _aggregatedPosition = 55;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppTopBar(
        title: widget.viewItem.title,
        icon: MdiIcons.blindsHorizontal,
      ),
      body: SafeArea(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: _buildContent(context),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context) {
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
  // LANDSCAPE LAYOUT
  // ===========================================================================

  Widget _buildLandscapeLayout(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left: Main Control
        Expanded(
          flex: 2,
          child: Column(
            children: [
              // Primary Role Card
              Expanded(
                child: _buildRoleCard(
                  context,
                  name: 'Indoor Shading',
                  roleType: 'Primary',
                  deviceCount: 6,
                  position: _aggregatedPosition,
                  showSlider: true,
                  showActions: true,
                ),
              ),
              AppSpacings.spacingMdVertical,
              // Auxiliary Role Card
              _buildRoleCard(
                context,
                name: 'Outdoor Shading',
                roleType: 'Auxiliary',
                deviceCount: 2,
                position: 30,
              ),
            ],
          ),
        ),
        AppSpacings.spacingMdHorizontal,
        // Right: Presets & Devices
        SizedBox(
          width: _screenService.scale(
            280,
            density: _visualDensityService.density,
          ),
          child: Column(
            children: [
              _buildPresetsCard(context),
              AppSpacings.spacingMdVertical,
              Expanded(child: _buildDevicesCard(context)),
            ],
          ),
        ),
      ],
    );
  }

  // ===========================================================================
  // PORTRAIT LAYOUT
  // ===========================================================================

  Widget _buildPortraitLayout(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Primary Role Card
          _buildRoleCard(
            context,
            name: 'Indoor Shading',
            roleType: 'Primary',
            deviceCount: 6,
            position: _aggregatedPosition,
            showSlider: true,
            showActions: true,
          ),
          AppSpacings.spacingMdVertical,
          // Auxiliary Role Card
          _buildRoleCard(
            context,
            name: 'Outdoor Shading',
            roleType: 'Auxiliary',
            deviceCount: 2,
            position: 30,
          ),
          AppSpacings.spacingLgVertical,
          // Presets Section
          _buildSectionTitle(context, 'Presets', MdiIcons.tune),
          AppSpacings.spacingSmVertical,
          _buildPresetsHorizontalScroll(context),
          AppSpacings.spacingLgVertical,
          // Devices Section
          _buildSectionTitle(context, 'Devices', MdiIcons.viewGrid),
          AppSpacings.spacingSmVertical,
          _buildDevicesGrid(context),
        ],
      ),
    );
  }

  // ===========================================================================
  // ROLE CARDS
  // ===========================================================================

  Widget _buildRoleCard(
    BuildContext context, {
    required String name,
    required String roleType,
    required int deviceCount,
    required int position,
    bool showSlider = false,
    bool showActions = false,
  }) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final Color stateColor = _getPositionColor(position, isLight);
    final Color stateColorLight = stateColor.withValues(alpha: 0.15);

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight
            ? Border.all(color: AppBorderColorLight.base)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Row
          Row(
            children: [
              // Role Icon
              Container(
                width: _screenService.scale(
                  48,
                  density: _visualDensityService.density,
                ),
                height: _screenService.scale(
                  48,
                  density: _visualDensityService.density,
                ),
                decoration: BoxDecoration(
                  color: stateColorLight,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Icon(
                  MdiIcons.blindsHorizontal,
                  color: stateColor,
                  size: _screenService.scale(
                    24,
                    density: _visualDensityService.density,
                  ),
                ),
              ),
              AppSpacings.spacingMdHorizontal,
              // Title
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: TextStyle(
                        fontSize: AppFontSize.large,
                        fontWeight: FontWeight.w600,
                        color: isLight
                            ? AppTextColorLight.regular
                            : AppTextColorDark.regular,
                      ),
                    ),
                    Text(
                      '$deviceCount devices - $roleType',
                      style: TextStyle(
                        fontSize: AppFontSize.small,
                        color: isLight
                            ? AppTextColorLight.secondary
                            : AppTextColorDark.secondary,
                      ),
                    ),
                  ],
                ),
              ),
              // Position Value
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '$position%',
                    style: TextStyle(
                      fontSize: _screenService.scale(
                        28,
                        density: _visualDensityService.density,
                      ),
                      fontWeight: FontWeight.w300,
                      color: isLight
                          ? AppColorsLight.primary
                          : AppColorsDark.primary,
                    ),
                  ),
                  Text(
                    _getPositionText(position),
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      color: isLight
                          ? AppTextColorLight.placeholder
                          : AppTextColorDark.placeholder,
                    ),
                  ),
                ],
              ),
            ],
          ),
          // Slider
          if (showSlider) ...[
            AppSpacings.spacingMdVertical,
            _buildPositionSlider(context, position),
          ],
          // Quick Actions
          if (showActions) ...[
            AppSpacings.spacingMdVertical,
            _buildQuickActions(context),
          ],
        ],
      ),
    );
  }

  Widget _buildPositionSlider(BuildContext context, int position) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return SliderTheme(
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
        thumbColor: isLight ? AppColorsLight.primary : AppColorsDark.primary,
        overlayColor: (isLight ? AppColorsLight.primary : AppColorsDark.primary)
            .withValues(alpha: 0.15),
      ),
      child: Slider(
        value: _aggregatedPosition.toDouble(),
        min: 0,
        max: 100,
        onChanged: (value) {
          setState(() => _aggregatedPosition = value.round());
        },
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
            onTap: () {
              setState(() => _aggregatedPosition = 100);
            },
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
            onTap: () {
              setState(() => _aggregatedPosition = 0);
            },
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
                18,
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
  // PRESETS
  // ===========================================================================

  Widget _buildPresetsCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight
            ? Border.all(color: AppBorderColorLight.base)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle(context, 'Presets', MdiIcons.tune),
          AppSpacings.spacingMdVertical,
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: AppSpacings.pSm,
            crossAxisSpacing: AppSpacings.pSm,
            childAspectRatio: 2.2,
            children: _mockPresets.take(4).map((preset) {
              return _buildPresetCard(context, preset);
            }).toList(),
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

  Widget _buildPresetCard(BuildContext context, _MockPreset preset) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;
    final bool isActive = _aggregatedPosition == preset.position;

    return GestureDetector(
      onTap: () {
        setState(() => _aggregatedPosition = preset.position);
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
  // DEVICES
  // ===========================================================================

  Widget _buildDevicesCard(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: isLight
            ? Border.all(color: AppBorderColorLight.base)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardTitle(context, 'Devices', MdiIcons.viewGrid),
          AppSpacings.spacingMdVertical,
          Expanded(
            child: ListView.separated(
              itemCount: _mockDevices.length,
              separatorBuilder: (_, __) => AppSpacings.spacingSmVertical,
              itemBuilder: (context, index) {
                return _buildDeviceTile(context, _mockDevices[index]);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDevicesGrid(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: AppSpacings.pSm,
      crossAxisSpacing: AppSpacings.pSm,
      childAspectRatio: 1.4,
      children: _mockDevices.map((device) {
        return _buildDeviceTileCompact(context, device);
      }).toList(),
    );
  }

  Widget _buildDeviceTile(BuildContext context, _MockDevice device) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final Color stateColor = _getPositionColor(device.position, isLight);
    final Color stateColorLight = stateColor.withValues(alpha: 0.15);
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;

    return GestureDetector(
      onTap: () {
        // Navigate to device detail (mock - no actual navigation)
      },
      child: Container(
        padding: EdgeInsets.all(AppSpacings.pSm),
        decoration: BoxDecoration(
          color: isLight
              ? AppFillColorLight.base
              : AppFillColorDark.base,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: isLight
              ? Border.all(color: AppBorderColorLight.base)
              : null,
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
                color: stateColorLight,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
              ),
              child: Icon(
                device.typeIcon,
                color: stateColor,
                size: _screenService.scale(
                  20,
                  density: _visualDensityService.density,
                ),
              ),
            ),
            AppSpacings.spacingMdHorizontal,
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    device.name,
                    style: TextStyle(
                      fontSize: AppFontSize.small,
                      fontWeight: FontWeight.w500,
                      color: isLight
                          ? AppTextColorLight.regular
                          : AppTextColorDark.regular,
                    ),
                  ),
                  Text(
                    '${device.typeName} - ${device.statusText}',
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
            Text(
              '${device.position}%',
              style: TextStyle(
                fontSize: AppFontSize.base,
                fontWeight: FontWeight.w600,
                color: device.position > 0
                    ? primaryColor
                    : (isLight
                        ? AppTextColorLight.placeholder
                        : AppTextColorDark.placeholder),
              ),
            ),
            AppSpacings.spacingXsHorizontal,
            Icon(
              MdiIcons.chevronRight,
              color: isLight
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
              size: _screenService.scale(
                20,
                density: _visualDensityService.density,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDeviceTileCompact(BuildContext context, _MockDevice device) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final Color stateColor = _getPositionColor(device.position, isLight);
    final Color stateColorLight = stateColor.withValues(alpha: 0.15);
    final primaryColor =
        isLight ? AppColorsLight.primary : AppColorsDark.primary;

    return GestureDetector(
      onTap: () {
        // Navigate to device detail (mock - no actual navigation)
      },
      child: Container(
        padding: EdgeInsets.all(AppSpacings.pSm),
        decoration: BoxDecoration(
          color: isLight
              ? AppFillColorLight.base
              : AppFillColorDark.base,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: isLight
              ? Border.all(color: AppBorderColorLight.base)
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
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
                color: stateColorLight,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
              ),
              child: Icon(
                device.typeIcon,
                color: stateColor,
                size: _screenService.scale(
                  20,
                  density: _visualDensityService.density,
                ),
              ),
            ),
            const Spacer(),
            Text(
              device.name,
              style: TextStyle(
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.w500,
                color: isLight
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              device.typeName,
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                color: isLight
                    ? AppTextColorLight.placeholder
                    : AppTextColorDark.placeholder,
              ),
            ),
            const Spacer(),
            Text(
              '${device.position}%',
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
                color: device.position > 0
                    ? primaryColor
                    : (isLight
                        ? AppTextColorLight.placeholder
                        : AppTextColorDark.placeholder),
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

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  Color _getPositionColor(int position, bool isLight) {
    if (position == 100) {
      return isLight ? AppColorsLight.success : AppColorsDark.success;
    }
    if (position == 0) {
      return isLight ? AppColorsLight.info : AppColorsDark.info;
    }
    return isLight ? AppColorsLight.warning : AppColorsDark.warning;
  }

  String _getPositionText(int position) {
    if (position == 100) return 'Open';
    if (position == 0) return 'Closed';
    return '$position% open';
  }
}

// ===========================================================================
// MOCK DATA MODELS
// ===========================================================================

class _MockPreset {
  final String name;
  final IconData icon;
  final int position;

  const _MockPreset({
    required this.name,
    required this.icon,
    required this.position,
  });
}

class _MockDevice {
  final String name;
  final IconData typeIcon;
  final String typeName;
  final int position;

  const _MockDevice({
    required this.name,
    required this.typeIcon,
    required this.typeName,
    required this.position,
  });

  String get statusText {
    if (position == 100) return 'Open';
    if (position == 0) return 'Closed';
    return '$position% open';
  }
}

// ===========================================================================
// MOCK DATA
// ===========================================================================

final _mockPresets = [
  _MockPreset(
    name: 'Morning',
    icon: MdiIcons.weatherSunny,
    position: 100,
  ),
  _MockPreset(
    name: 'Day',
    icon: MdiIcons.whiteBalanceSunny,
    position: 75,
  ),
  _MockPreset(
    name: 'Evening',
    icon: MdiIcons.weatherNight,
    position: 30,
  ),
  _MockPreset(
    name: 'Night',
    icon: MdiIcons.weatherNightPartlyCloudy,
    position: 0,
  ),
  _MockPreset(
    name: 'Privacy',
    icon: MdiIcons.lock,
    position: 0,
  ),
  _MockPreset(
    name: 'Away',
    icon: MdiIcons.home,
    position: 0,
  ),
];

final _mockDevices = [
  _MockDevice(
    name: 'East Window',
    typeIcon: MdiIcons.blindsHorizontal,
    typeName: 'Blind',
    position: 75,
  ),
  _MockDevice(
    name: 'West Window',
    typeIcon: MdiIcons.blindsHorizontal,
    typeName: 'Blind',
    position: 75,
  ),
  _MockDevice(
    name: 'Main Curtain',
    typeIcon: MdiIcons.curtains,
    typeName: 'Curtain',
    position: 0,
  ),
  _MockDevice(
    name: 'Side Curtain',
    typeIcon: MdiIcons.curtains,
    typeName: 'Curtain',
    position: 100,
  ),
  _MockDevice(
    name: 'Bedroom Roller',
    typeIcon: MdiIcons.rollerShade,
    typeName: 'Roller',
    position: 50,
  ),
  _MockDevice(
    name: 'Patio Blind',
    typeIcon: MdiIcons.blindsHorizontalClosed,
    typeName: 'Outdoor Blind',
    position: 60,
  ),
];
