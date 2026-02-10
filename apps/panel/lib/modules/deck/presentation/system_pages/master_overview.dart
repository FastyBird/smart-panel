import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/energy/widgets/energy_header_widget.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Room summary data for master overview.
class RoomSummary {
  final String id;
  final String name;
  final IconData icon;
  final int onlineDevices;
  final int totalDevices;
  final double? temperature;

  const RoomSummary({
    required this.id,
    required this.name,
    required this.icon,
    required this.onlineDevices,
    required this.totalDevices,
    this.temperature,
  });
}

/// Master system view - shows whole-house overview.
///
/// This is the primary view for displays with role=master. It provides:
/// - Summary counts (rooms, devices, alerts, scenes)
/// - Room list with status cards
/// - Global scenes (Away, Home, Night, etc.)
class MasterOverviewPage extends StatefulWidget {
  final SystemViewItem viewItem;

  const MasterOverviewPage({super.key, required this.viewItem});

  @override
  State<MasterOverviewPage> createState() => _MasterOverviewPageState();
}

class _MasterOverviewPageState extends State<MasterOverviewPage> {
  late final IntentsService _intentsService;
  SpacesService? _spacesService;
  DevicesService? _devicesService;
  ScenesService? _scenesService;

  // Loading states
  bool _isLoading = true;
  bool _isScenesLoading = false;
  bool _isSceneTriggering = false;
  String? _triggeringSceneId;

  // House data
  int _roomsCount = 0;
  int _totalDevices = 0;
  int _onlineDevices = 0;
  int _alertsCount = 0;
  List<RoomSummary> _rooms = [];

  // Global scenes
  List<SceneView> _globalScenes = [];

  // Error state
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _intentsService = locator<IntentsService>();

    try {
      _spacesService = locator<SpacesService>();
    } catch (_) {}

    try {
      _devicesService = locator<DevicesService>();
    } catch (_) {}

    try {
      _scenesService = locator<ScenesService>();
    } catch (_) {}

