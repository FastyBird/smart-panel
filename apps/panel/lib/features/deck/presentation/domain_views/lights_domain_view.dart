import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_navigation.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
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

  bool _isLoading = true;

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

    // Fetch light targets for this space
    _fetchLightTargets();
  }

  Future<void> _fetchLightTargets() async {
    try {
      await _spacesService?.fetchLightTargetsForSpace(_roomId);
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) {
      // Re-fetch light targets when devices change (e.g., device assigned/unassigned from space)
      _spacesService?.fetchLightTargetsForSpace(_roomId);
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

            if (_isLoading) {
              return const Center(child: CircularProgressIndicator());
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
        if (device is LightingDeviceView &&
            device.lightChannels.isNotEmpty) {
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
      onLongPress: () => _openRoleDetail(context, group, devicesService),
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
        if (device is LightingDeviceView &&
            device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          final success = await devicesService.setPropertyValue(
            channel.onProp.id,
            newState,
          );
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        }
      }

      if (!mounted) return;

      if (failCount > 0 && successCount == 0) {
        AlertBar.showError(
          this.context,
          message: localizations?.action_failed ?? 'Failed to toggle lights',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        this.context,
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

  /// Open role detail page or device detail if only one device
  void _openRoleDetail(
    BuildContext context,
    _RoleGroup group,
    DevicesService devicesService,
  ) {
    // If only one device in role, open device detail directly
    if (group.targets.length == 1) {
      final target = group.targets.first;
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => DeviceDetailPage(device.id),
          ),
        );
        return;
      }
    }

    // Otherwise open role detail page
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
    if (device is! LightingDeviceView ||
        device.lightChannels.isEmpty) {
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
      final success = await devicesService.setPropertyValue(
        channel.onProp.id,
        !channel.on,
      );

      if (!mounted) return;

      if (!success) {
        AlertBar.showError(
          this.context,
          message:
              localizations?.action_failed ?? 'Failed to toggle device',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        this.context,
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

class _LightRoleDetailPageState extends State<_LightRoleDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  SpacesService? _spacesService;
  DevicesService? _devicesService;

  // Current mode for bottom navigation
  _LightRoleMode _currentMode = _LightRoleMode.off;
  final List<_LightRoleMode> _availableModes = [];

  bool _isSettingBrightness = false;
  // Local slider value for visual feedback during drag
  double? _sliderBrightness;
  // Debounce timer for brightness slider
  Timer? _brightnessDebounceTimer;

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

    // Initialize available modes
    _updateAvailableModes();
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _spacesService?.removeListener(_onDataChanged);
    _devicesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) {
      // Re-fetch light targets when devices change (e.g., device assigned/unassigned from space)
      _spacesService?.fetchLightTargetsForSpace(widget.roomId);
      _updateAvailableModes();
      setState(() {
        // Reset slider brightness so it reflects actual device state
        _sliderBrightness = null;
      });
    }
  }

  /// Update available modes based on current light targets capabilities
  void _updateAvailableModes() {
    final spacesService = _spacesService;
    final devicesService = _devicesService;
    if (spacesService == null || devicesService == null) return;

    final lightTargets = spacesService
        .getLightTargetsForSpace(widget.roomId)
        .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
        .toList();

    bool hasBrightness = false;
    bool hasTemperature = false;
    bool hasColor = false;
    bool hasWhite = false;

    for (final target in lightTargets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasBrightness) hasBrightness = true;
        if (target.hasColorTemp) hasTemperature = true;
        if (channel.hasColor) hasColor = true;
        if (channel.hasColorWhite) hasWhite = true;
      }
    }

    _availableModes.clear();
    _availableModes.add(_LightRoleMode.off);
    if (hasBrightness) _availableModes.add(_LightRoleMode.brightness);
    if (hasColor) _availableModes.add(_LightRoleMode.color);
    if (hasTemperature) _availableModes.add(_LightRoleMode.temperature);
    if (hasWhite) _availableModes.add(_LightRoleMode.white);

    // Set initial mode to brightness if available, otherwise first available
    if (_availableModes.length > 1 &&
        !_availableModes.contains(_currentMode)) {
      _currentMode = _availableModes[1];
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final spacesService = _spacesService;
    final devicesService = _devicesService;

    if (spacesService == null || devicesService == null) {
      return Scaffold(
        appBar: AppTopBar(
          title: _getRoleName(widget.role),
          icon: _getRoleIcon(widget.role),
          actions: [
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Icon(
                MdiIcons.close,
                size: _screenService.scale(
                  16,
                  density: _visualDensityService.density,
                ),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
            ),
          ],
        ),
        body: const Center(child: Text('Services not available')),
      );
    }

    final lightTargets = spacesService
        .getLightTargetsForSpace(widget.roomId)
        .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
        .toList();

    // Calculate aggregate values
    int totalBrightness = 0;
    int brightnessCount = 0;
    int onCount = 0;

    for (final target in lightTargets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        if (channel.on) {
          onCount++;
          if (channel.hasBrightness) {
            totalBrightness += channel.brightness;
            brightnessCount++;
          }
        }
      }
    }

    final avgBrightness = brightnessCount > 0
        ? (totalBrightness / brightnessCount).round()
        : 0;
    final allOn = onCount == lightTargets.length && lightTargets.isNotEmpty;

    return Scaffold(
      appBar: AppTopBar(
        title: _getRoleName(widget.role),
        icon: _getRoleIcon(widget.role),
        actions: [
          GestureDetector(
            onTap: () => Navigator.pop(context),
            child: Icon(
              MdiIcons.close,
              size: _screenService.scale(
                16,
                density: _visualDensityService.density,
              ),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SafeArea(
              bottom: false,
              child: _buildModeContent(
                context,
                lightTargets,
                avgBrightness,
                allOn,
                devicesService,
              ),
            ),
          ),
          if (_availableModes.length > 1)
            SafeArea(
              top: false,
              child: _buildBottomNavigation(context, localizations, lightTargets, devicesService),
            ),
        ],
      ),
    );
  }

  /// Build content based on current mode
  Widget _buildModeContent(
    BuildContext context,
    List<LightTargetView> targets,
    int avgBrightness,
    bool allOn,
    DevicesService devicesService,
  ) {
    // Check if any devices have color support
    final hasColorSupport = targets.any((target) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        return channel.hasColor;
      }
      return false;
    });

    // Get average color from devices that are on and have color
    Color? avgColor;
    if (hasColorSupport && allOn) {
      int r = 0, g = 0, b = 0, count = 0;
      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );
          if (channel.hasColor && channel.on) {
            final color = channel.color;
            r += color.red;
            g += color.green;
            b += color.blue;
            count++;
          }
        }
      }
      if (count > 0) {
        avgColor = Color.fromARGB(255, r ~/ count, g ~/ count, b ~/ count);
      }
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final elementMaxSize = constraints.maxHeight - 2 * AppSpacings.pMd;

        return Padding(
          padding: AppSpacings.paddingMd,
          child: Row(
            children: [
              // Left side - info and device list
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: AppSpacings.pLg),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Flexible(
                        flex: 0,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Brightness display
                            _buildBrightnessDisplay(context, avgBrightness, allOn),
                            AppSpacings.spacingMdVertical,
                            // Color box for color-supported devices
                            if (hasColorSupport)
                              Wrap(
                                spacing: AppSpacings.pMd,
                                runSpacing: AppSpacings.pMd,
                                children: [
                                  _buildColorBox(context, avgColor),
                                ],
                              ),
                          ],
                        ),
                      ),
                      AppSpacings.spacingSmVertical,
                      Flexible(
                        flex: 1,
                        child: SingleChildScrollView(
                          child: _buildDevicesList(context, targets, devicesService),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // Right side - control slider
              _buildControlSlider(
                context,
                targets,
                avgBrightness,
                elementMaxSize,
                devicesService,
              ),
            ],
          ),
        );
      },
    );
  }

  /// Build color box display
  Widget _buildColorBox(BuildContext context, Color? color) {
    final boxSize = _screenService.scale(
      75,
      density: _visualDensityService.density,
    );

    return SizedBox(
      width: boxSize,
      height: boxSize,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: Theme.of(context).brightness == Brightness.light
                ? AppBorderColorLight.base
                : AppBorderColorDark.base,
            width: _screenService.scale(
              1,
              density: _visualDensityService.density,
            ),
          ),
        ),
        child: Padding(
          padding: EdgeInsets.all(_screenService.scale(
            1,
            density: _visualDensityService.density,
          )),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(
                AppBorderRadius.base -
                    2 * _screenService.scale(1, density: _visualDensityService.density),
              ),
              color: color ?? Colors.grey,
            ),
          ),
        ),
      ),
    );
  }

  /// Build brightness display like lighting.dart
  Widget _buildBrightnessDisplay(BuildContext context, int brightness, bool allOn) {
    final localizations = AppLocalizations.of(context)!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              allOn ? '$brightness' : localizations.light_state_off,
              style: TextStyle(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
                fontSize: _screenService.scale(
                  60,
                  density: _visualDensityService.density,
                ),
                fontFamily: 'DIN1451',
                fontWeight: FontWeight.w100,
                height: 1.0,
              ),
            ),
            if (allOn)
              Text(
                '%',
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular,
                  fontSize: _screenService.scale(
                    25,
                    density: _visualDensityService.density,
                  ),
                  fontFamily: 'DIN1451',
                  fontWeight: FontWeight.w100,
                  height: 1.0,
                ),
              ),
          ],
        ),
        Text(
          allOn
              ? localizations.light_state_brightness_description
              : localizations.light_state_off_description,
          style: TextStyle(
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.regular
                : AppTextColorDark.regular,
            fontSize: AppFontSize.base,
          ),
        ),
      ],
    );
  }

  /// Build control slider based on current mode
  Widget _buildControlSlider(
    BuildContext context,
    List<LightTargetView> targets,
    int currentBrightness,
    double elementMaxSize,
    DevicesService devicesService,
  ) {
    switch (_currentMode) {
      case _LightRoleMode.brightness:
        return _buildBrightnessSlider(
          context,
          targets,
          currentBrightness,
          elementMaxSize,
          devicesService,
        );
      case _LightRoleMode.color:
        return _buildColorSlider(context, elementMaxSize);
      case _LightRoleMode.temperature:
        return _buildTemperatureSlider(context, elementMaxSize);
      case _LightRoleMode.white:
        return _buildWhiteSlider(context, elementMaxSize);
      case _LightRoleMode.off:
        return _buildBrightnessSlider(
          context,
          targets,
          currentBrightness,
          elementMaxSize,
          devicesService,
        );
    }
  }

  /// Build brightness slider
  Widget _buildBrightnessSlider(
    BuildContext context,
    List<LightTargetView> targets,
    int currentBrightness,
    double elementMaxSize,
    DevicesService devicesService,
  ) {
    if (_isSettingBrightness) {
      return SizedBox(
        width: _screenService.scale(60, density: _visualDensityService.density),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    return ColoredSlider(
      value: _sliderBrightness ?? currentBrightness.toDouble(),
      min: 0,
      max: 100,
      enabled: true,
      vertical: true,
      trackWidth: elementMaxSize,
      showThumb: false,
      onValueChanged: (value) {
        setState(() {
          _sliderBrightness = value;
        });
        // Debounce the API call to prevent overwhelming the backend
        _brightnessDebounceTimer?.cancel();
        _brightnessDebounceTimer = Timer(
          const Duration(milliseconds: 300),
          () => _setBrightnessForAll(context, targets, value.round(), devicesService),
        );
      },
      inner: [
        Positioned(
          left: _screenService.scale(20, density: _visualDensityService.density),
          child: RotatedBox(
            quarterTurns: 1,
            child: Icon(
              MdiIcons.weatherSunny,
              size: _screenService.scale(40, density: _visualDensityService.density),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.regular,
            ),
          ),
        ),
      ],
    );
  }

  /// Build color slider (placeholder)
  Widget _buildColorSlider(BuildContext context, double elementMaxSize) {
    return ColoredSlider(
      value: 0.5,
      min: 0.0,
      max: 1.0,
      enabled: true,
      vertical: true,
      trackWidth: elementMaxSize,
      onValueChanged: (value) {
        // TODO: Implement color control for all devices
      },
      background: const BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color(0xFFFF0000),
            Color(0xFFFFFF00),
            Color(0xFF00FF00),
            Color(0xFF00FFFF),
            Color(0xFF0000FF),
            Color(0xFFFF00FF),
            Color(0xFFFF0000),
          ],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
    );
  }

  /// Build temperature slider (placeholder)
  Widget _buildTemperatureSlider(BuildContext context, double elementMaxSize) {
    return ColoredSlider(
      value: 4000,
      min: 2700,
      max: 6500,
      enabled: true,
      vertical: true,
      trackWidth: elementMaxSize,
      onValueChanged: (value) {
        // TODO: Implement temperature control for all devices
      },
      background: const BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Color(0xFFFFAA55),
            Color(0xFFB3D9FF),
          ],
        ),
      ),
      thumbDividerColor: AppBorderColorDark.base,
      inner: [
        Positioned(
          left: _screenService.scale(5, density: _visualDensityService.density),
          child: RotatedBox(
            quarterTurns: 1,
            child: Icon(
              MdiIcons.thermometer,
              size: _screenService.scale(40, density: _visualDensityService.density),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
          ),
        ),
      ],
    );
  }

  /// Build white slider (placeholder)
  Widget _buildWhiteSlider(BuildContext context, double elementMaxSize) {
    return ColoredSlider(
      value: 128,
      min: 0,
      max: 255,
      enabled: true,
      vertical: true,
      trackWidth: elementMaxSize,
      showThumb: false,
      onValueChanged: (value) {
        // TODO: Implement white channel control for all devices
      },
      activeTrackColor: AppColors.white,
      inner: [
        Positioned(
          left: _screenService.scale(20, density: _visualDensityService.density),
          child: RotatedBox(
            quarterTurns: 1,
            child: Icon(
              MdiIcons.lightbulbOutline,
              size: _screenService.scale(40, density: _visualDensityService.density),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
          ),
        ),
      ],
    );
  }

  /// Build devices list
  Widget _buildDevicesList(
    BuildContext context,
    List<LightTargetView> targets,
    DevicesService devicesService,
  ) {
    final items = targets.map((target) {
      final device = devicesService.getDevice(target.deviceId);
      if (device == null) return null;

      LightChannelView? channel;
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
      }

      return Material(
        elevation: 0,
        color: Colors.transparent,
        child: ListTile(
          minTileHeight: _screenService.scale(
            25,
            density: _visualDensityService.density,
          ),
          leading: Icon(
            channel?.on == true ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
            size: AppFontSize.large,
            color: channel?.on == true
                ? (channel!.hasColor ? channel.color : Theme.of(context).primaryColor)
                : null,
          ),
          title: Text(
            device.name,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall * 0.8,
              fontWeight: FontWeight.w600,
            ),
          ),
          trailing: channel?.hasBrightness == true
              ? Text(
                  '${channel!.brightness}%',
                  style: TextStyle(fontSize: AppFontSize.extraSmall),
                )
              : null,
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
    }).whereType<Widget>().toList();

    return Wrap(
      runSpacing: AppSpacings.pSm,
      children: items,
    );
  }

  /// Build bottom navigation bar
  Widget _buildBottomNavigation(
    BuildContext context,
    AppLocalizations localizations,
    List<LightTargetView> targets,
    DevicesService devicesService,
  ) {
    final currentIndex = _availableModes.indexOf(_currentMode);

    return AppBottomNavigationBar(
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
      enableFloatingNavBar: false,
      onTap: (int index) async {
        final selectedMode = _availableModes[index];

        if (selectedMode == _LightRoleMode.off) {
          // Toggle all lights
          await _toggleAllLights(context, targets, devicesService);
          // Switch to brightness mode after toggle
          if (_availableModes.contains(_LightRoleMode.brightness)) {
            setState(() {
              _currentMode = _LightRoleMode.brightness;
            });
          }
        } else {
          setState(() {
            _currentMode = selectedMode;
          });
        }
      },
      items: _availableModes.map((mode) {
        switch (mode) {
          case _LightRoleMode.off:
            return AppBottomNavigationItem(
              icon: Icon(MdiIcons.power),
              label: localizations.light_mode_off,
            );
          case _LightRoleMode.brightness:
            return AppBottomNavigationItem(
              icon: Icon(MdiIcons.weatherSunny),
              label: localizations.light_mode_brightness,
            );
          case _LightRoleMode.color:
            return AppBottomNavigationItem(
              icon: Icon(MdiIcons.paletteOutline),
              label: localizations.light_mode_color,
            );
          case _LightRoleMode.temperature:
            return AppBottomNavigationItem(
              icon: Icon(MdiIcons.thermometer),
              label: localizations.light_mode_temperature,
            );
          case _LightRoleMode.white:
            return AppBottomNavigationItem(
              icon: Icon(MdiIcons.lightbulbOutline),
              label: localizations.light_mode_white,
            );
        }
      }).toList(),
    );
  }

  /// Toggle all lights in the role
  Future<void> _toggleAllLights(
    BuildContext context,
    List<LightTargetView> targets,
    DevicesService devicesService,
  ) async {
    // Determine if we should turn on or off (if any are on, turn all off)
    bool anyOn = false;
    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.on) {
          anyOn = true;
          break;
        }
      }
    }

    final newState = !anyOn;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        final onProp = channel.onProp;
        await devicesService.setPropertyValue(onProp.id, newState);
      }
    }
  }

  /// Set brightness for all devices in the role
  Future<void> _setBrightnessForAll(
    BuildContext context,
    List<LightTargetView> targets,
    int brightness,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);

    setState(() {
      _isSettingBrightness = true;
    });

    try {
      int successCount = 0;
      int failCount = 0;

      for (final target in targets) {
        if (!target.hasBrightness) continue;

        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView &&
            device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          final brightnessProp = channel.brightnessProp;
          if (brightnessProp != null) {
            final success = await devicesService.setPropertyValue(
              brightnessProp.id,
              brightness,
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
          this.context,
          message:
              localizations?.action_failed ?? 'Failed to set brightness',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        this.context,
        message: localizations?.action_failed ?? 'Failed to set brightness',
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSettingBrightness = false;
          // Reset slider brightness so it reflects actual device state
          _sliderBrightness = null;
        });
      }
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

  /// Get icon for a role
  IconData _getRoleIcon(LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return MdiIcons.ceilingLight;
      case LightTargetRole.task:
        return MdiIcons.deskLamp;
      case LightTargetRole.ambient:
        return MdiIcons.wallSconce;
      case LightTargetRole.accent:
        return MdiIcons.floorLamp;
      case LightTargetRole.night:
        return MdiIcons.weatherNight;
      case LightTargetRole.other:
        return MdiIcons.lightbulbOutline;
    }
  }
}

/// Light role mode for bottom navigation
enum _LightRoleMode {
  off,
  brightness,
  color,
  temperature,
  white,
}
