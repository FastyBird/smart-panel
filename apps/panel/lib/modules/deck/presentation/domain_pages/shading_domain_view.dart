import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/covers_state/covers_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/covers_targets/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
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

  String get statusText {
    if (!isOnline) return 'Offline';
    if (position == 100) return 'Open';
    if (position == 0) return 'Closed';
    return '$position% open';
  }
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
    final stateBgColor = stateColor.withValues(alpha: 0.15);

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
      backgroundColor: AppColors.blank,
      leading: HeaderDeviceIcon(
        icon: position > 0 ? MdiIcons.blindsHorizontal : MdiIcons.blindsHorizontalClosed,
        backgroundColor: stateBgColor,
        iconColor: stateColor,
      ),
      trailing: HeaderHomeButton(
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
  List<_CoverDeviceData> _buildDeviceDataList(List<CoversTargetView> targets) {
    final List<_CoverDeviceData> devices = [];
    final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is! WindowCoveringDeviceView) continue;

      // Strip room name from device name if present
      String name = target.displayName;
      if (roomName.isNotEmpty && name.toLowerCase().startsWith(roomName.toLowerCase())) {
        name = name.substring(roomName.length).trim();
        // Remove leading separator if present
        if (name.startsWith('-') || name.startsWith(':')) {
          name = name.substring(1).trim();
        }
      }
      if (name.isEmpty) name = target.displayName;

      devices.add(_CoverDeviceData(
        deviceId: target.deviceId,
        channelId: target.channelId,
        name: name,
        typeName: _getCoverTypeName(target.coverType),
        typeIcon: _getCoverTypeIcon(target.coverType),
        position: device.isWindowCoveringPercentage,
        isOnline: device.isOnline,
      ));
    }

    return devices;
  }

  String _getRoleName(CoversTargetRole role) {
    final localizations = AppLocalizations.of(context);
    switch (role) {
      case CoversTargetRole.primary:
        return localizations?.covers_role_primary ?? 'Primary';
      case CoversTargetRole.blackout:
        return localizations?.covers_role_blackout ?? 'Blackout';
      case CoversTargetRole.sheer:
        return localizations?.covers_role_sheer ?? 'Sheer';
      case CoversTargetRole.outdoor:
        return localizations?.covers_role_outdoor ?? 'Outdoor';
      case CoversTargetRole.hidden:
        return localizations?.covers_role_hidden ?? 'Hidden';
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
    final localizations = AppLocalizations.of(context);
    switch (coverType) {
      case 'curtain':
        return localizations?.cover_type_curtain ?? 'Curtain';
      case 'blind':
        return localizations?.cover_type_blind ?? 'Blind';
      case 'roller':
        return localizations?.cover_type_roller ?? 'Roller';
      case 'outdoorBlind':
        return localizations?.cover_type_outdoor_blind ?? 'Outdoor Blind';
      default:
        return localizations?.cover_type_cover ?? 'Cover';
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final primaryRole = roleDataList.isNotEmpty ? roleDataList.first : null;
    final secondaryRoles = roleDataList.length > 1 ? roleDataList.skip(1).toList() : [];
    final hasDevices = deviceDataList.isNotEmpty;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: Main Control
        Expanded(
          flex: 2,
          child: Padding(
            padding: EdgeInsets.all(AppSpacings.pLg),
            child: Column(
              children: [
                // Primary Role Card (with slider and actions)
                if (primaryRole != null)
                  Expanded(
                    child: _buildRoleCard(
                      context,
                      roleData: primaryRole,
                      showSlider: true,
                      showActions: true,
                    ),
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
        ),

        // Middle column: Vertical Mode Selector
        Container(
          padding: EdgeInsets.symmetric(
            vertical: AppSpacings.pLg,
            horizontal: AppSpacings.pMd,
          ),
          child: Center(
            child: _buildLandscapeModeSelector(context, localizations),
          ),
        ),

        // Right column: Devices
        if (hasDevices)
          Expanded(
            flex: 1,
            child: Container(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
              child: Padding(
                padding: EdgeInsets.all(AppSpacings.pLg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle(context, localizations.shading_devices_title, MdiIcons.viewGrid),
                    AppSpacings.spacingMdVertical,
                    Expanded(
                      child: ListView.separated(
                        itemCount: deviceDataList.length,
                        separatorBuilder: (_, __) => AppSpacings.spacingMdVertical,
                        itemBuilder: (context, index) {
                          final device = deviceDataList[index];
                          final isActive = device.isOnline && device.position > 0;
                          final status = _getDeviceStatus(device, localizations);

                          return UniversalTile(
                            layout: TileLayout.horizontal,
                            icon: device.position > 0
                                ? MdiIcons.blindsHorizontal
                                : MdiIcons.blindsHorizontalClosed,
                            name: device.name,
                            status: status,
                            isActive: isActive,
                            isOffline: !device.isOnline,
                            showWarningBadge: true,
                            showInactiveBorder: true,
                            onTileTap: () => _openDeviceDetail(context, device),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final primaryRole = roleDataList.isNotEmpty ? roleDataList.first : null;
    final secondaryRoles = roleDataList.length > 1 ? roleDataList.skip(1).toList() : [];
    final hasCovers = roleDataList.isNotEmpty;

    // Devices layout: same as climate auxiliary - 2 cols, aspect ratio based on screen size
    final isAtLeastMedium = _screenService.isAtLeastMedium;
    final devicesAspectRatio = isAtLeastMedium ? 3.0 : 2.5;

    return Column(
      children: [
        // Scrollable content
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacings.paddingLg,
            child: Column(
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
                  _buildSectionTitle(context, localizations.shading_devices_title, MdiIcons.viewGrid),
                  AppSpacings.spacingMdVertical,
                  _buildDevicesGrid(
                    context,
                    deviceDataList,
                    localizations,
                    crossAxisCount: 2,
                    aspectRatio: devicesAspectRatio,
                  ),
                ],
              ],
            ),
          ),
        ),
        // Sticky Mode Selector at bottom
        if (hasCovers)
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: isDark ? AppBgColorDark.page : AppBgColorLight.page,
              border: Border(
                top: BorderSide(
                  color: isDark ? AppBorderColorDark.light : AppBorderColorLight.base,
                  width: 1,
                ),
              ),
            ),
            padding: EdgeInsets.only(
              left: AppSpacings.pLg,
              right: AppSpacings.pLg,
              top: AppSpacings.pMd,
              bottom: AppSpacings.pLg,
            ),
            child: _buildModeSelector(context, localizations),
          ),
      ],
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
    final Color stateColorLight = stateColor.withValues(alpha: 0.15);
    final localizations = AppLocalizations.of(context)!;

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
          // Slider
          if (showSlider) ...[
            AppSpacings.spacingMdVertical,
            _buildPositionSlider(context, roleData),
          ],
          // Quick Actions
          if (showActions) ...[
            AppSpacings.spacingMdVertical,
            _buildQuickActions(context, roleData),
          ],
        ],
      ),
    );
  }

  Widget _buildPositionSlider(BuildContext context, _CoverRoleData roleData) {
    final bool isLight = Theme.of(context).brightness == Brightness.light;
    final position = _getRolePosition(roleData);

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
        value: position.toDouble(),
        min: 0,
        max: 100,
        onChanged: (value) {
          // Optimistic UI update for this role
          setState(() => _pendingPositions[roleData.role] = value.round());
        },
        onChangeEnd: (value) {
          // Send actual intent when slider is released
          _setRolePosition(roleData.role, value.round());
        },
      ),
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
        final localizations = AppLocalizations.of(context);
        AlertBar.showError(context, message: localizations?.action_failed ?? 'Failed');
        _pendingPositions.remove(role);
        setState(() {});
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to set role position: $e');
      }
      if (mounted) {
        final localizations = AppLocalizations.of(context);
        AlertBar.showError(context, message: localizations?.action_failed ?? 'Failed');
        _pendingPositions.remove(role);
        setState(() {});
      }
    }
  }

  /// Stop all covers in the space (currently no backend support, placeholder)
  Future<void> _stopCovers() async {
    // Note: Stop intent may not be supported in the backend yet
    // For now, this is a placeholder that shows current behavior
    if (kDebugMode) {
      debugPrint('[ShadingDomainView] Stop covers - not yet implemented in backend');
    }
  }

  /// Get current covers mode from backend state
  CoversMode? get _currentMode => _coversState?.lastAppliedMode;

  /// Set covers mode via backend intent
  Future<void> _setCoversMode(CoversMode mode) async {
    try {
      final result = await _spacesService?.setCoversMode(_roomId, mode);

      if (result == null || result.failedDevices > 0) {
        if (mounted) {
          final localizations = AppLocalizations.of(context);
          AlertBar.showError(
            context,
            message: localizations?.action_failed ?? 'Failed',
          );
        }
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[ShadingDomainView] Failed to set covers mode: $e');
      }
      if (mounted) {
        final localizations = AppLocalizations.of(context);
        AlertBar.showError(
          context,
          message: localizations?.action_failed ?? 'Failed',
        );
      }
    }
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
  // MODE SELECTOR
  // ===========================================================================

  /// Build the mode selector widget for portrait/horizontal layout.
  Widget _buildModeSelector(BuildContext context, AppLocalizations localizations) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mode = _currentMode;
    final modeColor = _getModeColor(context, mode);

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: mode != null
              ? modeColor.withValues(alpha: 0.3)
              : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light),
          width: 1,
        ),
      ),
      child: ModeSelector<CoversMode>(
        modes: _getCoversModeOptions(localizations),
        selectedValue: mode,
        onChanged: _setCoversMode,
        orientation: ModeSelectorOrientation.horizontal,
        iconPlacement: ModeSelectorIconPlacement.top,
      ),
    );
  }

  /// Build vertical mode selector for landscape layout
  Widget _buildLandscapeModeSelector(BuildContext context, AppLocalizations localizations) {
    final mode = _currentMode;

    return ModeSelector<CoversMode>(
      modes: _getCoversModeOptions(localizations),
      selectedValue: mode,
      onChanged: _setCoversMode,
      orientation: ModeSelectorOrientation.vertical,
      iconPlacement: ModeSelectorIconPlacement.top,
    );
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
        color: ModeSelectorColor.primary,
      ),
      ModeOption(
        value: CoversMode.daylight,
        icon: MdiIcons.weatherSunny,
        label: localizations.covers_mode_daylight,
        color: ModeSelectorColor.warning,
      ),
      ModeOption(
        value: CoversMode.privacy,
        icon: MdiIcons.eyeOff,
        label: localizations.covers_mode_privacy,
        color: ModeSelectorColor.info,
      ),
      ModeOption(
        value: CoversMode.closed,
        icon: MdiIcons.blindsHorizontalClosed,
        label: localizations.covers_mode_closed,
        color: ModeSelectorColor.neutral,
      ),
    ];
  }

  /// Get color for covers mode
  Color _getModeColor(BuildContext context, CoversMode? mode) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (mode) {
      case CoversMode.open:
        return isDark ? AppColorsDark.primary : AppColorsLight.primary;
      case CoversMode.daylight:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case CoversMode.privacy:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case CoversMode.closed:
      case null:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    }
  }

  // ===========================================================================
  // DEVICES
  // ===========================================================================

  /// Builds a grid of device tiles that fill the available width.
  Widget _buildDevicesGrid(
    BuildContext context,
    List<_CoverDeviceData> deviceDataList,
    AppLocalizations localizations, {
    int crossAxisCount = 2,
    double? aspectRatio,
  }) {
    // Use horizontal layout for single column or wide aspect ratio
    final useHorizontalLayout =
        crossAxisCount == 1 || (aspectRatio != null && aspectRatio > 1.5);
    final tileLayout =
        useHorizontalLayout ? TileLayout.horizontal : TileLayout.vertical;

    final items = _buildDeviceItems(context, deviceDataList, localizations, tileLayout);

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: aspectRatio ?? 1.0,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) => items[index],
    );
  }

  /// Builds list of device tile widgets
  List<Widget> _buildDeviceItems(
    BuildContext context,
    List<_CoverDeviceData> deviceDataList,
    AppLocalizations localizations,
    TileLayout layout,
  ) {
    return deviceDataList.map((device) {
      final isActive = device.isOnline && device.position > 0;
      final status = _getDeviceStatus(device, localizations);

      return UniversalTile(
        layout: layout,
        icon: device.position > 0
            ? MdiIcons.blindsHorizontal
            : MdiIcons.blindsHorizontalClosed,
        name: device.name,
        status: status,
        isActive: isActive,
        isOffline: !device.isOnline,
        showWarningBadge: true,
        onTileTap: () => _openDeviceDetail(context, device),
      );
    }).toList();
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
  // COMMON WIDGETS
  // ===========================================================================

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
              backgroundColor: AppColors.blank,
              leading: HeaderDeviceIcon(
                icon: MdiIcons.blindsHorizontalClosed,
                backgroundColor: isLight ? AppFillColorLight.light : AppFillColorDark.light,
                iconColor: secondaryColor,
              ),
              trailing: HeaderHomeButton(
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
