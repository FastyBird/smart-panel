import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Role group data for displaying in tiles
class _RoleGroup {
  final LightTargetRole role;
  final List<LightTargetView> targets;
  final int onCount;
  final int totalCount;
  final bool hasBrightness;
  final int? avgBrightness;

  _RoleGroup({
    required this.role,
    required this.targets,
    required this.onCount,
    required this.totalCount,
    required this.hasBrightness,
    this.avgBrightness,
  });

  bool get isOn => onCount > 0;
}

/// Lights domain page - displays lighting devices grouped by role with quick controls.
///
/// Features:
/// - Role tiles (Main, Task, Ambient, Accent, Night) with device counts and states
/// - Tap to toggle all devices in a role
/// - Long-press to open role detail page for advanced controls
/// - "Other" devices displayed as small tiles at the bottom
class LightsDomainViewPage extends StatefulWidget {
  final DomainViewItem viewItem;

  const LightsDomainViewPage({super.key, required this.viewItem});

  @override
  State<LightsDomainViewPage> createState() => _LightsDomainViewPageState();
}

class _LightsDomainViewPageState extends State<LightsDomainViewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SpacesService? _spacesService;
  DevicesService? _devicesService;

  // Track which roles are currently being toggled
  final Set<LightTargetRole> _togglingRoles = {};
  // Track which individual devices are being toggled
  final Set<String> _togglingDevices = {};

  String get _roomId => widget.viewItem.roomId;

  @override
  void initState() {
    super.initState();

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onDataChanged);
    } catch (_) {}

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDataChanged);
    } catch (_) {}
  }

  @override
  void dispose() {
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final spacesService = _spacesService;
    final devicesService = _devicesService;

    return Scaffold(
      appBar: AppTopBar(
        title: widget.viewItem.title,
        icon: DomainType.lights.icon,
      ),
      body: SafeArea(
        child: Builder(
          builder: (context) {
            if (spacesService == null || devicesService == null) {
              return _buildEmptyState(context);
            }

            final lightTargets =
                spacesService.getLightTargetsForSpace(_roomId);

            if (lightTargets.isEmpty) {
              return _buildEmptyState(context);
            }

            // Group light targets by role
            final roleGroups = _buildRoleGroups(lightTargets, devicesService);
            final definedRoles = roleGroups
                .where((g) =>
                    g.role != LightTargetRole.other && g.targets.isNotEmpty)
                .toList();
            final otherGroup = roleGroups
                .where((g) => g.role == LightTargetRole.other)
                .firstOrNull;

            return SingleChildScrollView(
              padding: AppSpacings.paddingMd,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Role tiles grid
                  if (definedRoles.isNotEmpty)
                    _buildRoleTilesGrid(context, definedRoles, devicesService),

                  // Spacer between sections
                  if (definedRoles.isNotEmpty &&
                      otherGroup != null &&
                      otherGroup.targets.isNotEmpty)
                    AppSpacings.spacingLgVertical,

                  // "Other" devices section
                  if (otherGroup != null && otherGroup.targets.isNotEmpty)
                    _buildOtherDevicesSection(
                        context, otherGroup, devicesService),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  /// Build role groups from light targets
  List<_RoleGroup> _buildRoleGroups(
    List<LightTargetView> targets,
    DevicesService devicesService,
  ) {
    // Group targets by role
    final Map<LightTargetRole, List<LightTargetView>> grouped = {};
    for (final target in targets) {
      final role = target.role ?? LightTargetRole.other;
      grouped.putIfAbsent(role, () => []).add(target);
    }

    // Build role groups with state information
    final List<_RoleGroup> groups = [];
    for (final role in LightTargetRole.values) {
      final roleTargets = grouped[role] ?? [];
      if (roleTargets.isEmpty) continue;

      int onCount = 0;
      int totalBrightness = 0;
      int brightnessCount = 0;
      bool hasBrightness = false;

      for (final target in roleTargets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
          // Find matching channel
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          if (channel.on) {
            onCount++;
          }

          if (channel.hasBrightness) {
            hasBrightness = true;
            if (channel.on) {
              totalBrightness += channel.brightness;
              brightnessCount++;
            }
          }
        }
      }

      groups.add(_RoleGroup(
        role: role,
        targets: roleTargets,
        onCount: onCount,
        totalCount: roleTargets.length,
        hasBrightness: hasBrightness,
        avgBrightness: brightnessCount > 0
            ? (totalBrightness / brightnessCount).round()
            : null,
      ));
    }

    return groups;
  }

  /// Build grid of role tiles
  Widget _buildRoleTilesGrid(
    BuildContext context,
    List<_RoleGroup> roleGroups,
    DevicesService devicesService,
  ) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final tileWidth = _screenService.scale(
          180,
          density: _visualDensityService.density,
        );
        final crossAxisCount =
            (constraints.maxWidth / tileWidth).floor().clamp(2, 3);

        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: AppSpacings.pMd,
            mainAxisSpacing: AppSpacings.pMd,
            childAspectRatio: 1.2,
          ),
          itemCount: roleGroups.length,
          itemBuilder: (context, index) {
            return _buildRoleTile(context, roleGroups[index], devicesService);
          },
        );
      },
    );
  }

  /// Build a single role tile
  Widget _buildRoleTile(
    BuildContext context,
    _RoleGroup group,
    DevicesService devicesService,
  ) {
    final isToggling = _togglingRoles.contains(group.role);
    final isOn = group.isOn;

    return GestureDetector(
      onTap:
          isToggling ? null : () => _toggleRole(context, group, devicesService),
      onLongPress: () => _openRoleDetail(context, group),
      child: Container(
        decoration: BoxDecoration(
          color: isOn
              ? (Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.warning.withValues(alpha: 0.15)
                  : AppColorsDark.warning.withValues(alpha: 0.2))
              : (Theme.of(context).brightness == Brightness.light
                  ? AppBgColorLight.page.withValues(alpha: 0.5)
                  : AppBgColorDark.overlay.withValues(alpha: 0.5)),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isOn
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.warning.withValues(alpha: 0.3)
                    : AppColorsDark.warning.withValues(alpha: 0.4))
                : Colors.transparent,
            width: 1,
          ),
        ),
        child: Padding(
          padding: AppSpacings.paddingSm,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Role icon
              _buildRoleIcon(context, group.role, isOn, isToggling),
              AppSpacings.spacingSmVertical,
              // Role name
              Text(
                _getRoleName(context, group.role),
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.primary
                      : AppTextColorDark.primary,
                ),
                textAlign: TextAlign.center,
              ),
              AppSpacings.spacingXsVertical,
              // Device count and state
              Text(
                '${group.onCount}/${group.totalCount} on',
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  color: isOn
                      ? (Theme.of(context).brightness == Brightness.light
                          ? AppColorsLight.warningDark2
                          : AppColorsDark.warningDark2)
                      : (Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.placeholder
                          : AppTextColorDark.placeholder),
                ),
              ),
              // Brightness if available
              if (group.hasBrightness && group.avgBrightness != null && isOn)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    '${group.avgBrightness}%',
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppColorsLight.warningDark2
                          : AppColorsDark.warningDark2,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// Build role icon
  Widget _buildRoleIcon(
    BuildContext context,
    LightTargetRole role,
    bool isOn,
    bool isToggling,
  ) {
    final iconSize = _screenService.scale(
      36,
      density: _visualDensityService.density,
    );

    if (isToggling) {
      return SizedBox(
        width: iconSize,
        height: iconSize,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: Theme.of(context).colorScheme.primary,
        ),
      );
    }

    return Icon(
      _getRoleIcon(role, isOn),
      size: iconSize,
      color: isOn
          ? (Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.warning
              : AppColorsDark.warning)
          : (Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.placeholder
              : AppTextColorDark.placeholder),
    );
  }

  /// Get icon for a role
  IconData _getRoleIcon(LightTargetRole role, bool isOn) {
    switch (role) {
      case LightTargetRole.main:
        return isOn ? MdiIcons.ceilingLight : MdiIcons.ceilingLight;
      case LightTargetRole.task:
        return isOn ? MdiIcons.deskLamp : MdiIcons.deskLamp;
      case LightTargetRole.ambient:
        return isOn ? MdiIcons.wallSconce : MdiIcons.wallSconceFlat;
      case LightTargetRole.accent:
        return isOn ? MdiIcons.floorLamp : MdiIcons.floorLampOutline;
      case LightTargetRole.night:
        return isOn ? MdiIcons.weatherNight : MdiIcons.moonWaningCrescent;
      case LightTargetRole.other:
        return isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline;
    }
  }

  /// Get display name for a role
  String _getRoleName(BuildContext context, LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return 'Main';
      case LightTargetRole.task:
        return 'Task';
      case LightTargetRole.ambient:
        return 'Ambient';
      case LightTargetRole.accent:
        return 'Accent';
      case LightTargetRole.night:
        return 'Night';
      case LightTargetRole.other:
        return 'Other';
    }
  }

  /// Toggle all devices in a role
  Future<void> _toggleRole(
    BuildContext context,
    _RoleGroup group,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);

    setState(() {
      _togglingRoles.add(group.role);
    });

    try {
      // If any device is on, turn all off. Otherwise turn all on.
      final newState = !group.isOn;

      int successCount = 0;
      int failCount = 0;

      for (final target in group.targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          final onProp = channel.onProp;
          if (onProp != null) {
            final success = await devicesService.setPropertyValue(
              onProp.id,
              newState,
            );
            if (success) {
              successCount++;
            } else {
              failCount++;
            }
          }
        }
      }

      if (!mounted) return;

      if (failCount > 0 && successCount == 0) {
        AlertBar.showError(
          context,
          message: localizations?.action_failed ?? 'Failed to toggle lights',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations?.action_failed ?? 'Failed to toggle lights',
      );
    } finally {
      if (mounted) {
        setState(() {
          _togglingRoles.remove(group.role);
        });
      }
    }
  }

  /// Open role detail page
  void _openRoleDetail(BuildContext context, _RoleGroup group) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => _LightRoleDetailPage(
          role: group.role,
          roomId: _roomId,
        ),
      ),
    );
  }

  /// Build "Other" devices section
  Widget _buildOtherDevicesSection(
    BuildContext context,
    _RoleGroup group,
    DevicesService devicesService,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            'Other Lights',
            style: TextStyle(
              fontSize: AppFontSize.base,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
          ),
        ),
        // Device tiles
        LayoutBuilder(
          builder: (context, constraints) {
            final tileWidth = _screenService.scale(
              120,
              density: _visualDensityService.density,
            );
            final crossAxisCount =
                (constraints.maxWidth / tileWidth).floor().clamp(2, 4);

            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: crossAxisCount,
                crossAxisSpacing: AppSpacings.pSm,
                mainAxisSpacing: AppSpacings.pSm,
                childAspectRatio: 1.0,
              ),
              itemCount: group.targets.length,
              itemBuilder: (context, index) {
                return _buildOtherDeviceTile(
                  context,
                  group.targets[index],
                  devicesService,
                );
              },
            );
          },
        ),
      ],
    );
  }

  /// Build a small device tile for "Other" devices
  Widget _buildOtherDeviceTile(
    BuildContext context,
    LightTargetView target,
    DevicesService devicesService,
  ) {
    final device = devicesService.getDevice(target.deviceId);
    if (device is! LightingDeviceView) {
      return const SizedBox.shrink();
    }

    final channel = device.lightChannels.firstWhere(
      (c) => c.id == target.channelId,
      orElse: () => device.lightChannels.first,
    );

    final isOn = channel.on;
    final isToggling = _togglingDevices.contains(target.id);
    final hasBrightness = channel.hasBrightness;
    final brightness = hasBrightness ? channel.brightness : null;

    return GestureDetector(
      onTap: isToggling
          ? null
          : () => _toggleDevice(context, target, channel, devicesService),
      onLongPress: () => _openDeviceDetail(context, device),
      child: Container(
        decoration: BoxDecoration(
          color: isOn
              ? (Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.warning.withValues(alpha: 0.15)
                  : AppColorsDark.warning.withValues(alpha: 0.2))
              : (Theme.of(context).brightness == Brightness.light
                  ? AppBgColorLight.page.withValues(alpha: 0.5)
                  : AppBgColorDark.overlay.withValues(alpha: 0.5)),
          borderRadius: BorderRadius.circular(AppBorderRadius.small),
          border: Border.all(
            color: isOn
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.warning.withValues(alpha: 0.3)
                    : AppColorsDark.warning.withValues(alpha: 0.4))
                : Colors.transparent,
            width: 1,
          ),
        ),
        child: Padding(
          padding: AppSpacings.paddingXs,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Device icon
              if (isToggling)
                SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                )
              else
                Icon(
                  isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
                  size: 24,
                  color: isOn
                      ? (Theme.of(context).brightness == Brightness.light
                          ? AppColorsLight.warning
                          : AppColorsDark.warning)
                      : (Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.placeholder
                          : AppTextColorDark.placeholder),
                ),
              AppSpacings.spacingXsVertical,
              // Device name
              Text(
                target.displayName,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w500,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.primary
                      : AppTextColorDark.primary,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              // Brightness value
              if (hasBrightness && isOn && brightness != null)
                Text(
                  '$brightness%',
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.warningDark2
                        : AppColorsDark.warningDark2,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// Toggle a single device
  Future<void> _toggleDevice(
    BuildContext context,
    LightTargetView target,
    LightChannelView channel,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);

    setState(() {
      _togglingDevices.add(target.id);
    });

    try {
      final onProp = channel.onProp;
      if (onProp != null) {
        final success = await devicesService.setPropertyValue(
          onProp.id,
          !channel.on,
        );

        if (!mounted) return;

        if (!success) {
          AlertBar.showError(
            context,
            message:
                localizations?.action_failed ?? 'Failed to toggle device',
          );
        }
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations?.action_failed ?? 'Failed to toggle device',
      );
    } finally {
      if (mounted) {
        setState(() {
          _togglingDevices.remove(target.id);
        });
      }
    }
  }

  /// Open device detail page
  void _openDeviceDetail(BuildContext context, LightingDeviceView device) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(device.id),
      ),
    );
  }

  /// Build empty state
  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: AppSpacings.paddingLg,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.lightbulbOffOutline,
              size: _screenService.scale(
                64,
                density: _visualDensityService.density,
              ),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
            AppSpacings.spacingMdVertical,
            Text(
              'No Lights',
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
              textAlign: TextAlign.center,
            ),
            AppSpacings.spacingSmVertical,
            Text(
              'No lighting devices found in this room',
              style: TextStyle(
                fontSize: AppFontSize.small,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.placeholder
                    : AppTextColorDark.placeholder,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// Light Role Detail Page
// ============================================================================

/// Detail page for controlling all lights in a specific role
class _LightRoleDetailPage extends StatefulWidget {
  final LightTargetRole role;
  final String roomId;

  const _LightRoleDetailPage({
    required this.role,
    required this.roomId,
  });

  @override
  State<_LightRoleDetailPage> createState() => _LightRoleDetailPageState();
}

class _LightRoleDetailPageState extends State<_LightRoleDetailPage>
    with SingleTickerProviderStateMixin {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SpacesService? _spacesService;
  DevicesService? _devicesService;

  late TabController _tabController;
  int _tabCount = 1;

  bool _isSettingBrightness = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 1, vsync: this);

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onDataChanged);
    } catch (_) {}

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDataChanged);
    } catch (_) {}
  }

  @override
  void dispose() {
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final spacesService = _spacesService;
    final devicesService = _devicesService;

    if (spacesService == null || devicesService == null) {
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(_getRoleName(widget.role)),
        ),
        body: const Center(child: Text('Services not available')),
      );
    }

    final lightTargets = spacesService
        .getLightTargetsForSpace(widget.roomId)
        .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
        .toList();

    // Calculate aggregate capabilities
    bool hasBrightness = false;
    bool hasTemperature = false;
    bool hasColor = false;
    int totalBrightness = 0;
    int brightnessCount = 0;
    int onCount = 0;

    for (final target in lightTargets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        if (channel.on) {
          onCount++;
        }

        if (channel.hasBrightness) {
          hasBrightness = true;
          if (channel.on) {
            totalBrightness += channel.brightness;
            brightnessCount++;
          }
        }

        if (target.hasColorTemp) {
          hasTemperature = true;
        }

        if (target.hasColor) {
          hasColor = true;
        }
      }
    }

    final avgBrightness = brightnessCount > 0
        ? (totalBrightness / brightnessCount).round()
        : 50;

    // Build tab list based on capabilities
    final List<Widget> tabs = [];
    final List<Widget> tabViews = [];

    if (hasBrightness) {
      tabs.add(Tab(icon: Icon(MdiIcons.brightness6)));
      tabViews.add(_buildBrightnessTab(
        context,
        lightTargets,
        avgBrightness,
        devicesService,
      ));
    }

    if (hasTemperature) {
      tabs.add(Tab(icon: Icon(MdiIcons.thermometer)));
      tabViews.add(_buildTemperatureTab(context, lightTargets));
    }

    if (hasColor) {
      tabs.add(Tab(icon: Icon(MdiIcons.palette)));
      tabViews.add(_buildColorTab(context, lightTargets));
    }

    // Always add devices tab
    tabs.add(Tab(icon: Icon(MdiIcons.viewList)));
    tabViews.add(_buildDevicesTab(
      context,
      lightTargets,
      devicesService,
    ));

    // Update tab controller if needed
    if (_tabCount != tabs.length) {
      _tabCount = tabs.length;
      _tabController.dispose();
      _tabController = TabController(length: tabs.length, vsync: this);
    }

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: Row(
          children: [
            Icon(_getRoleIcon(widget.role, onCount > 0)),
            const SizedBox(width: 8),
            Text(_getRoleName(widget.role)),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                '${lightTargets.length} devices',
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular,
                ),
              ),
            ),
          ),
        ],
        bottom: tabs.length > 1
            ? TabBar(
                controller: _tabController,
                tabs: tabs,
              )
            : null,
      ),
      body: tabs.length > 1
          ? TabBarView(
              controller: _tabController,
              children: tabViews,
            )
          : (tabViews.isNotEmpty
              ? tabViews.first
              : const SizedBox.shrink()),
    );
  }

  /// Build brightness control tab
  Widget _buildBrightnessTab(
    BuildContext context,
    List<LightTargetView> targets,
    int currentBrightness,
    DevicesService devicesService,
  ) {
    return Padding(
      padding: AppSpacings.paddingLg,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.brightness6,
            size: _screenService.scale(
              48,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).colorScheme.primary,
          ),
          AppSpacings.spacingMdVertical,
          Text(
            '$currentBrightness%',
            style: TextStyle(
              fontSize: AppFontSize.extraLarge,
              fontWeight: FontWeight.bold,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
          ),
          AppSpacings.spacingLgVertical,
          if (_isSettingBrightness)
            const CircularProgressIndicator()
          else
            Slider(
              value: currentBrightness.toDouble(),
              min: 0,
              max: 100,
              divisions: 20,
              label: '$currentBrightness%',
              onChangeEnd: (value) => _setBrightnessForAll(
                  context, targets, value.round(), devicesService),
              onChanged: (value) {},
            ),
          AppSpacings.spacingMdVertical,
          Text(
            'Drag to set brightness for all lights',
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
          ),
        ],
      ),
    );
  }

  /// Set brightness for all devices in the role
  Future<void> _setBrightnessForAll(
    BuildContext context,
    List<LightTargetView> targets,
    int brightness,
    DevicesService devicesService,
  ) async {
    setState(() {
      _isSettingBrightness = true;
    });

    try {
      for (final target in targets) {
        if (!target.hasBrightness) continue;

        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          final brightnessProp = channel.brightnessProp;
          if (brightnessProp != null) {
            await devicesService.setPropertyValue(
              brightnessProp.id,
              brightness,
            );
          }
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          _isSettingBrightness = false;
        });
      }
    }
  }

  /// Build temperature control tab (placeholder)
  Widget _buildTemperatureTab(
    BuildContext context,
    List<LightTargetView> targets,
  ) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.thermometer,
            size: _screenService.scale(
              48,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).colorScheme.primary,
          ),
          AppSpacings.spacingMdVertical,
          Text(
            'Color Temperature',
            style: TextStyle(
              fontSize: AppFontSize.large,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
          ),
          AppSpacings.spacingSmVertical,
          Text(
            'Coming soon',
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
          ),
        ],
      ),
    );
  }

  /// Build color control tab (placeholder)
  Widget _buildColorTab(
    BuildContext context,
    List<LightTargetView> targets,
  ) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.palette,
            size: _screenService.scale(
              48,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).colorScheme.primary,
          ),
          AppSpacings.spacingMdVertical,
          Text(
            'Color',
            style: TextStyle(
              fontSize: AppFontSize.large,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
          ),
          AppSpacings.spacingSmVertical,
          Text(
            'Coming soon',
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
          ),
        ],
      ),
    );
  }

  /// Build devices list tab
  Widget _buildDevicesTab(
    BuildContext context,
    List<LightTargetView> targets,
    DevicesService devicesService,
  ) {
    return ListView.builder(
      padding: AppSpacings.paddingMd,
      itemCount: targets.length,
      itemBuilder: (context, index) {
        final target = targets[index];
        final device = devicesService.getDevice(target.deviceId);

        if (device is! LightingDeviceView) {
          return const SizedBox.shrink();
        }

        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        final isOn = channel.on;

        return Card(
          child: ListTile(
            leading: Icon(
              isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
              color: isOn
                  ? (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.warning
                      : AppColorsDark.warning)
                  : null,
            ),
            title: Text(target.displayName),
            subtitle: Text(
              isOn
                  ? (channel.hasBrightness ? '${channel.brightness}%' : 'On')
                  : 'Off',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => DeviceDetailPage(device.id),
                ),
              );
            },
          ),
        );
      },
    );
  }

  /// Get icon for a role
  IconData _getRoleIcon(LightTargetRole role, bool isOn) {
    switch (role) {
      case LightTargetRole.main:
        return MdiIcons.ceilingLight;
      case LightTargetRole.task:
        return MdiIcons.deskLamp;
      case LightTargetRole.ambient:
        return isOn ? MdiIcons.wallSconce : MdiIcons.wallSconceFlat;
      case LightTargetRole.accent:
        return isOn ? MdiIcons.floorLamp : MdiIcons.floorLampOutline;
      case LightTargetRole.night:
        return isOn ? MdiIcons.weatherNight : MdiIcons.moonWaningCrescent;
      case LightTargetRole.other:
        return isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline;
    }
  }

  /// Get display name for a role
  String _getRoleName(LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return 'Main';
      case LightTargetRole.task:
        return 'Task';
      case LightTargetRole.ambient:
        return 'Ambient';
      case LightTargetRole.accent:
        return 'Accent';
      case LightTargetRole.night:
        return 'Night';
      case LightTargetRole.other:
        return 'Other';
    }
  }
}
