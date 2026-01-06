import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_navigation.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/fixed_grid_size_grid.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart'
    hide IntentOverlayService;
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// ============================================================================
// Role UI State Machine
// ============================================================================

/// UI states for role-level aggregated controls
enum RoleUIState {
  /// Normal state - showing actual device values
  idle,

  /// User has initiated action, waiting for intent to be created/completed
  pending,

  /// Intent completed, waiting for devices to converge (settling window)
  settling,

  /// Settling window expired but devices have not converged
  mixed,

  /// Error state (optional, for future use)
  error,
}

/// Control state for a single control type (brightness, hue, temperature, white)
class RoleControlState {
  /// Current UI state
  final RoleUIState state;

  /// The value the user set (persists through PENDING, SETTLING, MIXED)
  final double? desiredValue;

  /// Settling timer (active during SETTLING state)
  final Timer? settlingTimer;

  /// Timestamp when settling started
  final DateTime? settlingStartedAt;

  const RoleControlState({
    this.state = RoleUIState.idle,
    this.desiredValue,
    this.settlingTimer,
    this.settlingStartedAt,
  });

  /// Create a copy with updated fields
  RoleControlState copyWith({
    RoleUIState? state,
    double? desiredValue,
    Timer? settlingTimer,
    DateTime? settlingStartedAt,
    bool clearDesiredValue = false,
    bool clearSettlingTimer = false,
    bool clearSettlingStartedAt = false,
  }) {
    return RoleControlState(
      state: state ?? this.state,
      desiredValue: clearDesiredValue ? null : (desiredValue ?? this.desiredValue),
      settlingTimer: clearSettlingTimer ? null : (settlingTimer ?? this.settlingTimer),
      settlingStartedAt: clearSettlingStartedAt ? null : (settlingStartedAt ?? this.settlingStartedAt),
    );
  }

  /// Whether the control is in a "locked" state where we show desired value
  bool get isLocked => state == RoleUIState.pending || state == RoleUIState.settling || state == RoleUIState.mixed;

  /// Whether we're actively waiting for devices to sync
  bool get isSettling => state == RoleUIState.settling;

  /// Whether devices are in mixed state
  bool get isMixed => state == RoleUIState.mixed;

  /// Cancel any active timer
  void cancelTimer() {
    settlingTimer?.cancel();
  }
}

/// Settling window duration in milliseconds
const int _settlingWindowMs = 2000;

/// Tolerance for brightness comparison (±)
const double _brightnessTolerance = 3.0;

/// Tolerance for hue comparison (±)
const double _hueTolerance = 5.0;

/// Tolerance for temperature comparison (±)
const double _temperatureTolerance = 100.0;

/// Tolerance for white comparison (±)
const double _whiteTolerance = 5.0;

// ============================================================================
// Helper Functions
// ============================================================================

