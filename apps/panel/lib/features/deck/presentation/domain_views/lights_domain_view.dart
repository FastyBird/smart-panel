library lights_domain_view;

import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_navigation.dart';
import 'package:fastybird_smart_panel/core/widgets/button_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/colored_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/fixed_grid_size_grid.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart'
    hide IntentOverlayService;
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/intents/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

part 'lights_domain_view_models.dart';

// ============================================================================
// Helper Functions
// ============================================================================

// Private UI models are in the part file: lights_domain_view_models.dart
// Public models, constants, and utilities are in: modules/deck/domain_views/lighting/

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
  DeviceControlStateService? _deviceControlStateService;

  // Track which roles are currently being toggled (prevents double-taps)
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

    try {
      _deviceControlStateService = locator<DeviceControlStateService>();
      _deviceControlStateService?.addListener(_onControlStateChanged);
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
    _deviceControlStateService?.removeListener(_onControlStateChanged);

    super.dispose();
  }

  void _onSpacesDataChanged() {
    // SpacesService notification means data is already updated, just rebuild UI
    if (mounted) {
      setState(() {});
    }
  }

  void _onDevicesDataChanged() {
    // DevicesService notification means device property values were updated
    // Trigger UI rebuild to reflect the new values
    if (mounted) {
      setState(() {});
    }
  }

  void _onIntentDataChanged() {
    // Intent overlay service changed - rebuild to show/hide failure indicators
    if (mounted) {
      setState(() {});
    }
  }

  void _onControlStateChanged() {
    // Device control state changed - rebuild to reflect optimistic UI state
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

                  // "Other" channels section
                  if (otherGroup != null && otherGroup.targets.isNotEmpty)
                    _buildOtherChannelsSection(
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
    // Group targets by role, filtering out targets whose devices are disabled/not found
    final Map<LightTargetRole, List<LightTargetView>> grouped = {};
    for (final target in targets) {
      // Skip targets whose devices are disabled (not in devicesService)
      final device = devicesService.getDevice(target.deviceId);
      if (device == null) continue;

      final role = target.role ?? LightTargetRole.other;
      grouped.putIfAbsent(role, () => []).add(target);
    }

    // Build role groups with state information
    final List<_RoleGroup> groups = [];
    for (final role in LightTargetRole.values) {
      final roleTargets = grouped[role] ?? [];
      if (roleTargets.isEmpty) continue;

      int onCount = 0;
      bool hasBrightness = false;
      int? firstOnBrightness;
      int? firstDeviceBrightness;

      for (final target in roleTargets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView &&
            device.lightChannels.isNotEmpty) {
          // Find matching channel
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          // Skip if channel wasn't found (fallback was used) to avoid incorrect state
          if (channel.id != target.channelId) continue;

          // Check if ON property is locked by intent to get overlay value for instant feedback
          bool isOn = channel.on;
          if (_intentOverlayService != null) {
            final onProp = channel.onProp;
            if (_intentOverlayService!.isPropertyLocked(
                  target.deviceId,
                  target.channelId,
                  onProp.id,
                )) {
              final overlayValue = _intentOverlayService!.getOverlayValue(
                target.deviceId,
                target.channelId,
                onProp.id,
              );
              if (overlayValue is bool) {
                isOn = overlayValue;
              }
            }
          }

          if (isOn) {
            onCount++;
          }

          if (channel.hasBrightness) {
            hasBrightness = true;
            // Capture first device's brightness (for when all are off)
            firstDeviceBrightness ??= channel.brightness;
            // Capture first ON device's brightness
            if (isOn && firstOnBrightness == null) {
              firstOnBrightness = channel.brightness;
            }
          }
        }
      }

      // Check device control state service for optimistic UI
      // When any property in the role is locked, use its desired value
      bool isRoleLocked = false;
      bool desiredOn = false;
      final controlStateService = _deviceControlStateService;

      if (controlStateService != null) {
        for (final target in roleTargets) {
          final device = devicesService.getDevice(target.deviceId);
          if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
            final channel = device.lightChannels.firstWhere(
              (c) => c.id == target.channelId,
              orElse: () => device.lightChannels.first,
            );
            if (channel.id != target.channelId) continue;

            if (controlStateService.isLocked(
              target.deviceId,
              target.channelId,
              channel.onProp.id,
            )) {
              isRoleLocked = true;
              final desiredValue = controlStateService.getDesiredValue(
                target.deviceId,
                target.channelId,
                channel.onProp.id,
              );
              if (desiredValue is bool) {
                desiredOn = desiredValue;
              } else if (desiredValue is num) {
                desiredOn = desiredValue > 0.5;
              }
              break;
            }
          }
        }
      }

      final effectiveOnCount = isRoleLocked
          ? (desiredOn ? roleTargets.length : 0) // All on or all off based on desired state
          : onCount;

      if (kDebugMode && isRoleLocked) {
        debugPrint(
          '[LIGHTS DOMAIN] _buildRoleGroups: role=$role, isLocked=$isRoleLocked, '
          'desiredOn=$desiredOn, onCount=$onCount, effectiveOnCount=$effectiveOnCount',
        );
      }

      groups.add(_RoleGroup(
        role: role,
        targets: roleTargets,
        onCount: effectiveOnCount,
        totalCount: roleTargets.length,
        hasBrightness: hasBrightness,
        brightness: firstOnBrightness ?? firstDeviceBrightness,
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
  /// Uses optimistic UI updates via device control state service
  Widget _buildRoleTile(
    BuildContext context,
    _RoleGroup group,
    DevicesService devicesService,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final isToggling = _togglingRoles.contains(group.role);

    // Check device control state service for optimistic state
    // If any property in the role is locked, use the service's desired value
    bool isOn = group.isOn;
    final controlStateService = _deviceControlStateService;
    if (controlStateService != null) {
      for (final target in group.targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );
          // Skip if channel wasn't found (fallback was used)
          if (channel.id != target.channelId) continue;

          if (controlStateService.isLocked(
            target.deviceId,
            target.channelId,
            channel.onProp.id,
          )) {
            // Role has locked properties - derive isOn from desired value
            final desiredValue = controlStateService.getDesiredValue(
              target.deviceId,
              target.channelId,
              channel.onProp.id,
            );
            if (desiredValue is bool) {
              isOn = desiredValue;
            } else if (desiredValue is num) {
              isOn = desiredValue > 0.5;
            }
            break; // Found a locked property, use its desired state
          }
        }
      }
    }

    // Build subtitle: "X light(s) on" or "all off", with optional brightness
    final String countText;
    if (group.onCount == 0 && !isOn) {
      countText = localizations.domain_lights_all_off;
    } else if (isOn && group.onCount == 0) {
      // Optimistic state: turning on but actual count is still 0
      countText = localizations.domain_lights_count_on(group.totalCount);
    } else {
      countText = localizations.domain_lights_count_on(group.onCount);
    }

    // Build subtitle widget with brightness icon if available
    final bool showBrightness = group.hasBrightness && group.brightness != null && group.onCount > 0;

    return ButtonTileBox(
      // Tap on tile (outside icon) opens detail
      onTap: isToggling
          ? null
          : () => _openRoleTileDetail(context, group, devicesService),
      isOn: isOn,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          ButtonTileIcon(
            icon: getLightRoleIcon(group.role),
            // Tap on icon toggles the role
            onTap: isToggling ? null : () => _toggleRole(context, group, devicesService),
            isOn: isOn,
          ),
          AppSpacings.spacingSmVertical,
          ButtonTileTitle(
            title: getLightRoleName(context, group.role),
            isOn: isOn,
          ),
          AppSpacings.spacingXsVertical,
          ButtonTileSubTitle(
            subTitle: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(countText),
                if (showBrightness) ...[
                  Text(' • '),
                  Icon(
                    MdiIcons.weatherSunny,
                    size: AppFontSize.extraSmall,
                  ),
                  const SizedBox(width: 2),
                  Text('${group.brightness}%'),
                ],
              ],
            ),
            isOn: isOn,
          ),
        ],
      ),
    );
  }

  /// Open role detail or device detail based on number of devices in the group
  void _openRoleTileDetail(
    BuildContext context,
    _RoleGroup group,
    DevicesService devicesService,
  ) {
    if (group.targets.length == 1) {
      // Single device - open device detail
      final target = group.targets.first;
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        _openDeviceDetail(context, device);
      }
    } else {
      // Multiple devices - open role detail
      _openRoleDetail(context, group, devicesService);
    }
  }

  /// Toggle all devices in a role using batch commands with optimistic UI updates
  /// Uses DeviceControlStateService for property-level state tracking
  Future<void> _toggleRole(
    BuildContext context,
    _RoleGroup group,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);
    final role = group.role;
    final controlStateService = _deviceControlStateService;

    // If any device is on, turn all off. Otherwise turn all on.
    final newState = !group.isOn;

    // Build list of properties to update
    final List<PropertyCommandItem> properties = [];

    for (final target in group.targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView &&
          device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        // Skip if channel wasn't found (fallback was used) to avoid property/channel mismatch
        if (channel.id != target.channelId) continue;

        properties.add(PropertyCommandItem(
          deviceId: target.deviceId,
          channelId: target.channelId,
          propertyId: channel.onProp.id,
          value: newState,
        ));
      }
    }

    if (properties.isEmpty) return;

    // Set state machine to PENDING for all properties - locks UI to show desired state
    if (kDebugMode) {
      debugPrint('[LIGHTS DOMAIN] _toggleRole: Setting PENDING state for $role to $newState');
    }
    for (final property in properties) {
      controlStateService?.setPending(
        property.deviceId,
        property.channelId,
        property.propertyId,
        newState,
      );
    }
    setState(() {
      _togglingRoles.add(role);
    });

    // Create local optimistic overlays for intent tracking
    for (final property in properties) {
      _intentOverlayService?.createLocalOverlay(
        deviceId: property.deviceId,
        channelId: property.channelId,
        propertyId: property.propertyId,
        value: property.value,
        ttlMs: 5000, // 5 second TTL
      );
    }

    try {
      // Get display ID from display repository
      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      // Build context for intent tracking
      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: _roomId,
        roleKey: role.name,
      );

      // Send single batch command for all properties
      final success = await devicesService.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
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
      // Transition to SETTLING state for all properties
      setState(() {
        _togglingRoles.remove(role);
      });

      if (mounted) {
        if (kDebugMode) {
          debugPrint('[LIGHTS DOMAIN] _toggleRole: Transitioning to SETTLING state for $role');
        }
        for (final property in properties) {
          controlStateService?.setSettling(
            property.deviceId,
            property.channelId,
            property.propertyId,
          );
        }
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

  /// Build "Other" channels section using FixedGridSizeGrid
  Widget _buildOtherChannelsSection(
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
          child: _buildOtherChannelTile(
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
        // Channel tiles grid - horizontal layout with 1 row height
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

  /// Build a small channel tile for "Other" channels using horizontal layout
  Widget _buildOtherChannelTile(
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

    // Skip if channel wasn't found (fallback was used) to avoid property/channel mismatch
    if (channel.id != target.channelId) {
      return const SizedBox.shrink();
    }

    // Check device control state service first (local optimistic state, most reliable)
    // When state is locked (pending/settling), use the desired value
    bool isOn = channel.on;
    final controlStateService = _deviceControlStateService;
    final onProp = channel.onProp;

    if (controlStateService != null &&
        controlStateService.isLocked(target.deviceId, target.channelId, onProp.id)) {
      // Use desired value from control state service (immediate, no listener delay)
      final desiredValue = controlStateService.getDesiredValue(
        target.deviceId,
        target.channelId,
        onProp.id,
      );
      if (desiredValue is bool) {
        isOn = desiredValue;
      } else if (desiredValue is num) {
        isOn = desiredValue > 0.5;
      }
    } else if (_intentOverlayService != null) {
      // Fall back to overlay service (for failures, backend intents, etc.)
      if (_intentOverlayService!.isPropertyLocked(
            target.deviceId,
            target.channelId,
            onProp.id,
          )) {
        final overlayValue = _intentOverlayService!.getOverlayValue(
          target.deviceId,
          target.channelId,
          onProp.id,
        );
        if (overlayValue is bool) {
          isOn = overlayValue;
        }
      }
    }

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

    // Strip room name from channel name
    final roomName = _spacesService?.getSpace(_roomId)?.name;
    final displayName = stripRoomNameFromDevice(target.channelName, roomName);

    // Uses optimistic UI updates via overlay service - no loader needed
    return ButtonTileBox(
      // Tap on tile (outside icon) opens device detail
      onTap: isToggling ? null : () => _openDeviceDetail(context, device),
      isOn: isOn,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              ButtonTileIcon(
                icon: hasFailure
                    ? MdiIcons.alertCircleOutline
                    : (isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline),
                // Tap on icon toggles the device
                onTap: isToggling
                    ? null
                    : () => _toggleDevice(context, target, channel, devicesService),
                isOn: isOn,
                iconColor: hasFailure ? AppColorsLight.warning : null,
              ),
              // Offline indicator badge
              if (!device.isOnline)
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      MdiIcons.alert,
                      size: AppFontSize.extraSmall,
                      color: AppColorsLight.warning,
                    ),
                  ),
                ),
            ],
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
                ),
                AppSpacings.spacingXsVertical,
                ButtonTileSubTitle(
                  subTitle: Row(
                    children: [
                      Text(stateText),
                      if (showBrightness) ...[
                        AppSpacings.spacingSmHorizontal,
                        Icon(
                          MdiIcons.weatherSunny,
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
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Toggle a single device using batch command with optimistic UI updates
  /// Uses DeviceControlStateService for property-level state tracking
  Future<void> _toggleDevice(
    BuildContext context,
    LightTargetView target,
    LightChannelView channel,
    DevicesService devicesService,
  ) async {
    final localizations = AppLocalizations.of(context);
    final newOnValue = !channel.on;
    final controlStateService = _deviceControlStateService;

    // Set state machine to PENDING - this locks the UI to show desired state
    controlStateService?.setPending(
      target.deviceId,
      target.channelId,
      channel.onProp.id,
      newOnValue,
    );
    setState(() {
      _togglingDevices.add(target.id);
    });

    // Also create overlay for intent tracking (for failure detection etc)
    _intentOverlayService?.createLocalOverlay(
      deviceId: target.deviceId,
      channelId: target.channelId,
      propertyId: channel.onProp.id,
      value: newOnValue,
      ttlMs: 5000, // 5 second TTL - should be replaced by real intent before this expires
    );

    try {
      // Get display ID from display repository
      // Note: displayId may be null if display is not yet registered, which is acceptable
      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      // Build context for intent tracking
      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: _roomId,
        roleKey: 'other',
      );

      // Use batch command even for single device for consistency with intents
      final success = await devicesService.setMultiplePropertyValues(
        properties: [
          PropertyCommandItem(
            deviceId: target.deviceId,
            channelId: target.channelId,
            propertyId: channel.onProp.id,
            value: newOnValue,
          ),
        ],
        context: commandContext,
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
      // Transition to SETTLING state - suppresses state changes while device syncs
      setState(() {
        _togglingDevices.remove(target.id);
      });

      if (mounted) {
        controlStateService?.setSettling(
          target.deviceId,
          target.channelId,
          channel.onProp.id,
        );
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
  RoleControlStateRepository? _roleControlStateRepository;

  // Current mode for bottom navigation
  _LightRoleMode _currentMode = _LightRoleMode.off;
  final List<_LightRoleMode> _availableModes = [];

  // Role control states for each control type (replaces simple slider values)
  RoleControlState _brightnessState = const RoleControlState();
  RoleControlState _hueState = const RoleControlState();
  RoleControlState _temperatureState = const RoleControlState();
  RoleControlState _whiteState = const RoleControlState();
  RoleControlState _onOffState = const RoleControlState(); // For on/off settling

  // Pending on/off state for optimistic UI (fallback when overlay timing issues)
  // desiredValue: 1.0 = on, 0.0 = off (stored in _onOffState.desiredValue)
  bool? _pendingOnState;

  // Timer for delayed clearing of pending on/off state
  Timer? _pendingOnStateClearTimer;

  // Cache key for this role
  String get _cacheKey => RoleControlStateRepository.generateKey(
        widget.roomId,
        'lighting',
        widget.role.name,
      );

  // Flag to track if we've loaded cached values
  bool _cacheLoaded = false;

  // Debounce timers for sliders (user input debounce, separate from settling)
  Timer? _brightnessDebounceTimer;
  Timer? _hueDebounceTimer;
  Timer? _temperatureDebounceTimer;
  Timer? _whiteDebounceTimer;

  // Track which control types had active intents (for detecting intent completion)
  bool _brightnessWasLocked = false;
  bool _colorWasLocked = false;
  bool _temperatureWasLocked = false;
  bool _whiteWasLocked = false;

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
      // Initialize lock tracking state
      _updateLockTrackingState();
    } catch (_) {}

    try {
      _roleControlStateRepository = locator<RoleControlStateRepository>();
    } catch (_) {}

    // Initialize available modes
    _updateAvailableModes();

    // Load cached values (deferred to first build when targets are available)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadCachedValues();
    });
  }

  @override
  void dispose() {
    _brightnessDebounceTimer?.cancel();
    _hueDebounceTimer?.cancel();
    _temperatureDebounceTimer?.cancel();
    _whiteDebounceTimer?.cancel();
    _pendingOnStateClearTimer?.cancel();
    // Cancel any settling timers
    _brightnessState.cancelTimer();
    _hueState.cancelTimer();
    _temperatureState.cancelTimer();
    _whiteState.cancelTimer();
    _onOffState.cancelTimer();
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
    final timer = Timer(const Duration(milliseconds: LightingConstants.settlingWindowMs), () {
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
    // Early exit if widget is disposed
    if (!mounted) return;
    if (currentState.desiredValue == null) return;

    // Check if devices have converged
    if (convergenceCheck(targets, currentState.desiredValue!, tolerance)) {
      // All devices converged - return to IDLE
      // Re-check mounted before setState to handle race condition
      if (!mounted) return;
      setState(() {
        updateState(const RoleControlState(state: RoleUIState.idle));
      });
    } else {
      // Devices did not converge - enter MIXED state
      // Keep the desired value so slider stays in place
      // Re-check mounted before setState to handle race condition
      if (!mounted) return;
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
  // Intent Lock Tracking Helpers
  // ============================================================================

  /// Check if any target's brightness property is currently locked by an intent
  bool _anyBrightnessLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      if (!target.hasBrightness) continue;
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.id != target.channelId) continue;
        final brightnessProp = channel.brightnessProp;
        if (brightnessProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, brightnessProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  /// Check if any target's color property is currently locked by an intent
  /// Supports both HSV (hue) and RGB color properties
  bool _anyColorLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.id != target.channelId) continue;
        if (!channel.hasColor) continue;

        // Check HSV hue property
        final hueProp = channel.hueProp;
        if (hueProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, hueProp.id)) {
          return true;
        }

        // Check RGB properties
        final redProp = channel.colorRedProp;
        if (redProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, redProp.id)) {
          return true;
        }
        final greenProp = channel.colorGreenProp;
        if (greenProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, greenProp.id)) {
          return true;
        }
        final blueProp = channel.colorBlueProp;
        if (blueProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, blueProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  /// Check if any target's temperature property is currently locked by an intent
  bool _anyTemperatureLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      if (!target.hasColorTemp) continue;
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.id != target.channelId) continue;
        final tempProp = channel.temperatureProp;
        if (tempProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, tempProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  /// Check if any target's white property is currently locked by an intent
  bool _anyWhiteLocked(List<LightTargetView> targets) {
    final service = _intentOverlayService;
    final devicesService = _devicesService;
    if (service == null || devicesService == null) return false;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.id != target.channelId) continue;
        if (!channel.hasColorWhite) continue;
        final whiteProp = channel.colorWhiteProp;
        if (whiteProp != null &&
            service.isPropertyLocked(target.deviceId, target.channelId, whiteProp.id)) {
          return true;
        }
      }
    }
    return false;
  }

  /// Update the lock tracking state based on current intent locks
  void _updateLockTrackingState() {
    final targets = _spacesService
        ?.getLightTargetsForSpace(widget.roomId)
        .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
        .toList() ?? [];

    _brightnessWasLocked = _anyBrightnessLocked(targets);
    _colorWasLocked = _anyColorLocked(targets);
    _temperatureWasLocked = _anyTemperatureLocked(targets);
    _whiteWasLocked = _anyWhiteLocked(targets);
  }

  // ============================================================================
  // Intent Change Handler
  // ============================================================================

  /// Called when intent overlay service notifies of changes
  ///
  /// Only transitions a control to SETTLING when its specific intent completes,
  /// not when any global intent completes. This prevents incorrect state
  /// transitions when multiple controls are adjusted in quick succession.
  void _onIntentChanged() {
    if (!mounted) return;

    final targets = _spacesService
        ?.getLightTargetsForSpace(widget.roomId)
        .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
        .toList() ?? [];

    // Check current lock state for each control type
    final brightnessNowLocked = _anyBrightnessLocked(targets);
    final hueNowLocked = _anyColorLocked(targets);
    final temperatureNowLocked = _anyTemperatureLocked(targets);
    final whiteNowLocked = _anyWhiteLocked(targets);

    setState(() {
      // Transition brightness to SETTLING only when its intent completes
      // (was locked before, not locked now, and state is PENDING)
      if (_brightnessWasLocked && !brightnessNowLocked &&
          _brightnessState.state == RoleUIState.pending) {
        _startSettlingState(
          _brightnessState,
          (s) => _brightnessState = s,
          targets,
          _allBrightnessMatch,
          LightingConstants.brightnessTolerance,
        );
      }

      // Transition hue to SETTLING only when its intent completes
      if (_colorWasLocked && !hueNowLocked &&
          _hueState.state == RoleUIState.pending) {
        _startSettlingState(
          _hueState,
          (s) => _hueState = s,
          targets,
          _allHueMatch,
          LightingConstants.hueTolerance,
        );
      }

      // Transition temperature to SETTLING only when its intent completes
      if (_temperatureWasLocked && !temperatureNowLocked &&
          _temperatureState.state == RoleUIState.pending) {
        _startSettlingState(
          _temperatureState,
          (s) => _temperatureState = s,
          targets,
          _allTemperatureMatch,
          LightingConstants.temperatureTolerance,
        );
      }

      // Transition white to SETTLING only when its intent completes
      if (_whiteWasLocked && !whiteNowLocked &&
          _whiteState.state == RoleUIState.pending) {
        _startSettlingState(
          _whiteState,
          (s) => _whiteState = s,
          targets,
          _allWhiteMatch,
          LightingConstants.whiteTolerance,
        );
      }
    });

    // Update lock tracking state for next comparison
    _brightnessWasLocked = brightnessNowLocked;
    _colorWasLocked = hueNowLocked;
    _temperatureWasLocked = temperatureNowLocked;
    _whiteWasLocked = whiteNowLocked;
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
          LightingConstants.brightnessTolerance,
        );
        _checkConvergenceDuringSettling(
          _hueState,
          (s) => _hueState = s,
          targets,
          _allHueMatch,
          LightingConstants.hueTolerance,
        );
        _checkConvergenceDuringSettling(
          _temperatureState,
          (s) => _temperatureState = s,
          targets,
          _allTemperatureMatch,
          LightingConstants.temperatureTolerance,
        );
        _checkConvergenceDuringSettling(
          _whiteState,
          (s) => _whiteState = s,
          targets,
          _allWhiteMatch,
          LightingConstants.whiteTolerance,
        );

        // Also check MIXED state - if user hasn't interacted and devices converge, return to IDLE
        if (_brightnessState.state == RoleUIState.mixed &&
            _brightnessState.desiredValue != null &&
            _allBrightnessMatch(targets, _brightnessState.desiredValue!, LightingConstants.brightnessTolerance)) {
          _brightnessState = const RoleControlState(state: RoleUIState.idle);
        }
        if (_hueState.state == RoleUIState.mixed &&
            _hueState.desiredValue != null &&
            _allHueMatch(targets, _hueState.desiredValue!, LightingConstants.hueTolerance)) {
          _hueState = const RoleControlState(state: RoleUIState.idle);
        }
        if (_temperatureState.state == RoleUIState.mixed &&
            _temperatureState.desiredValue != null &&
            _allTemperatureMatch(targets, _temperatureState.desiredValue!, LightingConstants.temperatureTolerance)) {
          _temperatureState = const RoleControlState(state: RoleUIState.idle);
        }
        if (_whiteState.state == RoleUIState.mixed &&
            _whiteState.desiredValue != null &&
            _allWhiteMatch(targets, _whiteState.desiredValue!, LightingConstants.whiteTolerance)) {
          _whiteState = const RoleControlState(state: RoleUIState.idle);
        }

        // Update cache when devices are fully synced
        _updateCacheIfSynced(targets);
      });
    }
  }

  // ============================================================================
  // Role Control State Cache
  // ============================================================================

  /// Load cached values on first build
  void _loadCachedValues() {
    if (_cacheLoaded) return;
    _cacheLoaded = true;

    // Get current targets
    final targets = _spacesService
        ?.getLightTargetsForSpace(widget.roomId)
        .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
        .toList() ?? [];

    if (targets.isEmpty) return;

    // Get current mixed state
    final roleMixedState = _getRoleMixedState(targets);

    // If devices are not mixed, no need to set up cached state
    if (!roleMixedState.isMixed) return;

    // Try to get cached values
    final cached = _roleControlStateRepository?.get(_cacheKey);

    // Derive initial values from first device with each capability
    double? initialBrightness;
    double? initialHue;
    double? initialTemperature;
    double? initialWhite;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        // Get first available value for each capability
        if (initialBrightness == null && channel.hasBrightness) {
          initialBrightness = channel.brightness.toDouble();
        }
        if (initialHue == null && channel.hasColor) {
          initialHue = _getChannelHue(channel);
        }
        if (initialTemperature == null && channel.hasTemperature) {
          final tempProp = channel.temperatureProp;
          if (tempProp?.value is NumberValueType) {
            initialTemperature = (tempProp!.value as NumberValueType).value.toDouble();
          }
        }
        if (initialWhite == null && channel.hasColorWhite) {
          initialWhite = channel.colorWhite.toDouble();
        }

        // Stop if we have all values
        if (initialBrightness != null && initialHue != null &&
            initialTemperature != null && initialWhite != null) {
          break;
        }
      }
    }

    // Use cached values if available, otherwise use values from first device
    // Check mounted since this may be called from addPostFrameCallback
    if (!mounted) return;

    setState(() {
      final brightness = cached?.brightness ?? initialBrightness;
      if (brightness != null) {
        _brightnessState = RoleControlState(
          state: RoleUIState.mixed,
          desiredValue: brightness,
        );
      }

      final hue = cached?.hue ?? initialHue;
      if (hue != null) {
        _hueState = RoleControlState(
          state: RoleUIState.mixed,
          desiredValue: hue,
        );
      }

      final temperature = cached?.temperature ?? initialTemperature;
      if (temperature != null) {
        _temperatureState = RoleControlState(
          state: RoleUIState.mixed,
          desiredValue: temperature,
        );
      }

      final white = cached?.white ?? initialWhite;
      if (white != null) {
        _whiteState = RoleControlState(
          state: RoleUIState.mixed,
          desiredValue: white,
        );
      }
    });
  }

  /// Save user-set value to cache
  void _saveToCache({
    double? brightness,
    double? hue,
    double? temperature,
    double? white,
  }) {
    _roleControlStateRepository?.set(
      _cacheKey,
      brightness: brightness,
      hue: hue,
      temperature: temperature,
      white: white,
    );
  }

  /// Update cache when all devices are synced
  void _updateCacheIfSynced(List<LightTargetView> targets) {
    final roleMixedState = _getRoleMixedState(targets);

    // Only update cache when devices are fully synced (all in IDLE state)
    if (roleMixedState.isSynced && !roleMixedState.onStateMixed) {
      // Get the common values from devices
      double? commonBrightness;
      double? commonHue;
      double? commonTemperature;
      double? commonWhite;

      // Use the values from the first ON device as the synced values
      for (final target in targets) {
        final device = _devicesService?.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          if (channel.on) {
            if (channel.hasBrightness) {
              commonBrightness = channel.brightness.toDouble();
            }
            if (channel.hasColor) {
              commonHue = _getChannelHue(channel);
            }
            if (channel.hasTemperature) {
              final tempProp = channel.temperatureProp;
              if (tempProp?.value is NumberValueType) {
                commonTemperature = (tempProp!.value as NumberValueType).value.toDouble();
              }
            }
            if (channel.hasColorWhite) {
              commonWhite = channel.colorWhite.toDouble();
            }
            break; // Only need first ON device since they're synced
          }
        }
      }

      // Update cache with synced values
      if (commonBrightness != null || commonHue != null ||
          commonTemperature != null || commonWhite != null) {
        _roleControlStateRepository?.updateFromSync(
          _cacheKey,
          brightness: commonBrightness,
          hue: commonHue,
          temperature: commonTemperature,
          white: commonWhite,
        );
      }
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
        if (channel.hasColor && channel.on) {
          final hue = _getChannelHue(channel);
          if (hue != null) {
            totalCount++;
            if ((hue - targetValue).abs() <= tolerance) {
              matchCount++;
            }
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

  /// Get comprehensive mixed state for a role's devices
  ///
  /// Checks all capabilities and returns detailed info about what's mixed:
  /// - On/off state: mixed if some devices are on and some off
  /// - Brightness: mixed if values differ by more than threshold (among ON devices)
  /// - Hue: mixed if values differ by more than threshold (among ON devices)
  /// - Temperature: mixed if values differ by more than threshold (among ON devices)
  /// - White: mixed if values differ by more than threshold (among ON devices)
  RoleMixedState _getRoleMixedState(List<LightTargetView> targets) {
    int onCount = 0;
    int offCount = 0;

    // Track min/max for each capability
    int? minBrightness, maxBrightness;
    double? minHue, maxHue;
    double? minTemperature, maxTemperature;
    int? minWhite, maxWhite;

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is! LightingDeviceView || device.lightChannels.isEmpty) continue;

      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );

      // Skip if channel wasn't found (fallback was used) to avoid incorrect state
      if (channel.id != target.channelId) continue;

      // Count on/off state
      if (channel.on) {
        onCount++;
      } else {
        offCount++;
      }

      // Only check property values for ON devices
      if (!channel.on) continue;

      // Brightness
      if (channel.hasBrightness) {
        final brightness = channel.brightness;
        minBrightness = minBrightness == null
            ? brightness
            : (brightness < minBrightness ? brightness : minBrightness);
        maxBrightness = maxBrightness == null
            ? brightness
            : (brightness > maxBrightness ? brightness : maxBrightness);
      }

      // Hue (color) - supports both HSV and RGB-only lights
      if (channel.hasColor) {
        final hue = _getChannelHue(channel);
        if (hue != null) {
          minHue = minHue == null ? hue : (hue < minHue ? hue : minHue);
          maxHue = maxHue == null ? hue : (hue > maxHue ? hue : maxHue);
        }
      }

      // Temperature
      if (channel.hasTemperature) {
        final tempProp = channel.temperatureProp;
        if (tempProp?.value is NumberValueType) {
          final temp = (tempProp!.value as NumberValueType).value.toDouble();
          minTemperature = minTemperature == null
              ? temp
              : (temp < minTemperature ? temp : minTemperature);
          maxTemperature = maxTemperature == null
              ? temp
              : (temp > maxTemperature ? temp : maxTemperature);
        }
      }

      // White
      if (channel.hasColorWhite) {
        final white = channel.colorWhite;
        minWhite = minWhite == null
            ? white
            : (white < minWhite ? white : minWhite);
        maxWhite = maxWhite == null
            ? white
            : (white > maxWhite ? white : maxWhite);
      }
    }

    // Determine mixed state for each capability
    final onStateMixed = onCount > 0 && offCount > 0;

    final brightnessMixed = minBrightness != null &&
        maxBrightness != null &&
        (maxBrightness - minBrightness) > LightingConstants.mixedThreshold;

    final hueMixed = minHue != null &&
        maxHue != null &&
        (maxHue - minHue) > LightingConstants.mixedThreshold;

    final temperatureMixed = minTemperature != null &&
        maxTemperature != null &&
        (maxTemperature - minTemperature) > LightingConstants.mixedThreshold * 10; // temp uses larger threshold

    final whiteMixed = minWhite != null &&
        maxWhite != null &&
        (maxWhite - minWhite) > LightingConstants.mixedThreshold;

    return RoleMixedState(
      onStateMixed: onStateMixed,
      brightnessMixed: brightnessMixed,
      hueMixed: hueMixed,
      temperatureMixed: temperatureMixed,
      whiteMixed: whiteMixed,
      onCount: onCount,
      offCount: offCount,
      minBrightness: minBrightness,
      maxBrightness: maxBrightness,
      minHue: minHue,
      maxHue: maxHue,
      minTemperature: minTemperature,
      maxTemperature: maxTemperature,
      minWhite: minWhite,
      maxWhite: maxWhite,
    );
  }

  /// Check if a device is out of sync with the role's target value
  /// Returns true if:
  /// - State is MIXED (settling timed out but devices didn't converge)
  /// - AND this device's actual value differs from the target
  ///
  /// Note: We only show out-of-sync during MIXED state, not during PENDING/SETTLING
  /// because during those states we're actively waiting for devices to respond.
  bool _isDeviceOutOfSync(LightChannelView channel) {
    // Check brightness - only if in MIXED state (not PENDING or SETTLING)
    if (_brightnessState.isMixed && _brightnessState.desiredValue != null) {
      if (channel.hasBrightness && channel.on) {
        final targetBrightness = _brightnessState.desiredValue!.round();
        if ((channel.brightness - targetBrightness).abs() > LightingConstants.brightnessTolerance) {
          return true;
        }
      }
    }

    // Check hue (color) - only if in MIXED state
    // Supports both HSV and RGB-only lights
    if (_hueState.isMixed && _hueState.desiredValue != null) {
      if (channel.hasColor && channel.on) {
        final channelHue = _getChannelHue(channel);
        if (channelHue != null) {
          final targetHue = _hueState.desiredValue!;
          if ((channelHue - targetHue).abs() > LightingConstants.hueTolerance) {
            return true;
          }
        }
      }
    }

    // Check temperature - only if in MIXED state
    if (_temperatureState.isMixed && _temperatureState.desiredValue != null) {
      if (channel.hasTemperature && channel.on) {
        final tempProp = channel.temperatureProp;
        if (tempProp?.value is NumberValueType) {
          final actualTemp = (tempProp!.value as NumberValueType).value.toDouble();
          final targetTemp = _temperatureState.desiredValue!;
          if ((actualTemp - targetTemp).abs() > LightingConstants.temperatureTolerance) {
            return true;
          }
        }
      }
    }

    // Check white - only if in MIXED state
    if (_whiteState.isMixed && _whiteState.desiredValue != null) {
      if (channel.hasColorWhite && channel.on) {
        final targetWhite = _whiteState.desiredValue!.round();
        if ((channel.colorWhite - targetWhite).abs() > LightingConstants.whiteTolerance) {
          return true;
        }
      }
    }

    return false;
  }

  void _onDevicesDataChanged() {
    // DevicesService notification means device property values were updated
    // Trigger UI rebuild to reflect the new values and check convergence
    if (mounted) {
      _updateAvailableModes();

      final targets = _spacesService
              ?.getLightTargetsForSpace(widget.roomId)
              .where((t) => (t.role ?? LightTargetRole.other) == widget.role)
              .toList() ??
          [];

      setState(() {
        // Check convergence during SETTLING state
        // If devices converge, state machine will transition to IDLE
        _checkConvergenceDuringSettling(
          _brightnessState,
          (s) => _brightnessState = s,
          targets,
          _allBrightnessMatch,
          LightingConstants.brightnessTolerance,
        );
        _checkConvergenceDuringSettling(
          _hueState,
          (s) => _hueState = s,
          targets,
          _allHueMatch,
          LightingConstants.hueTolerance,
        );
        _checkConvergenceDuringSettling(
          _temperatureState,
          (s) => _temperatureState = s,
          targets,
          _allTemperatureMatch,
          LightingConstants.temperatureTolerance,
        );
        _checkConvergenceDuringSettling(
          _whiteState,
          (s) => _whiteState = s,
          targets,
          _allWhiteMatch,
          LightingConstants.whiteTolerance,
        );

        // Update cache if devices are now synced
        _updateCacheIfSynced(targets);
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
          title: getLightRoleName(context, widget.role),
          icon: getLightRoleIcon(widget.role),
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

        // Check if ON property is locked by intent to get overlay value for instant feedback
        bool isOn = channel.on;
        if (_intentOverlayService != null) {
          final onProp = channel.onProp;
          if (_intentOverlayService!.isPropertyLocked(
                target.deviceId,
                target.channelId,
                onProp.id,
              )) {
            final overlayValue = _intentOverlayService!.getOverlayValue(
              target.deviceId,
              target.channelId,
              onProp.id,
            );
            if (overlayValue is bool) {
              isOn = overlayValue;
            }
          }
        }

        if (isOn) {
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
    // Use pending state as fallback for optimistic UI (in case overlay lookup has timing issues)
    final anyOn = _pendingOnState ?? (onCount > 0);
    final hasBrightness = _availableModes.contains(_LightRoleMode.brightness);

    return Scaffold(
      appBar: AppTopBar(
        title: getLightRoleName(context, widget.role),
        icon: getLightRoleIcon(widget.role),
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
              // Left side - info and channels list
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
                          child: _buildChannelsList(context, targets, devicesService),
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

    // Get comprehensive mixed state for the role
    final roleMixedState = _getRoleMixedState(targets);

    // For simple on/off lights, show ON/OFF text (but check for mixed on/off state)
    if (!hasBrightness) {
      // Check if on/off states are mixed (some on, some off) and user hasn't interacted
      // Only show mixed icon when state is IDLE - during PENDING/SETTLING/MIXED, show user's desired state
      final isOnOffLocked = _onOffState.isLocked;
      final showInitialMixedSimple = !isOnOffLocked && roleMixedState.onStateMixed;

      // When locked, show the user's desired state; otherwise show actual state
      final displayAnyOn = isOnOffLocked
          ? (_onOffState.desiredValue != null && _onOffState.desiredValue! > 0.5)
          : anyOn;

      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showInitialMixedSimple)
            // Show sync-off icon when devices are initially out of sync
            Icon(
              MdiIcons.syncOff,
              size: _screenService.scale(
                60,
                density: _visualDensityService.density,
              ),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            )
          else
            Text(
              displayAnyOn ? localizations.light_state_on : localizations.light_state_off,
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
            showInitialMixedSimple
                ? localizations.light_role_not_synced_description
                : (displayAnyOn
                    ? localizations.light_state_on_description
                    : localizations.light_role_off_description),
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
    // 1. If state is IDLE and devices are mixed, show sync-off icon
    // 2. If state is PENDING/SETTLING/MIXED (user has interacted), show user's desired value
    // 3. If state is IDLE and devices are synced, show actual brightness

    final isLocked = _brightnessState.isLocked;
    final isOnOffLocked = _onOffState.isLocked;

    // Determine the display value
    final displayBrightness = isLocked
        ? (_brightnessState.desiredValue?.round() ?? avgBrightness)
        : avgBrightness;

    // Check if devices are mixed (on/off OR brightness)
    // But suppress on/off mixed state if on/off is currently settling
    final onStateMixedForDisplay = !isOnOffLocked && roleMixedState.onStateMixed;
    final devicesMixed = onStateMixedForDisplay || roleMixedState.brightnessMixed;

    // Show sync-off icon when:
    // - User hasn't interacted yet (IDLE state) AND devices have different values
    final showInitialMixed = !isLocked && devicesMixed;

    // For brightness-capable lights, show brightness percentage or sync-off icon
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showInitialMixed)
          // Show sync-off icon when devices are initially out of sync
          Icon(
            MdiIcons.syncOff,
            size: _screenService.scale(
              60,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.regular
                : AppTextColorDark.regular,
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
            ],
          ),
        Text(
          showInitialMixed
              ? localizations.light_role_not_synced_description
              : (anyOn
                  ? localizations.light_state_brightness_description
                  : localizations.light_role_off_description),
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
    // Get mixed state to determine what value to show
    final roleMixedState = _getRoleMixedState(targets);

    // Check if any property is locked by an intent to get overlay value
    double? overlayBrightness;

    for (final target in targets) {
      if (!target.hasBrightness) continue;
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        final brightnessProp = channel.brightnessProp;
        if (brightnessProp != null) {
          if (_intentOverlayService?.isPropertyLocked(
                target.deviceId,
                target.channelId,
                brightnessProp.id,
              ) == true) {
            // Get overlay value from intent
            final overlay = _intentOverlayService?.getOverlayValue(
              target.deviceId,
              target.channelId,
              brightnessProp.id,
            );
            if (overlay is num) {
              overlayBrightness = overlay.toDouble();
              break; // Use first locked property's overlay value
            }
          }
        }
      }
    }

    // Get first device's brightness for fallback (handles off lights with null brightness from HA)
    double? firstDeviceBrightness;
    for (final target in targets) {
      if (!target.hasBrightness) continue;
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasBrightness) {
          firstDeviceBrightness = channel.brightness.toDouble();
          break;
        }
      }
    }

    // Get cached brightness if available
    final cachedBrightness = _roleControlStateRepository?.get(_cacheKey)?.brightness;

    // Check if any light is on
    final anyLightOn = roleMixedState.anyOn;

    // Check on/off mixed state (but suppress if on/off is settling)
    final effectiveOnStateMixed = !_onOffState.isLocked && roleMixedState.onStateMixed;

    // Determine displayed value (priority: overlay > locked state > mixed/cached > actual)
    final double displayValue;
    if (overlayBrightness != null) {
      // Intent overlay value takes highest priority
      displayValue = overlayBrightness;
    } else if (_brightnessState.isLocked) {
      // User has interacted - show their intended value
      displayValue = _brightnessState.desiredValue ?? currentBrightness.toDouble();
    } else if (roleMixedState.brightnessMixed || effectiveOnStateMixed) {
      // Devices are mixed due to external change - show cached or first device's value
      displayValue = cachedBrightness ?? firstDeviceBrightness ?? currentBrightness.toDouble();
    } else if (!anyLightOn) {
      // All lights are off - prefer cached value, then first device's brightness
      // This prevents slider jumping to 0 when HA returns null brightness for off lights
      displayValue = cachedBrightness ?? firstDeviceBrightness ?? currentBrightness.toDouble();
    } else {
      // Devices are synced and on - show first device's value (same as all others when synced)
      displayValue = firstDeviceBrightness ?? currentBrightness.toDouble();
    }

    return ColoredSlider(
      value: displayValue,
      min: 0,
      max: 100,
      enabled: true, // Always enabled - don't disable during intent to prevent blinking
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
        // Save to cache for UI stability
        _saveToCache(brightness: value);
        // Debounce the API call to prevent overwhelming the backend
        _brightnessDebounceTimer?.cancel();
        _brightnessDebounceTimer = Timer(
          const Duration(milliseconds: 300),
          () {
            if (!mounted) return;
            _setBrightnessForAll(context, targets, value.round(), devicesService);
          },
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
    // Get mixed state to determine what value to show
    final roleMixedState = _getRoleMixedState(targets);

    // Check if any property is locked by an intent to get overlay value
    double? overlayHue;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );

        // Check HSV hue property first
        final hueProp = channel.hueProp;
        if (hueProp != null) {
          if (_intentOverlayService?.isPropertyLocked(
                target.deviceId,
                target.channelId,
                hueProp.id,
              ) == true) {
            // Get overlay value from intent
            final overlay = _intentOverlayService?.getOverlayValue(
              target.deviceId,
              target.channelId,
              hueProp.id,
            );
            if (overlay is num) {
              overlayHue = overlay.toDouble();
              break; // Use first locked property's overlay value
            }
          }
        }

        // For RGB-only lights, check if RGB properties are locked
        if (hueProp == null && channel.hasColorRed) {
          final redProp = channel.colorRedProp;
          final greenProp = channel.colorGreenProp;
          final blueProp = channel.colorBlueProp;

          if (redProp != null &&
              _intentOverlayService?.isPropertyLocked(
                    target.deviceId,
                    target.channelId,
                    redProp.id,
                  ) == true) {
            // Get RGB overlay values and convert to hue
            final overlayR = _intentOverlayService?.getOverlayValue(
              target.deviceId,
              target.channelId,
              redProp.id,
            );
            final overlayG = greenProp != null
                ? _intentOverlayService?.getOverlayValue(
                    target.deviceId,
                    target.channelId,
                    greenProp.id,
                  )
                : null;
            final overlayB = blueProp != null
                ? _intentOverlayService?.getOverlayValue(
                    target.deviceId,
                    target.channelId,
                    blueProp.id,
                  )
                : null;

            if (overlayR is num && overlayG is num && overlayB is num) {
              final color = ColorUtils.fromRGB(
                overlayR.toInt(),
                overlayG.toInt(),
                overlayB.toInt(),
              );
              overlayHue = ColorUtils.toHSV(color).hue;
              break; // Use first locked property's overlay value
            }
          }
        }
      }
    }

    // Calculate average hue and get first device's hue
    // Supports both HSV (hasHue) and RGB-only lights (convert RGB to HSV)
    double totalHue = 0;
    int hueCount = 0;
    double? firstDeviceHue;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasColor) {
          // Get hue value - either directly from HSV or convert from RGB
          final hueValue = _getChannelHue(channel);
          if (hueValue != null) {
            firstDeviceHue ??= hueValue;
            if (channel.on) {
              totalHue += hueValue;
              hueCount++;
            }
          }
        }
      }
    }

    final avgHue = hueCount > 0 ? totalHue / hueCount : 180.0;

    // Get cached hue if available
    final cachedHue = _roleControlStateRepository?.get(_cacheKey)?.hue;

    // Check if any light is on
    final anyLightOn = roleMixedState.anyOn;

    // Check on/off mixed state (but suppress if on/off is settling)
    final effectiveOnStateMixed = !_onOffState.isLocked && roleMixedState.onStateMixed;

    // Determine displayed value (priority: overlay > locked state > mixed/cached > actual)
    final double displayValue;
    if (overlayHue != null) {
      // Intent overlay value takes highest priority
      displayValue = overlayHue;
    } else if (_hueState.isLocked) {
      displayValue = _hueState.desiredValue ?? avgHue;
    } else if (roleMixedState.hueMixed || effectiveOnStateMixed) {
      // Devices are mixed due to external change - show cached or first device's value
      displayValue = cachedHue ?? firstDeviceHue ?? avgHue;
    } else if (!anyLightOn) {
      // All lights are off - prefer cached value, then first device's hue
      displayValue = cachedHue ?? firstDeviceHue ?? avgHue;
    } else {
      // Devices are synced and on - show first device's value (same as all others when synced)
      displayValue = firstDeviceHue ?? avgHue;
    }

    return ColoredSlider(
      value: displayValue,
      min: 0.0,
      max: 360.0,
      enabled: true, // Always enabled - don't disable during intent to prevent blinking
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
        // Save to cache for UI stability
        _saveToCache(hue: value);
        // Debounce the API call
        _hueDebounceTimer?.cancel();
        _hueDebounceTimer = Timer(
          const Duration(milliseconds: 300),
          () {
            if (!mounted) return;
            _setHueForAll(context, targets, value, devicesService);
          },
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
    // Get mixed state to determine what value to show
    final roleMixedState = _getRoleMixedState(targets);

    // Check if any property is locked by an intent to get overlay value
    double? overlayTemperature;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        final tempProp = channel.temperatureProp;
        if (tempProp != null) {
          if (_intentOverlayService?.isPropertyLocked(
                target.deviceId,
                target.channelId,
                tempProp.id,
              ) == true) {
            // Get overlay value from intent
            final overlay = _intentOverlayService?.getOverlayValue(
              target.deviceId,
              target.channelId,
              tempProp.id,
            );
            if (overlay is num) {
              overlayTemperature = overlay.toDouble();
              break; // Use first locked property's overlay value
            }
          }
        }
      }
    }

    // Calculate average temperature and get first device's temperature
    double totalTemp = 0;
    int tempCount = 0;
    double? firstDeviceTemp;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasTemperature) {
          final tempProp = channel.temperatureProp;
          if (tempProp != null && tempProp.value is NumberValueType) {
            final tempValue = (tempProp.value as NumberValueType).value.toDouble();
            firstDeviceTemp ??= tempValue;
            if (channel.on) {
              totalTemp += tempValue;
              tempCount++;
            }
          }
        }
      }
    }

    final avgTemp = tempCount > 0 ? totalTemp / tempCount : 4000.0;

    // Get cached temperature if available
    final cachedTemp = _roleControlStateRepository?.get(_cacheKey)?.temperature;

    // Check if any light is on
    final anyLightOn = roleMixedState.anyOn;

    // Check on/off mixed state (but suppress if on/off is settling)
    final effectiveOnStateMixed = !_onOffState.isLocked && roleMixedState.onStateMixed;

    // Determine displayed value (priority: overlay > locked state > mixed/cached > actual)
    final double displayValue;
    if (overlayTemperature != null) {
      // Intent overlay value takes highest priority
      displayValue = overlayTemperature;
    } else if (_temperatureState.isLocked) {
      displayValue = _temperatureState.desiredValue ?? avgTemp;
    } else if (roleMixedState.temperatureMixed || effectiveOnStateMixed) {
      // Devices are mixed due to external change - show cached or first device's value
      displayValue = cachedTemp ?? firstDeviceTemp ?? avgTemp;
    } else if (!anyLightOn) {
      // All lights are off - prefer cached value, then first device's temperature
      displayValue = cachedTemp ?? firstDeviceTemp ?? avgTemp;
    } else {
      // Devices are synced and on - show first device's value (same as all others when synced)
      displayValue = firstDeviceTemp ?? avgTemp;
    }

    return ColoredSlider(
      value: displayValue,
      min: 2700,
      max: 6500,
      enabled: true, // Always enabled - don't disable during intent to prevent blinking
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
        // Save to cache for UI stability
        _saveToCache(temperature: value);
        // Debounce the API call
        _temperatureDebounceTimer?.cancel();
        _temperatureDebounceTimer = Timer(
          const Duration(milliseconds: 300),
          () {
            if (!mounted) return;
            _setTemperatureForAll(context, targets, value, devicesService);
          },
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
    // Get mixed state to determine what value to show
    final roleMixedState = _getRoleMixedState(targets);

    // Check if any property is locked by an intent to get overlay value
    double? overlayWhite;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        final whiteProp = channel.colorWhiteProp;
        if (whiteProp != null) {
          if (_intentOverlayService?.isPropertyLocked(
                target.deviceId,
                target.channelId,
                whiteProp.id,
              ) == true) {
            // Get overlay value from intent
            final overlay = _intentOverlayService?.getOverlayValue(
              target.deviceId,
              target.channelId,
              whiteProp.id,
            );
            if (overlay is num) {
              overlayWhite = overlay.toDouble();
              break; // Use first locked property's overlay value
            }
          }
        }
      }
    }

    // Calculate average white value and get first device's white
    double totalWhite = 0;
    int whiteCount = 0;
    double? firstDeviceWhite;

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.hasColorWhite) {
          firstDeviceWhite ??= channel.colorWhite.toDouble();
          if (channel.on) {
            totalWhite += channel.colorWhite.toDouble();
            whiteCount++;
          }
        }
      }
    }

    final avgWhite = whiteCount > 0 ? totalWhite / whiteCount : 128.0;

    // Get cached white if available
    final cachedWhite = _roleControlStateRepository?.get(_cacheKey)?.white;

    // Check if any light is on
    final anyLightOn = roleMixedState.anyOn;

    // Check on/off mixed state (but suppress if on/off is settling)
    final effectiveOnStateMixed = !_onOffState.isLocked && roleMixedState.onStateMixed;

    // Determine displayed value (priority: overlay > locked state > mixed/cached > actual)
    final double displayValue;
    if (overlayWhite != null) {
      // Intent overlay value takes highest priority
      displayValue = overlayWhite;
    } else if (_whiteState.isLocked) {
      displayValue = _whiteState.desiredValue ?? avgWhite;
    } else if (roleMixedState.whiteMixed || effectiveOnStateMixed) {
      // Devices are mixed due to external change - show cached or first device's value
      displayValue = cachedWhite ?? firstDeviceWhite ?? avgWhite;
    } else if (!anyLightOn) {
      // All lights are off - prefer cached value, then first device's white
      displayValue = cachedWhite ?? firstDeviceWhite ?? avgWhite;
    } else {
      // Devices are synced and on - show first device's value (same as all others when synced)
      displayValue = firstDeviceWhite ?? avgWhite;
    }

    return ColoredSlider(
      value: displayValue,
      min: 0,
      max: 255,
      enabled: true, // Always enabled - don't disable during intent to prevent blinking
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
        // Save to cache for UI stability
        _saveToCache(white: value);
        // Debounce the API call
        _whiteDebounceTimer?.cancel();
        _whiteDebounceTimer = Timer(
          const Duration(milliseconds: 300),
          () {
            if (!mounted) return;
            _setWhiteForAll(context, targets, value.round(), devicesService);
          },
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

  /// Build channels list for the role
  ///
  /// Each target represents a lighting channel (not a device). A device can have
  /// multiple lighting channels that appear in different roles.
  Widget _buildChannelsList(
    BuildContext context,
    List<LightTargetView> targets,
    DevicesService devicesService,
  ) {
    // Get room name for stripping from names
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

      // Skip if channel wasn't found (fallback was used) to avoid property/channel mismatch
      if (channel != null && channel.id != target.channelId) {
        return null;
      }

      // Use channel name - each target represents a lighting channel
      final displayName = stripRoomNameFromDevice(target.channelName, roomName);

      // Check if device is out of sync with role's target value
      final isOutOfSync = channel != null ? _isDeviceOutOfSync(channel) : false;

      // Check if this device's property is locked by an intent (based on current mode)
      bool isPropertyLocked = false;
      if (channel != null && _intentOverlayService != null) {
        switch (_currentMode) {
          case _LightRoleMode.brightness:
            final brightnessProp = channel.brightnessProp;
            if (brightnessProp != null) {
              isPropertyLocked = _intentOverlayService!.isPropertyLocked(
                target.deviceId,
                target.channelId,
                brightnessProp.id,
              );
            }
            break;
          case _LightRoleMode.color:
            final hueProp = channel.hueProp;
            if (hueProp != null) {
              isPropertyLocked = _intentOverlayService!.isPropertyLocked(
                target.deviceId,
                target.channelId,
                hueProp.id,
              );
            } else if (channel.colorRedProp != null) {
              // Check RGB properties if HSV not available
              isPropertyLocked = _intentOverlayService!.isPropertyLocked(
                target.deviceId,
                target.channelId,
                channel.colorRedProp!.id,
              );
            }
            break;
          case _LightRoleMode.temperature:
            final tempProp = channel.temperatureProp;
            if (tempProp != null) {
              isPropertyLocked = _intentOverlayService!.isPropertyLocked(
                target.deviceId,
                target.channelId,
                tempProp.id,
              );
            }
            break;
          case _LightRoleMode.white:
            final whiteProp = channel.colorWhiteProp;
            if (whiteProp != null) {
              isPropertyLocked = _intentOverlayService!.isPropertyLocked(
                target.deviceId,
                target.channelId,
                whiteProp.id,
              );
            }
            break;
          case _LightRoleMode.off:
            // No property to check for off mode
            break;
        }
      }

      return Material(
        elevation: 0,
        color: Colors.transparent,
        child: ListTile(
          minTileHeight: _screenService.scale(
            25,
            density: _visualDensityService.density,
          ),
          leading: SizedBox(
            width: AppFontSize.large,
            height: AppFontSize.large,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Icon(
                  // Show alert icon when device is offline
                  !device.isOnline
                      ? MdiIcons.alert
                      : (isOutOfSync
                          ? MdiIcons.syncOff
                          : (channel?.on == true ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline)),
                  size: AppFontSize.large,
                  color: !device.isOnline
                      ? AppColorsLight.warning
                      : (isOutOfSync
                          ? AppColorsLight.warning
                          : (channel?.on == true
                              ? (channel!.hasColor
                                  ? (_getChannelColorSafe(channel) ?? Theme.of(context).primaryColor)
                                  : Theme.of(context).primaryColor)
                              : null)),
                ),
                if (isPropertyLocked)
                  CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.regular.withValues(alpha: 0.6)
                        : AppTextColorDark.regular.withValues(alpha: 0.6),
                  ),
              ],
            ),
          ),
          title: Text(
            displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall * 0.8,
              fontWeight: FontWeight.w600,
            ),
          ),
          trailing: channel?.hasBrightness == true
              ? Text(
                  '${channel!.brightness}%',
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    color: isOutOfSync ? AppColorsLight.warning : null,
                  ),
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

      // Build list of properties to update
      final List<PropertyCommandItem> properties = [];

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          // Skip if channel wasn't found (fallback was used) to avoid property/channel mismatch
          if (channel.id != target.channelId) {
            if (kDebugMode) {
              debugPrint(
                '[LIGHTS DOMAIN] Channel fallback used for device ${target.deviceId}: '
                'expected channel ${target.channelId}, using ${channel.id}',
              );
            }
            continue;
          }

          final onProp = channel.onProp;
          properties.add(PropertyCommandItem(
            deviceId: target.deviceId,
            channelId: target.channelId,
            propertyId: onProp.id,
            value: newState,
          ));
        }
      }

      if (properties.isEmpty) return;

      // Cancel any existing timers
      _pendingOnStateClearTimer?.cancel();
      _pendingOnStateClearTimer = null;
      _onOffState.cancelTimer();

      // Set pending state and state machine FIRST for optimistic UI
      // Use state machine to suppress mixed icon during settling
      setState(() {
        _pendingOnState = newState;
        _onOffState = RoleControlState(
          state: RoleUIState.pending,
          desiredValue: newState ? 1.0 : 0.0,
        );
      });

      // Get display ID from display repository
      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      // Build context
      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: widget.roomId,
        roleKey: widget.role.name,
      );

      // Create local optimistic overlays for intent tracking
      // These trigger rebuilds via _onIntentDataChanged, but pending state is already set
      for (final property in properties) {
        _intentOverlayService?.createLocalOverlay(
          deviceId: property.deviceId,
          channelId: property.channelId,
          propertyId: property.propertyId,
          value: property.value,
          ttlMs: 5000, // 5 second TTL - should be replaced by real intent before this expires
        );
      }

      // Send single batch command for all properties
      final success = await devicesService.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        if (kDebugMode) {
          debugPrint(
            '[LIGHTS DOMAIN] Failed to toggle lights for role ${widget.role.name} '
            'in room ${widget.roomId}: ${properties.length} properties',
          );
        }
        AlertBar.showError(
          this.context,
          message: localizations?.action_failed ?? 'Failed to toggle lights',
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (kDebugMode) {
        debugPrint(
          '[LIGHTS DOMAIN] Exception while toggling lights for role ${widget.role.name}: $e',
        );
      }
      AlertBar.showError(
        this.context,
        message: localizations?.action_failed ?? 'Failed to toggle lights',
      );
    } finally {
      // Transition to SETTLING state - this suppresses the mixed icon while devices sync
      // After settling window (3 seconds), check if devices are synced or still mixed
      if (mounted) {
        _onOffState.cancelTimer();

        final settlingTimer = Timer(const Duration(seconds: 3), () {
          if (!mounted) {
            _pendingOnState = null;
            _onOffState = const RoleControlState();
            return;
          }

          if (kDebugMode) {
            debugPrint('[LIGHTS DOMAIN DETAIL] On/off settling timer fired');
          }

          // Check if all devices are now synced (all on or all off)
          final spacesService = _spacesService;
          final devicesService = _devicesService;
          if (spacesService == null || devicesService == null) {
            setState(() {
              _pendingOnState = null;
              _onOffState = const RoleControlState();
            });
            return;
          }

          final targets = spacesService
              .getLightTargetsForSpace(widget.roomId)
              .where((t) => t.role == widget.role)
              .toList();

          final roleMixedState = _getRoleMixedState(targets);

          setState(() {
            _pendingOnState = null;
            if (roleMixedState.onStateMixed) {
              // Devices still not synced - transition to MIXED state
              _onOffState = RoleControlState(
                state: RoleUIState.mixed,
                desiredValue: _onOffState.desiredValue,
              );
            } else {
              // Devices synced - transition to IDLE
              _onOffState = const RoleControlState();
            }
          });
        });

        setState(() {
          _onOffState = RoleControlState(
            state: RoleUIState.settling,
            desiredValue: _onOffState.desiredValue,
            settlingTimer: settlingTimer,
            settlingStartedAt: DateTime.now(),
          );
        });
      } else {
        _pendingOnState = null;
        _onOffState = const RoleControlState();
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

    try {
      // Build list of properties to update
      final List<PropertyCommandItem> properties = [];

      for (final target in targets) {
        if (!target.hasBrightness) continue;

        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView &&
            device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          // Skip if channel wasn't found (fallback was used) to avoid property/channel mismatch
          if (channel.id != target.channelId) {
            if (kDebugMode) {
              debugPrint(
                '[LIGHTS DOMAIN] Channel fallback used for device ${target.deviceId}: '
                'expected channel ${target.channelId}, using ${channel.id}',
              );
            }
            continue;
          }

          final brightnessProp = channel.brightnessProp;
          if (brightnessProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: brightnessProp.id,
              value: brightness,
            ));
          }
        }
      }

      if (properties.isEmpty) return;

      // Get display ID from display repository
      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      // Build context
      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: widget.roomId,
        roleKey: widget.role.name,
      );

      // Send single batch command for all properties
      final success = await devicesService.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        if (kDebugMode) {
          debugPrint(
            '[LIGHTS DOMAIN] Failed to set brightness for role ${widget.role.name} '
            'in room ${widget.roomId}: ${properties.length} properties, value=$brightness',
          );
        }
        AlertBar.showError(
          this.context,
          message:
              localizations?.action_failed ?? 'Failed to set brightness',
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (kDebugMode) {
        debugPrint(
          '[LIGHTS DOMAIN] Exception while setting brightness for role ${widget.role.name}: $e',
        );
      }
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
      // Convert hue to Color (using full saturation and brightness)
      // We use full saturation (100%) and brightness (100%) to get the pure color
      final color = ColorUtils.fromHSV(hue, 100.0, 100.0);
      final rgbValue = ColorUtils.toRGB(color);
      final hsvValue = ColorUtils.toHSV(color);

      // Build list of properties to update
      final List<PropertyCommandItem> properties = [];

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          // Skip if channel wasn't found (fallback was used) to avoid property/channel mismatch
          if (channel.id != target.channelId) {
            if (kDebugMode) {
              debugPrint(
                '[LIGHTS DOMAIN] Channel fallback used for device ${target.deviceId}: '
                'expected channel ${target.channelId}, using ${channel.id}',
              );
            }
            continue;
          }

          // Set RGB properties if available
          if (channel.colorRedProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: channel.colorRedProp!.id,
              value: rgbValue.red,
            ));
          }

          if (channel.colorGreenProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: channel.colorGreenProp!.id,
              value: rgbValue.green,
            ));
          }

          if (channel.colorBlueProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: channel.colorBlueProp!.id,
              value: rgbValue.blue,
            ));
          }

          // Set HSV properties if available
          if (channel.hueProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: channel.hueProp!.id,
              value: hsvValue.hue,
            ));
          }

          if (channel.saturationProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: channel.saturationProp!.id,
              value: hsvValue.saturation,
            ));
          }
        }
      }

      if (properties.isEmpty) return;

      // Get display ID from display repository
      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      // Build context
      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: widget.roomId,
        roleKey: widget.role.name,
      );

      // Send single batch command for all properties
      final success = await devicesService.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        if (kDebugMode) {
          debugPrint(
            '[LIGHTS DOMAIN] Failed to set color for role ${widget.role.name} '
            'in room ${widget.roomId}: ${properties.length} properties, hue=$hue',
          );
        }
        AlertBar.showError(
          this.context,
          message: localizations?.action_failed ?? 'Failed to set color',
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (kDebugMode) {
        debugPrint(
          '[LIGHTS DOMAIN] Exception while setting color for role ${widget.role.name}: $e',
        );
      }
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
      // Build list of properties to update
      final List<PropertyCommandItem> properties = [];

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          // Skip if channel wasn't found (fallback was used) to avoid property/channel mismatch
          if (channel.id != target.channelId) {
            if (kDebugMode) {
              debugPrint(
                '[LIGHTS DOMAIN] Channel fallback used for device ${target.deviceId}: '
                'expected channel ${target.channelId}, using ${channel.id}',
              );
            }
            continue;
          }

          final tempProp = channel.temperatureProp;
          if (tempProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: tempProp.id,
              value: temperature.round(),
            ));
          }
        }
      }

      if (properties.isEmpty) return;

      // Get display ID from display repository
      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      // Build context
      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: widget.roomId,
        roleKey: widget.role.name,
      );

      // Send single batch command for all properties
      final success = await devicesService.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        if (kDebugMode) {
          debugPrint(
            '[LIGHTS DOMAIN] Failed to set temperature for role ${widget.role.name} '
            'in room ${widget.roomId}: ${properties.length} properties, value=$temperature',
          );
        }
        AlertBar.showError(
          this.context,
          message: localizations?.action_failed ?? 'Failed to set temperature',
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (kDebugMode) {
        debugPrint(
          '[LIGHTS DOMAIN] Exception while setting temperature for role ${widget.role.name}: $e',
        );
      }
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
      // Build list of properties to update
      final List<PropertyCommandItem> properties = [];

      for (final target in targets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView && device.lightChannels.isNotEmpty) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );

          // Skip if channel wasn't found (fallback was used) to avoid property/channel mismatch
          if (channel.id != target.channelId) {
            if (kDebugMode) {
              debugPrint(
                '[LIGHTS DOMAIN] Channel fallback used for device ${target.deviceId}: '
                'expected channel ${target.channelId}, using ${channel.id}',
              );
            }
            continue;
          }

          final whiteProp = channel.colorWhiteProp;
          if (whiteProp != null) {
            properties.add(PropertyCommandItem(
              deviceId: target.deviceId,
              channelId: target.channelId,
              propertyId: whiteProp.id,
              value: white,
            ));
          }
        }
      }

      if (properties.isEmpty) return;

      // Get display ID from display repository
      final displayRepository = locator<DisplayRepository>();
      final displayId = displayRepository.display?.id;

      // Build context
      final commandContext = PropertyCommandContext(
        origin: 'panel.system.room',
        displayId: displayId,
        spaceId: widget.roomId,
        roleKey: widget.role.name,
      );

      // Send single batch command for all properties
      final success = await devicesService.setMultiplePropertyValues(
        properties: properties,
        context: commandContext,
      );

      if (!mounted) return;

      if (!success) {
        if (kDebugMode) {
          debugPrint(
            '[LIGHTS DOMAIN] Failed to set white level for role ${widget.role.name} '
            'in room ${widget.roomId}: ${properties.length} properties, value=$white',
          );
        }
        AlertBar.showError(
          this.context,
          message: localizations?.action_failed ?? 'Failed to set white level',
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (kDebugMode) {
        debugPrint(
          '[LIGHTS DOMAIN] Exception while setting white level for role ${widget.role.name}: $e',
        );
      }
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

  /// Get hue value from a light channel
  /// Supports both HSV (hasHue) and RGB-only lights (converts RGB to HSV)
  /// Returns null if the channel doesn't have valid color properties
  double? _getChannelHue(LightChannelView channel) {
    // First try direct hue property (HSV lights)
    if (channel.hasHue) {
      return channel.hue;
    }
    // For RGB-only lights, convert color to HSV to get hue
    final color = _getChannelColorSafe(channel);
    if (color != null) {
      final hsv = ColorUtils.toHSV(color);
      return hsv.hue;
    }
    return null;
  }
}
