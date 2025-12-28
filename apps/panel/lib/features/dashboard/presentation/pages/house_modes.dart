import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/dashboard/service.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/house_modes.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/system/models/system.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// HouseModesPage displays house mode selection (Home, Away, Night).
/// Users can tap on a mode card to switch the current house mode.
class HouseModesPage extends StatefulWidget {
  final HouseModesPageView page;

  const HouseModesPage({
    super.key,
    required this.page,
  });

  @override
  State<HouseModesPage> createState() => _HouseModesPageState();
}

class _HouseModesPageState extends State<HouseModesPage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final ConfigModuleService _configModule = locator<ConfigModuleService>();

  bool _isUpdating = false;
  HouseMode? _currentMode;

  @override
  void initState() {
    super.initState();
    _loadCurrentMode();
  }

  void _loadCurrentMode() {
    try {
      final repo =
          _configModule.getModuleRepository<SystemConfigModel>('system-module');
      repo.addListener(_onConfigChanged);
      _currentMode = repo.data?.houseMode;
    } catch (e) {
      // Config not yet available
    }
  }

  void _onConfigChanged() {
    if (!mounted) return;
    try {
      final repo =
          _configModule.getModuleRepository<SystemConfigModel>('system-module');
      final newMode = repo.data?.houseMode;
      if (newMode != _currentMode) {
        setState(() {
          _currentMode = newMode;
        });
      }
    } catch (e) {
      // Ignore errors
    }
  }

  @override
  void dispose() {
    try {
      final repo =
          _configModule.getModuleRepository<SystemConfigModel>('system-module');
      repo.removeListener(_onConfigChanged);
    } catch (e) {
      // Ignore
    }
    super.dispose();
  }

  Future<void> _setHouseMode(
    HouseMode mode,
    AppLocalizations localizations,
  ) async {
    if (_isUpdating || mode == _currentMode) return;

    // Check if confirmation is required for away mode
    if (mode == HouseMode.away && widget.page.confirmOnAway) {
      final confirmed = await _showConfirmationDialog(
        context,
        localizations,
        mode,
      );
      if (!confirmed) return;
    }

    setState(() {
      _isUpdating = true;
    });

    try {
      final repo =
          _configModule.getModuleRepository<SystemConfigModel>('system-module');
      final success = await repo.updateConfiguration({
        'house_mode': mode.value,
      });

      if (!mounted) return;

      if (success) {
        setState(() {
          _currentMode = mode;
        });
        AlertBar.showSuccess(
          context,
          message: localizations.house_modes_changed_success,
        );
      } else {
        AlertBar.showError(
          context,
          message: localizations.house_modes_changed_error,
        );
      }
    } catch (e) {
      if (!mounted) return;
      AlertBar.showError(
        context,
        message: localizations.house_modes_changed_error,
      );
    } finally {
      if (mounted) {
        setState(() {
          _isUpdating = false;
        });
      }
    }
  }

  Future<bool> _showConfirmationDialog(
    BuildContext context,
    AppLocalizations localizations,
    HouseMode mode,
  ) async {
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(localizations.house_modes_confirm_title),
            content: Text(localizations.house_modes_confirm_away_description),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: Text(localizations.button_cancel),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: Text(localizations.button_confirm),
              ),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<DashboardService>(builder: (
      context,
      dashboardService,
      _,
    ) {
      final DashboardPageView? freshPage =
          dashboardService.getPage(widget.page.id);

      if (freshPage == null || freshPage is! HouseModesPageView) {
        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    MdiIcons.alert,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(
                      64,
                      density: _visualDensityService.density,
                    ),
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    localizations.message_error_page_not_found_title,
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
                  Text(
                    localizations.message_error_page_not_found_description,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      return Scaffold(
        appBar: freshPage.showTopBar
            ? AppTopBar(
                icon: freshPage.icon,
                title: freshPage.title,
              )
            : null,
        body: SafeArea(
          child: Padding(
            padding: AppSpacings.paddingMd,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: GridView.count(
                    crossAxisCount: 3,
                    childAspectRatio: 0.9,
                    crossAxisSpacing: _screenService.scale(
                      12,
                      density: _visualDensityService.density,
                    ),
                    mainAxisSpacing: _screenService.scale(
                      12,
                      density: _visualDensityService.density,
                    ),
                    children: [
                      _buildModeCard(
                        context,
                        localizations,
                        mode: HouseMode.home,
                        icon: MdiIcons.home,
                        label: localizations.house_modes_home,
                        description: localizations.house_modes_home_description,
                      ),
                      _buildModeCard(
                        context,
                        localizations,
                        mode: HouseMode.away,
                        icon: MdiIcons.exitRun,
                        label: localizations.house_modes_away,
                        description: localizations.house_modes_away_description,
                      ),
                      _buildModeCard(
                        context,
                        localizations,
                        mode: HouseMode.night,
                        icon: MdiIcons.weatherNight,
                        label: localizations.house_modes_night,
                        description:
                            localizations.house_modes_night_description,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    });
  }

  Widget _buildModeCard(
    BuildContext context,
    AppLocalizations localizations, {
    required HouseMode mode,
    required IconData icon,
    required String label,
    required String description,
  }) {
    final isSelected = _currentMode == mode;
    final isDisabled = _isUpdating;

    final cardColor = isSelected
        ? (Theme.of(context).brightness == Brightness.light
            ? AppColorsLight.primaryLight8
            : AppColorsDark.primaryLight2)
        : null;

    final borderColor = isSelected
        ? (Theme.of(context).brightness == Brightness.light
            ? AppColorsLight.primary
            : AppColorsDark.primary)
        : (Theme.of(context).brightness == Brightness.light
            ? AppBorderColorLight.base
            : AppBorderColorDark.base);

    final iconColor = isSelected
        ? (Theme.of(context).brightness == Brightness.light
            ? AppColorsLight.primary
            : AppColorsDark.primary)
        : (Theme.of(context).brightness == Brightness.light
            ? AppTextColorLight.regular
            : AppTextColorDark.regular);

    return Opacity(
      opacity: isDisabled ? 0.6 : 1.0,
      child: Card(
        color: cardColor,
        elevation: isSelected ? 4 : 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppBorderRadius.large),
          side: BorderSide(
            color: borderColor,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: InkWell(
          onTap: isDisabled ? null : () => _setHouseMode(mode, localizations),
          borderRadius: BorderRadius.circular(AppBorderRadius.large),
          child: Padding(
            padding: AppSpacings.paddingSm,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: _screenService.scale(
                    48,
                    density: _visualDensityService.density,
                  ),
                  color: iconColor,
                ),
                AppSpacings.spacingSmVertical,
                Text(
                  label,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight:
                            isSelected ? FontWeight.bold : FontWeight.normal,
                        color: iconColor,
                      ),
                  textAlign: TextAlign.center,
                ),
                AppSpacings.spacingXsVertical,
                Flexible(
                  child: Text(
                    description,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).hintColor,
                        ),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (isSelected) ...[
                  AppSpacings.spacingSmVertical,
                  Icon(
                    MdiIcons.checkCircle,
                    size: _screenService.scale(
                      20,
                      density: _visualDensityService.density,
                    ),
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.success
                        : AppColorsDark.success,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
