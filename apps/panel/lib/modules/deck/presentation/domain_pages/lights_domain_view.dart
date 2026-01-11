import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/deck/views/light_role_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/scenes/service.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/scenes/view.dart';
import 'package:fastybird_smart_panel/modules/spaces/service.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

// ============================================================================
// DATA MODELS
// ============================================================================

class LightingRoleData {
  final LightTargetRole role;
  final String name;
  final IconData icon;
  final int onCount;
  final int totalCount;
  final int? brightness;
  final List<LightTargetView> targets;

  const LightingRoleData({
    required this.role,
    required this.name,
    required this.icon,
    required this.onCount,
    required this.totalCount,
    required this.targets,
    this.brightness,
  });

  bool get hasLightsOn => onCount > 0;

  String get statusText {
    if (onCount == 0) {
      return '$onCount/$totalCount';
    }
    if (brightness != null) {
      return '$onCount/$totalCount \u2022 $brightness%';
    }
    return '$onCount/$totalCount';
  }
}

enum LightState { off, on, offline }

class LightDeviceData {
  final String deviceId;
  final String channelId;
  final String name;
  final LightState state;
  final int? brightness;

  const LightDeviceData({
    required this.deviceId,
    required this.channelId,
    required this.name,
    this.state = LightState.off,
    this.brightness,
  });

  bool get isOn => state == LightState.on;
  bool get isOffline => state == LightState.offline;

  String get statusText {
    switch (state) {
      case LightState.off:
        return 'Off';
      case LightState.on:
        return brightness != null ? '$brightness%' : 'On';
      case LightState.offline:
        return 'Offline';
    }
  }
}

