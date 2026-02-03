import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Room system view - shows room-specific devices, scenes, and controls.
///
/// This is the primary view for displays with role=room. It provides:
/// - Room name and icon in header
/// - Domain tiles (lights, climate, sensors, media) with navigation
/// - Quick scenes for this room
/// - Suggested actions based on context
class RoomOverviewPage extends StatefulWidget {
  final SystemViewItem viewItem;

  const RoomOverviewPage({
    super.key,
    required this.viewItem,
  });

  @override
  State<RoomOverviewPage> createState() => _RoomOverviewPageState();
}

class _RoomOverviewPageState extends State<RoomOverviewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final EventBus _eventBus = locator<EventBus>();

  late final IntentsService _intentsService;
  late final DeckService _deckService;
  DevicesService? _devicesService;
  ScenesService? _scenesService;
  SpacesService? _spacesService;

  // Loading states
  bool _isLoading = true;
  bool _isSceneTriggering = false;
  String? _triggeringSceneId;

  // Room overview model (built from pure function)
  RoomOverviewModel? _model;

  // Additional live data (not in model)
  int _lightsOnCount = 0;
  double? _temperature;

  // Error state
  String? _errorMessage;

  String get _roomId => widget.viewItem.roomId ?? '';

  @override
  void initState() {
    super.initState();
    _intentsService = locator<IntentsService>();
    _deckService = locator<DeckService>();

    try {
      _devicesService = locator<DevicesService>();
      _devicesService?.addListener(_onDevicesDataChanged);
    } catch (_) {}

    try {
      _scenesService = locator<ScenesService>();
    } catch (_) {}

    try {
      _spacesService = locator<SpacesService>();
      _spacesService?.addListener(_onSpacesDataChanged);
    } catch (_) {}

    // Listen for DeckService changes (e.g., when device categories are loaded)
    _deckService.addListener(_onDeckServiceChanged);

    _loadRoomData();
  }

  void _onDeckServiceChanged() {
    // Reload room data when DeckService updates (e.g., device categories loaded)
    if (mounted && !_deckService.isLoadingDevices) {
      debugPrint(
        '[ROOM OVERVIEW] DeckService changed, reloading. '
        'deviceCategories: ${_deckService.deviceCategories.length}',
      );
      _loadRoomData();
    }
  }

  void _onDevicesDataChanged() {
    // Devices updated (e.g., light on/off state changed, device assigned/unassigned)
    // Refresh live device data and rebuild UI
    if (mounted) {
      _refreshLiveData();
    }
  }

  void _onSpacesDataChanged() {
    // Spaces data updated, refresh live data
    if (mounted) {
      _refreshLiveData();
    }
  }

  Future<void> _refreshLiveData() async {
    await _fetchLiveDeviceData();
    if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    _deckService.removeListener(_onDeckServiceChanged);
    _devicesService?.removeListener(_onDevicesDataChanged);
    _spacesService?.removeListener(_onSpacesDataChanged);
    super.dispose();
  }

  Future<void> _loadRoomData() async {
    if (_roomId.isEmpty) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'No room assigned to this display';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Get room data from SpacesService
      final room = _spacesService?.getSpace(_roomId);

      // Get device categories from DeckService
      final deviceCategories = _deckService.deviceCategories;

      debugPrint(
        '[ROOM OVERVIEW] Loading room data. '
        'roomId: $_roomId, '
        'deviceCategories: ${deviceCategories.length}, '
        'isLoadingDevices: ${_deckService.isLoadingDevices}',
      );

      // Get scenes for this room
      final scenes = _scenesService?.getScenesForSpace(_roomId) ?? [];

      // Fetch live device property values (temperature, lights on)
      await _fetchLiveDeviceData();

      if (!mounted) return;

      // Get display for model building
      final display = locator<DisplayRepository>().display;

      if (display == null) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Display not configured';
        });
        return;
      }

      // Build the room overview model
      final input = RoomOverviewBuildInput(
        display: display,
        room: room,
        deviceCategories: deviceCategories,
        scenes: scenes,
        now: DateTime.now(),
        lightsOnCount: _lightsOnCount,
        displayCols: display.cols,
      );

      final model = buildRoomOverviewModel(input);

      setState(() {
        _model = model;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load room data';
      });
    }
  }

  /// Fetches live device property values (temperature, lights on count).
  Future<void> _fetchLiveDeviceData() async {
    try {
      // Get devices for this room from DevicesService
      final devices = _devicesService?.getDevicesForRoom(_roomId) ?? [];

      debugPrint(
        '[ROOM OVERVIEW] Live device fetch returned ${devices.length} devices. '
        'Categories: ${devices.map((d) => d.category.name).toList()}',
      );

      int lightsOnCount = 0;
      double? temperature;

      for (final device in devices) {
        // Check if light is on
        if (_isLightingDevice(device) && _isDeviceOn(device)) {
          lightsOnCount++;
        }

        // Get temperature
        temperature ??= _getTemperature(device);
      }

      _lightsOnCount = lightsOnCount;
      _temperature = temperature;
    } catch (_) {
      // Keep existing values on error
    }
  }

  bool _isLightingDevice(DeviceView device) {
    return device.category == DevicesModuleDeviceCategory.lighting;
  }

  /// Check if a device is currently on by looking for the 'on' property
  bool _isDeviceOn(DeviceView device) {
    for (final channel in device.channels) {
      for (final property in channel.properties) {
        if (property.category == DevicesModulePropertyCategory.valueOn) {
          final valueType = property.value;
          if (valueType != null) {
            final rawValue = valueType.value;
            if (rawValue is bool) {
              return rawValue;
            }
            if (rawValue is String) {
              return rawValue.toLowerCase() == 'true';
            }
          }
        }
      }
    }
    return false;
  }

  /// Get temperature value from a device's channels
  double? _getTemperature(DeviceView device) {
    for (final channel in device.channels) {
      for (final property in channel.properties) {
        if (property.category == DevicesModulePropertyCategory.temperature) {
          final valueType = property.value;
          if (valueType != null) {
            final rawValue = valueType.value;
            if (rawValue is num) {
              return rawValue.toDouble();
            }
          }
        }
      }
    }
    return null;
  }

  void _navigateToDomainView(DomainType domain) {
    // Get the domain view item ID for navigation
    final roomId = widget.viewItem.roomId;
    if (roomId == null) return;

    final domainViewId = DomainViewItem.generateId(domain, roomId);
    _eventBus.fire(NavigateToDeckItemEvent(domainViewId));
  }

  Future<void> _triggerScene(String sceneId) async {
    if (_isSceneTriggering) return;

    setState(() {
      _isSceneTriggering = true;
      _triggeringSceneId = sceneId;
    });

    try {
      final result = await _intentsService.activateScene(sceneId);

      if (!mounted) return;

      setState(() {
        _isSceneTriggering = false;
        _triggeringSceneId = null;
      });

      final localizations = AppLocalizations.of(context);

      if (result.isSuccess) {
        AppToast.showSuccess(
          context,
          message: localizations?.space_scene_triggered ?? 'Scene activated',
        );
      } else if (result.isPartialSuccess) {
        AppToast.showInfo(
          context,
          message: localizations?.space_scene_partial_success ??
              'Scene partially activated',
        );
      } else {
        AppToast.showError(
          context,
          message: result.message ?? localizations?.action_failed ?? 'Failed',
        );
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isSceneTriggering = false;
        _triggeringSceneId = null;
      });

      final localizations = AppLocalizations.of(context);
      AppToast.showError(
        context,
        message: localizations?.action_failed ?? 'Failed to activate scene',
      );
    }
  }

  Future<void> _handleSuggestedAction(SuggestedAction action) async {
    switch (action.actionType) {
      case SuggestedActionType.scene:
        if (action.sceneId != null) {
          await _triggerScene(action.sceneId!);
        }
        break;
      case SuggestedActionType.turnOffLights:
        await _turnOffAllLights();
        break;
    }
  }

  Future<void> _turnOffAllLights() async {
    // Get all lighting devices in this room
    final lightDevices =
        _devicesService?.getDevicesForRoomByCategory(_roomId, DevicesModuleDeviceCategory.lighting) ?? [];

    if (lightDevices.isEmpty) return;

    int successCount = 0;
    int failCount = 0;

    for (final device in lightDevices) {
      // Only turn off devices that are currently on
      if (_isDeviceOn(device)) {
        final result = await _intentsService.toggleDevice(device.id);
        if (result.isSuccess) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    if (!mounted) return;

    // Refresh live data
    await _fetchLiveDeviceData();

    if (!mounted) return;

    setState(() {});

    // Show feedback - get localizations after mounted check
    final feedbackLocalizations = AppLocalizations.of(context);
    if (failCount == 0 && successCount > 0) {
      AppToast.showSuccess(
        context,
        message: 'Lights turned off',
      );
    } else if (successCount > 0) {
      AppToast.showInfo(
        context,
        message: 'Some lights turned off',
      );
    } else if (failCount > 0) {
      AppToast.showError(
        context,
        message: feedbackLocalizations?.action_failed ?? 'Failed to turn off lights',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final model = _model;

    return Scaffold(
      appBar: AppTopBar(
        title: model?.title ?? widget.viewItem.title,
        icon: model?.icon ?? MdiIcons.homeOutline,
        actions: _buildStatusBadges(context),
      ),
      body: SafeArea(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: _isLoading
              ? _buildLoadingState()
              : _errorMessage != null
                  ? _buildErrorState()
                  : model != null
                      ? _buildContent(context, localizations, model)
                      : _buildEmptyState(context, localizations),
        ),
      ),
    );
  }

  List<Widget> _buildStatusBadges(BuildContext context) {
    final badges = <Widget>[];
    final model = _model;

    // Lights status badge (using live data)
    if (model != null && model.domainCounts.hasDomain(DomainType.lights)) {
      badges.add(_buildLightsBadge(context));
    }

    // Temperature badge
    if (_temperature != null) {
      if (badges.isNotEmpty) badges.add(AppSpacings.spacingSmHorizontal);
      badges.add(_buildTemperatureBadge(context));
    }

    return badges;
  }

  Widget _buildLightsBadge(BuildContext context) {
    final model = _model;
    final lightsCount = model?.domainCounts.lights ?? 0;
    final isOn = _lightsOnCount > 0;
    final iconSize = _screenService.scale(
      14,
      density: _visualDensityService.density,
    );

    return GestureDetector(
      onTap: () => _navigateToDomainView(DomainType.lights),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pSm,
          vertical: AppSpacings.pXs,
        ),
        decoration: BoxDecoration(
          color: isOn
              ? (Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.warningLight9
                  : AppColorsDark.warningLight9)
              : (Theme.of(context).brightness == Brightness.light
                  ? AppFillColorLight.base
                  : AppFillColorDark.base),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
              size: iconSize,
              color: isOn
                  ? (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.warning
                      : AppColorsDark.warning)
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.placeholder
                      : AppTextColorDark.placeholder),
            ),
            AppSpacings.spacingXsHorizontal,
            Text(
              isOn ? '$_lightsOnCount/$lightsCount' : 'Off',
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                fontWeight: FontWeight.w500,
                color: isOn
                    ? (Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.warningDark2
                        : AppColorsDark.warningDark2)
                    : (Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.placeholder
                        : AppTextColorDark.placeholder),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTemperatureBadge(BuildContext context) {
    final iconSize = _screenService.scale(
      14,
      density: _visualDensityService.density,
    );

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pSm,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.light
            ? AppColorsLight.infoLight9
            : AppColorsDark.infoLight7,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            MdiIcons.thermometer,
            size: iconSize,
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.info
                : AppColorsDark.info,
          ),
          AppSpacings.spacingXsHorizontal,
          Text(
            '${NumberFormatUtils.defaultFormat.formatDecimal(_temperature!, decimalPlaces: 1)}°',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.infoDark2
                  : AppTextColorDark.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: CircularProgressIndicator(
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.alertCircleOutline,
            size:
                _screenService.scale(64, density: _visualDensityService.density),
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.danger
                : AppColorsDark.danger,
          ),
          AppSpacings.spacingMdVertical,
          Text(
            _errorMessage!,
            style: TextStyle(
              fontSize: AppFontSize.base,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
            textAlign: TextAlign.center,
          ),
          AppSpacings.spacingMdVertical,
          FilledButton.icon(
            onPressed: _loadRoomData,
            icon: Icon(MdiIcons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(
    BuildContext context,
    AppLocalizations? localizations,
    RoomOverviewModel model,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Domain tiles section
        if (model.hasAnyDomain) ...[
          _buildDomainTilesSection(context, model),
          AppSpacings.spacingMdVertical,
        ],

        // Quick scenes section
        if (model.hasScenes)
          Expanded(child: _buildScenesSection(context, localizations, model)),

        // Suggested actions
        if (model.suggestedActions.isNotEmpty && !model.hasScenes)
          _buildSuggestedActionsSection(context, model),

        // Empty state if no domains and no scenes
        if (!model.hasAnyDomain && !model.hasScenes)
          Expanded(child: _buildEmptyState(context, localizations)),
      ],
    );
  }

  Widget _buildDomainTilesSection(BuildContext context, RoomOverviewModel model) {
    final tiles = model.tiles;
    // Layout hints available for future use: model.layoutHints

    return Wrap(
      spacing: AppSpacings.pMd,
      runSpacing: AppSpacings.pMd,
      children: tiles.map((tile) => _buildDomainTile(context, tile)).toList(),
    );
  }

  Widget _buildDomainTile(BuildContext context, DomainTile tile) {
    final cardWidth = _screenService.scale(
      100,
      density: _visualDensityService.density,
    );
    final iconSize = _screenService.scale(
      32,
      density: _visualDensityService.density,
    );

    // Get active count for lights domain
    final activeCount = tile.domain == DomainType.lights ? _lightsOnCount : null;

    return GestureDetector(
      onTap: () => _navigateToDomainView(tile.domain),
      child: Container(
        width: cardWidth,
        padding: AppSpacings.paddingSm,
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.light
              ? AppBgColorLight.pageOverlay50
              : AppBgColorDark.pageOverlay50,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
        ),
        child: Column(
          children: [
            Icon(
              tile.icon,
              size: iconSize,
              color: Theme.of(context).colorScheme.primary,
            ),
            AppSpacings.spacingXsVertical,
            Text(
              activeCount != null && activeCount > 0
                  ? '$activeCount/${tile.count}'
                  : '${tile.count}',
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              tile.label,
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScenesSection(
    BuildContext context,
    AppLocalizations? localizations,
    RoomOverviewModel model,
  ) {
    return Card(
      elevation: 0,
      color: Theme.of(context).brightness == Brightness.light
          ? AppBgColorLight.pageOverlay50
          : AppBgColorDark.pageOverlay50,
      child: Padding(
        padding: AppSpacings.paddingMd,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  MdiIcons.movieOpenPlay,
                  size: _screenService.scale(
                    24,
                    density: _visualDensityService.density,
                  ),
                ),
                AppSpacings.spacingSmHorizontal,
                Text(
                  localizations?.space_scenes_title ?? 'Quick Scenes',
                  style: TextStyle(
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            AppSpacings.spacingMdVertical,
            Expanded(
              child: _buildScenesGrid(context, model.quickScenes),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScenesGrid(BuildContext context, List<QuickScene> scenes) {
    return Wrap(
      spacing: AppSpacings.pSm,
      runSpacing: AppSpacings.pSm,
      children: scenes.map((scene) => _buildSceneButton(context, scene)).toList(),
    );
  }

  Widget _buildSceneButton(BuildContext context, QuickScene scene) {
    final isTriggering = _triggeringSceneId == scene.sceneId;
    final buttonWidth = _screenService.scale(
      80,
      density: _visualDensityService.density,
    );
    final buttonHeight = _screenService.scale(
      60,
      density: _visualDensityService.density,
    );

    return SizedBox(
      width: buttonWidth,
      child: Column(
        children: [
          SizedBox(
            width: buttonHeight,
            height: buttonHeight,
            child: isTriggering
                ? Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppBorderRadius.base),
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppBgColorLight.pageOverlay70
                          : AppBgColorDark.pageOverlay70,
                    ),
                    child: Center(
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
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ),
                  )
                : Theme(
                    data: ThemeData(
                      filledButtonTheme:
                          Theme.of(context).brightness == Brightness.light
                              ? AppFilledButtonsLightThemes.primary
                              : AppFilledButtonsDarkThemes.primary,
                    ),
                    child: FilledButton(
                      onPressed: _isSceneTriggering
                          ? null
                          : () => _triggerScene(scene.sceneId),
                      style: ButtonStyle(
                        padding: WidgetStateProperty.all(EdgeInsets.zero),
                        shape: WidgetStateProperty.all(
                          RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppBorderRadius.base),
                          ),
                        ),
                      ),
                      child: Icon(
                        scene.icon,
                        size: _screenService.scale(
                          28,
                          density: _visualDensityService.density,
                        ),
                      ),
                    ),
                  ),
          ),
          AppSpacings.spacingXsVertical,
          Text(
            scene.name,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestedActionsSection(
    BuildContext context,
    RoomOverviewModel model,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Suggested',
          style: TextStyle(
            fontSize: AppFontSize.small,
            fontWeight: FontWeight.w600,
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.regular
                : AppTextColorDark.regular,
          ),
        ),
        AppSpacings.spacingSmVertical,
        Wrap(
          spacing: AppSpacings.pSm,
          runSpacing: AppSpacings.pSm,
          children: model.suggestedActions
              .map((action) => _buildSuggestedActionChip(context, action))
              .toList(),
        ),
      ],
    );
  }

  Widget _buildSuggestedActionChip(
    BuildContext context,
    SuggestedAction action,
  ) {
    return ActionChip(
      avatar: Icon(
        action.icon,
        size: _screenService.scale(
          18,
          density: _visualDensityService.density,
        ),
      ),
      label: Text(action.label),
      onPressed: () => _handleSuggestedAction(action),
    );
  }

  Widget _buildEmptyState(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.homeOffOutline,
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
            localizations?.space_empty_state_title ?? 'No Devices',
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
            localizations?.space_empty_state_description ??
                'Assign devices to this room in Admin',
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
    );
  }
}