/// Strips room name from device name (case insensitive).
/// Capitalizes first letter if it becomes lowercase after stripping.
String _stripRoomName(String deviceName, String? roomName) {
  if (roomName == null || roomName.isEmpty) return deviceName;

  final lowerDevice = deviceName.toLowerCase();
  final lowerRoom = roomName.toLowerCase();

  if (lowerDevice.startsWith(lowerRoom)) {
    String stripped = deviceName.substring(roomName.length).trim();
    if (stripped.isEmpty) return deviceName;

    // Capitalize first letter if it's lowercase
    if (stripped[0].toLowerCase() == stripped[0] &&
        stripped[0].toUpperCase() != stripped[0]) {
      stripped = stripped[0].toUpperCase() + stripped.substring(1);
    }
    return stripped;
  }
  return deviceName;
}

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

  DeckService? _deckService;
  SpacesService? _spacesService;
  DevicesService? _devicesService;
  IntentOverlayService? _intentOverlayService;

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
      _deckService = locator<DeckService>();
    } catch (_) {}

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onSpacesDataChanged);
    } catch (_) {}

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDevicesDataChanged);
    } catch (_) {}

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentDataChanged);
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
    _spacesService?.removeListener(_onSpacesDataChanged);
    _devicesService?.removeListener(_onDevicesDataChanged);
    _intentOverlayService?.removeListener(_onIntentDataChanged);
    super.dispose();
  }

  void _onSpacesDataChanged() {
    // SpacesService notification means data is already updated, just rebuild UI
    if (mounted) {
      setState(() {});
    }
  }

  void _onDevicesDataChanged() {
    // DevicesService notification means device was updated (e.g., assigned/unassigned from space)
    // Re-fetch light targets to get latest data
    if (mounted) {
      _spacesService?.fetchLightTargetsForSpace(_roomId);
    }
  }

  void _onIntentDataChanged() {
    // Intent overlay service changed - rebuild to show/hide failure indicators
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
        child: LayoutBuilder(
          builder: (context, constraints) {
            // Capture body dimensions for grid calculations
            final bodyHeight = constraints.maxHeight;

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
                    _buildRoleTilesGrid(
                      context,
                      definedRoles,
                      devicesService,
                      bodyHeight,
                    ),

                  // Spacer between sections
                  if (definedRoles.isNotEmpty &&
                      otherGroup != null &&
                      otherGroup.targets.isNotEmpty)
                    AppSpacings.spacingLgVertical,

                  // "Other" devices section
                  if (otherGroup != null && otherGroup.targets.isNotEmpty)
                    _buildOtherDevicesSection(
                      context,
                      otherGroup,
                      devicesService,
                      bodyHeight,
                    ),
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

  /// Build grid of role tiles using FixedGridSizeGrid
  Widget _buildRoleTilesGrid(
    BuildContext context,
    List<_RoleGroup> roleGroups,
    DevicesService devicesService,
    double bodyHeight,
  ) {
    final display = _deckService?.display;
    // Ensure minimum of 2 columns for 2-per-row layout
    final cols = (display?.cols ?? 4).clamp(2, 100);
    // Use display rows to calculate proper cell height
    final displayRows = (display?.rows ?? 6).clamp(1, 100);

    // Calculate cell height based on body height and display rows
    final cellHeight = bodyHeight / displayRows;

    // For portrait mode: 2 tiles per row, square tiles (colSpan = rowSpan)
    // Calculate tile size: each tile takes half the columns (minimum 1)
    final tileColSpan = (cols / 2).floor().clamp(1, cols);
    final tileRowSpan = tileColSpan; // Square tiles

    // Calculate how many rows we need for the role tiles
    final tilesPerRow = 2;
    final totalRows = (roleGroups.length / tilesPerRow).ceil();
    final gridRows = totalRows * tileRowSpan;

    // Build grid items
    final List<FixedGridSizeGridItem> gridItems = [];
    for (int i = 0; i < roleGroups.length; i++) {
      final row = i ~/ tilesPerRow;
      final col = i % tilesPerRow;

      gridItems.add(
        FixedGridSizeGridItem(
          mainAxisIndex: row * tileRowSpan + 1,
          crossAxisIndex: col * tileColSpan + 1,
          mainAxisCellCount: tileRowSpan,
          crossAxisCellCount: tileColSpan,
          child: _buildRoleTile(context, roleGroups[i], devicesService),
        ),
      );
    }

    // Calculate grid height based on cell height from display rows
    final gridHeight = gridRows * cellHeight;

    return SizedBox(
      height: gridHeight,
      child: FixedGridSizeGrid(
        mainAxisSize: gridRows,
        crossAxisSize: cols,
        children: gridItems,
      ),
    );
  }

  /// Build a single role tile using existing ButtonTileBox components
  Widget _buildRoleTile(
    BuildContext context,
    _RoleGroup group,
    DevicesService devicesService,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final isToggling = _togglingRoles.contains(group.role);
    final isOn = group.isOn;

    // Build subtitle: "X light(s) on" or "all off", with optional brightness
    String subtitleText;
    if (group.onCount == 0) {
      subtitleText = localizations.domain_lights_all_off;
    } else {
      subtitleText = localizations.domain_lights_count_on(group.onCount);
      if (group.hasBrightness && group.avgBrightness != null) {
        subtitleText = '$subtitleText • ${group.avgBrightness}%';
      }
    }

    return GestureDetector(
      onLongPress: () => _openRoleDetail(context, group, devicesService),
      child: ButtonTileBox(
        onTap: isToggling ? null : () => _toggleRole(context, group, devicesService),
        isOn: isOn,
        isDisabled: isToggling,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ButtonTileIcon(
              icon: _getRoleIconData(group.role),
              onTap: isToggling ? null : () => _toggleRole(context, group, devicesService),
              isOn: isOn,
              isLoading: isToggling,
            ),
            AppSpacings.spacingSmVertical,
            ButtonTileTitle(
              title: _getRoleName(context, group.role),
              isOn: isOn,
              isLoading: isToggling,
            ),
            AppSpacings.spacingXsVertical,
            ButtonTileSubTitle(
              subTitle: Text(subtitleText),
              isOn: isOn,
              isLoading: isToggling,
            ),
          ],
        ),
      ),
    );
  }

  /// Get icon data for a role (used with ButtonTileIcon)
  IconData _getRoleIconData(LightTargetRole role) {
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

  /// Build "Other" devices section using FixedGridSizeGrid
  Widget _buildOtherDevicesSection(
    BuildContext context,
    _RoleGroup group,
    DevicesService devicesService,
    double bodyHeight,
  ) {
    final display = _deckService?.display;
    // Ensure minimum of 2 columns for 2-per-row layout
    final cols = (display?.cols ?? 4).clamp(2, 100);
    // Use display rows to calculate proper cell height
    final displayRows = (display?.rows ?? 6).clamp(1, 100);

    // Calculate cell height based on body height and display rows
    final cellHeight = bodyHeight / displayRows;

    // Each tile spans half the columns (2 tiles per row) and 1 row height
    final tileColSpan = (cols / 2).floor().clamp(1, cols);
    final tileRowSpan = 1;

    // Calculate how many rows we need
    final tilesPerRow = 2;
    final totalRows = (group.targets.length / tilesPerRow).ceil();
    final gridRows = totalRows * tileRowSpan;

    // Build grid items
    final List<FixedGridSizeGridItem> gridItems = [];
    for (int i = 0; i < group.targets.length; i++) {
      final row = i ~/ tilesPerRow;
      final col = i % tilesPerRow;

      gridItems.add(
        FixedGridSizeGridItem(
          mainAxisIndex: row * tileRowSpan + 1,
          crossAxisIndex: col * tileColSpan + 1,
          mainAxisCellCount: tileRowSpan,
          crossAxisCellCount: tileColSpan,
          child: _buildOtherDeviceTile(
            context,
            group.targets[i],
            devicesService,
          ),
        ),
      );
    }

    final localizations = AppLocalizations.of(context)!;

    // Calculate grid height based on cell height from display rows
    final gridHeight = gridRows * cellHeight;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            localizations.domain_lights_other,
            style: TextStyle(
              fontSize: AppFontSize.base,
              fontWeight: FontWeight.w600,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
          ),
        ),
        // Device tiles grid - horizontal layout with 1 row height
        SizedBox(
          height: gridHeight,
          child: FixedGridSizeGrid(
            mainAxisSize: gridRows,
            crossAxisSize: cols,
            children: gridItems,
          ),
        ),
      ],
    );
  }

  /// Build a small device tile for "Other" devices using horizontal layout
  Widget _buildOtherDeviceTile(
    BuildContext context,
    LightTargetView target,
    DevicesService devicesService,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final device = devicesService.getDevice(target.deviceId);
    if (device is! LightingDeviceView || device.lightChannels.isEmpty) {
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

    // Check for recent failure
    final hasFailure = _intentOverlayService?.hasRecentFailure(target.deviceId) ?? false;

    // Build subtitle: On/Off state, with brightness icon if supported
    final stateText = hasFailure
        ? localizations.light_state_failed
        : (isOn ? localizations.light_state_on : localizations.light_state_off);
    final showBrightness = hasBrightness && isOn && brightness != null && !hasFailure;

    // Strip room name from device name
    final roomName = _spacesService?.getSpace(_roomId)?.name;
    final displayName = _stripRoomName(device.name, roomName);

    return GestureDetector(
      onLongPress: () => _openDeviceDetail(context, device),
      child: ButtonTileBox(
        onTap: isToggling
            ? null
            : () => _toggleDevice(context, target, channel, devicesService),
        isOn: isOn,
        isDisabled: isToggling,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            ButtonTileIcon(
              icon: hasFailure
                  ? MdiIcons.alertCircleOutline
                  : (isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline),
              onTap: isToggling
                  ? null
                  : () => _toggleDevice(context, target, channel, devicesService),
              isOn: isOn,
              isLoading: isToggling,
              iconColor: hasFailure ? AppColorsLight.warning : null,
            ),
            AppSpacings.spacingMdHorizontal,
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ButtonTileTitle(
                    title: displayName,
                    isOn: isOn,
                    isLoading: isToggling,
                  ),
                  AppSpacings.spacingXsVertical,
                  ButtonTileSubTitle(
                    subTitle: Row(
                      children: [
                        Text(stateText),
                        if (showBrightness) ...[
                          AppSpacings.spacingSmHorizontal,
                          Icon(
                            MdiIcons.brightnessPercent,
                            size: AppFontSize.extraSmall,
                            color: Theme.of(context).brightness == Brightness.light
                                ? AppTextColorLight.placeholder
                                : AppTextColorDark.placeholder,
                          ),
                          const SizedBox(width: 2),
                          Text('$brightness%'),
                        ],
                      ],
                    ),
                    isOn: isOn,
                    isLoading: isToggling,
                  ),
                ],
              ),
            ),
          ],
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
    final localizations = AppLocalizations.of(context)!;

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
              localizations.domain_lights_empty_title,
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
              localizations.domain_lights_empty_description,
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
  IntentOverlayService? _intentOverlayService;

  // Current mode for bottom navigation
  _LightRoleMode _currentMode = _LightRoleMode.off;
  final List<_LightRoleMode> _availableModes = [];

  // Role control states for each control type (replaces simple slider values)
  RoleControlState _brightnessState = const RoleControlState();
  RoleControlState _hueState = const RoleControlState();
  RoleControlState _temperatureState = const RoleControlState();
  RoleControlState _whiteState = const RoleControlState();

  // Debounce timers for sliders (user input debounce, separate from settling)
  Timer? _brightnessDebounceTimer;
  Timer? _hueDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  // Track the last intent count to detect when intents complete
  int _lastIntentCount = 0;

  @override
  void initState() {
    super.initState();

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onSpacesDataChanged);
    } catch (_) {}

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDevicesDataChanged);
    } catch (_) {}

    try {
      _intentOverlayService = locator<IntentOverlayService>();
      _intentOverlayService?.addListener(_onIntentChanged);
      _lastIntentCount = _intentOverlayService?.activeCount ?? 0;
    } catch (_) {}

    // Initialize available modes
    _updateAvailableModes();
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _hueDebounceTimer?.cancel();
    _temperatureDebounceTimer?.cancel();
    _whiteDebounceTimer?.cancel();
    // Cancel any settling timers
    _brightnessState.cancelTimer();
    _hueState.cancelTimer();
    _temperatureState.cancelTimer();
    _whiteState.cancelTimer();
    _spacesService?.removeListener(_onSpacesDataChanged);
    _devicesService?.removeListener(_onDevicesDataChanged);
    _intentOverlayService?.removeListener(_onIntentChanged);
    super.dispose();
  }

  // ============================================================================
  // State Machine Helpers
  // ============================================================================

  /// Transition control to SETTLING state after intent completes
  void _startSettlingState(
    RoleControlState currentState,
    void Function(RoleControlState) updateState,
    List<LightTargetView> targets,
    bool Function(List<LightTargetView>, double, double) convergenceCheck,
    double tolerance,
  ) {
    if (currentState.state != RoleUIState.pending) return;
    if (currentState.desiredValue == null) return;

    currentState.cancelTimer();

    // Check if already converged
    if (convergenceCheck(targets, currentState.desiredValue!, tolerance)) {
      updateState(const RoleControlState(state: RoleUIState.idle));
      return;
    }

    // Start settling timer
    final timer = Timer(const Duration(milliseconds: _settlingWindowMs), () {
      if (!mounted) return;
      _onSettlingTimeout(currentState, updateState, targets, convergenceCheck, tolerance);
    });

    updateState(currentState.copyWith(
      state: RoleUIState.settling,
      settlingTimer: timer,
      settlingStartedAt: DateTime.now(),
    ));
  }

  /// Called when settling timer expires
  void _onSettlingTimeout(
    RoleControlState currentState,
    void Function(RoleControlState) updateState,
    List<LightTargetView> targets,
    bool Function(List<LightTargetView>, double, double) convergenceCheck,
    double tolerance,
  ) {
    if (!mounted) return;
    if (currentState.desiredValue == null) return;

    // Check if devices have converged
    if (convergenceCheck(targets, currentState.desiredValue!, tolerance)) {
      // All devices converged - return to IDLE
      setState(() {
        updateState(const RoleControlState(state: RoleUIState.idle));
      });
    } else {
      // Devices did not converge - enter MIXED state
      // Keep the desired value so slider stays in place
      setState(() {
        updateState(currentState.copyWith(
          state: RoleUIState.mixed,
          clearSettlingTimer: true,
          clearSettlingStartedAt: true,
        ));
      });
    }
  }

  /// Check convergence during SETTLING state (called on device data changes)
  void _checkConvergenceDuringSettling(
    RoleControlState currentState,
    void Function(RoleControlState) updateState,
    List<LightTargetView> targets,
    bool Function(List<LightTargetView>, double, double) convergenceCheck,
    double tolerance,
  ) {
    if (currentState.state != RoleUIState.settling) return;
    if (currentState.desiredValue == null) return;

    // Check if all devices have converged to desired value
    if (convergenceCheck(targets, currentState.desiredValue!, tolerance)) {
      // All devices converged - return to IDLE immediately
      currentState.cancelTimer();
      updateState(const RoleControlState(state: RoleUIState.idle));
    }
    // If not converged, keep waiting for timer
  }

  // ============================================================================
  // Intent Change Handler
  // ============================================================================

  /// Called when intent overlay service notifies of changes
  void _onIntentChanged() {
    if (!mounted) return;

    final currentIntentCount = _intentOverlayService?.activeCount ?? 0;
    final targets = _spacesService
        ?.getLightTargetsForSpace(widget.roomId)
        .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
        .toList() ?? [];

    // Detect intent completion: count decreased and we have pending states
    if (currentIntentCount < _lastIntentCount) {
      // An intent completed - transition PENDING states to SETTLING
      setState(() {
        if (_brightnessState.state == RoleUIState.pending) {
          _startSettlingState(
            _brightnessState,
            (s) => _brightnessState = s,
            targets,
            _allBrightnessMatch,
            _brightnessTolerance,
          );
        }
        if (_hueState.state == RoleUIState.pending) {
          _startSettlingState(
            _hueState,
            (s) => _hueState = s,
            targets,
            _allHueMatch,
            _hueTolerance,
          );
        }
        if (_temperatureState.state == RoleUIState.pending) {
          _startSettlingState(
            _temperatureState,
            (s) => _temperatureState = s,
            targets,
            _allTemperatureMatch,
            _temperatureTolerance,
          );
        }
        if (_whiteState.state == RoleUIState.pending) {
          _startSettlingState(
            _whiteState,
            (s) => _whiteState = s,
            targets,
            _allWhiteMatch,
            _whiteTolerance,
          );
        }
      });
    }

    _lastIntentCount = currentIntentCount;

    // Always rebuild UI to reflect any state changes
    setState(() {});
  }

  void _onSpacesDataChanged() {
    // SpacesService notification means data is already updated, just rebuild UI
    if (mounted) {
      _updateAvailableModes();

      final targets = _spacesService
          ?.getLightTargetsForSpace(widget.roomId)
          .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
          .toList() ?? [];

      setState(() {
        // Check convergence during SETTLING state
        // If devices converge, state machine will transition to IDLE
        _checkConvergenceDuringSettling(
          _brightnessState,
          (s) => _brightnessState = s,
          targets,
          _allBrightnessMatch,
          _brightnessTolerance,
        );
        _checkConvergenceDuringSettling(
          _hueState,
          (s) => _hueState = s,
          targets,
          _allHueMatch,
          _hueTolerance,
        );
        _checkConvergenceDuringSettling(
          _temperatureState,
          (s) => _temperatureState = s,
          targets,
          _allTemperatureMatch,
          _temperatureTolerance,
        );
        _checkConvergenceDuringSettling(
          _whiteState,
          (s) => _whiteState = s,
          targets,
          _allWhiteMatch,
          _whiteTolerance,
        );

        // Also check MIXED state - if user hasn't interacted and devices converge, return to IDLE
        if (_brightnessState.state == RoleUIState.mixed &&
            _brightnessState.desiredValue != null &&
            _allBrightnessMatch(targets, _brightnessState.desiredValue!, _brightnessTolerance)) {
          _brightnessState = const RoleControlState(state: RoleUIState.idle);
        }
        if (_hueState.state == RoleUIState.mixed &&
            _hueState.desiredValue != null &&
            _allHueMatch(targets, _hueState.desiredValue!, _hueTolerance)) {
          _hueState = const RoleControlState(state: RoleUIState.idle);
        }
        if (_temperatureState.state == RoleUIState.mixed &&
            _temperatureState.desiredValue != null &&
            _allTemperatureMatch(targets, _temperatureState.desiredValue!, _temperatureTolerance)) {
          _temperatureState = const RoleControlState(state: RoleUIState.idle);
        }
        if (_whiteState.state == RoleUIState.mixed &&
            _whiteState.desiredValue != null &&
            _allWhiteMatch(targets, _whiteState.desiredValue!, _whiteTolerance)) {
          _whiteState = const RoleControlState(state: RoleUIState.idle);
        }
      });
    }
  }

  /// Check if ALL devices have brightness within tolerance of target value
  bool _allBrightnessMatch(List<LightTargetView> targets, double targetValue, double tolerance) {
    int matchCount = 0;
    int totalCount = 0;

    for (final target in targets) {
      if (!target.hasBrightness) continue;

      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasBrightness) {
          totalCount++;
          // Check if this device's brightness is within tolerance of target
          if ((channel.brightness - targetValue).abs() <= tolerance) {
            matchCount++;
          }
        }
      }
    }

    // All devices must match (or no devices with brightness)
    return totalCount == 0 || matchCount == totalCount;
  }

  /// Check if brightness values are "mixed" (differ by more than threshold)
  /// Returns (isMixed, minValue, maxValue)
  (bool, int, int) _getBrightnessMixedState(List<LightTargetView> targets, {int threshold = 10}) {
    int? minBrightness;
    int? maxBrightness;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasBrightness && channel.on) {
          final brightness = channel.brightness;
          minBrightness = minBrightness == null ? brightness : (brightness < minBrightness ? brightness : minBrightness);
          maxBrightness = maxBrightness == null ? brightness : (brightness > maxBrightness ? brightness : maxBrightness);
        }
      }
    }

    if (minBrightness == null || maxBrightness == null) {
      return (false, 0, 0);
    }

    final isMixed = (maxBrightness - minBrightness) > threshold;
    return (isMixed, minBrightness, maxBrightness);
  }

  /// Check if ALL devices have hue within tolerance of target value
  bool _allHueMatch(List<LightTargetView> targets, double targetValue, double tolerance) {
    int matchCount = 0;
    int totalCount = 0;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasHue && channel.on) {
          totalCount++;
          if ((channel.hue - targetValue).abs() <= tolerance) {
            matchCount++;
          }
        }
      }
    }

    return totalCount == 0 || matchCount == totalCount;
  }

  /// Check if ALL devices have temperature within tolerance of target value
  bool _allTemperatureMatch(List<LightTargetView> targets, double targetValue, double tolerance) {
    int matchCount = 0;
    int totalCount = 0;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasTemperature && channel.on) {
          final tempProp = channel.temperatureProp;
          if (tempProp != null && tempProp.value is NumberValueType) {
            totalCount++;
            final temp = (tempProp.value as NumberValueType).value.toDouble();
            if ((temp - targetValue).abs() <= tolerance) {
              matchCount++;
            }
          }
        }
      }
    }

    return totalCount == 0 || matchCount == totalCount;
  }

  /// Check if ALL devices have white within tolerance of target value
  bool _allWhiteMatch(List<LightTargetView> targets, double targetValue, double tolerance) {
    int matchCount = 0;
    int totalCount = 0;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasColorWhite && channel.on) {
          totalCount++;
          if ((channel.colorWhite - targetValue).abs() <= tolerance) {
            matchCount++;
          }
        }
      }
    }

    return totalCount == 0 || matchCount == totalCount;
  }

  void _onDevicesDataChanged() {
    // DevicesService notification means device was updated (e.g., assigned/unassigned from space)
    // Re-fetch light targets to get latest data
    if (mounted) {
      _spacesService?.fetchLightTargetsForSpace(widget.roomId);
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

    // Set initial mode to brightness if available, otherwise keep current
    if (_availableModes.length > 1 && _currentMode == _LightRoleMode.off) {
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
    final anyOn = onCount > 0;
    final hasBrightness = _availableModes.contains(_LightRoleMode.brightness);

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
                anyOn,
                hasBrightness,
                devicesService,
              ),
            ),
          ),
          if (_availableModes.length > 1)
            SafeArea(
              top: false,
              child: _buildBottomNavigation(context, localizations, lightTargets, devicesService, anyOn),
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
    bool anyOn,
    bool hasBrightness,
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
    if (hasColorSupport && anyOn) {
      int r = 0, g = 0, b = 0, count = 0;
      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );
          if (channel.hasColor && channel.on) {
            final color = _getChannelColorSafe(channel);
            if (color != null) {
              r += (color.r * 255).toInt();
              g += (color.g * 255).toInt();
              b += (color.b * 255).toInt();
              count++;
            }
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
                            // Brightness or on/off display
                            // Check for mixed state when no local slider value is set
                            _buildStateDisplay(
                              context,
                              avgBrightness,
                              anyOn,
                              hasBrightness,
                              targets,
                            ),
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
              // Right side - control slider or switch
              _buildControlSlider(
                context,
                targets,
                avgBrightness,
                anyOn,
                hasBrightness,
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

  /// Build state display (brightness percentage or on/off)
  Widget _buildStateDisplay(
    BuildContext context,
    int avgBrightness,
    bool anyOn,
    bool hasBrightness,
    List<LightTargetView> targets,
  ) {
    final localizations = AppLocalizations.of(context)!;

    // For simple on/off lights, show ON/OFF text
    if (!hasBrightness) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            anyOn ? localizations.light_state_on : localizations.light_state_off,
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
          Text(
            anyOn
                ? localizations.light_state_on_description
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

    // Determine what to display based on state machine:
    // 1. If state is PENDING/SETTLING/MIXED, show the desired value with appropriate indicator
    // 2. If state is IDLE and devices are mixed, show "Mixed" with range
    // 3. If state is IDLE and devices are synced, show average brightness

    final (devicesMixed, minBrightness, maxBrightness) = _getBrightnessMixedState(targets);
    final isLocked = _brightnessState.isLocked;
    final isSettling = _brightnessState.isSettling;
    final isMixedState = _brightnessState.isMixed;

    // Determine the display value
    final displayBrightness = isLocked
        ? (_brightnessState.desiredValue?.round() ?? avgBrightness)
        : avgBrightness;

    // Show mixed indicator when:
    // - State is MIXED (settling timed out with partial convergence)
    // - Or state is IDLE and devices have different values
    final showMixed = (isMixedState || (devicesMixed && !isLocked)) && anyOn;

    // Show settling indicator when actively waiting for devices
    final showSettling = isSettling && anyOn;

    // For brightness-capable lights, show brightness percentage or mixed indicator
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showMixed)
          // Show "Mixed" with an icon when devices have different values
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(
                MdiIcons.tuneVariant,
                size: _screenService.scale(
                  40,
                  density: _visualDensityService.density,
                ),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
              SizedBox(width: AppSpacings.pSm),
              Text(
                '$minBrightness-$maxBrightness',
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular,
                  fontSize: _screenService.scale(
                    45,
                    density: _visualDensityService.density,
                  ),
                  fontFamily: 'DIN1451',
                  fontWeight: FontWeight.w100,
                  height: 1.0,
                ),
              ),
              Text(
                '%',
                style: TextStyle(
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular,
                  fontSize: _screenService.scale(
                    20,
                    density: _visualDensityService.density,
                  ),
                  fontFamily: 'DIN1451',
                  fontWeight: FontWeight.w100,
                  height: 1.0,
                ),
              ),
            ],
          )
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                anyOn ? '$displayBrightness' : localizations.light_state_off,
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
              if (anyOn)
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
              if (showSettling)
                Padding(
                  padding: EdgeInsets.only(left: AppSpacings.pSm),
                  child: SizedBox(
                    width: _screenService.scale(
                      20,
                      density: _visualDensityService.density,
                    ),
                    height: _screenService.scale(
                      20,
                      density: _visualDensityService.density,
                    ),
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.regular.withValues(alpha: 0.6)
                          : AppTextColorDark.regular.withValues(alpha: 0.6),
                    ),
                  ),
                ),
            ],
          ),
        Text(
          showSettling
              ? localizations.light_state_syncing_description
              : (showMixed
                  ? localizations.light_state_mixed_description
                  : (anyOn
                      ? localizations.light_state_brightness_description
                      : localizations.light_state_off_description)),
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
    bool anyOn,
    bool hasBrightness,
    double elementMaxSize,
    DevicesService devicesService,
  ) {
    // For simple on/off lights, show a switch instead of slider
    if (!hasBrightness) {
      return _buildOnOffSwitch(
        context,
        targets,
        anyOn,
        elementMaxSize,
        devicesService,
      );
    }

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
        return _buildColorSlider(
          context,
          targets,
          elementMaxSize,
          devicesService,
        );
      case _LightRoleMode.temperature:
        return _buildTemperatureSlider(
          context,
          targets,
          elementMaxSize,
          devicesService,
        );
      case _LightRoleMode.white:
        return _buildWhiteSlider(
          context,
          targets,
          elementMaxSize,
          devicesService,
        );
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

  /// Build on/off switch for simple lights
  Widget _buildOnOffSwitch(
    BuildContext context,
    List<LightTargetView> targets,
    bool anyOn,
    double elementMaxSize,
    DevicesService devicesService,
  ) {
    return ColoredSwitch(
      switchState: anyOn,
      iconOn: MdiIcons.power,
      iconOff: MdiIcons.power,
      trackWidth: elementMaxSize,
      vertical: true,
      onChanged: (bool state) async {
        await _toggleAllLights(context, targets, devicesService);
      },
    );
  }

  /// Build brightness slider
  Widget _buildBrightnessSlider(
    BuildContext context,
    List<LightTargetView> targets,
    int currentBrightness,
    double elementMaxSize,
    DevicesService devicesService,
  ) {
    // Determine displayed value:
    // - If state is locked (PENDING/SETTLING/MIXED), show desired value
    // - Otherwise show actual device average
    final displayValue = _brightnessState.isLocked
        ? (_brightnessState.desiredValue ?? currentBrightness.toDouble())
        : currentBrightness.toDouble();

    return ColoredSlider(
      value: displayValue,
      min: 0,
      max: 100,
      enabled: true,
      vertical: true,
      trackWidth: elementMaxSize,
      showThumb: false,
      onValueChanged: (value) {
        // New user interaction cancels any SETTLING/MIXED state
        setState(() {
          _brightnessState.cancelTimer();
          _brightnessState = RoleControlState(
            state: RoleUIState.pending,
            desiredValue: value,
          );
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

  /// Build color (hue) slider
  Widget _buildColorSlider(
    BuildContext context,
    List<LightTargetView> targets,
    double elementMaxSize,
    DevicesService devicesService,
  ) {
    // Calculate average hue from devices that are on
    double totalHue = 0;
    int hueCount = 0;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasHue && channel.on) {
          totalHue += channel.hue;
          hueCount++;
        }
      }
    }

    final avgHue = hueCount > 0 ? totalHue / hueCount : 180.0;

    // Determine displayed value based on state
    final displayValue = _hueState.isLocked
        ? (_hueState.desiredValue ?? avgHue)
        : avgHue;

    return ColoredSlider(
      value: displayValue,
      min: 0.0,
      max: 360.0,
      enabled: true,
      vertical: true,
      trackWidth: elementMaxSize,
      onValueChanged: (value) {
        // New user interaction cancels any SETTLING/MIXED state
        setState(() {
          _hueState.cancelTimer();
          _hueState = RoleControlState(
            state: RoleUIState.pending,
            desiredValue: value,
          );
        });
        // Debounce the API call
        _hueDebounceTimer?.cancel();
        _hueDebounceTimer = Timer(
          const Duration(milliseconds: 300),
          () => _setHueForAll(context, targets, value, devicesService),
        );
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

  /// Build temperature slider
  Widget _buildTemperatureSlider(
    BuildContext context,
    List<LightTargetView> targets,
    double elementMaxSize,
    DevicesService devicesService,
  ) {
    // Calculate average temperature from devices that are on
    double totalTemp = 0;
    int tempCount = 0;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasTemperature && channel.on) {
          final tempProp = channel.temperatureProp;
          if (tempProp != null && tempProp.value is NumberValueType) {
            totalTemp += (tempProp.value as NumberValueType).value.toDouble();
            tempCount++;
          }
        }
      }
    }

    final avgTemp = tempCount > 0 ? totalTemp / tempCount : 4000.0;

    // Determine displayed value based on state
    final displayValue = _temperatureState.isLocked
        ? (_temperatureState.desiredValue ?? avgTemp)
        : avgTemp;

    return ColoredSlider(
      value: displayValue,
      min: 2700,
      max: 6500,
      enabled: true,
      vertical: true,
      trackWidth: elementMaxSize,
      onValueChanged: (value) {
        // New user interaction cancels any SETTLING/MIXED state
        setState(() {
          _temperatureState.cancelTimer();
          _temperatureState = RoleControlState(
            state: RoleUIState.pending,
            desiredValue: value,
          );
        });
        // Debounce the API call
        _temperatureDebounceTimer?.cancel();
        _temperatureDebounceTimer = Timer(
          const Duration(milliseconds: 300),
          () => _setTemperatureForAll(context, targets, value, devicesService),
        );
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

  /// Build white channel slider
  Widget _buildWhiteSlider(
    BuildContext context,
    List<LightTargetView> targets,
    double elementMaxSize,
    DevicesService devicesService,
  ) {
    // Calculate average white value from devices that are on
    double totalWhite = 0;
    int whiteCount = 0;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasColorWhite && channel.on) {
          totalWhite += channel.colorWhite.toDouble();
          whiteCount++;
        }
      }
    }

    final avgWhite = whiteCount > 0 ? totalWhite / whiteCount : 128.0;

    // Determine displayed value based on state
    final displayValue = _whiteState.isLocked
        ? (_whiteState.desiredValue ?? avgWhite)
        : avgWhite;

    return ColoredSlider(
      value: displayValue,
      min: 0,
      max: 255,
      enabled: true,
      vertical: true,
      trackWidth: elementMaxSize,
      showThumb: false,
      onValueChanged: (value) {
        // New user interaction cancels any SETTLING/MIXED state
        setState(() {
          _whiteState.cancelTimer();
          _whiteState = RoleControlState(
            state: RoleUIState.pending,
            desiredValue: value,
          );
        });
        // Debounce the API call
        _whiteDebounceTimer?.cancel();
        _whiteDebounceTimer = Timer(
          const Duration(milliseconds: 300),
          () => _setWhiteForAll(context, targets, value.round(), devicesService),
        );
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
    // Get room name for stripping from device names
    final roomName = _spacesService?.getSpace(widget.roomId)?.name;

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

      // Strip room name from device name
      final displayName = _stripRoomName(device.name, roomName);

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
                ? (channel!.hasColor
                    ? (_getChannelColorSafe(channel) ?? Theme.of(context).primaryColor)
                    : Theme.of(context).primaryColor)
                : null,
          ),
          title: Text(
            displayName,
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
    bool anyOn,
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
            // Show "On" when lights are off, "Off" when lights are on
            return AppBottomNavigationItem(
              icon: Icon(MdiIcons.power),
              label: anyOn ? localizations.light_mode_off : localizations.light_mode_on,
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
    final localizations = AppLocalizations.of(context);

    try {
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

      int successCount = 0;
      int failCount = 0;

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );
          final onProp = channel.onProp;
          final success = await devicesService.setPropertyValue(onProp.id, newState);
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
    }
    // Note: Don't reset _sliderBrightness here - let it persist until device state catches up
    // The _onSpacesDataChanged callback will reset it when device state matches slider value
  }

  /// Set hue for all devices in the role that support color
  Future<void> _setHueForAll(
    BuildContext context,
    List<LightTargetView> targets,
    double hue,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);

    try {
      int successCount = 0;
      int failCount = 0;

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          final hueProp = channel.hueProp;
          if (hueProp != null) {
            final success = await devicesService.setPropertyValue(
              hueProp.id,
              hue,
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
          message: localizations?.action_failed ?? 'Failed to set color',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        this.context,
        message: localizations?.action_failed ?? 'Failed to set color',
      );
    }
    // Note: Don't reset _sliderHue here - let it persist until device state catches up
  }

  /// Set color temperature for all devices in the role that support it
  Future<void> _setTemperatureForAll(
    BuildContext context,
    List<LightTargetView> targets,
    double temperature,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);

    try {
      int successCount = 0;
      int failCount = 0;

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          final tempProp = channel.temperatureProp;
          if (tempProp != null) {
            final success = await devicesService.setPropertyValue(
              tempProp.id,
              temperature.round(),
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
          message: localizations?.action_failed ?? 'Failed to set temperature',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        this.context,
        message: localizations?.action_failed ?? 'Failed to set temperature',
      );
    }
    // Note: Don't reset _sliderTemperature here - let it persist until device state catches up
  }

  /// Set white channel for all devices in the role that support it
  Future<void> _setWhiteForAll(
    BuildContext context,
    List<LightTargetView> targets,
    int white,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);

    try {
      int successCount = 0;
      int failCount = 0;

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          final whiteProp = channel.colorWhiteProp;
          if (whiteProp != null) {
            final success = await devicesService.setPropertyValue(
              whiteProp.id,
              white,
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
          message: localizations?.action_failed ?? 'Failed to set white level',
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        this.context,
        message: localizations?.action_failed ?? 'Failed to set white level',
      );
    }
    // Note: Don't reset _sliderWhite here - let it persist until device state catches up
  }

  /// Safely get color from a light channel
  /// Returns null if the channel doesn't have valid color properties
  Color? _getChannelColorSafe(LightChannelView channel) {
    try {
      return channel.color;
    } catch (_) {
      // Channel has partial color properties but not enough for a valid color
      return null;
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
