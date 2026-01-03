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

/// Entry system view - shows house modes and security status.
///
/// This is the primary view for displays with role=entry. It provides:
/// - Primary house mode actions (Home, Away, Night, Movie)
/// - Security status panel (locks, alarms, cameras)
/// - Quick access to doorbell/camera if present
class EntryOverviewPage extends StatefulWidget {
  final SystemViewItem viewItem;

  const EntryOverviewPage({super.key, required this.viewItem});

  @override
  State<EntryOverviewPage> createState() => _EntryOverviewPageState();
}

class _EntryOverviewPageState extends State<EntryOverviewPage> {
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

  // Security data
  int _locksCount = 0;
  int _locksLockedCount = 0;
  int _alarmsCount = 0;
  bool _alarmArmed = false;
  int _camerasCount = 0;
  bool _hasDoorbellActivity = false;

  // House mode scenes
  List<SceneModel> _houseModeScenes = [];
  String? _activeHouseMode;

  // Error state
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _intentsService = locator<IntentsService>();
    try {
      _scenesService = locator<ScenesService>();
    } catch (_) {}

    _loadSecurityData();
  }

  Future<void> _loadSecurityData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // TODO: Call actual security/devices API when available
      await Future.delayed(const Duration(milliseconds: 300));

      if (!mounted) return;

      // Set security info (simulated for now)
      setState(() {
        _locksCount = 2;
        _locksLockedCount = 2;
        _alarmsCount = 1;
        _alarmArmed = false;
        _camerasCount = 3;
        _hasDoorbellActivity = false;
        _activeHouseMode = 'home';
        _isLoading = false;
      });

      // Load house mode scenes
      _loadHouseModeScenes();
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isLoading = false;
        _errorMessage = 'Failed to load security data';
      });
    }
  }

  Future<void> _loadHouseModeScenes() async {
    if (_scenesService == null) return;

    setState(() {
      _isScenesLoading = true;
    });

    try {
      // Fetch whole-home scenes for house modes
      final scenes = await _scenesService!.fetchScenesForSpace('home');

      if (!mounted) return;

      // Filter for house mode scenes (away, home, night, movie, etc.)
      final houseModeCategories = ['away', 'home', 'night', 'movie', 'party', 'sleep'];
      final houseModeScenes = scenes
          .where((s) => houseModeCategories.contains(s.category))
          .toList();

      setState(() {
        _houseModeScenes = houseModeScenes;
        _isScenesLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _houseModeScenes = [];
        _isScenesLoading = false;
      });
    }
  }

  Future<void> _triggerHouseMode(SceneModel scene) async {
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
        setState(() {
          _activeHouseMode = scene.category;
        });

        final localizations = AppLocalizations.of(context);
        AlertBar.showSuccess(
          context,
          message: localizations?.entry_mode_activated ?? 'Mode activated',
        );
      } else if (result.isPartialSuccess) {
        final localizations = AppLocalizations.of(context);
        AlertBar.showInfo(
          context,
          message: localizations?.space_scene_partial_success ??
              'Mode partially activated',
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
        message: localizations?.action_failed ?? 'Failed to activate mode',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppTopBar(
        title: widget.viewItem.title,
        icon: MdiIcons.doorOpen,
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

    // Locks status badge
    if (_locksCount > 0) {
      badges.add(_buildLocksBadge(context));
    }

    // Alarm status badge
    if (_alarmsCount > 0) {
      if (badges.isNotEmpty) badges.add(AppSpacings.spacingSmHorizontal);
      badges.add(_buildAlarmBadge(context));
    }

    return badges;
  }

  Widget _buildLocksBadge(BuildContext context) {
    final iconSize = _screenService.scale(
      14,
      density: _visualDensityService.density,
    );
    final allLocked = _locksLockedCount == _locksCount;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pSm,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: allLocked
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.success.withValues(alpha: 0.15)
                : AppColorsDark.success.withValues(alpha: 0.2))
            : (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.warning.withValues(alpha: 0.15)
                : AppColorsDark.warning.withValues(alpha: 0.2)),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            allLocked ? MdiIcons.lock : MdiIcons.lockOpenVariant,
            size: iconSize,
            color: allLocked
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.success
                    : AppColorsDark.success)
                : (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.warning
                    : AppColorsDark.warning),
          ),
          SizedBox(width: AppSpacings.pXs),
          Text(
            allLocked ? 'Locked' : '$_locksLockedCount/$_locksCount',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w500,
              color: allLocked
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

  Widget _buildAlarmBadge(BuildContext context) {
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
        color: _alarmArmed
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.danger.withValues(alpha: 0.15)
                : AppColorsDark.danger.withValues(alpha: 0.2))
            : (Theme.of(context).brightness == Brightness.light
                ? AppFillColorLight.base
                : AppFillColorDark.base),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            _alarmArmed ? MdiIcons.shieldLock : MdiIcons.shieldOffOutline,
            size: iconSize,
            color: _alarmArmed
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.danger
                    : AppColorsDark.danger)
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.placeholder
                    : AppTextColorDark.placeholder),
          ),
          SizedBox(width: AppSpacings.pXs),
          Text(
            _alarmArmed ? 'Armed' : 'Disarmed',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w500,
              color: _alarmArmed
                  ? (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.dangerDark2
                      : AppColorsDark.dangerDark2)
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.placeholder
                      : AppTextColorDark.placeholder),
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
            onPressed: _loadSecurityData,
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
        // House mode buttons
        _buildHouseModesSection(context, localizations),
        AppSpacings.spacingLgVertical,

        // Security panel
        _buildSecuritySection(context, localizations),
      ],
    );
  }

  Widget _buildHouseModesSection(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              MdiIcons.homeSwitch,
              size: _screenService.scale(
                20,
                density: _visualDensityService.density,
              ),
            ),
            AppSpacings.spacingSmHorizontal,
            Text(
              localizations?.entry_house_modes ?? 'House Mode',
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
        else if (_houseModeScenes.isEmpty)
          _buildDefaultHouseModes(context, localizations)
        else
          _buildHouseModesGrid(context),
      ],
    );
  }

  Widget _buildDefaultHouseModes(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    // Default house mode buttons when no scenes are configured
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _buildHouseModeButton(
          context,
          icon: MdiIcons.home,
          label: localizations?.entry_mode_home ?? 'Home',
          isActive: _activeHouseMode == 'home',
          onTap: () {
            setState(() {
              _activeHouseMode = 'home';
            });
          },
        ),
        _buildHouseModeButton(
          context,
          icon: MdiIcons.exitRun,
          label: localizations?.entry_mode_away ?? 'Away',
          isActive: _activeHouseMode == 'away',
          onTap: () {
            setState(() {
              _activeHouseMode = 'away';
            });
          },
        ),
        _buildHouseModeButton(
          context,
          icon: MdiIcons.weatherNight,
          label: localizations?.entry_mode_night ?? 'Night',
          isActive: _activeHouseMode == 'night',
          onTap: () {
            setState(() {
              _activeHouseMode = 'night';
            });
          },
        ),
        _buildHouseModeButton(
          context,
          icon: MdiIcons.movieOpen,
          label: localizations?.entry_mode_movie ?? 'Movie',
          isActive: _activeHouseMode == 'movie',
          onTap: () {
            setState(() {
              _activeHouseMode = 'movie';
            });
          },
        ),
      ],
    );
  }

  Widget _buildHouseModeButton(
    BuildContext context, {
    required IconData icon,
    required String label,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    final buttonSize = _screenService.scale(
      70,
      density: _visualDensityService.density,
    );

    return Column(
      children: [
        SizedBox(
          width: buttonSize,
          height: buttonSize,
          child: Theme(
            data: ThemeData(
              filledButtonTheme: Theme.of(context).brightness == Brightness.light
                  ? (isActive
                      ? AppFilledButtonsLightThemes.primary
                      : AppFilledButtonsLightThemes.info)
                  : (isActive
                      ? AppFilledButtonsDarkThemes.primary
                      : AppFilledButtonsDarkThemes.info),
            ),
            child: FilledButton(
              onPressed: onTap,
              style: ButtonStyle(
                padding: WidgetStateProperty.all(EdgeInsets.zero),
                shape: WidgetStateProperty.all(
                  RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  ),
                ),
              ),
              child: Icon(
                icon,
                size: _screenService.scale(
                  32,
                  density: _visualDensityService.density,
                ),
              ),
            ),
          ),
        ),
        AppSpacings.spacingXsVertical,
        Text(
          label,
          style: TextStyle(
            fontSize: AppFontSize.small,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
            color: isActive
                ? Theme.of(context).colorScheme.primary
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular),
          ),
        ),
      ],
    );
  }

  Widget _buildHouseModesGrid(BuildContext context) {
    return Wrap(
      spacing: AppSpacings.pMd,
      runSpacing: AppSpacings.pMd,
      alignment: WrapAlignment.center,
      children: _houseModeScenes
          .map((scene) => _buildSceneHouseModeButton(context, scene))
          .toList(),
    );
  }

  Widget _buildSceneHouseModeButton(BuildContext context, SceneModel scene) {
    final isTriggering = _triggeringSceneId == scene.id;
    final isActive = _activeHouseMode == scene.category;
    final buttonSize = _screenService.scale(
      70,
      density: _visualDensityService.density,
    );

    return Column(
      children: [
        SizedBox(
          width: buttonSize,
          height: buttonSize,
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
                  ),
                )
              : Theme(
                  data: ThemeData(
                    filledButtonTheme:
                        Theme.of(context).brightness == Brightness.light
                            ? (isActive
                                ? AppFilledButtonsLightThemes.primary
                                : AppFilledButtonsLightThemes.info)
                            : (isActive
                                ? AppFilledButtonsDarkThemes.primary
                                : AppFilledButtonsDarkThemes.info),
                  ),
                  child: FilledButton(
                    onPressed:
                        _isSceneTriggering ? null : () => _triggerHouseMode(scene),
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
                        32,
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
            fontSize: AppFontSize.small,
            fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
            color: isActive
                ? Theme.of(context).colorScheme.primary
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular),
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildSecuritySection(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    final hasSecurityDevices =
        _locksCount > 0 || _alarmsCount > 0 || _camerasCount > 0;

    return Expanded(
      child: Card(
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
                    MdiIcons.shieldHome,
                    size: _screenService.scale(
                      24,
                      density: _visualDensityService.density,
                    ),
                  ),
                  AppSpacings.spacingSmHorizontal,
                  Text(
                    localizations?.entry_security ?? 'Security',
                    style: TextStyle(
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              AppSpacings.spacingMdVertical,
              if (!hasSecurityDevices)
                _buildSecurityEmptyState(context, localizations)
              else
                Expanded(
                  child: _buildSecurityDevices(context, localizations),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSecurityEmptyState(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            MdiIcons.shieldOffOutline,
            size: _screenService.scale(
              48,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.placeholder
                : AppTextColorDark.placeholder,
          ),
          AppSpacings.spacingSmVertical,
          Text(
            localizations?.entry_no_security_devices ?? 'No Security Devices',
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

  Widget _buildSecurityDevices(
    BuildContext context,
    AppLocalizations? localizations,
  ) {
    return Column(
      children: [
        if (_locksCount > 0)
          _buildSecurityRow(
            context,
            icon: _locksLockedCount == _locksCount
                ? MdiIcons.lock
                : MdiIcons.lockOpenVariant,
            label: localizations?.entry_locks ?? 'Locks',
            status: _locksLockedCount == _locksCount
                ? 'All locked'
                : '$_locksLockedCount/$_locksCount locked',
            isSecure: _locksLockedCount == _locksCount,
          ),
        if (_alarmsCount > 0)
          _buildSecurityRow(
            context,
            icon: _alarmArmed ? MdiIcons.shieldLock : MdiIcons.shieldOffOutline,
            label: localizations?.entry_alarm ?? 'Alarm',
            status: _alarmArmed ? 'Armed' : 'Disarmed',
            isSecure: _alarmArmed,
          ),
        if (_camerasCount > 0)
          _buildSecurityRow(
            context,
            icon: MdiIcons.cctv,
            label: localizations?.entry_cameras ?? 'Cameras',
            status: '$_camerasCount active',
            isSecure: true,
          ),
      ],
    );
  }

  Widget _buildSecurityRow(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String status,
    required bool isSecure,
  }) {
    final iconSize = _screenService.scale(
      28,
      density: _visualDensityService.density,
    );

    return Padding(
      padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
      child: Row(
        children: [
          Icon(
            icon,
            size: iconSize,
            color: isSecure
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.success
                    : AppColorsDark.success)
                : (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.warning
                    : AppColorsDark.warning),
          ),
          AppSpacings.spacingMdHorizontal,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  status,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    color: isSecure
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
        ],
      ),
    );
  }
}
