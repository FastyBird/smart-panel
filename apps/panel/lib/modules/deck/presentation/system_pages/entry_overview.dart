import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_toast.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
import 'package:fastybird_smart_panel/modules/energy/widgets/energy_header_widget.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
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
  late final IntentsService _intentsService;
  DevicesService? _devicesService;
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

  // House mode scenes
  List<SceneView> _houseModeScenes = [];
  ScenesModuleDataSceneCategory? _activeHouseMode;

  // Error state
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _intentsService = locator<IntentsService>();

    try {
      _devicesService = locator<DevicesService>();
    } catch (_) {}

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
      // Get security devices from DevicesService
      final locks = _devicesService?.getDevicesByCategory(DevicesModuleDeviceCategory.lock) ?? [];
      final alarms = _devicesService?.getDevicesByCategory(DevicesModuleDeviceCategory.alarm) ?? [];
      final cameras = _devicesService?.getDevicesByCategory(DevicesModuleDeviceCategory.camera) ?? [];

      if (!mounted) return;

      // Count locked devices
      int lockedCount = 0;
      for (final lock in locks) {
        if (_isDeviceLocked(lock)) {
          lockedCount++;
        }
      }

      // Check if alarm is armed
      bool isAlarmArmed = false;
      for (final alarm in alarms) {
        if (_isAlarmArmed(alarm)) {
          isAlarmArmed = true;
          break;
        }
      }

      setState(() {
        _locksCount = locks.length;
        _locksLockedCount = lockedCount;
        _alarmsCount = alarms.length;
        _alarmArmed = isAlarmArmed;
        _camerasCount = cameras.length;
        _activeHouseMode = ScenesModuleDataSceneCategory.home;
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

  /// Check if a lock device is currently locked
  bool _isDeviceLocked(DeviceView device) {
    for (final channel in device.channels) {
      for (final property in channel.properties) {
        if (property.category == DevicesModulePropertyCategory.locked) {
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

  /// Check if an alarm device is armed
  bool _isAlarmArmed(DeviceView device) {
    for (final channel in device.channels) {
      for (final property in channel.properties) {
        // Check for 'active' or 'on' property
        if (property.category == DevicesModulePropertyCategory.active ||
            property.category == DevicesModulePropertyCategory.valueOn) {
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

  void _loadHouseModeScenes() {
    if (_scenesService == null) return;

    setState(() {
      _isScenesLoading = true;
    });

    try {
      // Get triggerable scenes and filter for house modes
      final scenes = _scenesService!.triggerableScenes;

      if (!mounted) return;

      // Filter for house mode scenes (away, home, night, movie, etc.)
      const houseModeCategories = [
        ScenesModuleDataSceneCategory.away,
        ScenesModuleDataSceneCategory.home,
        ScenesModuleDataSceneCategory.night,
        ScenesModuleDataSceneCategory.movie,
        ScenesModuleDataSceneCategory.party,
      ];
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

  Future<void> _triggerHouseMode(SceneView scene) async {
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
        AppToast.showSuccess(
          context,
          message: localizations?.entry_mode_activated ?? 'Mode activated',
        );
      } else if (result.isPartialSuccess) {
        final localizations = AppLocalizations.of(context);
        AppToast.showInfo(
          context,
          message: localizations?.space_scene_partial_success ??
              'Mode partially activated',
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
    return [
      if (_locksCount > 0) _buildLocksBadge(context),
      if (_alarmsCount > 0) _buildAlarmBadge(context),
      if (locator.isRegistered<EnergyRepository>() &&
          locator<EnergyRepository>().isSupported)
        const EnergyHeaderWidget(),
    ];
  }

  Widget _buildLocksBadge(BuildContext context) {
    final iconSize = AppSpacings.scale(14);
    final allLocked = _locksLockedCount == _locksCount;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pSm,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: allLocked
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
    final iconSize = AppSpacings.scale(14);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pSm,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: _alarmArmed
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.dangerLight9
                : AppColorsDark.dangerLight9)
            : (Theme.of(context).brightness == Brightness.light
                ? AppFillColorLight.base
                : AppFillColorDark.base),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Row(
        spacing: AppSpacings.pXs,
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
              onPressed: _loadSecurityData,
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
      spacing: AppSpacings.pLg,
      children: [
        // House mode buttons
        _buildHouseModesSection(context, localizations),

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
      spacing: AppSpacings.pMd,
      children: [
        Row(
          spacing: AppSpacings.pSm,
          children: [
            Icon(
              MdiIcons.homeSwitch,
              size: AppSpacings.scale(20),
            ),
            Text(
              localizations?.entry_house_modes ?? 'House Mode',
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
          isActive: _activeHouseMode == ScenesModuleDataSceneCategory.home,
          onTap: () {
            setState(() {
              _activeHouseMode = ScenesModuleDataSceneCategory.home;
            });
          },
        ),
        _buildHouseModeButton(
          context,
          icon: MdiIcons.exitRun,
          label: localizations?.entry_mode_away ?? 'Away',
          isActive: _activeHouseMode == ScenesModuleDataSceneCategory.away,
          onTap: () {
            setState(() {
              _activeHouseMode = ScenesModuleDataSceneCategory.away;
            });
          },
        ),
        _buildHouseModeButton(
          context,
          icon: MdiIcons.weatherNight,
          label: localizations?.entry_mode_night ?? 'Night',
          isActive: _activeHouseMode == ScenesModuleDataSceneCategory.night,
          onTap: () {
            setState(() {
              _activeHouseMode = ScenesModuleDataSceneCategory.night;
            });
          },
        ),
        _buildHouseModeButton(
          context,
          icon: MdiIcons.movieOpen,
          label: localizations?.entry_mode_movie ?? 'Movie',
          isActive: _activeHouseMode == ScenesModuleDataSceneCategory.movie,
          onTap: () {
            setState(() {
              _activeHouseMode = ScenesModuleDataSceneCategory.movie;
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
    final buttonSize = AppSpacings.scale(70);

    return Column(
      spacing: AppSpacings.pXs,
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
              style: FilledButton.styleFrom(
                padding: EdgeInsets.zero,
              ),
              child: Icon(
                icon,
                size: AppSpacings.scale(32),
                color: Theme.of(context).brightness == Brightness.dark
                    ? (isActive
                        ? AppFilledButtonsDarkThemes.primaryForegroundColor
                        : AppFilledButtonsDarkThemes.infoForegroundColor)
                    : (isActive
                        ? AppFilledButtonsLightThemes.primaryForegroundColor
                        : AppFilledButtonsLightThemes.infoForegroundColor),
              ),
            ),
          ),
        ),
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

  Widget _buildSceneHouseModeButton(BuildContext context, SceneView scene) {
    final isTriggering = _triggeringSceneId == scene.id;
    final isActive = _activeHouseMode == scene.category;
    final buttonSize = AppSpacings.scale(70);

    return Column(
      spacing: AppSpacings.pXs,
      children: [
        SizedBox(
          width: buttonSize,
          height: buttonSize,
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
                      width: AppSpacings.scale(24),
                      height: AppSpacings.scale(24),
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
                    style: FilledButton.styleFrom(
                      padding: EdgeInsets.zero,
                    ),
                    child: Icon(
                      scene.iconData,
                      size: AppSpacings.scale(32),
                      color: Theme.of(context).brightness == Brightness.dark
                          ? (isActive
                              ? AppFilledButtonsDarkThemes.primaryForegroundColor
                              : AppFilledButtonsDarkThemes.infoForegroundColor)
                          : (isActive
                              ? AppFilledButtonsLightThemes.primaryForegroundColor
                              : AppFilledButtonsLightThemes.infoForegroundColor),
                    ),
                  ),
                ),
        ),
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
            ? AppBgColorLight.pageOverlay50
            : AppBgColorDark.pageOverlay50,
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: AppSpacings.pMd,
            children: [
              Row(
                spacing: AppSpacings.pSm,
                children: [
                  Icon(
                    MdiIcons.shieldHome,
                    size: AppSpacings.scale(24),
                  ),
                  Text(
                    localizations?.entry_security ?? 'Security',
                    style: TextStyle(
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
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
        spacing: AppSpacings.pSm,
        children: [
          Icon(
            MdiIcons.shieldOffOutline,
            size: AppSpacings.scale(48),
            color: Theme.of(context).brightness == Brightness.light
                ? AppTextColorLight.placeholder
                : AppTextColorDark.placeholder,
          ),
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
    final iconSize = AppSpacings.scale(28);

    return Padding(
      padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
      child: Row(
        spacing: AppSpacings.pMd,
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
