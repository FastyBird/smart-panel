import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/navigate_event.dart';
import 'package:fastybird_smart_panel/modules/deck/views/light_role_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_detail_page.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/deck/utils/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/scenes/service.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/scenes/view.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
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

/// Light device power state for UI display.
enum LightState { off, on, offline }

/// UI mode for lighting control.
///
/// This enum represents the lighting modes available in the UI, including an 'off'
/// state that doesn't exist in the backend [LightingMode] enum. The backend only
/// has work/relax/night modes - turning lights off is a separate intent.
///
/// The distinction exists because:
/// - Backend [LightingMode]: Represents active lighting presets (work, relax, night)
/// - UI [LightingModeUI]: Includes 'off' as a selectable option for user convenience
///
/// Use [LightingModeUIExtension] to convert between UI and backend representations.
enum LightingModeUI { off, work, relax, night }

/// Extension to convert between UI mode and backend mode.
///
/// Provides bidirectional conversion:
/// - [toBackendMode]: Converts UI mode to backend mode (returns null for 'off')
/// - [fromBackendMode]: Converts backend mode + light state to UI mode
extension LightingModeUIExtension on LightingModeUI {
  /// Converts UI mode to backend [LightingMode].
  ///
  /// Returns `null` for [LightingModeUI.off] since the backend doesn't have
  /// an 'off' mode - turning lights off is handled via a separate intent.
  LightingMode? toBackendMode() {
    switch (this) {
      case LightingModeUI.off:
        return null;
      case LightingModeUI.work:
        return LightingMode.work;
      case LightingModeUI.relax:
        return LightingMode.relax;
      case LightingModeUI.night:
        return LightingMode.night;
    }
  }

