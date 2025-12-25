import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/space.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

enum LightingMode {
  off,
  work,
  relax,
  night,
}

class SpacePage extends StatefulWidget {
  final SpacePageView page;

  const SpacePage({super.key, required this.page});

  @override
  State<SpacePage> createState() => _SpacePageState();
}

class _SpacePageState extends State<SpacePage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  bool _isLoading = false;
  LightingMode? _activeMode;

  // TODO: Replace with localizations after running `flutter gen-l10n`
  // The localization strings are defined in app_en.arb and app_cs.arb
  static const String _lightingControlsTitle = 'Lighting Controls';
  static const String _modeOff = 'Off';
  static const String _modeWork = 'Work';
  static const String _modeRelax = 'Relax';
  static const String _modeNight = 'Night';
  static const String _devicesTitle = 'Devices';
  static const String _devicesPlaceholder =
      'Devices in this space will be displayed here';
  static const String _actionSuccess = 'Action completed successfully';

  Future<void> _executeLightingIntent(LightingMode mode) async {
    if (_isLoading) return;

    setState(() {
      _isLoading = true;
    });

    try {
      // TODO: Replace with actual API call after running `melos rebuild-api`
      // Example implementation:
      //
      // final spacesApi = locator<SpacesModuleSpacesApi>();
      // final request = switch (mode) {
      //   LightingMode.off => SpacesModuleCreateSpaceLightingIntentReq(
      //       data: SpacesModuleCreateSpaceLightingIntentReqDataUnion.spacesModuleLightingIntentOff(
      //         SpacesModuleLightingIntentOff(type: SpacesModuleLightingIntentType.off),
      //       ),
      //     ),
      //   LightingMode.work => SpacesModuleCreateSpaceLightingIntentReq(
      //       data: SpacesModuleCreateSpaceLightingIntentReqDataUnion.spacesModuleLightingIntentSetMode(
      //         SpacesModuleLightingIntentSetMode(
      //           type: SpacesModuleLightingIntentType.setMode,
      //           mode: SpacesModuleLightingMode.work,
      //         ),
      //       ),
      //     ),
      //   LightingMode.relax => ... (mode: SpacesModuleLightingMode.relax),
      //   LightingMode.night => ... (mode: SpacesModuleLightingMode.night),
      // };
      // await spacesApi.createSpacesModuleSpaceLightingIntent(
      //   id: widget.page.spaceId,
      //   spacesModuleCreateSpaceLightingIntentReq: request,
      // );
      //
      // For now, simulate the action with a delay
      await Future.delayed(const Duration(milliseconds: 500));

      setState(() {
        _activeMode = mode == LightingMode.off ? null : mode;
      });

      if (mounted) {
        AlertBar.showSuccess(
          context,
          message: _actionSuccess,
        );
      }
    } catch (e) {
      if (mounted) {
        final localizations = AppLocalizations.of(context)!;
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
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
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.page.showTopBar
          ? AppTopBar(
              title: widget.page.title,
              icon: widget.page.icon ?? MdiIcons.homeOutline,
            )
          : null,
      body: SafeArea(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Lighting controls section
              _buildLightingControlsSection(context),
              AppSpacings.spacingLgVertical,
              // Placeholder for device list
              Expanded(
                child: _buildDevicesSection(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLightingControlsSection(BuildContext context) {
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
                  MdiIcons.lightbulbGroupOutline,
                  size: _screenService.scale(
                    24,
                    density: _visualDensityService.density,
                  ),
                ),
                AppSpacings.spacingSmHorizontal,
                Text(
                  _lightingControlsTitle,
                  style: TextStyle(
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            AppSpacings.spacingMdVertical,
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildLightingModeButton(
                  context,
                  LightingMode.off,
                  MdiIcons.power,
                  _modeOff,
                  isActive: _activeMode == null,
                ),
                _buildLightingModeButton(
                  context,
                  LightingMode.work,
                  MdiIcons.desktopClassic,
                  _modeWork,
                  isActive: _activeMode == LightingMode.work,
                ),
                _buildLightingModeButton(
                  context,
                  LightingMode.relax,
                  MdiIcons.sofaOutline,
                  _modeRelax,
                  isActive: _activeMode == LightingMode.relax,
                ),
                _buildLightingModeButton(
                  context,
                  LightingMode.night,
                  MdiIcons.weatherNight,
                  _modeNight,
                  isActive: _activeMode == LightingMode.night,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLightingModeButton(
    BuildContext context,
    LightingMode mode,
    IconData icon,
    String label, {
    bool isActive = false,
  }) {
    final buttonSize = _screenService.scale(
      60,
      density: _visualDensityService.density,
    );

    return Column(
      children: [
        SizedBox(
          width: buttonSize,
          height: buttonSize,
          child: _isLoading
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
                            ? (isActive
                                ? AppFilledButtonsLightThemes.primary
                                : AppFilledButtonsLightThemes.info)
                            : (isActive
                                ? AppFilledButtonsDarkThemes.primary
                                : AppFilledButtonsDarkThemes.info),
                  ),
                  child: FilledButton(
                    onPressed: () => _executeLightingIntent(mode),
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
                      icon,
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
          label,
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
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

  Widget _buildDevicesSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              MdiIcons.formatListBulleted,
              size: _screenService.scale(
                20,
                density: _visualDensityService.density,
              ),
            ),
            AppSpacings.spacingSmHorizontal,
            Text(
              _devicesTitle,
              style: TextStyle(
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        AppSpacings.spacingSmVertical,
        Expanded(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  MdiIcons.homeOutline,
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
                  _devicesPlaceholder,
                  style: TextStyle(
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.placeholder
                        : AppTextColorDark.placeholder,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
