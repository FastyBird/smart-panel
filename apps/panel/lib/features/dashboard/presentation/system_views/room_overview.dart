import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/scene.dart';
import 'package:fastybird_smart_panel/modules/scenes/services/scenes_service.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Room system view - shows room-specific devices, scenes, and controls.
///
/// This is the primary view for displays with role=room. It provides:
/// - Room name and icon in header
/// - Device counts by category (lights, climate, sensors, media)
/// - Quick scenes for this room
/// - Optional recent activity (if available via WS)
class RoomOverviewPage extends StatefulWidget {
  final SystemViewItem viewItem;

  const RoomOverviewPage({super.key, required this.viewItem});

  @override
  State<RoomOverviewPage> createState() => _RoomOverviewPageState();
}

class _RoomOverviewPageState extends State<RoomOverviewPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  late final IntentsService _intentsService;
  ScenesService? _scenesService;

  // Loading states
  bool _isLoading = true;
  bool _isScenesLoading = false;
  bool _isSceneTriggering = false;
  String? _triggeringSceneId;

  // Room data
  String _roomName = '';
  IconData _roomIcon = MdiIcons.homeOutline;
  int _lightsCount = 0;
  int _lightsOnCount = 0;
  int _climateDevicesCount = 0;
  int _sensorsCount = 0;
  int _mediaDevicesCount = 0;
  double? _temperature;

  // Scenes
  List<SceneModel> _scenes = [];

  // Error state
  String? _errorMessage;

  String get _roomId => widget.viewItem.roomId ?? '';

  @override
  void initState() {
    super.initState();
    _intentsService = locator<IntentsService>();
    try {
      _scenesService = locator<ScenesService>();
    } catch (_) {}

    _loadRoomData();
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
      // Load room name and summary data
      // TODO: Call actual spaces API when available
      await Future.delayed(const Duration(milliseconds: 300));

      if (!mounted) return;

      // Set room info from API or use defaults
      setState(() {
        _roomName = widget.viewItem.title;
        _roomIcon = MdiIcons.homeOutline;
        _lightsCount = 5;
        _lightsOnCount = 2;
        _climateDevicesCount = 1;
        _sensorsCount = 3;
        _mediaDevicesCount = 1;
        _temperature = 21.5;
        _isLoading = false;
      });

      // Load scenes for this room
      _loadScenes();
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load room data';
      });
    }
  }

  Future<void> _loadScenes() async {
    if (_scenesService == null || _roomId.isEmpty) return;

    setState(() {
      _isScenesLoading = true;
    });

    try {
      final scenes = await _scenesService!.fetchScenesForSpace(_roomId);

      if (!mounted) return;

      setState(() {
        _scenes = scenes;
        _isScenesLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _scenes = [];
        _isScenesLoading = false;
      });
    }
  }

  Future<void> _triggerScene(SceneModel scene) async {
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
        AlertBar.showSuccess(
          context,
          message: localizations?.space_scene_triggered ?? 'Scene activated',
        );
      } else if (result.isPartialSuccess) {
        final localizations = AppLocalizations.of(context);
        AlertBar.showInfo(
          context,
          message: localizations?.space_scene_partial_success ??
              'Scene partially activated',
        );
      } else {
        final localizations = AppLocalizations.of(context);
        AlertBar.showError(
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
      AlertBar.showError(
        context,
        message: localizations?.action_failed ?? 'Failed to activate scene',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppTopBar(
        title: _roomName.isNotEmpty ? _roomName : widget.viewItem.title,
        icon: _roomIcon,
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

    // Lights status badge
    if (_lightsCount > 0) {
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
    final isOn = _lightsOnCount > 0;
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
        color: isOn
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.warning.withValues(alpha: 0.15)
                : AppColorsDark.warning.withValues(alpha: 0.2))
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
          SizedBox(width: AppSpacings.pXs),
          Text(
            isOn ? '$_lightsOnCount/$_lightsCount' : 'Off',
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
            ? AppColorsLight.secondaryLight9
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
                ? AppColorsLight.secondary
                : AppColorsDark.info,
          ),
          SizedBox(width: AppSpacings.pXs),
          Text(
            '${_temperature!.toStringAsFixed(1)}°',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.secondaryDark2
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
            size: _screenService.scale(64, density: _visualDensityService.density),
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

  Widget _buildContent(BuildContext context, AppLocalizations? localizations) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Device summary cards
        _buildDeviceSummarySection(context, localizations),
        AppSpacings.spacingMdVertical,

        // Scenes section
        if (_scenes.isNotEmpty || _isScenesLoading)
          Expanded(child: _buildScenesSection(context, localizations)),

        // Empty state if no devices and no scenes
        if (_lightsCount == 0 &&
            _climateDevicesCount == 0 &&
            _sensorsCount == 0 &&
            _mediaDevicesCount == 0 &&
            _scenes.isEmpty &&
            !_isScenesLoading)
          Expanded(child: _buildEmptyState(context, localizations)),
      ],
    );
  }

  Widget _buildDeviceSummarySection(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    return Wrap(
      spacing: AppSpacings.pMd,
      runSpacing: AppSpacings.pMd,
      children: [
        if (_lightsCount > 0)
          _buildDeviceCard(
            context,
            icon: MdiIcons.lightbulbGroupOutline,
            label: localizations?.device_category_lighting ?? 'Lights',
            count: _lightsCount,
            activeCount: _lightsOnCount,
          ),
        if (_climateDevicesCount > 0)
          _buildDeviceCard(
            context,
            icon: MdiIcons.thermometer,
            label: localizations?.device_category_climate ?? 'Climate',
            count: _climateDevicesCount,
          ),
        if (_sensorsCount > 0)
          _buildDeviceCard(
            context,
            icon: MdiIcons.eyeOutline,
            label: localizations?.device_category_sensors ?? 'Sensors',
            count: _sensorsCount,
          ),
        if (_mediaDevicesCount > 0)
          _buildDeviceCard(
            context,
            icon: MdiIcons.televisionClassic,
            label: localizations?.device_category_media ?? 'Media',
            count: _mediaDevicesCount,
          ),
      ],
    );
  }

  Widget _buildDeviceCard(
    BuildContext context, {
    required IconData icon,
    required String label,
    required int count,
    int? activeCount,
  }) {
    final cardWidth = _screenService.scale(
      100,
      density: _visualDensityService.density,
    );
    final iconSize = _screenService.scale(
      32,
      density: _visualDensityService.density,
    );

    return Container(
      width: cardWidth,
      padding: AppSpacings.paddingSm,
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.light
            ? AppBgColorLight.page.withValues(alpha: 0.5)
            : AppBgColorDark.overlay.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            size: iconSize,
            color: Theme.of(context).colorScheme.primary,
          ),
          AppSpacings.spacingXsVertical,
          Text(
            activeCount != null ? '$activeCount/$count' : '$count',
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
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildScenesSection(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    return Card(
      elevation: 0,
      color: Theme.of(context).brightness == Brightness.light
          ? AppBgColorLight.page.withValues(alpha: 0.5)
          : AppBgColorDark.overlay.withValues(alpha: 0.5),
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
            if (_isScenesLoading)
              Center(
                child: SizedBox(
                  width: _screenService.scale(
                    24,
                    density: _visualDensityService.density,
                  ),
                  height: _screenService.scale(
                    24,
                    density: _visualDensityService.density,
                  ),
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              )
            else
              Expanded(
                child: _buildScenesGrid(context),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildScenesGrid(BuildContext context) {
    return Wrap(
      spacing: AppSpacings.pSm,
      runSpacing: AppSpacings.pSm,
      children: _scenes.map((scene) => _buildSceneButton(context, scene)).toList(),
    );
  }

  Widget _buildSceneButton(BuildContext context, SceneModel scene) {
    final isTriggering = _triggeringSceneId == scene.id;
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
                          ? AppBgColorLight.page.withValues(alpha: 0.7)
                          : AppBgColorDark.overlay.withValues(alpha: 0.7),
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
                      onPressed:
                          _isSceneTriggering ? null : () => _triggerScene(scene),
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
                        scene.iconData,
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

  Widget _buildEmptyState(BuildContext context, AppLocalizations? localizations) {
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
