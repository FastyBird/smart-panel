/// Shading domain view: room-level control for window coverings in a single space.
///
/// **Purpose:** One screen per room showing covers grouped by role (primary,
/// blackout, sheer, outdoor). Each role card shows position %, slider, and
/// quick actions (open / stop / close). Mode selector (open, daylight, privacy,
/// closed) and a devices bottom sheet are available from the header.
///
/// **Data flow:**
/// - [SpacesService] provides covers targets and [CoversStateModel] for the room.
/// - [DevicesService] provides [WindowCoveringDeviceView] / [WindowCoveringChannelView]
///   used to build [_CoverRoleData], [_CoverDeviceData], and to open device detail.
/// - Optimistic UI: [_pendingPositions] holds per-role position until backend
///   converges (cleared in [_onDataChanged] when within 5% of actual).
///
/// **Key concepts:**
/// - [_CoverRoleData] = one role’s targets and average position; [_CoverDeviceData]
///   = one device/channel row for the devices sheet.
/// - Primary role card always shows slider and actions; secondary roles are
///   expandable via [_expandedRoles].
/// - Portrait: role cards + horizontal mode selector. Landscape: same content
///   in [LandscapeViewLayout] with vertical mode selector.
///
/// **File structure (for humans and AI):**
/// Search for the exact section header (e.g. "// DATA MODELS", "// LIFECYCLE")
/// to jump to that part of the file. Sections appear in this order:
///
/// - **DATA MODELS** — [_CoverRoleData], [_CoverDeviceData].
/// - **SHADING DOMAIN VIEW PAGE** — [ShadingDomainViewPage] and state class:
///   - LIFECYCLE: initState (services, listeners, fetch), dispose, [_onDataChanged].
///   - DATA BUILDING: [_buildRoleDataList], [_buildDeviceDataList], role/cover type helpers.
///   - INTENT METHODS: [_setRolePosition], [_stopCovers], [_setCoversMode], [_showActionFailed].
///   - HEADER: [_buildHeader].
///   - LANDSCAPE / PORTRAIT LAYOUT: [_buildLandscapeLayout], [_buildPortraitLayout].
///   - ROLE CARDS: [_buildRoleCard], slider, quick actions, expand toggle.
///   - MODE SELECTOR: [_buildModeSelector], [_buildLandscapeModeSelector], [_getCoversModeOptions].
///   - DEVICES BOTTOM SHEET: [_showShadingDevicesSheet], device tile builders.
///   - NAVIGATION: [_navigateToHome], [_openDeviceDetail].
///   - HELPERS: position theme/color/text, [_toStateRole], [_getRolePosition].
///   - EMPTY STATE: [_buildEmptyState].
import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_item_sheet.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/covers_state/covers_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/utils/intent_result_handler.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/covers_targets/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// =============================================================================
// DATA MODELS
// =============================================================================

// View models for the shading domain. [_CoverRoleData] groups targets by role;
// [_CoverDeviceData] is one device/channel row for the devices bottom sheet.

/// Aggregated data for a group of covers with the same role (primary, blackout, etc.).
class _CoverRoleData {
  final CoversTargetRole role;
  final String name;
  final IconData icon;
  final int deviceCount;
  final int averagePosition;
  final List<CoversTargetView> targets;

  const _CoverRoleData({
    required this.role,
    required this.name,
    required this.icon,
    required this.deviceCount,
    required this.averagePosition,
    required this.targets,
  });
}

/// Represents individual cover device data for UI display.
class _CoverDeviceData {
  final String deviceId;
  final String channelId;
  final String name;
  final String typeName;
  final IconData typeIcon;
  final int position;
  final bool isOnline;

  const _CoverDeviceData({
    required this.deviceId,
    required this.channelId,
    required this.name,
    required this.typeName,
    required this.typeIcon,
    required this.position,
    this.isOnline = true,
  });

  bool get isActive => isOnline && position > 0;
}