// ============================================================================
// LIGHTS DOMAIN VIEW PAGE
// ============================================================================

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
  ScenesService? _scenesService;
  DeckService? _deckService;
  EventBus? _eventBus;
  bool _isLoading = true;

  String get _roomId => widget.viewItem.roomId;

  @override
  void initState() {
    super.initState();

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightsDomainView] Failed to get SpacesService: $e');
    }

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightsDomainView] Failed to get DevicesService: $e');
    }

    try {
      _scenesService = locator<ScenesService>();
      _scenesService?.addListener(_onDataChanged);
    } catch (e) {
      if (kDebugMode) debugPrint('[LightsDomainView] Failed to get ScenesService: $e');
    }

    try {
      _deckService = locator<DeckService>();
    } catch (e) {
      if (kDebugMode) debugPrint('[LightsDomainView] Failed to get DeckService: $e');
    }

    try {
      _eventBus = locator<EventBus>();
    } catch (e) {
      if (kDebugMode) debugPrint('[LightsDomainView] Failed to get EventBus: $e');
    }

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
    _scenesService?.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (mounted) setState(() {});
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

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
    return Consumer<DevicesService>(
      builder: (context, devicesService, _) {
        if (_isLoading) {
          return Scaffold(
            backgroundColor: Theme.of(context).brightness == Brightness.dark
                ? AppBgColorDark.page
                : AppBgColorLight.page,
            body: const Center(child: CircularProgressIndicator()),
          );
        }

        final lightTargets = _spacesService?.getLightTargetsForSpace(_roomId) ?? [];
        final localizations = AppLocalizations.of(context)!;

        if (lightTargets.isEmpty) {
          return _buildEmptyState(context);
        }

        // Build role data and other lights
        final roleDataList = _buildRoleDataList(lightTargets, devicesService, localizations);
        final definedRoles = roleDataList
            .where((r) =>
                r.role != LightTargetRole.other &&
                r.role != LightTargetRole.hidden)
            .toList();
        final otherRole = roleDataList.firstWhere(
          (r) => r.role == LightTargetRole.other,
          orElse: () => LightingRoleData(
            role: LightTargetRole.other,
            name: localizations.light_role_other,
            icon: MdiIcons.lightbulbOutline,
            onCount: 0,
            totalCount: 0,
            targets: [],
          ),
        );
        final otherLights = _buildOtherLights(otherRole.targets, devicesService);

        // Calculate totals
        final totalLights = lightTargets.length;
        final lightsOn = _countLightsOn(lightTargets, devicesService);
        final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';

        return Scaffold(
          backgroundColor: Theme.of(context).brightness == Brightness.dark
              ? AppBgColorDark.page
              : AppBgColorLight.page,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(context, roomName, lightsOn, totalLights),
                Expanded(
                  child: OrientationBuilder(
                    builder: (context, orientation) {
                      final isLandscape = orientation == Orientation.landscape;
                      return isLandscape
                          ? _buildLandscapeLayout(
                              context, definedRoles, otherLights, otherRole.targets, devicesService, localizations)
                          : _buildPortraitLayout(
                              context, definedRoles, otherLights, otherRole.targets, devicesService, localizations);
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // DATA BUILDING
  // --------------------------------------------------------------------------

  List<LightingRoleData> _buildRoleDataList(
    List<LightTargetView> targets,
    DevicesService devicesService,
    AppLocalizations localizations,
  ) {
    final Map<LightTargetRole, List<LightTargetView>> grouped = {};

    for (final target in targets) {
      final role = target.role ?? LightTargetRole.other;
      if (role == LightTargetRole.hidden) continue;
      grouped.putIfAbsent(role, () => []).add(target);
    }

    final List<LightingRoleData> roles = [];
    for (final role in LightTargetRole.values) {
      final roleTargets = grouped[role] ?? [];
      if (roleTargets.isEmpty) continue;

      int onCount = 0;
      int? avgBrightness;
      int brightnessSum = 0;
      int brightnessCount = 0;

      for (final target in roleTargets) {
        final device = devicesService.getDevice(target.deviceId);
        if (device is LightingDeviceView) {
          final channel = device.lightChannels.firstWhere(
            (c) => c.id == target.channelId,
            orElse: () => device.lightChannels.first,
          );
          if (channel.on) {
            onCount++;
            if (channel.hasBrightness) {
              brightnessSum += channel.brightness;
              brightnessCount++;
            }
          }
        }
      }

      if (brightnessCount > 0) {
        avgBrightness = (brightnessSum / brightnessCount).round();
      }

      roles.add(LightingRoleData(
        role: role,
        name: _getRoleName(role, localizations),
        icon: _getRoleIcon(role),
        onCount: onCount,
        totalCount: roleTargets.length,
        brightness: onCount > 0 ? avgBrightness : null,
        targets: roleTargets,
      ));
    }

    return roles;
  }

  List<LightDeviceData> _buildOtherLights(
    List<LightTargetView> targets,
    DevicesService devicesService,
  ) {
    final List<LightDeviceData> lights = [];

    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is! LightingDeviceView) continue;

      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );

      LightState state;
      if (!device.isOnline) {
        state = LightState.offline;
      } else if (channel.on) {
        state = LightState.on;
      } else {
        state = LightState.off;
      }

      lights.add(LightDeviceData(
        deviceId: target.deviceId,
        channelId: channel.id,
        name: target.channelName,
        state: state,
        brightness: channel.hasBrightness && channel.on ? channel.brightness : null,
      ));
    }

    return lights;
  }

  int _countLightsOn(List<LightTargetView> targets, DevicesService devicesService) {
    int count = 0;
    for (final target in targets) {
      final device = devicesService.getDevice(target.deviceId);
      if (device is LightingDeviceView) {
        final channel = device.lightChannels.firstWhere(
          (c) => c.id == target.channelId,
          orElse: () => device.lightChannels.first,
        );
        if (channel.on) count++;
      }
    }
    return count;
  }

  String _getRoleName(LightTargetRole role, AppLocalizations localizations) {
    switch (role) {
      case LightTargetRole.main:
        return localizations.light_role_main;
      case LightTargetRole.ambient:
        return localizations.light_role_ambient;
      case LightTargetRole.task:
        return localizations.light_role_task;
      case LightTargetRole.accent:
        return localizations.light_role_accent;
      case LightTargetRole.night:
        return localizations.light_role_night;
      case LightTargetRole.other:
        return localizations.light_role_other;
      case LightTargetRole.hidden:
        return localizations.light_role_hidden;
    }
  }

  IconData _getRoleIcon(LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return MdiIcons.ceilingLight;
      case LightTargetRole.ambient:
        return MdiIcons.wallSconce;
      case LightTargetRole.task:
        return MdiIcons.deskLamp;
      case LightTargetRole.accent:
        return MdiIcons.lightbulbSpot;
      case LightTargetRole.night:
        return MdiIcons.weatherNight;
      case LightTargetRole.other:
        return MdiIcons.lightbulbOutline;
      case LightTargetRole.hidden:
        return MdiIcons.eyeOff;
    }
  }

  // --------------------------------------------------------------------------
  // HEADER
  // --------------------------------------------------------------------------

  Widget _buildHeader(
    BuildContext context,
    String roomName,
    int lightsOn,
    int totalLights,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pLg,
        vertical: AppSpacings.pMd,
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: borderColor,
            width: _scale(1),
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            MdiIcons.lightbulbOutline,
            color: isDark ? AppColorsDark.primary : AppColorsLight.primary,
            size: _scale(24),
          ),
          SizedBox(width: AppSpacings.pMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  localizations.domain_lights,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.primary
                        : AppTextColorLight.primary,
                    fontSize: AppFontSize.large,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '$roomName \u2022 $lightsOn of $totalLights on',
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                    fontSize: AppFontSize.small,
                    fontWeight: FontWeight.w400,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          SizedBox(width: AppSpacings.pMd),
          GestureDetector(
            onTap: _navigateToHome,
            child: Container(
              width: _scale(32),
              height: _scale(32),
              decoration: BoxDecoration(
                color: isDark ? AppFillColorDark.light : AppFillColorLight.darker,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.home_outlined,
                size: _scale(18),
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --------------------------------------------------------------------------
  // PORTRAIT LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildPortraitLayout(
    BuildContext context,
    List<LightingRoleData> roles,
    List<LightDeviceData> otherLights,
    List<LightTargetView> otherTargets,
    DevicesService devicesService,
    AppLocalizations localizations,
  ) {
    final hasRoles = roles.isNotEmpty;
    final hasOtherLights = otherLights.isNotEmpty;
    final hasScenes = _lightingScenes.isNotEmpty;

    // Fixed 4 tiles per row for scenes in portrait
    const scenesPerRow = 4;

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacings.paddingLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Roles Grid
                if (hasRoles)
                  _buildRolesGrid(context, roles, devicesService, crossAxisCount: 3),

                // Quick Scenes Section
                if (hasScenes) ...[
                  if (hasRoles) SizedBox(height: AppSpacings.pLg),
                  _buildSectionTitle(context, localizations.space_scenes_title, Icons.auto_awesome),
                  SizedBox(height: AppSpacings.pMd),
                  // Use horizontal scroll when other lights present (less vertical space)
                  if (hasOtherLights)
                    SizedBox(
                      height: _scale(70),
                      child: _buildPortraitScenesRow(
                        context,
                        tilesPerRow: scenesPerRow,
                      ),
                    )
                  else
                    _buildScenesGrid(context, crossAxisCount: 4),
                ],

                // Other Lights Section
                if (hasOtherLights) ...[
                  if (hasRoles || hasScenes) SizedBox(height: AppSpacings.pLg),
                  _buildOtherLightsHeader(context, otherLights, otherTargets, localizations),
                  SizedBox(height: AppSpacings.pMd),
                  _buildLightsGrid(context, otherLights, localizations, crossAxisCount: 2),
                ],
              ],
            ),
          ),
        ),
        // Fixed space at bottom for swipe dots
        SizedBox(height: AppSpacings.pLg),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // LANDSCAPE LAYOUT
  // --------------------------------------------------------------------------

  Widget _buildLandscapeLayout(
    BuildContext context,
    List<LightingRoleData> roles,
    List<LightDeviceData> otherLights,
    List<LightTargetView> otherTargets,
    DevicesService devicesService,
    AppLocalizations localizations,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasRoles = roles.isNotEmpty;
    final hasOtherLights = otherLights.isNotEmpty;
    final hasScenes = _lightingScenes.isNotEmpty;

    // Use ScreenService breakpoints for responsive layout (landscape orientation)
    final isLargeScreen = _screenService.isLargeScreenFor(isPortraitOrientation: false);
    final tilesPerRow = isLargeScreen ? 4 : 3;
    final maxScenes = isLargeScreen ? 6 : 4;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Main Area (left, wider) - expands to full width when no scenes
        Expanded(
          flex: hasScenes ? 2 : 1,
          child: Padding(
            padding: EdgeInsets.all(AppSpacings.pLg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Roles + Other Lights layout
                if (hasRoles && hasOtherLights) ...[
                  // Roles grid - 1 row
                  Flexible(
                    flex: 1,
                    child: _buildLandscapeRolesRow(
                      context,
                      roles,
                      devicesService,
                      tilesPerRow: tilesPerRow,
                    ),
                  ),
                  SizedBox(height: AppSpacings.pLg),
                  // Other Lights header
                  _buildOtherLightsHeader(context, otherLights, otherTargets, localizations),
                  SizedBox(height: AppSpacings.pMd),
                  // Other Lights grid - fills remaining space
                  Flexible(
                    flex: isLargeScreen ? 2 : 1,
                    child: _buildLandscapeLightsGrid(
                      context,
                      otherLights,
                      localizations,
                      tilesPerRow: tilesPerRow,
                      maxRows: isLargeScreen ? 2 : 1,
                    ),
                  ),
                ] else if (hasRoles) ...[
                  // Only roles, no other lights - grid layout
                  Expanded(
                    child: _buildRolesGrid(
                      context,
                      roles,
                      devicesService,
                      crossAxisCount: tilesPerRow,
                      aspectRatio: 1.0,
                    ),
                  ),
                ] else if (hasOtherLights) ...[
                  // Only other lights, no roles
                  _buildOtherLightsHeader(context, otherLights, otherTargets, localizations),
                  SizedBox(height: AppSpacings.pMd),
                  Expanded(
                    child: _buildLandscapeLightsGrid(
                      context,
                      otherLights,
                      localizations,
                      tilesPerRow: tilesPerRow,
                      maxRows: isLargeScreen ? 2 : 1,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),

        // Side Area (right, narrower) - scenes with different background
        if (hasScenes)
          Expanded(
            flex: 1,
            child: Container(
              decoration: BoxDecoration(
                color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
                border: Border(
                  left: BorderSide(
                    color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
                    width: 1,
                  ),
                ),
              ),
              child: Padding(
                padding: EdgeInsets.all(AppSpacings.pLg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSectionTitle(context, localizations.space_scenes_title, Icons.auto_awesome),
                    SizedBox(height: AppSpacings.pMd),
                    // Show more scenes on wider screens
                    Expanded(
                      child: _buildScenesGrid(context, crossAxisCount: 2, maxItems: maxScenes),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildLandscapeRolesRow(
    BuildContext context,
    List<LightingRoleData> roles,
    DevicesService devicesService, {
    required int tilesPerRow,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate tile width to fit exactly tilesPerRow tiles
        final totalSpacing = AppSpacings.pMd * (tilesPerRow - 1);
        final tileWidth = (constraints.maxWidth - totalSpacing) / tilesPerRow;

        return ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: roles.length,
          separatorBuilder: (context, index) => SizedBox(width: AppSpacings.pMd),
          itemBuilder: (context, index) {
            return SizedBox(
              width: tileWidth,
              child: _RoleCard(
                role: roles[index],
                onTap: () => _openRoleDetail(context, roles[index]),
                onIconTap: () => _toggleRole(roles[index]),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildPortraitScenesRow(
    BuildContext context, {
    required int tilesPerRow,
  }) {
    final scenes = _lightingScenes;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate tile width to fit exactly tilesPerRow tiles
        final totalSpacing = AppSpacings.pMd * (tilesPerRow - 1);
        final tileWidth = (constraints.maxWidth - totalSpacing) / tilesPerRow;

        return ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: scenes.length,
          separatorBuilder: (context, index) => SizedBox(width: AppSpacings.pMd),
          itemBuilder: (context, index) {
            return SizedBox(
              width: tileWidth,
              child: _SceneTile(
                scene: scenes[index],
                icon: _getSceneIcon(scenes[index]),
                onTap: () => _activateScene(scenes[index]),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildLandscapeLightsGrid(
    BuildContext context,
    List<LightDeviceData> lights,
    AppLocalizations localizations, {
    required int tilesPerRow,
    required int maxRows,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate tile size to fit exactly tilesPerRow tiles
        final totalHSpacing = AppSpacings.pMd * (tilesPerRow - 1);
        final tileWidth = (constraints.maxWidth - totalHSpacing) / tilesPerRow;

        // For 2 rows, calculate height per row
        final totalVSpacing = maxRows > 1 ? AppSpacings.pMd * (maxRows - 1) : 0.0;
        final tileHeight = (constraints.maxHeight - totalVSpacing) / maxRows;

        // Build columns of tiles (each column has maxRows tiles stacked)
        final columnCount = (lights.length / maxRows).ceil();

        return ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: columnCount,
          separatorBuilder: (context, index) => SizedBox(width: AppSpacings.pMd),
          itemBuilder: (context, colIndex) {
            return SizedBox(
              width: tileWidth,
              child: Column(
                children: [
                  for (var row = 0; row < maxRows; row++) ...[
                    if (row > 0) SizedBox(height: AppSpacings.pMd),
                    SizedBox(
                      height: tileHeight,
                      child: () {
                        final index = colIndex * maxRows + row;
                        if (index < lights.length) {
                          return _LightTile(
                            light: lights[index],
                            localizations: localizations,
                            onTap: () => _openDeviceDetail(context, lights[index]),
                            onIconTap: () => _toggleLight(lights[index]),
                            isVertical: true,
                          );
                        }
                        return const SizedBox.shrink();
                      }(),
                    ),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // SECTION TITLE
  // --------------------------------------------------------------------------

  Widget _buildSectionTitle(BuildContext context, String title, IconData icon) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      children: [
        Icon(
          icon,
          color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
          size: _scale(18),
        ),
        SizedBox(width: AppSpacings.pMd),
        Text(
          title,
          style: TextStyle(
            color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
            fontSize: AppFontSize.small,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildOtherLightsHeader(
    BuildContext context,
    List<LightDeviceData> otherLights,
    List<LightTargetView> otherTargets,
    AppLocalizations localizations,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final anyOn = otherLights.any((light) => light.isOn);
    final buttonLabel = anyOn
        ? localizations.domain_lights_button_all_off
        : localizations.domain_lights_button_all_on;

    return Row(
      children: [
        Icon(
          MdiIcons.lightbulbOutline,
          color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
          size: _scale(18),
        ),
        SizedBox(width: AppSpacings.pMd),
        Expanded(
          child: Text(
            localizations.domain_lights_other,
            style: TextStyle(
              color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ),
        GestureDetector(
          onTap: () => _toggleAllOtherLights(otherTargets, anyOn),
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.pMd,
              vertical: AppSpacings.pSm,
            ),
            decoration: BoxDecoration(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.darker,
              borderRadius: BorderRadius.circular(AppBorderRadius.round),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.power_settings_new,
                  size: _scale(14),
                  color: isDark ? AppTextColorDark.secondary : AppTextColorLight.primary,
                ),
                SizedBox(width: AppSpacings.pSm),
                Text(
                  buttonLabel,
                  style: TextStyle(
                    color: isDark ? AppTextColorDark.secondary : AppTextColorLight.primary,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  /// Toggle all other lights on or off
  Future<void> _toggleAllOtherLights(
    List<LightTargetView> targets,
    bool currentlyAnyOn,
  ) async {
    final targetState = !currentlyAnyOn; // If any on, turn all off; if all off, turn all on

    for (final target in targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is! LightingDeviceView) continue;

      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );

      // Only toggle lights that need to change state
      final isOn = channel.on;
      if ((targetState && !isOn) || (!targetState && isOn)) {
        final onPropId = channel.onProp.id;
        await _devicesService?.setPropertyValue(onPropId, targetState);
      }
    }
  }

  /// Toggle all lights in a role
  Future<void> _toggleRole(LightingRoleData roleData) async {
    // If any light is on, turn all off. If all off, turn all on.
    final anyOn = roleData.hasLightsOn;
    final targetState = !anyOn;

    for (final target in roleData.targets) {
      final device = _devicesService?.getDevice(target.deviceId);
      if (device is! LightingDeviceView) continue;

      final channel = device.lightChannels.firstWhere(
        (c) => c.id == target.channelId,
        orElse: () => device.lightChannels.first,
      );

      // Only toggle lights that need to change state
      final isOn = channel.on;
      if ((targetState && !isOn) || (!targetState && isOn)) {
        final onPropId = channel.onProp.id;
        await _devicesService?.setPropertyValue(onPropId, targetState);
      }
    }
  }

  /// Toggle a single light
  Future<void> _toggleLight(LightDeviceData light) async {
    final device = _devicesService?.getDevice(light.deviceId);
    if (device is! LightingDeviceView) return;

    final channel = device.lightChannels.firstWhere(
      (c) => c.id == light.channelId,
      orElse: () => device.lightChannels.first,
    );

    final targetState = !channel.on;
    final onPropId = channel.onProp.id;
    await _devicesService?.setPropertyValue(onPropId, targetState);
  }

  // --------------------------------------------------------------------------
  // ROLES GRID
  // --------------------------------------------------------------------------

  Widget _buildRolesGrid(
    BuildContext context,
    List<LightingRoleData> roles,
    DevicesService devicesService, {
    required int crossAxisCount,
    double aspectRatio = 0.9,
  }) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: aspectRatio,
      ),
      itemCount: roles.length,
      itemBuilder: (context, index) {
        return _RoleCard(
          role: roles[index],
          onTap: () => _openRoleDetail(context, roles[index]),
          onIconTap: () => _toggleRole(roles[index]),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // LIGHTS GRID
  // --------------------------------------------------------------------------

  Widget _buildLightsGrid(
    BuildContext context,
    List<LightDeviceData> lights,
    AppLocalizations localizations, {
    required int crossAxisCount,
    double aspectRatio = 2.5,
  }) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: aspectRatio,
      ),
      itemCount: lights.length,
      itemBuilder: (context, index) {
        return _LightTile(
          light: lights[index],
          localizations: localizations,
          onTap: () => _openDeviceDetail(context, lights[index]),
          onIconTap: () => _toggleLight(lights[index]),
        );
      },
    );
  }

  // --------------------------------------------------------------------------
  // SCENES GRID
  // --------------------------------------------------------------------------

  /// Get lighting scenes for the current room
  List<SceneView> get _lightingScenes {
    if (_scenesService == null) return [];

    // Get scenes for this room with lighting category
    return _scenesService!
        .getScenesForSpace(_roomId)
        .where((s) => s.category == ScenesModuleDataSceneCategory.lighting)
        .toList();
  }

  /// Get icon for scene based on its category or name
  IconData _getSceneIcon(SceneView scene) {
    final nameLower = scene.name.toLowerCase();

    // Match common scene names to icons
    if (nameLower.contains('relax')) return MdiIcons.sofaSingleOutline;
    if (nameLower.contains('movie') || nameLower.contains('cinema')) {
      return MdiIcons.movieOpenOutline;
    }
    if (nameLower.contains('bright') || nameLower.contains('day')) {
      return MdiIcons.weatherSunny;
    }
    if (nameLower.contains('night') || nameLower.contains('sleep')) {
      return MdiIcons.weatherNight;
    }
    if (nameLower.contains('read')) return MdiIcons.bookOpenPageVariantOutline;
    if (nameLower.contains('party') || nameLower.contains('color')) {
      return MdiIcons.partyPopper;
    }
    if (nameLower.contains('dinner') || nameLower.contains('romantic')) {
      return MdiIcons.candle;
    }
    if (nameLower.contains('work') || nameLower.contains('focus')) {
      return MdiIcons.deskLamp;
    }
    if (nameLower.contains('morning') || nameLower.contains('wake')) {
      return MdiIcons.weatherSunsetUp;
    }
    if (nameLower.contains('evening') || nameLower.contains('sunset')) {
      return MdiIcons.weatherSunsetDown;
    }

    // Default icon for lighting scenes
    return MdiIcons.lightbulbGroup;
  }

  Widget _buildScenesGrid(
    BuildContext context, {
    required int crossAxisCount,
    int? maxItems,
  }) {
    final allScenes = _lightingScenes;
    final scenes = maxItems != null && allScenes.length > maxItems
        ? allScenes.take(maxItems).toList()
        : allScenes;

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: 1.0,
      ),
      itemCount: scenes.length,
      itemBuilder: (context, index) {
        return _SceneTile(
          scene: scenes[index],
          icon: _getSceneIcon(scenes[index]),
          onTap: () => _activateScene(scenes[index]),
        );
      },
    );
  }

  Future<void> _activateScene(SceneView scene) async {
    await _scenesService?.triggerScene(scene.id);
  }

  // --------------------------------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------------------------------

  void _openRoleDetail(BuildContext context, LightingRoleData roleData) {
    if (roleData.targets.length == 1) {
      // Single device - open device detail
      final target = roleData.targets.first;
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => DeviceDetailPage(
            target.deviceId,
            initialChannelId: target.channelId,
          ),
        ),
      );
    } else {
      // Multiple devices - open role detail page
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => LightRoleDetailPage(
            role: roleData.role,
            roomId: _roomId,
          ),
        ),
      );
    }
  }

  void _openDeviceDetail(BuildContext context, LightDeviceData light) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DeviceDetailPage(
          light.deviceId,
          initialChannelId: light.channelId,
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // EMPTY STATE
  // --------------------------------------------------------------------------

  Widget _buildEmptyState(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark
          ? AppBgColorDark.page
          : AppBgColorLight.page,
      body: Center(
        child: Padding(
          padding: AppSpacings.paddingLg,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                MdiIcons.lightbulbOffOutline,
                color: isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary,
                size: _scale(64),
              ),
              AppSpacings.spacingMdVertical,
              Text(
                localizations.domain_lights_empty_title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: _scale(18),
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppTextColorDark.primary
                      : AppTextColorLight.primary,
                ),
              ),
              AppSpacings.spacingSmVertical,
              Text(
                localizations.domain_lights_empty_description,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: _scale(14),
                  color: isDark
                      ? AppTextColorDark.secondary
                      : AppTextColorLight.secondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// ROLE CARD
// ============================================================================

class _RoleCard extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final LightingRoleData role;
  final VoidCallback? onTap;
  final VoidCallback? onIconTap;

  _RoleCard({
    required this.role,
    this.onTap,
    this.onIconTap,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isOn = role.hasLightsOn;

    // Colors based on state (matching LightingChannelTile)
    final tileBgColor = isOn
        ? (isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9)
        : (isDark ? AppFillColorDark.light : AppFillColorLight.light);

    // Box-in-box border approach: always 2px total (1px outer + 1px inner)
    final Color outerBorderColor;
    final Color innerBorderColor;

    if (isOn) {
      // On: primary colored double border
      outerBorderColor =
          isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;
      innerBorderColor =
          isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;
    } else {
      // Off: light theme shows gray border, dark theme is borderless
      outerBorderColor = isDark ? tileBgColor : AppBorderColorLight.light;
      innerBorderColor = tileBgColor;
    }

    final iconBgColor = isOn
        ? (isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5)
        : (isDark ? AppFillColorDark.darker : AppFillColorLight.darker);

    final iconColor = isOn
        ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
        : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);

    final textColor = isOn
        ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
        : (isDark ? AppTextColorDark.primary : AppTextColorLight.primary);

    final subtitleColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final borderWidth = _scale(1);

    return GestureDetector(
      onTap: onTap,
      // Outer box with 1px border
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(
            color: outerBorderColor,
            width: borderWidth,
          ),
          boxShadow: isOn
              ? [
                  BoxShadow(
                    color: (isDark
                            ? AppColorsDark.primary
                            : AppColorsLight.primary)
                        .withValues(alpha: 0.2),
                    blurRadius: _scale(8),
                    spreadRadius: _scale(1),
                  ),
                ]
              : [],
        ),
        // Inner box with 1px border
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: BoxDecoration(
            color: tileBgColor,
            borderRadius:
                BorderRadius.circular(AppBorderRadius.medium - borderWidth),
            border: Border.all(
              color: innerBorderColor,
              width: borderWidth,
            ),
          ),
          child: Padding(
            padding: EdgeInsets.all(AppSpacings.pMd),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Icon - tappable for toggle
                Expanded(
                  child: Center(
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final iconSize = constraints.maxHeight;
                        return GestureDetector(
                          onTap: onIconTap,
                          child: Container(
                            width: iconSize,
                            height: iconSize,
                            decoration: BoxDecoration(
                              color: iconBgColor,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              role.icon,
                              color: iconColor,
                              size: iconSize * 0.5,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                SizedBox(height: AppSpacings.pSm),
                // Name
                Text(
                  role.name,
                  style: TextStyle(
                    color: textColor,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                // Status
                SizedBox(height: _scale(1)),
                Text(
                  role.statusText,
                  style: TextStyle(
                    color: subtitleColor,
                    fontSize: AppFontSize.extraExtraSmall,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// LIGHT TILE
// ============================================================================

class _LightTile extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final LightDeviceData light;
  final AppLocalizations localizations;
  final VoidCallback? onTap;
  final VoidCallback? onIconTap;
  final bool isVertical;

  _LightTile({
    required this.light,
    required this.localizations,
    this.onTap,
    this.onIconTap,
    this.isVertical = false,
  });

  String get _localizedStatusText {
    switch (light.state) {
      case LightState.off:
        return localizations.light_state_off;
      case LightState.on:
        return light.brightness != null ? '${light.brightness}%' : localizations.light_state_on;
      case LightState.offline:
        return localizations.device_status_offline;
    }
  }

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isOn = light.isOn;
    final isDisabled = light.isOffline;

    // Colors based on state (matching LightingChannelTile)
    final tileBgColor = isDisabled
        ? (isDark ? AppFillColorDark.darker : AppFillColorLight.darker)
        : (isOn
            ? (isDark
                ? AppColorsDark.primaryLight9
                : AppColorsLight.primaryLight9)
            : (isDark ? AppFillColorDark.light : AppFillColorLight.light));

    // Box-in-box border approach: always 2px total (1px outer + 1px inner)
    final Color outerBorderColor;
    final Color innerBorderColor;

    if (isDisabled) {
      // Disabled: subtle border
      outerBorderColor =
          isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
      innerBorderColor = tileBgColor;
    } else if (isOn) {
      // On: primary colored double border
      outerBorderColor =
          isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;
      innerBorderColor =
          isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;
    } else {
      // Off: light theme shows gray border, dark theme is borderless
      outerBorderColor = isDark ? tileBgColor : AppBorderColorLight.light;
      innerBorderColor = tileBgColor;
    }

    final iconBgColor = isDisabled
        ? (isDark ? AppFillColorDark.light : AppFillColorLight.light)
        : (isOn
            ? (isDark
                ? AppColorsDark.primaryLight5
                : AppColorsLight.primaryLight5)
            : (isDark ? AppFillColorDark.darker : AppFillColorLight.darker));

    final iconColor = isDisabled
        ? (isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled)
        : (isOn
            ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
            : (isDark
                ? AppTextColorDark.secondary
                : AppTextColorLight.secondary));

    final textColor = isDisabled
        ? (isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled)
        : (isOn
            ? (isDark ? AppColorsDark.primary : AppColorsLight.primary)
            : (isDark ? AppTextColorDark.primary : AppTextColorLight.primary));

    final subtitleColor = isDisabled
        ? (isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled)
        : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary);

    final warningColor =
        isDark ? AppColorsDark.warning : AppColorsLight.warning;

    final borderWidth = _scale(1);

    return GestureDetector(
      onTap: onTap,
      // Outer box with 1px border
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(
            color: outerBorderColor,
            width: borderWidth,
          ),
          boxShadow: isOn
              ? [
                  BoxShadow(
                    color: (isDark
                            ? AppColorsDark.primary
                            : AppColorsLight.primary)
                        .withValues(alpha: 0.2),
                    blurRadius: _scale(8),
                    spreadRadius: _scale(1),
                  ),
                ]
              : [],
        ),
        // Inner box with 1px border
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: BoxDecoration(
            color: tileBgColor,
            borderRadius:
                BorderRadius.circular(AppBorderRadius.medium - borderWidth),
            border: Border.all(
              color: innerBorderColor,
              width: borderWidth,
            ),
          ),
          child: Padding(
            padding: isVertical
                ? EdgeInsets.all(AppSpacings.pMd)
                : EdgeInsets.symmetric(horizontal: AppSpacings.pSm, vertical: 0),
            child: isVertical
                ? _buildVerticalLayout(iconBgColor, iconColor, textColor, subtitleColor, warningColor, isOn, isDisabled)
                : _buildHorizontalLayout(iconBgColor, iconColor, textColor, subtitleColor, warningColor, isOn, isDisabled),
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalLayout(
    Color iconBgColor,
    Color iconColor,
    Color textColor,
    Color subtitleColor,
    Color warningColor,
    bool isOn,
    bool isDisabled,
  ) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Icon - tappable for toggle
        Expanded(
          child: Center(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final iconSize = constraints.maxHeight;
                return GestureDetector(
                  onTap: onIconTap,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: iconSize,
                        height: iconSize,
                        decoration: BoxDecoration(
                          color: iconBgColor,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isOn ? Icons.lightbulb : Icons.lightbulb_outline,
                          color: iconColor,
                          size: iconSize * 0.5,
                        ),
                      ),
                      if (isDisabled)
                        Positioned(
                          right: -_scale(2),
                          bottom: -_scale(2),
                          child: Icon(
                            Icons.warning_rounded,
                            size: _scale(14),
                            color: warningColor,
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ),
        SizedBox(height: AppSpacings.pSm),
        // Name
        Text(
          light.name,
          style: TextStyle(
            color: textColor,
            fontSize: AppFontSize.extraSmall,
            fontWeight: FontWeight.w600,
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        // Status
        SizedBox(height: _scale(1)),
        Text(
          _localizedStatusText,
          style: TextStyle(
            color: isDisabled ? warningColor : subtitleColor,
            fontSize: AppFontSize.extraExtraSmall,
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildHorizontalLayout(
    Color iconBgColor,
    Color iconColor,
    Color textColor,
    Color subtitleColor,
    Color warningColor,
    bool isOn,
    bool isDisabled,
  ) {
    return Row(
      children: [
        // Icon with offline badge - tappable for toggle
        LayoutBuilder(
          builder: (context, constraints) {
            final iconSize = constraints.maxHeight * 0.6;
            return GestureDetector(
              onTap: onIconTap,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: iconSize,
                    height: iconSize,
                    decoration: BoxDecoration(
                      color: iconBgColor,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isOn ? Icons.lightbulb : Icons.lightbulb_outline,
                      color: iconColor,
                      size: iconSize * 0.5,
                    ),
                  ),
                  if (isDisabled)
                    Positioned(
                      right: -_scale(2),
                      bottom: -_scale(2),
                      child: Icon(
                        Icons.warning_rounded,
                        size: _scale(12),
                        color: warningColor,
                      ),
                    ),
                ],
              ),
            );
          },
        ),
        SizedBox(width: AppSpacings.pMd),
        // Info
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                light.name,
                style: TextStyle(
                  color: textColor,
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              SizedBox(height: _scale(1)),
              Text(
                _localizedStatusText,
                style: TextStyle(
                  color: isDisabled ? warningColor : subtitleColor,
                  fontSize: AppFontSize.extraExtraSmall,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ============================================================================
// SCENE TILE
// ============================================================================

class _SceneTile extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final SceneView scene;
  final IconData icon;
  final VoidCallback? onTap;

  _SceneTile({
    required this.scene,
    required this.icon,
    this.onTap,
  });

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final tileBgColor =
        isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final outerBorderColor =
        isDark ? tileBgColor : AppBorderColorLight.light;
    final innerBorderColor = tileBgColor;

    final iconBgColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    final iconColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

    final borderWidth = _scale(1);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          border: Border.all(
            color: outerBorderColor,
            width: borderWidth,
          ),
        ),
        child: Container(
          decoration: BoxDecoration(
            color: tileBgColor,
            borderRadius:
                BorderRadius.circular(AppBorderRadius.medium - borderWidth),
            border: Border.all(
              color: innerBorderColor,
              width: borderWidth,
            ),
          ),
          child: Padding(
            padding: EdgeInsets.all(AppSpacings.pXs),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Icon
                Expanded(
                  child: Center(
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final iconSize = constraints.maxHeight * 0.85;
                        return Container(
                          width: iconSize,
                          height: iconSize,
                          decoration: BoxDecoration(
                            color: iconBgColor,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            icon,
                            color: iconColor,
                            size: iconSize * 0.5,
                          ),
                        );
                      },
                    ),
                  ),
                ),
                SizedBox(height: AppSpacings.pXs),
                // Name
                Text(
                  scene.name,
                  style: TextStyle(
                    color: textColor,
                    fontSize: AppFontSize.extraExtraSmall,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