    _loadHouseData();
  }

  Future<void> _loadHouseData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Get rooms from SpacesService
      final rooms = _spacesService?.rooms ?? [];

      // Get all devices from DevicesService
      final allDevices = _devicesService?.devicesList ?? [];

      if (!mounted) return;

      // Build room summaries
      final roomSummaries = <RoomSummary>[];
      int onlineDeviceCount = 0;

      for (final room in rooms) {
        // Get devices assigned to this room
        final roomDevices =
            _devicesService?.getDevicesForRoom(room.id) ?? [];
        final deviceCount = roomDevices.length;

        // Count online devices (for now, assume all are online)
        final onlineCount = deviceCount;
        onlineDeviceCount += onlineCount;

        // Get temperature from any device in the room that has a temperature sensor
        double? temperature = _getTemperatureFromRoomDevices(roomDevices);

        roomSummaries.add(RoomSummary(
          id: room.id,
          name: room.name,
          icon: _getIconForRoom(room),
          onlineDevices: onlineCount,
          totalDevices: deviceCount,
          temperature: temperature,
        ));
      }

      setState(() {
        _roomsCount = rooms.length;
        _totalDevices = allDevices.length;
        _onlineDevices = onlineDeviceCount;
        _alertsCount = 0; // TODO: Add alerts tracking when available
        _rooms = roomSummaries;
        _isLoading = false;
      });

      // Load global scenes (whole-home scenes)
      _loadGlobalScenes();
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load house data';
      });
    }
  }

  /// Get temperature value from any device in the room that has a temperature sensor
  double? _getTemperatureFromRoomDevices(List<DeviceView> devices) {
    for (final device in devices) {
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
    }
    return null;
  }

  /// Get an appropriate icon for a room based on its category
  IconData _getIconForRoom(SpaceView room) {
    switch (room.category) {
      case SpacesModuleDataSpaceCategory.livingRoom:
        return MdiIcons.sofa;
      case SpacesModuleDataSpaceCategory.bedroom:
        return MdiIcons.bedKingOutline;
      case SpacesModuleDataSpaceCategory.bathroom:
        return MdiIcons.showerHead;
      case SpacesModuleDataSpaceCategory.kitchen:
        return MdiIcons.stove;
      case SpacesModuleDataSpaceCategory.office:
        return MdiIcons.deskLamp;
      case SpacesModuleDataSpaceCategory.garage:
        return MdiIcons.garage;
      case SpacesModuleDataSpaceCategory.outdoorGarden:
        return MdiIcons.flower;
      case SpacesModuleDataSpaceCategory.hallway:
      case SpacesModuleDataSpaceCategory.entryway:
        return MdiIcons.doorOpen;
      case SpacesModuleDataSpaceCategory.laundry:
        return MdiIcons.washingMachine;
      case SpacesModuleDataSpaceCategory.floorBasement:
        return MdiIcons.stairs;
      case SpacesModuleDataSpaceCategory.floorAttic:
        return MdiIcons.homeRoof;
      case SpacesModuleDataSpaceCategory.nursery:
        return MdiIcons.toyBrickOutline;
      case SpacesModuleDataSpaceCategory.diningRoom:
        return MdiIcons.tableFurniture;
      case SpacesModuleDataSpaceCategory.outdoorBalcony:
        return MdiIcons.balcony;
      case SpacesModuleDataSpaceCategory.outdoorTerrace:
        return MdiIcons.tableChair;
      case SpacesModuleDataSpaceCategory.guestRoom:
        return MdiIcons.bedOutline;
      case SpacesModuleDataSpaceCategory.gym:
        return MdiIcons.dumbbell;
      case SpacesModuleDataSpaceCategory.mediaRoom:
        return MdiIcons.television;
      case SpacesModuleDataSpaceCategory.workshop:
        return MdiIcons.hammerWrench;
      default:
        return MdiIcons.homeOutline;
    }
  }

  void _loadGlobalScenes() {
    if (_scenesService == null) return;

    setState(() {
      _isScenesLoading = true;
    });

    try {
      // Get all triggerable scenes (global scenes)
      final scenes = _scenesService!.triggerableScenes;

      if (!mounted) return;

      setState(() {
        _globalScenes = scenes;
        _isScenesLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _globalScenes = [];
        _isScenesLoading = false;
      });
    }
  }

  Future<void> _triggerScene(SceneView scene) async {
    if (_isSceneTriggering) return;

    setState(() {
      _isSceneTriggering = true;
      _triggeringSceneId = scene.id;
    });

    try {
      final result = await _intentsService.activateScene(scene.id);

      if (!mounted) return;

      setState(() {
        _isSceneTriggering = false;
        _triggeringSceneId = null;
      });

      if (result.isSuccess) {
        final localizations = AppLocalizations.of(context);
        AppToast.showSuccess(
          context,
          message: localizations?.space_scene_triggered ?? 'Scene activated',
        );
      } else if (result.isPartialSuccess) {
        final localizations = AppLocalizations.of(context);
        AppToast.showInfo(
          context,
          message: localizations?.space_scene_partial_success ??
              'Scene partially activated',
        );
      } else {
        final localizations = AppLocalizations.of(context);
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

  void _onRoomTap(RoomSummary room) {
    // Navigate to room context via intent
    _intentsService.setRoomContextIntent(room.id);

    // TODO: Navigate to room detail or room page when available
    debugPrint('Navigate to room: ${room.name}');
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppTopBar(
        title: widget.viewItem.title,
        icon: MdiIcons.home,
        actions: _buildStatusBadges(context),
      ),
      body: SafeArea(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: _isLoading
              ? _buildLoadingState()
              : _errorMessage != null
                  ? _buildErrorState()
                  : _buildContent(context, localizations),
        ),
      ),
    );
  }

  List<Widget> _buildStatusBadges(BuildContext context) {
    final badges = <Widget>[];

    // Devices status badge
    badges.add(_buildDevicesBadge(context));

    // Alerts badge
    if (_alertsCount > 0) {
      badges.add(AppSpacings.spacingSmHorizontal);
      badges.add(_buildAlertsBadge(context));
    }

    // Energy header widget (whole-installation)
    badges.add(AppSpacings.spacingSmHorizontal);
    badges.add(const EnergyHeaderWidget());

    return badges;
  }

  Widget _buildDevicesBadge(BuildContext context) {
    final iconSize = AppSpacings.scale(14);
    final allOnline = _onlineDevices == _totalDevices;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pSm,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: allOnline
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.successLight9
                : AppColorsDark.successLight9)
            : (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.warningLight9
                : AppColorsDark.warningLight9),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        spacing: AppSpacings.pXs,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            allOnline ? MdiIcons.checkCircleOutline : MdiIcons.alertOutline,
            size: iconSize,
            color: allOnline
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.success
                    : AppColorsDark.success)
                : (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.warning
                    : AppColorsDark.warning),
          ),
          Text(
            '$_onlineDevices/$_totalDevices',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w500,
              color: allOnline
                  ? (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.successDark2
                      : AppColorsDark.successDark2)
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.warningDark2
                      : AppColorsDark.warningDark2),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAlertsBadge(BuildContext context) {
    final iconSize = AppSpacings.scale(14);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pSm,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.light
            ? AppColorsLight.dangerLight9
            : AppColorsDark.dangerLight9,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        spacing: AppSpacings.pXs,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            MdiIcons.alertCircle,
            size: iconSize,
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.danger
                : AppColorsDark.danger,
          ),
          Text(
            '$_alertsCount',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.dangerDark2
                  : AppColorsDark.dangerDark2,
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
        spacing: AppSpacings.pMd,
        children: [
          Icon(
            MdiIcons.alertCircleOutline,
            size: AppSpacings.scale(64),
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.danger
                : AppColorsDark.danger,
          ),
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
          Theme(
            data: ThemeData(
              filledButtonTheme: Theme.of(context).brightness == Brightness.dark
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsLightThemes.primary,
            ),
            child: FilledButton.icon(
              onPressed: _loadHouseData,
              icon: Icon(
                MdiIcons.refresh,
                size: AppFontSize.base,
                color: Theme.of(context).brightness == Brightness.dark
                    ? AppFilledButtonsDarkThemes.primaryForegroundColor
                    : AppFilledButtonsLightThemes.primaryForegroundColor,
              ),
              label: const Text('Retry'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(BuildContext context, AppLocalizations? localizations) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: AppSpacings.pMd,
      children: [
        // Summary stats
        _buildSummarySection(context, localizations),

        // Global scenes
        if (_globalScenes.isNotEmpty || _isScenesLoading)
          _buildScenesSection(context, localizations),

        // Rooms list
        Expanded(
          child: _buildRoomsSection(context, localizations),
        ),
      ],
    );
  }

  Widget _buildSummarySection(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _buildSummaryCard(
          context,
          icon: MdiIcons.homeGroup,
          value: '$_roomsCount',
          label: localizations?.master_rooms ?? 'Rooms',
        ),
        _buildSummaryCard(
          context,
          icon: MdiIcons.devices,
          value: '$_totalDevices',
          label: localizations?.master_devices ?? 'Devices',
        ),
        _buildSummaryCard(
          context,
          icon: MdiIcons.movieOpenPlay,
          value: '${_globalScenes.length}',
          label: localizations?.master_scenes ?? 'Scenes',
        ),
      ],
    );
  }

  Widget _buildSummaryCard(
    BuildContext context, {
    required IconData icon,
    required String value,
    required String label,
  }) {
    final iconSize = AppSpacings.scale(28);

    return Container(
      padding: AppSpacings.paddingSm,
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.light
            ? AppBgColorLight.pageOverlay50
            : AppBgColorDark.pageOverlay50,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Column(
        spacing: AppSpacings.pXs,
        children: [
          Icon(
            icon,
            size: iconSize,
            color: Theme.of(context).colorScheme.primary,
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: AppFontSize.large,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.regular
                  : AppTextColorDark.regular,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScenesSection(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pSm,
      children: [
        Row(
          spacing: AppSpacings.pSm,
          children: [
            Icon(
              MdiIcons.movieOpenPlay,
              size: AppSpacings.scale(20),
            ),
            Text(
              localizations?.master_quick_actions ?? 'Quick Actions',
              style: TextStyle(
                fontSize: AppFontSize.base,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        if (_isScenesLoading)
          Center(
            child: SizedBox(
              width: AppSpacings.scale(24),
              height: AppSpacings.scale(24),
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          )
        else
          Wrap(
            spacing: AppSpacings.pSm,
            runSpacing: AppSpacings.pSm,
            children: _globalScenes
                .map((scene) => _buildSceneChip(context, scene))
                .toList(),
          ),
      ],
    );
  }

  Widget _buildSceneChip(BuildContext context, SceneView scene) {
    final isTriggering = _triggeringSceneId == scene.id;

    return ActionChip(
      avatar: isTriggering
          ? SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Theme.of(context).colorScheme.primary,
              ),
            )
          : Icon(
              scene.iconData,
              size: AppSpacings.scale(18),
            ),
      label: Text(scene.name),
      onPressed: _isSceneTriggering ? null : () => _triggerScene(scene),
    );
  }

  Widget _buildRoomsSection(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pSm,
      children: [
        Row(
          spacing: AppSpacings.pSm,
          children: [
            Icon(
              MdiIcons.homeGroup,
              size: AppSpacings.scale(20),
            ),
            Text(
              localizations?.master_rooms ?? 'Rooms',
              style: TextStyle(
                fontSize: AppFontSize.base,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        Expanded(
          child: ListView.separated(
            itemCount: _rooms.length,
            separatorBuilder: (context, index) => AppSpacings.spacingSmVertical,
            itemBuilder: (context, index) => _buildRoomCard(context, _rooms[index]),
          ),
        ),
      ],
    );
  }

  Widget _buildRoomCard(BuildContext context, RoomSummary room) {
    final iconSize = AppSpacings.scale(32);
    final allOnline = room.onlineDevices == room.totalDevices;

    return InkWell(
      onTap: () => _onRoomTap(room),
      borderRadius: BorderRadius.circular(AppBorderRadius.base),
      child: Container(
        padding: AppSpacings.paddingSm,
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.light
              ? AppBgColorLight.pageOverlay50
              : AppBgColorDark.pageOverlay50,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
        ),
        child: Row(
          children: [
            Icon(
              room.icon,
              size: iconSize,
              color: Theme.of(context).colorScheme.primary,
            ),
            AppSpacings.spacingMdHorizontal,
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    room.name,
                    style: TextStyle(
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '${room.onlineDevices}/${room.totalDevices} devices',
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      color: allOnline
                          ? (Theme.of(context).brightness == Brightness.light
                              ? AppColorsLight.success
                              : AppColorsDark.success)
                          : (Theme.of(context).brightness == Brightness.light
                              ? AppColorsLight.warning
                              : AppColorsDark.warning),
                    ),
                  ),
                ],
              ),
            ),
            if (room.temperature != null) ...[
              Text(
                '${NumberFormatUtils.defaultFormat.formatDecimal(room.temperature!, decimalPlaces: 1)}°',
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w500,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular,
                ),
              ),
              AppSpacings.spacingSmHorizontal,
            ],
            Icon(
              MdiIcons.chevronRight,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
          ],
        ),
      ),
    );
  }
}