  /// Converts backend [LightingMode] to UI mode.
  ///
  /// Takes into account whether any lights are on:
  /// - If no lights are on, returns [LightingModeUI.off]
  /// - If lights are on but mode is null, defaults to [LightingModeUI.work]
  /// - Otherwise, maps the backend mode to corresponding UI mode
  static LightingModeUI fromBackendMode(LightingMode? mode, bool anyLightsOn) {
    if (!anyLightsOn) return LightingModeUI.off;
    if (mode == null) return LightingModeUI.work;
    switch (mode) {
      case LightingMode.work:
        return LightingModeUI.work;
      case LightingMode.relax:
        return LightingModeUI.relax;
      case LightingMode.night:
        return LightingMode.night;
    }
  }
}

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
  bool _isExecutingIntent = false;

  // Current lighting mode for optimistic UI
  LightingModeUI? _pendingMode;

  // Debounce protection for rapid mode selection
  DateTime? _lastModeChangeTime;
  static const _modeChangeDebounce = Duration(milliseconds: 300);

  String get _roomId => widget.viewItem.roomId;

  /// Get lighting state from backend (cached)
  LightingStateModel? get _lightingState =>
      _spacesService?.getLightingState(_roomId);

  /// Determine current UI mode from backend state or pending state
  LightingModeUI get _currentMode {
    if (_pendingMode != null) return _pendingMode!;

    final state = _lightingState;
    if (state == null) return LightingModeUI.off;

    return LightingModeUIExtension.fromBackendMode(
      state.detectedMode ?? state.lastAppliedMode,
      state.anyOn,
    );
  }

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
      // Fetch light targets and lighting state in parallel
      await Future.wait([
        _spacesService?.fetchLightTargetsForSpace(_roomId) ?? Future.value(),
        _spacesService?.fetchLightingState(_roomId) ?? Future.value(),
      ]);
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
        // Calculate totals
        final totalLights = lightTargets.length;
        final lightsOn = _countLightsOn(lightTargets, devicesService);
        final roomName = _spacesService?.getSpace(_roomId)?.name ?? '';

        final otherLights = _buildOtherLights(otherRole.targets, devicesService, roomName);

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
    String roomName,
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
        name: stripRoomNameFromDevice(target.channelName, roomName),
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
    final localizations = AppLocalizations.of(context)!;

    // Get mode-aware colors
    final mode = _currentMode;
    final modeColor = _getModeColor(context, mode);
    final modeBgColor = _getModeBgColor(context, mode);

    // Build subtitle based on mode and lights state
    String subtitle;
    if (mode == LightingModeUI.off || lightsOn == 0) {
      subtitle = '$lightsOn of $totalLights on';
    } else {
      final modeName = _getModeName(mode, localizations);
      subtitle = '$modeName \u2022 $lightsOn on';
    }

    // Use actual light state for icon, not pending mode
    final hasLightsOn = lightsOn > 0;

    return PageHeader(
      title: localizations.domain_lights,
      subtitle: subtitle,
      subtitleColor: mode != LightingModeUI.off ? modeColor : null,
      backgroundColor: AppColors.blank,
      leading: HeaderDeviceIcon(
        icon: hasLightsOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
        backgroundColor: modeBgColor,
        iconColor: modeColor,
      ),
      trailing: HeaderHomeButton(
        onTap: _navigateToHome,
      ),
    );
  }

  /// Get color for lighting mode
  Color _getModeColor(BuildContext context, LightingModeUI mode) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (mode) {
      case LightingModeUI.off:
        return isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
      case LightingModeUI.work:
        return isDark ? AppColorsDark.primary : AppColorsLight.primary;
      case LightingModeUI.relax:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case LightingModeUI.night:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
    }
  }

  /// Get background color for lighting mode
  Color _getModeBgColor(BuildContext context, LightingModeUI mode) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    switch (mode) {
      case LightingModeUI.off:
        return isDark ? AppFillColorDark.light : AppFillColorLight.light;
      case LightingModeUI.work:
        return isDark ? AppColorsDark.primaryLight5 : AppColorsLight.primaryLight5;
      case LightingModeUI.relax:
        return isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight5;
      case LightingModeUI.night:
        return isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight5;
    }
  }

  /// Get localized name for lighting mode
  String _getModeName(LightingModeUI mode, AppLocalizations localizations) {
    switch (mode) {
      case LightingModeUI.off:
        return localizations.space_lighting_mode_off;
      case LightingModeUI.work:
        return localizations.space_lighting_mode_work;
      case LightingModeUI.relax:
        return localizations.space_lighting_mode_relax;
      case LightingModeUI.night:
        return localizations.space_lighting_mode_night;
    }
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
    final hasLights = hasRoles || hasOtherLights;

    // Responsive scenes per row based on screen size
    // Small: 3, Medium/Large: 4
    final isSmallScreen = _screenService.isSmallScreen;
    final scenesPerRow = isSmallScreen ? 3 : 4;

    // Use higher aspect ratio (shorter tiles) on medium+ portrait displays
    final isAtLeastMedium = _screenService.isAtLeastMedium;
    final otherLightsAspectRatio = isAtLeastMedium ? 3.0 : 2.5;

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: AppSpacings.paddingLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Mode Selector (only show if there are lights to control)
                if (hasLights) ...[
                  _buildModeSelector(context, localizations),
                  AppSpacings.spacingLgVertical,
                ],

                // Roles Grid
                if (hasRoles)
                  _buildRolesGrid(context, roles, devicesService, crossAxisCount: 3),

                // Quick Scenes Section
                if (hasScenes) ...[
                  if (hasRoles) AppSpacings.spacingLgVertical,
                  SectionTitle(title: localizations.space_scenes_title, icon: Icons.auto_awesome),
                  AppSpacings.spacingMdVertical,
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
                    _buildScenesGrid(context, crossAxisCount: scenesPerRow),
                ],

                // Other Lights Section
                if (hasOtherLights) ...[
                  if (hasRoles || hasScenes) AppSpacings.spacingLgVertical,
                  _buildOtherLightsTitle(otherLights, otherTargets, localizations),
                  AppSpacings.spacingMdVertical,
                  _buildLightsGrid(
                    context,
                    otherLights,
                    localizations,
                    crossAxisCount: 2,
                    aspectRatio: otherLightsAspectRatio,
                  ),
                ],
              ],
            ),
          ),
        ),
        // Fixed space at bottom for swipe dots
        AppSpacings.spacingLgVertical,
      ],
    );
  }

  /// Build the mode selector widget for portrait/horizontal layout.
  ///
  /// Uses the shared [ModeSelector] core widget wrapped with lighting-specific
  /// styling. The mode change logic (debouncing, backend intents) remains in
  /// this view because it's tightly coupled to the page's state lifecycle
  /// (`_pendingMode`, `_isExecutingIntent`). The shared widget handles the
  /// generic mode selection UI, while this view handles the domain logic.
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
          color: mode != LightingModeUI.off
              ? modeColor.withValues(alpha: 0.3)
              : (isDark ? AppBorderColorDark.light : AppBorderColorLight.light),
          width: 1,
        ),
      ),
      child: IgnorePointer(
        ignoring: _isExecutingIntent,
        child: ModeSelector<LightingModeUI>(
          modes: _getLightingModeOptions(localizations),
          selectedValue: mode,
          onChanged: _setLightingMode,
          orientation: ModeSelectorOrientation.horizontal,
          iconPlacement: ModeSelectorIconPlacement.top,
        ),
      ),
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
    final hasLights = hasRoles || hasOtherLights;

    // Use ScreenService breakpoints for responsive layout
    // Landscape breakpoints: small ≤800, medium ≤1150, large >1150
    final isLargeScreen = _screenService.isLargeScreen;
    final tilesPerRow = isLargeScreen ? 4 : 3;
    // Scenes: 1 column on small/medium, 2 columns on large
    final scenesPerRow = isLargeScreen ? 2 : 1;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left column: Roles + Other Lights
        Expanded(
          flex: 2,
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
                  AppSpacings.spacingLgVertical,
                  // Other Lights header
                  _buildOtherLightsTitle(otherLights, otherTargets, localizations),
                  AppSpacings.spacingMdVertical,
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
                  _buildOtherLightsTitle(otherLights, otherTargets, localizations),
                  AppSpacings.spacingMdVertical,
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

        // Middle column: Vertical Mode Selector
        // Show labels only on large screens when no scenes
        if (hasLights)
          Container(
            // More horizontal padding when labels are shown
            padding: EdgeInsets.symmetric(
              vertical: AppSpacings.pLg,
              horizontal: !hasScenes && isLargeScreen ? AppSpacings.pLg : AppSpacings.pMd,
            ),
            child: Center(
              child: _buildLandscapeModeSelector(
                context,
                localizations,
                showLabels: !hasScenes && isLargeScreen,
              ),
            ),
          ),

        // Right column: Scenes (or empty space if no scenes)
        if (hasScenes)
          Expanded(
            flex: 1,
            child: Container(
              color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
              child: Padding(
                padding: EdgeInsets.all(AppSpacings.pLg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SectionTitle(title: localizations.space_scenes_title, icon: Icons.auto_awesome),
                    AppSpacings.spacingMdVertical,
                    // Vertical scroll with responsive columns, no limit
                    // 1 column = horizontal tiles, 2+ columns = vertical tiles
                    Expanded(
                      child: _buildScenesGrid(
                        context,
                        crossAxisCount: scenesPerRow,
                        scrollable: true,
                        tileLayout: scenesPerRow == 1 ? TileLayout.horizontal : TileLayout.vertical,
                        showInactiveBorder: true,
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

  /// Build vertical mode selector for landscape layout
  Widget _buildLandscapeModeSelector(
    BuildContext context,
    AppLocalizations localizations, {
    bool showLabels = false,
  }) {
    final mode = _currentMode;

    return IgnorePointer(
      ignoring: _isExecutingIntent,
      child: ModeSelector<LightingModeUI>(
        modes: _getLightingModeOptions(localizations),
        selectedValue: mode,
        onChanged: _setLightingMode,
        orientation: ModeSelectorOrientation.vertical,
        iconPlacement: ModeSelectorIconPlacement.top,
        showLabels: showLabels,
        scrollable: showLabels, // Enable scroll when labels shown (takes more space)
      ),
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
          separatorBuilder: (context, index) => AppSpacings.spacingMdHorizontal,
          itemBuilder: (context, index) {
            return SizedBox(
              width: tileWidth,
              child: _RoleCard(
                role: roles[index],
                onTap: () => _openRoleDetail(context, roles[index]),
                onIconTap: () => _toggleRoleViaIntent(roles[index]),
                isLoading: _isExecutingIntent,
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
          separatorBuilder: (context, index) => AppSpacings.spacingMdHorizontal,
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
          separatorBuilder: (context, index) => AppSpacings.spacingMdHorizontal,
          itemBuilder: (context, colIndex) {
            return SizedBox(
              width: tileWidth,
              child: Column(
                children: [
                  for (var row = 0; row < maxRows; row++) ...[
                    if (row > 0) AppSpacings.spacingMdVertical,
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

  Widget _buildOtherLightsTitle(
    List<LightDeviceData> otherLights,
    List<LightTargetView> otherTargets,
    AppLocalizations localizations,
  ) {
    final anyOn = otherLights.any((light) => light.isOn);
    final buttonLabel = anyOn
        ? localizations.domain_lights_button_all_off
        : localizations.domain_lights_button_all_on;

    return SectionTitle(
      title: localizations.domain_lights_other,
      icon: MdiIcons.lightbulbOutline,
      trailing: SectionTitleButton(
        label: buttonLabel,
        icon: Icons.power_settings_new,
        onTap: () => _toggleAllOtherLights(otherTargets, anyOn),
      ),
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

  // --------------------------------------------------------------------------
  // LIGHTING MODE CONTROLS (Backend Intents)
  // --------------------------------------------------------------------------

  /// Set lighting mode via backend intent
  Future<void> _setLightingMode(LightingModeUI mode) async {
    // Guard against concurrent execution
    if (_isExecutingIntent) return;

    // Debounce rapid taps
    final now = DateTime.now();
    if (_lastModeChangeTime != null &&
        now.difference(_lastModeChangeTime!) < _modeChangeDebounce) {
      return;
    }
    _lastModeChangeTime = now;

    // Get localizations early (should always be available in widget context)
    final localizations = AppLocalizations.of(context)!;

    setState(() {
      _isExecutingIntent = true;
      _pendingMode = mode;
    });

    try {
      bool success = false;

      if (mode == LightingModeUI.off) {
        // Turn all lights off
        final result = await _spacesService?.turnLightsOff(_roomId);
        success = result != null;
      } else {
        // Set the mode - backend handles turning on appropriate lights
        final backendMode = mode.toBackendMode();
        if (backendMode != null) {
          final result = await _spacesService?.setLightingMode(_roomId, backendMode);
          success = result != null;
        }
      }

      if (success) {
        // Fetch updated lighting state to ensure UI reflects actual state
        await _spacesService?.fetchLightingState(_roomId);
        // Clear pending mode now that we have the actual state
        if (mounted) {
          setState(() {
            _pendingMode = null;
          });
        }
      } else if (mounted) {
        AlertBar.showError(context, message: localizations.action_failed);
        setState(() {
          _pendingMode = null;
        });
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightsDomainView] Failed to set lighting mode: $e');
      }
      if (mounted) {
        AlertBar.showError(context, message: localizations.action_failed);
        setState(() {
          _pendingMode = null;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isExecutingIntent = false;
        });
      }
    }
  }

  /// Toggle role via backend intent
  Future<void> _toggleRoleViaIntent(LightingRoleData roleData) async {
    if (_isExecutingIntent) return;
    final localizations = AppLocalizations.of(context);

    // Map LightTargetRole to LightingStateRole for backend
    final stateRole = _mapTargetRoleToStateRole(roleData.role);
    if (stateRole == null) {
      // Fallback to direct device control for unmapped roles
      await _toggleRole(roleData);
      return;
    }

    setState(() {
      _isExecutingIntent = true;
    });

    try {
      final anyOn = roleData.hasLightsOn;
      bool success = false;

      if (anyOn) {
        final result = await _spacesService?.turnRoleOff(_roomId, stateRole);
        success = result != null;
      } else {
        final result = await _spacesService?.turnRoleOn(_roomId, stateRole);
        success = result != null;
      }

      if (!success && mounted) {
        AlertBar.showError(
          context,
          message: localizations?.action_failed ?? 'Failed to toggle lights',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[LightsDomainView] Failed to toggle role: $e');
      }
      if (mounted) {
        AlertBar.showError(
          context,
          message: localizations?.action_failed ?? 'Failed to toggle lights',
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isExecutingIntent = false;
        });
      }
    }
  }

  /// Map LightTargetRole to LightingStateRole
  LightingStateRole? _mapTargetRoleToStateRole(LightTargetRole role) {
    switch (role) {
      case LightTargetRole.main:
        return LightingStateRole.main;
      case LightTargetRole.task:
        return LightingStateRole.task;
      case LightTargetRole.ambient:
        return LightingStateRole.ambient;
      case LightTargetRole.accent:
        return LightingStateRole.accent;
      case LightTargetRole.night:
        return LightingStateRole.night;
      case LightTargetRole.other:
        return LightingStateRole.other;
      case LightTargetRole.hidden:
        return null; // Hidden shouldn't be controlled
    }
  }

  /// Get mode options for the mode selector
  List<ModeOption<LightingModeUI>> _getLightingModeOptions(AppLocalizations localizations) {
    return [
      ModeOption(
        value: LightingModeUI.work,
        icon: MdiIcons.lightbulbOn,
        label: localizations.space_lighting_mode_work,
        color: ModeSelectorColor.primary,
      ),
      ModeOption(
        value: LightingModeUI.relax,
        icon: MdiIcons.sofaSingleOutline,
        label: localizations.space_lighting_mode_relax,
        color: ModeSelectorColor.warning,
      ),
      ModeOption(
        value: LightingModeUI.night,
        icon: MdiIcons.weatherNight,
        label: localizations.space_lighting_mode_night,
        color: ModeSelectorColor.info,
      ),
      ModeOption(
        value: LightingModeUI.off,
        icon: Icons.power_settings_new,
        label: localizations.space_lighting_mode_off,
        color: ModeSelectorColor.neutral,
      ),
    ];
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
          onIconTap: () => _toggleRoleViaIntent(roles[index]),
          isLoading: _isExecutingIntent,
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
    bool scrollable = false,
    TileLayout tileLayout = TileLayout.vertical,
    bool showInactiveBorder = false,
  }) {
    final allScenes = _lightingScenes;
    final scenes = maxItems != null && allScenes.length > maxItems
        ? allScenes.take(maxItems).toList()
        : allScenes;

    // Use different aspect ratio for horizontal tiles
    final aspectRatio = tileLayout == TileLayout.horizontal ? 3.0 : 1.0;

    return GridView.builder(
      shrinkWrap: !scrollable,
      physics: scrollable ? null : const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: AppSpacings.pMd,
        mainAxisSpacing: AppSpacings.pMd,
        childAspectRatio: aspectRatio,
      ),
      itemCount: scenes.length,
      itemBuilder: (context, index) {
        return _SceneTile(
          scene: scenes[index],
          icon: _getSceneIcon(scenes[index]),
          onTap: () => _activateScene(scenes[index]),
          layout: tileLayout,
          showInactiveBorder: showInactiveBorder,
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
                  fontSize: AppFontSize.extraLarge,
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
                  fontSize: AppFontSize.base,
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
// ROLE CARD (uses UniversalTile)
// ============================================================================

class _RoleCard extends StatelessWidget {
  final LightingRoleData role;
  final VoidCallback? onTap;
  final VoidCallback? onIconTap;
  final bool isLoading;

  const _RoleCard({
    required this.role,
    this.onTap,
    this.onIconTap,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return UniversalTile(
      layout: TileLayout.vertical,
      icon: role.icon,
      name: role.name,
      status: role.statusText,
      isActive: role.hasLightsOn,
      onTileTap: onTap,
      onIconTap: isLoading ? null : onIconTap,
      showWarningBadge: false,
    );
  }
}

// ============================================================================
// LIGHT TILE (uses UniversalTile)
// ============================================================================

class _LightTile extends StatelessWidget {
  final LightDeviceData light;
  final AppLocalizations localizations;
  final VoidCallback? onTap;
  final VoidCallback? onIconTap;
  final bool isVertical;

  const _LightTile({
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
        return light.brightness != null
            ? '${light.brightness}%'
            : localizations.light_state_on;
      case LightState.offline:
        return localizations.device_status_offline;
    }
  }

  @override
  Widget build(BuildContext context) {
    return UniversalTile(
      layout: isVertical ? TileLayout.vertical : TileLayout.horizontal,
      icon: Icons.lightbulb_outline,
      activeIcon: Icons.lightbulb,
      name: light.name,
      status: _localizedStatusText,
      isActive: light.isOn,
      isOffline: light.isOffline,
      onTileTap: onTap,
      onIconTap: onIconTap,
    );
  }
}

// ============================================================================
// SCENE TILE (uses UniversalTile)
// ============================================================================

class _SceneTile extends StatelessWidget {
  final SceneView scene;
  final IconData icon;
  final VoidCallback? onTap;
  final TileLayout layout;
  final bool showInactiveBorder;

  const _SceneTile({
    required this.scene,
    required this.icon,
    this.onTap,
    this.layout = TileLayout.vertical,
    this.showInactiveBorder = false,
  });

  @override
  Widget build(BuildContext context) {
    return UniversalTile(
      layout: layout,
      icon: icon,
      name: scene.name,
      isActive: false,
      onTileTap: onTap,
      showGlow: false,
      showWarningBadge: false,
      showInactiveBorder: showInactiveBorder,
    );
  }
}