// =============================================================================
// SHADING DOMAIN VIEW PAGE
// =============================================================================
// Stateful page for one room's shading. State class: holds optional services,
// [_pendingPositions] for optimistic UI, [_expandedRoles] for secondary cards;
// listens to SpacesService and DevicesService.

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

  SpacesService? _spacesService;
  DevicesService? _devicesService;
  DeckService? _deckService;
  EventBus? _eventBus;
  bool _isLoading = true;

  // Optimistic UI state for slider interaction (per role)
  final Map<CoversTargetRole, int> _pendingPositions = {};

  // Track which secondary role cards have expanded controls
  final Set<CoversTargetRole> _expandedRoles = {};

  String get _roomId => widget.viewItem.roomId;

  /// Covers state from backend (cached).
  CoversStateModel? get _coversState => _spacesService?.getCoversState(_roomId);

  /// Covers targets for the current room.
  List<CoversTargetView> get _coversTargets =>
      _spacesService?.getCoversTargetsForSpace(_roomId) ?? [];

  /// Position for a role: pending value if set, otherwise actual average.
  int _getRolePosition(_CoverRoleData roleData) {
    // Check for pending position first
    if (_pendingPositions.containsKey(roleData.role)) {
      return _pendingPositions[roleData.role]!;
    }
    // Return actual average position from devices
    return roleData.averagePosition;
  }

  /// Maps [CoversTargetRole] to [CoversStateRole] for SpacesService API calls.
  CoversStateRole? _toStateRole(CoversTargetRole role) {
    switch (role) {
      case CoversTargetRole.primary:
        return CoversStateRole.primary;
      case CoversTargetRole.blackout:
        return CoversStateRole.blackout;
      case CoversTargetRole.sheer:
        return CoversStateRole.sheer;
      case CoversTargetRole.outdoor:
        return CoversStateRole.outdoor;
      case CoversTargetRole.hidden:
        return CoversStateRole.hidden;
    }
  }

  // --------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------
  // initState: resolve services, add listeners (Spaces, Devices), fetch covers
  // data. dispose: remove listeners.

  @override
  void initState() {
    super.initState();

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to get SpacesService: $e');
      }
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to get DevicesService: $e');
      }
    }

    try {
      _deckService = locator<DeckService>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to get DeckService: $e');
      }
    }

    try {
      _eventBus = locator<EventBus>();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to get EventBus: $e');
      }
    }

    // Fetch covers targets and state for this space
    _fetchCoversData();
  }

  Future<void> _fetchCoversData() async {
    try {
      // Check if data is already available (cached) before fetching
      final existingTargets = _coversTargets;
      final existingState = _coversState;

      // Only fetch if data is not already available
      if (existingTargets.isEmpty || existingState == null) {
        // Fetch covers targets and state in parallel
        await Future.wait([
          _spacesService?.fetchCoversTargetsForSpace(_roomId) ?? Future.value(),
          _spacesService?.fetchCoversState(_roomId) ?? Future.value(),
        ]);
      }
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

  /// Called when SpacesService or DevicesService notifies; clears converged
  /// pending positions and calls setState.
  void _onDataChanged() {
    if (!mounted) return;
    // Use addPostFrameCallback to avoid "setState during build" errors
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        // Clear pending positions when data converges (per role)
        if (_pendingPositions.isNotEmpty) {
          final targets = _coversTargets;
          final roleDataList = _buildRoleDataList(targets);

          final rolesToRemove = <CoversTargetRole>[];
          for (final entry in _pendingPositions.entries) {
            final roleData = roleDataList.where((r) => r.role == entry.key).firstOrNull;
            if (roleData != null) {
              // Consider converged if within 5% tolerance
              if ((roleData.averagePosition - entry.value).abs() <= 5) {
                rolesToRemove.add(entry.key);
              }
            }
          }
          for (final role in rolesToRemove) {
            _pendingPositions.remove(role);
          }
        }
        setState(() {});
      }
    });
  }

  /// Navigate to deck home item via [EventBus].
  void _navigateToHome() {
    final deck = _deckService?.deck;
    if (deck == null || deck.items.isEmpty) {
      Navigator.pop(context);
      return;
    }

    final homeIndex = deck.startIndex;
    if (homeIndex >= 0 && homeIndex < deck.items.length) {
      final homeItem = deck.items[homeIndex];
      _eventBus?.fire(NavigateToDeckItemEvent(homeItem.id));
    }
  }

  // --------------------------------------------------------------------------
  // BUILD
  // --------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final targets = _coversTargets;
    if (targets.isEmpty) {
      return _buildEmptyState(context);
    }

    // Build role data from actual sources
    final roleDataList = _buildRoleDataList(targets);
    final totalDevices = targets.length;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context, totalDevices),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  final isLandscape = orientation == Orientation.landscape;
                  return isLandscape
                      ? _buildLandscapeLayout(context, roleDataList)
                      : _buildPortraitLayout(context, roleDataList);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(BuildContext context, int totalDevices) {
    final localizations = AppLocalizations.of(context)!;
    final position = _coversState?.averagePosition ?? 0;
    final positionColorFamily = _getPositionColorFamily(context, position);

    // Build subtitle
    String subtitle;
    if (position == 100) {
      subtitle = '${localizations.shading_state_open} \u2022 $totalDevices';
    } else if (position == 0) {
      subtitle = '${localizations.shading_state_closed} \u2022 $totalDevices';
    } else {
      subtitle = '$position% \u2022 $totalDevices';
    }

    final showDevicesButton = totalDevices > 0;

    return PageHeader(
      title: localizations.domain_shading,
      subtitle: subtitle,
      subtitleColor: position > 0 ? positionColorFamily.base : null,
      leading: HeaderMainIcon(
        icon: position > 0 ? MdiIcons.blindsHorizontal : MdiIcons.blindsHorizontalClosed,
        color: _getPositionThemeColor(position),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showDevicesButton) ...[
            HeaderIconButton(
              icon: MdiIcons.windowShutterSettings,
              onTap: _showShadingDevicesSheet,
            ),
            AppSpacings.spacingMdHorizontal,
          ],
          HeaderIconButton(
            icon: MdiIcons.homeOutline,
            onTap: _navigateToHome,
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // DATA BUILDING
  // --------------------------------------------------------------------------
  // [_buildRoleDataList] groups targets by role and computes average position
  // from DevicesService. [_buildDeviceDataList] builds rows for the devices sheet.

  /// Builds role data list from covers targets (grouped by role, avg position from devices).
  List<_CoverRoleData> _buildRoleDataList(List<CoversTargetView> targets) {
    final Map<CoversTargetRole, List<CoversTargetView>> grouped = {};

    for (final target in targets) {
      final role = target.role ?? CoversTargetRole.primary;
      if (role == CoversTargetRole.hidden) continue;
      grouped.putIfAbsent(role, () => []).add(target);
    }

    final List<_CoverRoleData> roles = [];

    for (final role in CoversTargetRole.values) {
      if (role == CoversTargetRole.hidden) continue;
      final roleTargets = grouped[role] ?? [];
      if (roleTargets.isEmpty) continue;

      // Calculate average position from actual device data
      int totalPosition = 0;
      int deviceCount = 0;

      for (final target in roleTargets) {
        final device = _devicesService?.getDevice(target.deviceId);
        if (device is WindowCoveringDeviceView) {
          totalPosition += device.isWindowCoveringPercentage;
          deviceCount++;
        }
      }

      final avgPosition = deviceCount > 0 ? (totalPosition / deviceCount).round() : 0;

      roles.add(_CoverRoleData(
        role: role,
        name: _getRoleName(role),
        icon: _getRoleIcon(role),
        deviceCount: roleTargets.length,
        averagePosition: avgPosition,
        targets: roleTargets,
      ));
    }

    return roles;
  }

  /// Device/channel rows for the devices sheet; multi-channel devices use channel name.
  List<_CoverDeviceData> _buildDeviceDataList(List<CoversTargetView> targets) {
    final List<_CoverDeviceData> devices = [];
    final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';

    // Filter out hidden targets
    final visibleTargets = targets.where((t) => t.role != CoversTargetRole.hidden).toList();

    // Count channels per device to determine naming strategy
    final channelsPerDevice = <String, int>{};
    for (final target in visibleTargets) {
      channelsPerDevice[target.deviceId] = (channelsPerDevice[target.deviceId] ?? 0) + 1;
    }

    for (final target in visibleTargets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is! WindowCoveringDeviceView) continue;

      // Find the specific channel for this target
      final channel = device.channels
          .whereType<WindowCoveringChannelView>()
          .where((c) => c.id == target.channelId)
          .firstOrNull;
      if (channel == null) continue;

      // Use channel name if device has multiple channels, device name otherwise
      final hasMultipleChannels = (channelsPerDevice[target.deviceId] ?? 1) > 1;
      final rawName = hasMultipleChannels ? target.channelName : target.deviceName;
      final name = stripRoomNameFromDevice(rawName, roomName);

      devices.add(_CoverDeviceData(
        deviceId: target.deviceId,
        channelId: target.channelId,
        name: name,
        typeName: _getCoverTypeName(target.coverType),
        typeIcon: _getCoverTypeIcon(target.coverType),
        position: channel.position,
        isOnline: device.isOnline,
      ));
    }

    return devices;
  }

  /// Localized label for a covers role (primary, blackout, sheer, outdoor).
  String _getRoleName(CoversTargetRole role) {
    final localizations = AppLocalizations.of(context)!;
    switch (role) {
      case CoversTargetRole.primary:
        return localizations.covers_role_primary;
      case CoversTargetRole.blackout:
        return localizations.covers_role_blackout;
      case CoversTargetRole.sheer:
        return localizations.covers_role_sheer;
      case CoversTargetRole.outdoor:
        return localizations.covers_role_outdoor;
      case CoversTargetRole.hidden:
        return localizations.covers_role_hidden;
    }
  }

  /// Icon for a covers role.
  IconData _getRoleIcon(CoversTargetRole role) {
    switch (role) {
      case CoversTargetRole.primary:
        return MdiIcons.blindsHorizontal;
      case CoversTargetRole.blackout:
        return MdiIcons.blindsHorizontalClosed;
      case CoversTargetRole.sheer:
        return MdiIcons.curtains;
      case CoversTargetRole.outdoor:
        return MdiIcons.blindsVerticalClosed;
      case CoversTargetRole.hidden:
        return MdiIcons.eyeOff;
    }
  }

  /// Localized cover type name (curtain, blind, roller, etc.).
  String _getCoverTypeName(String? coverType) {
    final localizations = AppLocalizations.of(context)!;
    switch (coverType) {
      case 'curtain':
        return localizations.cover_type_curtain;
      case 'blind':
        return localizations.cover_type_blind;
      case 'roller':
        return localizations.cover_type_roller;
      case 'outdoorBlind':
        return localizations.cover_type_outdoor_blind;
      default:
        return localizations.cover_type_cover;
    }
  }

  /// Icon for cover type.
  IconData _getCoverTypeIcon(String? coverType) {
    switch (coverType) {
      case 'curtain':
        return MdiIcons.curtains;
      case 'blind':
        return MdiIcons.blindsHorizontal;
      case 'roller':
        return MdiIcons.rollerShade;
      case 'outdoorBlind':
        return MdiIcons.blindsVerticalClosed;
      default:
        return MdiIcons.blindsHorizontal;
    }
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(
    BuildContext context,
    List<_CoverRoleData> roleDataList,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final primaryRole = roleDataList.isNotEmpty ? roleDataList.first : null;
    final secondaryRoles = roleDataList.length > 1 ? roleDataList.skip(1).toList() : [];
    final isLargeScreen = _screenService.isLargeScreen;

    return LandscapeViewLayout(
      mainContent: SingleChildScrollView(
        child: Column(
          children: [
            // Primary Role Card (with slider and actions)
            if (primaryRole != null)
              _buildRoleCard(
                context,
                roleData: primaryRole,
                showSlider: true,
                showActions: true,
              ),
            // Secondary Role Cards
            for (final role in secondaryRoles) ...[
              AppSpacings.spacingMdVertical,
              _buildRoleCard(
                context,
                roleData: role,
              ),
            ],
          ],
        ),
      ),
      modeSelector: _buildLandscapeModeSelector(
        context,
        localizations,
        showLabels: isLargeScreen,
      ),
      modeSelectorShowLabels: isLargeScreen,
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(
    BuildContext context,
    List<_CoverRoleData> roleDataList,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final primaryRole = roleDataList.isNotEmpty ? roleDataList.first : null;
    final secondaryRoles = roleDataList.length > 1 ? roleDataList.skip(1).toList() : [];
    final hasCovers = roleDataList.isNotEmpty;

    return PortraitViewLayout(
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Primary Role Card (with slider and actions)
          if (primaryRole != null)
            _buildRoleCard(
              context,
              roleData: primaryRole,
              showSlider: true,
              showActions: true,
            ),
          // Secondary Role Cards
          for (final role in secondaryRoles) ...[
            AppSpacings.spacingMdVertical,
            _buildRoleCard(
              context,
              roleData: role,
            ),
          ],
        ],
      ),
      modeSelector: hasCovers ? _buildModeSelector(context, localizations) : null,
    );
  }

  // --------------------------------------------------------------------------
  // ROLE CARDS
  // --------------------------------------------------------------------------
  // Primary role: slider + quick actions always visible. Secondary: expandable.

  Widget _buildRoleCard(
    BuildContext context, {
    required _CoverRoleData roleData,
    bool showSlider = false,
    bool showActions = false,
  }) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final position = _getRolePosition(roleData);
    final positionColorFamily = _getPositionColorFamily(context, position);
    final localizations = AppLocalizations.of(context)!;

    // Determine if this card is expandable (secondary roles without forced controls)
    final bool isExpandable = !showSlider && !showActions;
    final bool isExpanded = _expandedRoles.contains(roleData.role);

    // Show controls if forced OR expanded
    final bool shouldShowControls = showSlider || showActions || isExpanded;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isLight ? AppFillColorLight.light : AppFillColorDark.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
                  color: positionColorFamily.light5,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Icon(
                  roleData.icon,
                  color: positionColorFamily.base,
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
                      roleData.name,
                      style: TextStyle(
                        fontSize: AppFontSize.large,
                        fontWeight: FontWeight.w600,
                        color: isLight
                            ? AppTextColorLight.regular
                            : AppTextColorDark.regular,
                      ),
                    ),
                    Text(
                      localizations.shading_devices_count(roleData.deviceCount),
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
                            ? AppTextColorLight.regular
                            : AppTextColorDark.regular,
                    ),
                  ),
                  Text(
                    _getPositionText(position, localizations),
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
          // Expandable Controls (Slider + Quick Actions)
          if (shouldShowControls) ...[
            AppSpacings.spacingMdVertical,
            _buildPositionSlider(context, roleData),
            AppSpacings.spacingMdVertical,
            _buildQuickActions(context, roleData),
          ],
          // Expand/Collapse Toggle for secondary roles
          if (isExpandable) ...[
            AppSpacings.spacingSmVertical,
            _buildExpandToggle(context, roleData, isExpanded, localizations),
          ],
        ],
      ),
    );
  }

  /// Expand/collapse toggle for secondary role cards (show/hide slider and actions).
  Widget _buildExpandToggle(
    BuildContext context,
    _CoverRoleData roleData,
    bool isExpanded,
    AppLocalizations localizations,
  ) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;

    return GestureDetector(
      onTap: () {
        setState(() {
          if (isExpanded) {
            _expandedRoles.remove(roleData.role);
          } else {
            _expandedRoles.add(roleData.role);
          }
        });
      },
      child: Container(
        padding: EdgeInsets.symmetric(vertical: AppSpacings.pXs),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              isExpanded
                  ? localizations.shading_hide_controls
                  : localizations.shading_tap_for_controls,
              style: TextStyle(
                fontSize: AppFontSize.small,
                color: isLight
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
            AppSpacings.spacingXsHorizontal,
            Icon(
              isExpanded ? MdiIcons.chevronUp : MdiIcons.chevronDown,
              size: _screenService.scale(
                16,
                density: _visualDensityService.density,
              ),
              color: isLight
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPositionSlider(BuildContext context, _CoverRoleData roleData) {
    final localizations = AppLocalizations.of(context)!;
    final position = _getRolePosition(roleData);
    final normalizedValue = position / 100.0;

    return SliderWithSteps(
      value: normalizedValue,
      themeColor: ThemeColors.primary,
      steps: [
        localizations.shading_state_closed,
        '25%',
        '50%',
        '75%',
        localizations.shading_state_open,
      ],
      onChanged: (value) {
        final newPosition = (value * 100).round();
        // Optimistic UI update for this role
        setState(() => _pendingPositions[roleData.role] = newPosition);
        // Send actual intent
        _setRolePosition(roleData.role, newPosition);
      },
    );
  }

  Widget _buildQuickActions(BuildContext context, _CoverRoleData roleData) {
    final localizations = AppLocalizations.of(context)!;
    final position = _getRolePosition(roleData);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Expanded(
          child: _buildQuickActionButton(
            context,
            label: localizations.shading_action_open,
            icon: MdiIcons.chevronUp,
            isActive: position == 100,
            onTap: () => _setRolePosition(roleData.role, 100),
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Expanded(
          child: _buildQuickActionButton(
            context,
            label: localizations.shading_action_stop,
            icon: MdiIcons.stop,
            isActive: false,
            onTap: _stopCovers,
          ),
        ),
        AppSpacings.spacingSmHorizontal,
        Expanded(
          child: _buildQuickActionButton(
            context,
            label: localizations.shading_action_close,
            icon: MdiIcons.chevronDown,
            isActive: position == 0,
            onTap: () => _setRolePosition(roleData.role, 0),
          ),
        ),
      ],
    );
  }

  /// Single quick action button (open/stop/close); themed by [isActive].
  Widget _buildQuickActionButton(
    BuildContext context, {
    required String label,
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final themeData = isActive
        ? ThemeData(filledButtonTheme: isDark ? AppFilledButtonsDarkThemes.primary : AppFilledButtonsLightThemes.primary)
        : (isDark ? ThemeData(filledButtonTheme: AppFilledButtonsDarkThemes.neutral) : ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.neutral));
    final iconSize = _screenService.scale(18, density: _visualDensityService.density);

    return SizedBox(
      width: double.infinity,
      child: Theme(
        data: themeData,
        child: FilledButton(
          onPressed: () {
            HapticFeedback.lightImpact();
            onTap();
          },
          style: FilledButton.styleFrom(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pSm,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: iconSize,
                color: isDark
                    ? (isActive
                        ? AppFilledButtonsDarkThemes.primaryForegroundColor
                        : AppFilledButtonsDarkThemes.neutralForegroundColor)
                    : (isActive
                        ? AppFilledButtonsLightThemes.primaryForegroundColor
                        : AppFilledButtonsLightThemes.neutralForegroundColor),
              ),
              AppSpacings.spacingXsHorizontal,
              Text(
                label,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // INTENT METHODS
  // --------------------------------------------------------------------------
  // [_setRolePosition], [_stopCovers], [_setCoversMode] call SpacesService;
  // [_showActionFailed] shows toast and optionally clears pending position.

  void _showActionFailed({CoversTargetRole? clearPendingRole}) {
    if (!mounted) return;
    final localizations = AppLocalizations.of(context)!;
    AppToast.showError(context, message: localizations.action_failed);
    if (clearPendingRole != null) {
      _pendingPositions.remove(clearPendingRole);
      setState(() {});
    }
  }

  /// Set position for covers with a specific role
  Future<void> _setRolePosition(CoversTargetRole role, int position) async {
    setState(() => _pendingPositions[role] = position);

    try {
      final stateRole = _toStateRole(role);
      if (stateRole == null) {
        if (kDebugMode) {
          debugPrint('[ShadingDomainView] Invalid role: $role');
        }
        return;
      }

      final result = await _spacesService?.setRolePosition(_roomId, stateRole, position);
      if (result == null && mounted) {
        _showActionFailed(clearPendingRole: role);
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to set role position: $e');
      }
      if (mounted) _showActionFailed(clearPendingRole: role);
    }
  }

  /// Stop all covers movement in the space
  Future<void> _stopCovers() async {
    try {
      final result = await _spacesService?.stopCovers(_roomId);
      if (result == null && mounted) _showActionFailed();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to stop covers: $e');
      }
      if (mounted) _showActionFailed();
    }
  }

  /// Set covers mode via backend intent
  Future<void> _setCoversMode(CoversMode mode) async {
    try {
      final result = await _spacesService?.setCoversMode(_roomId, mode);

      if (mounted) {
        IntentResultHandler.showOfflineAlertIfNeededForCovers(context, result);
      }

      if (result == null || result.failedDevices > 0) {
        if (mounted) _showActionFailed();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to set covers mode: $e');
      }
      if (mounted) _showActionFailed();
    }
  }

  // --------------------------------------------------------------------------
  // MODE SELECTOR
  // --------------------------------------------------------------------------

  /// Horizontal mode selector for portrait layout.
  Widget _buildModeSelector(BuildContext context, AppLocalizations localizations) {
    return ModeSelector<CoversMode>(
      modes: _getCoversModeOptions(localizations),
      selectedValue: _coversState?.detectedMode ?? _coversState?.lastAppliedMode,
      onChanged: _setCoversMode,
      orientation: ModeSelectorOrientation.horizontal,
      iconPlacement: ModeSelectorIconPlacement.top,
      showLabels: true,
    );
  }

  /// Vertical mode selector for landscape layout; [showLabels] from screen size.
  Widget _buildLandscapeModeSelector(
    BuildContext context,
    AppLocalizations localizations, {
    bool showLabels = false,
  }) {
    return ModeSelector<CoversMode>(
      modes: _getCoversModeOptions(localizations),
      selectedValue: _coversState?.detectedMode ?? _coversState?.lastAppliedMode,
      onChanged: _setCoversMode,
      orientation: ModeSelectorOrientation.vertical,
      iconPlacement: ModeSelectorIconPlacement.top,
      showLabels: showLabels,
    );
  }

  /// Mode options for [ModeSelector] (open, daylight, privacy, closed).
  List<ModeOption<CoversMode>> _getCoversModeOptions(
    AppLocalizations localizations,
  ) {
    return [
      ModeOption(
        value: CoversMode.open,
        icon: MdiIcons.blindsHorizontal,
        label: localizations.covers_mode_open,
        color: ThemeColors.primary,
      ),
      ModeOption(
        value: CoversMode.daylight,
        icon: MdiIcons.weatherSunny,
        label: localizations.covers_mode_daylight,
        color: ThemeColors.warning,
      ),
      ModeOption(
        value: CoversMode.privacy,
        icon: MdiIcons.eyeOff,
        label: localizations.covers_mode_privacy,
        color: ThemeColors.info,
      ),
      ModeOption(
        value: CoversMode.closed,
        icon: MdiIcons.blindsHorizontalClosed,
        label: localizations.covers_mode_closed,
        color: ThemeColors.neutral,
      ),
    ];
  }

  // --------------------------------------------------------------------------
  // DEVICES BOTTOM SHEET
  // --------------------------------------------------------------------------
  // [_showShadingDevicesSheet] opens [DeckItemSheet] with tiles; tap opens detail.

  /// Icon for device tile (open vs closed).
  IconData _getDeviceTileIcon(_CoverDeviceData device) {
    return device.position > 0
        ? MdiIcons.blindsHorizontal
        : MdiIcons.blindsHorizontalClosed;
  }

  /// Localized status text for a device (offline / open / closed / %).
  String _getDeviceStatus(_CoverDeviceData device, AppLocalizations localizations) {
    if (!device.isOnline) return localizations.device_status_offline;
    if (device.position == 100) return localizations.shading_state_open;
    if (device.position == 0) return localizations.shading_state_closed;
    return '${device.position}%';
  }

  void _showShadingDevicesSheet() {
    final targets = _coversTargets;
    final deviceDataList = _buildDeviceDataList(targets);
    if (deviceDataList.isEmpty) return;
    final localizations = AppLocalizations.of(context)!;

    DeckItemSheet.showItemSheet(
      context,
      title: localizations.shading_devices_title,
      icon: MdiIcons.windowShutterSettings,
      itemCount: deviceDataList.length,
      itemBuilder: (context, index) =>
          _buildShadingDeviceTileForSheet(context, deviceDataList[index]),
    );
  }

  Widget _buildShadingDeviceTileForSheet(
    BuildContext context,
    _CoverDeviceData device,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final deviceView = _devicesService?.getDevice(device.deviceId);
    final tileIcon = deviceView != null
        ? buildDeviceIcon(deviceView.category, deviceView.icon)
        : _getDeviceTileIcon(device);

    return HorizontalTileStretched(
      icon: tileIcon,
      name: device.name,
      status: _getDeviceStatus(device, localizations),
      isActive: device.isActive,
      isOffline: !device.isOnline,
      showWarningBadge: true,
      activeColor: device.isActive ? _getPositionThemeColor(device.position) : null,
      onTileTap: () {
        Navigator.of(context).pop();
        _openDeviceDetail(context, device);
      },
    );
  }

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------

  void _openDeviceDetail(BuildContext context, _CoverDeviceData device) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(
          device.deviceId,
          initialChannelId: device.channelId,
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // HELPERS (THEME & POSITION LABELS)
  // --------------------------------------------------------------------------
  // Use [_getPositionThemeColor] / [_getPositionColorFamily] for position-based
  // colors; [_getPositionText] for localized open/closed/partial.

  /// Theme color for position (success=open, info=closed, warning=partial).
  ThemeColors _getPositionThemeColor(int position) {
    if (position == 100) return ThemeColors.success;
    if (position == 0) return ThemeColors.info;
    return ThemeColors.warning;
  }

  /// Color family for position (header subtitle, role icons).
  ThemeColorFamily _getPositionColorFamily(BuildContext context, int position) =>
      ThemeColorFamily.get(Theme.of(context).brightness, _getPositionThemeColor(position));

  /// Localized position label (open / closed / partial).
  String _getPositionText(int position, AppLocalizations localizations) {
    if (position == 100) return localizations.shading_state_open;
    if (position == 0) return localizations.shading_state_closed;
    return localizations.shading_state_partial(position);
  }

  // --------------------------------------------------------------------------
  // EMPTY STATE
  // --------------------------------------------------------------------------

  Widget _buildEmptyState(BuildContext context) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final localizations = AppLocalizations.of(context)!;
    final secondaryColor = isLight ? AppTextColorLight.secondary : AppTextColorDark.secondary;

    return Scaffold(
      backgroundColor: isLight ? AppBgColorLight.page : AppBgColorDark.page,
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: localizations.domain_shading,
              subtitle: localizations.domain_shading_empty_title,
              leading: HeaderMainIcon(
                icon: MdiIcons.blindsHorizontalClosed,
                color: ThemeColors.neutral,
              ),
              trailing: HeaderIconButton(
                icon: MdiIcons.homeOutline,
                onTap: _navigateToHome,
              ),
            ),
            Expanded(
              child: Center(
                child: Padding(
                  padding: AppSpacings.paddingLg,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        MdiIcons.blindsHorizontalClosed,
                        color: secondaryColor,
                        size: _screenService.scale(
                          64,
                          density: _visualDensityService.density,
                        ),
                      ),
                      AppSpacings.spacingMdVertical,
                      Text(
                        localizations.domain_shading_empty_title,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: AppFontSize.extraLarge,
                          fontWeight: FontWeight.w600,
                          color: isLight
                              ? AppTextColorLight.primary
                              : AppTextColorDark.primary,
                        ),
                      ),
                      AppSpacings.spacingSmVertical,
                      Text(
                        localizations.domain_shading_empty_description,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: AppFontSize.base,
                          color: secondaryColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
