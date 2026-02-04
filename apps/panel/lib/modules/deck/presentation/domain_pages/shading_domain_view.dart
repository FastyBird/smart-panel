import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/color.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/intent_mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
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

// ============================================================================
// DATA MODELS
// ============================================================================

/// Represents aggregated data for a group of covers with the same role.
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

// ============================================================================
// SHADING DOMAIN VIEW PAGE
// ============================================================================

/// Shading domain view page - shows window covering devices in a room.
///
/// Connects to [SpacesService] for covers targets and state, and [DevicesService]
/// for individual device data. Displays covers grouped by role with position
/// sliders, quick actions, presets, and device tiles.
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

  /// Get covers state from backend (cached)
  CoversStateModel? get _coversState => _spacesService?.getCoversState(_roomId);

  /// Get covers targets for the current room
  List<CoversTargetView> get _coversTargets =>
      _spacesService?.getCoversTargetsForSpace(_roomId) ?? [];

  /// Get position for a specific role (pending or actual)
  int _getRolePosition(_CoverRoleData roleData) {
    // Check for pending position first
    if (_pendingPositions.containsKey(roleData.role)) {
      return _pendingPositions[roleData.role]!;
    }
    // Return actual average position from devices
    return roleData.averagePosition;
  }

  /// Convert CoversTargetRole to CoversStateRole for backend calls
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

  /// Navigate to the home page in the deck
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

    // Build role and device data from actual sources
    final roleDataList = _buildRoleDataList(targets);
    final deviceDataList = _buildDeviceDataList(targets);
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
                      ? _buildLandscapeLayout(context, roleDataList, deviceDataList)
                      : _buildPortraitLayout(context, roleDataList, deviceDataList);
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

  Widget _buildHeader(BuildContext context, int totalDevices) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final position = _coversState?.averagePosition ?? 0;

    // Determine state color based on position
    final stateColor = _getPositionColor(position, !isDark);
    final stateThemeColor = _getPositionThemeColor(position);

    // Build subtitle
    String subtitle;
    if (position == 100) {
      subtitle = '${localizations.shading_state_open} \u2022 $totalDevices';
    } else if (position == 0) {
      subtitle = '${localizations.shading_state_closed} \u2022 $totalDevices';
    } else {
      subtitle = '$position% \u2022 $totalDevices';
    }

    return PageHeader(
      title: localizations.domain_shading,
      subtitle: subtitle,
      subtitleColor: position > 0 ? stateColor : null,
      leading: HeaderMainIcon(
        icon: position > 0 ? MdiIcons.blindsHorizontal : MdiIcons.blindsHorizontalClosed,
        color: stateThemeColor,
      ),
      trailing: HeaderIconButton(
        icon: MdiIcons.homeOutline,
        onTap: _navigateToHome,
      ),
    );
  }

  // ===========================================================================
  // DATA BUILDING
  // ===========================================================================

  /// Build role data list from covers targets
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

  /// Build device data list from covers targets
  ///
  /// Each target represents a channel. If a device has multiple window covering
  /// channels, each becomes a separate tile with the channel name. If a device
  /// has only one channel, the device name is used instead.
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

  // ===========================================================================
  // LANDSCAPE LAYOUT
  // ===========================================================================

  Widget _buildLandscapeLayout(
    BuildContext context,
    List<_CoverRoleData> roleDataList,
    List<_CoverDeviceData> deviceDataList,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final primaryRole = roleDataList.isNotEmpty ? roleDataList.first : null;
    final secondaryRoles = roleDataList.length > 1 ? roleDataList.skip(1).toList() : [];
    final hasDevices = deviceDataList.isNotEmpty;

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
      modeSelector: _buildLandscapeModeSelector(context, localizations),
      additionalContent: hasDevices
          ? _buildLandscapeDevicesColumn(context, deviceDataList, localizations)
          : null,
    );
  }

  Widget _buildLandscapeDevicesColumn(
    BuildContext context,
    List<_CoverDeviceData> deviceDataList,
    AppLocalizations localizations,
  ) {
    // Build list of device tile widgets using DeviceTileLandscape wrapper
    final deviceWidgets = deviceDataList.map((device) {
      return DeviceTileLandscape(
        icon: _getDeviceTileIcon(device),
        name: device.name,
        status: _getDeviceStatus(device, localizations),
        isActive: device.isActive,
        isOffline: !device.isOnline,
        onTileTap: () => _openDeviceDetail(context, device),
      );
    }).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      children: [
        SectionTitle(
          title: localizations.shading_devices_title,
          icon: MdiIcons.viewGrid,
        ),
        for (final widget in deviceWidgets) ...[
          widget,
        ],
      ],
    );
  }

  // ===========================================================================
  // PORTRAIT LAYOUT
  // ===========================================================================

  Widget _buildPortraitLayout(
    BuildContext context,
    List<_CoverRoleData> roleDataList,
    List<_CoverDeviceData> deviceDataList,
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

          // Devices Section
          if (deviceDataList.isNotEmpty) ...[
            AppSpacings.spacingLgVertical,
            SectionTitle(
              title: localizations.shading_devices_title,
              icon: MdiIcons.viewGrid,
            ),
            AppSpacings.spacingMdVertical,
            _buildDevicesGrid(
              context,
              deviceDataList,
              localizations,
              crossAxisCount: 2,
            ),
          ],
        ],
      ),
      modeSelector: hasCovers ? _buildModeSelector(context, localizations) : null,
    );
  }

  // ===========================================================================
  // ROLE CARDS
  // ===========================================================================

  Widget _buildRoleCard(
    BuildContext context, {
    required _CoverRoleData roleData,
    bool showSlider = false,
    bool showActions = false,
  }) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final position = _getRolePosition(roleData);
    final Color stateColor = _getPositionColor(position, isLight);
    final Color stateColorLight = getSemanticBackgroundColor(context, stateColor);
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
                  color: stateColorLight,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Icon(
                  roleData.icon,
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
                          ? AppColorsLight.primary
                          : AppColorsDark.primary,
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

  /// Build the expand/collapse toggle for secondary role cards
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
    final bool isLight = Theme.of(context).brightness == Brightness.light;
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

  // ===========================================================================
  // INTENT METHODS
  // ===========================================================================

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

  // ===========================================================================
  // MODE SELECTOR
  // ===========================================================================

  /// Build the mode selector widget for portrait/horizontal layout.
  Widget _buildModeSelector(BuildContext context, AppLocalizations localizations) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (activeValue, matchedValue, lastIntentValue) = _getCoversModeSelectorValues();

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: isDark ? AppFillColorDark.light : AppBorderColorLight.light,
          width: 1,
        ),
      ),
      child: IntentModeSelector<CoversMode>(
        modes: _getCoversModeOptions(localizations),
        activeValue: activeValue,
        matchedValue: matchedValue,
        lastIntentValue: lastIntentValue,
        onChanged: _setCoversMode,
        orientation: ModeSelectorOrientation.horizontal,
        iconPlacement: ModeSelectorIconPlacement.top,
      ),
    );
  }

  /// Build vertical mode selector for landscape layout
  Widget _buildLandscapeModeSelector(BuildContext context, AppLocalizations localizations) {
    final (activeValue, matchedValue, lastIntentValue) = _getCoversModeSelectorValues();

    return IntentModeSelector<CoversMode>(
      modes: _getCoversModeOptions(localizations),
      activeValue: activeValue,
      matchedValue: matchedValue,
      lastIntentValue: lastIntentValue,
      onChanged: _setCoversMode,
      orientation: ModeSelectorOrientation.vertical,
      iconPlacement: ModeSelectorIconPlacement.top,
    );
  }

  /// Resolves activeValue, matchedValue, lastIntentValue for the mode selector UI.
  (CoversMode? activeValue, CoversMode? matchedValue, CoversMode? lastIntentValue)
      _getCoversModeSelectorValues() {
    final detectedMode = _coversState?.detectedMode;
    final lastAppliedMode = _coversState?.lastAppliedMode;
    final isModeFromIntent = _coversState?.isModeFromIntent ?? false;

    if (detectedMode != null && isModeFromIntent) {
      return (detectedMode, null, null);
    }
    if (detectedMode != null && !isModeFromIntent) {
      return (null, detectedMode, null);
    }
    if (lastAppliedMode != null) {
      return (null, null, lastAppliedMode);
    }
    return (null, null, null);
  }

  /// Get mode options for the mode selector
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

  // ===========================================================================
  // DEVICES
  // ===========================================================================

  /// Builds a grid of device tiles that fill the available width.
  /// Uses DeviceTilePortrait wrapper for portrait mode.
  Widget _buildDevicesGrid(
    BuildContext context,
    List<_CoverDeviceData> deviceDataList,
    AppLocalizations localizations, {
    int crossAxisCount = 2,
  }) {
    // Build device tiles using DeviceTilePortrait wrapper
    final items = deviceDataList.map((device) {
      return DeviceTilePortrait(
        icon: _getDeviceTileIcon(device),
        name: device.name,
        status: _getDeviceStatus(device, localizations),
        isActive: device.isActive,
        isOffline: !device.isOnline,
        onTileTap: () => _openDeviceDetail(context, device),
      );
    }).toList();

    // Build rows of tiles
    final List<Widget> rows = [];
    for (var i = 0; i < items.length; i += crossAxisCount) {
      final rowItems = <Widget>[];
      for (var j = 0; j < crossAxisCount; j++) {
        final index = i + j;
        if (index < items.length) {
          rowItems.add(Expanded(child: items[index]));
        } else {
          rowItems.add(const Expanded(child: SizedBox()));
        }
        if (j < crossAxisCount - 1) {
          rowItems.add(SizedBox(width: AppSpacings.pMd));
        }
      }
      if (rows.isNotEmpty) {
        rows.add(SizedBox(height: AppSpacings.pMd));
      }
      rows.add(Row(children: rowItems));
    }

    return Column(children: rows);
  }

  /// Icon for device tile based on position (open vs closed).
  IconData _getDeviceTileIcon(_CoverDeviceData device) {
    return device.position > 0
        ? MdiIcons.blindsHorizontal
        : MdiIcons.blindsHorizontalClosed;
  }

  /// Get localized status text for a device
  String _getDeviceStatus(_CoverDeviceData device, AppLocalizations localizations) {
    if (!device.isOnline) return localizations.device_status_offline;
    if (device.position == 100) return localizations.shading_state_open;
    if (device.position == 0) return localizations.shading_state_closed;
    return '${device.position}%';
  }

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================

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

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  ThemeColors _getPositionThemeColor(int position) {
    if (position == 100) return ThemeColors.success;
    if (position == 0) return ThemeColors.info;
    return ThemeColors.warning;
  }

  Color _getPositionColor(int position, bool isLight) {
    if (position == 100) {
      return isLight ? AppColorsLight.success : AppColorsDark.success;
    }
    if (position == 0) {
      return isLight ? AppColorsLight.info : AppColorsDark.info;
    }
    return isLight ? AppColorsLight.warning : AppColorsDark.warning;
  }

  String _getPositionText(int position, AppLocalizations localizations) {
    if (position == 100) return localizations.shading_state_open;
    if (position == 0) return localizations.shading_state_closed;
    return localizations.shading_state_partial(position);
  }

  // ===========================================================================
  // EMPTY STATE
  // ===========================================================================

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
