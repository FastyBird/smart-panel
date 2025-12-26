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

enum ClimateState {
  loading,
  noClimate,
  readOnly,
  controllable,
}

/// Represents a suggestion for the space
class SpaceSuggestion {
  final String type;
  final String title;
  final String? reason;
  final LightingMode? lightingMode;

  SpaceSuggestion({
    required this.type,
    required this.title,
    this.reason,
    this.lightingMode,
  });
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

  // Climate state
  bool _isClimateLoading = false;
  ClimateState _climateState = ClimateState.loading;
  double? _currentTemperature;
  double? _targetTemperature;
  double _minSetpoint = 5.0;
  double _maxSetpoint = 35.0;

  // Suggestion state
  SpaceSuggestion? _suggestion;
  bool _isSuggestionLoading = false;

  // TODO: Replace with localizations after running `flutter gen-l10n`
  // The localization strings are defined in app_en.arb and app_cs.arb
  static const String _lightingControlsTitle = 'Lighting Controls';
  static const String _modeOff = 'Off';
  static const String _modeWork = 'Work';
  static const String _modeRelax = 'Relax';
  static const String _modeNight = 'Night';
  static const String _climateControlsTitle = 'Climate';
  static const String _currentTempLabel = 'Current';
  static const String _targetTempLabel = 'Target';
  static const String _devicesTitle = 'Devices';
  static const String _devicesPlaceholder =
      'Devices in this space will be displayed here';
  static const String _actionSuccess = 'Action completed successfully';
  static const String _suggestionApplied = 'Suggestion applied';
  static const String _suggestionDismissed = 'Suggestion dismissed';

  @override
  void initState() {
    super.initState();
    _loadClimateState();
    _loadSuggestion();
  }

  Future<void> _loadClimateState() async {
    setState(() {
      _climateState = ClimateState.loading;
    });

    try {
      // TODO: Replace with actual API call after running `melos rebuild-api`
      // Example:
      // final spacesApi = locator<SpacesModuleSpacesApi>();
      // final response = await spacesApi.getSpacesModuleSpaceClimate(
      //   id: widget.page.spaceId,
      // );
      // final data = response.data;
      //
      // For now, simulate no climate devices
      await Future.delayed(const Duration(milliseconds: 300));

      if (!mounted) return;

      setState(() {
        // Simulating no climate devices for now
        // When API is integrated:
        // _currentTemperature = data.currentTemperature;
        // _targetTemperature = data.targetTemperature;
        // _minSetpoint = data.minSetpoint;
        // _maxSetpoint = data.maxSetpoint;
        // _climateState = !data.hasClimate
        //     ? ClimateState.noClimate
        //     : data.canSetSetpoint
        //         ? ClimateState.controllable
        //         : ClimateState.readOnly;
        _climateState = ClimateState.noClimate;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _climateState = ClimateState.noClimate;
      });
    }
  }

  Future<void> _loadSuggestion() async {
    setState(() {
      _isSuggestionLoading = true;
    });

    try {
      // TODO: Replace with actual API call after running `melos rebuild-api`
      // Example:
      // final spacesApi = locator<SpacesModuleSpacesApi>();
      // final response = await spacesApi.getSpacesModuleSpaceSuggestion(
      //   id: widget.page.spaceId,
      // );
      // final data = response.data;
      //
      // if (data != null) {
      //   setState(() {
      //     _suggestion = SpaceSuggestion(
      //       type: data.type.name,
      //       title: data.title,
      //       reason: data.reason,
      //       lightingMode: _parseMode(data.lightingMode),
      //     );
      //   });
      // }
      //
      // For now, simulate no suggestion
      await Future.delayed(const Duration(milliseconds: 300));

      if (!mounted) return;

      setState(() {
        _suggestion = null;
        _isSuggestionLoading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _suggestion = null;
        _isSuggestionLoading = false;
      });
    }
  }

  Future<void> _applySuggestion() async {
    if (_suggestion == null || _isSuggestionLoading) return;

    setState(() {
      _isSuggestionLoading = true;
    });

    try {
      // TODO: Replace with actual API call after running `melos rebuild-api`
      // Example:
      // final spacesApi = locator<SpacesModuleSpacesApi>();
      // final request = SpacesModuleCreateSpaceSuggestionFeedbackReq(
      //   data: SpacesModuleSuggestionFeedback(
      //     suggestionType: SpacesModuleSuggestionType.values.byName(_suggestion!.type),
      //     feedback: SpacesModuleSuggestionFeedbackType.applied,
      //   ),
      // );
      // await spacesApi.createSpacesModuleSpaceSuggestionFeedback(
      //   id: widget.page.spaceId,
      //   spacesModuleCreateSpaceSuggestionFeedbackReq: request,
      // );
      //
      // For now, simulate the action
      await Future.delayed(const Duration(milliseconds: 300));

      if (!mounted) return;

      // Update the active mode based on the suggestion
      if (_suggestion?.lightingMode != null) {
        setState(() {
          _activeMode = _suggestion!.lightingMode;
        });
      }

      setState(() {
        _suggestion = null;
        _isSuggestionLoading = false;
      });

      if (mounted) {
        AlertBar.showSuccess(
          context,
          message: _suggestionApplied,
        );
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isSuggestionLoading = false;
      });

      if (mounted) {
        final localizations = AppLocalizations.of(context)!;
        AlertBar.showError(
          context,
          message: localizations.action_failed,
        );
      }
    }
  }

  Future<void> _dismissSuggestion() async {
    if (_suggestion == null || _isSuggestionLoading) return;

    setState(() {
      _isSuggestionLoading = true;
    });

    try {
      // TODO: Replace with actual API call after running `melos rebuild-api`
      // Example:
      // final spacesApi = locator<SpacesModuleSpacesApi>();
      // final request = SpacesModuleCreateSpaceSuggestionFeedbackReq(
      //   data: SpacesModuleSuggestionFeedback(
      //     suggestionType: SpacesModuleSuggestionType.values.byName(_suggestion!.type),
      //     feedback: SpacesModuleSuggestionFeedbackType.dismissed,
      //   ),
      // );
      // await spacesApi.createSpacesModuleSpaceSuggestionFeedback(
      //   id: widget.page.spaceId,
      //   spacesModuleCreateSpaceSuggestionFeedbackReq: request,
      // );
      //
      // For now, simulate the action
      await Future.delayed(const Duration(milliseconds: 200));

      if (!mounted) return;

      setState(() {
        _suggestion = null;
        _isSuggestionLoading = false;
      });

      if (mounted) {
        AlertBar.showInfo(
          context,
          message: _suggestionDismissed,
        );
      }
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _isSuggestionLoading = false;
      });
    }
  }

  Future<void> _adjustSetpoint(bool increase) async {
    if (_isClimateLoading || _climateState != ClimateState.controllable) return;

    setState(() {
      _isClimateLoading = true;
    });

    try {
      // TODO: Replace with actual API call after running `melos rebuild-api`
      // Example:
      // final spacesApi = locator<SpacesModuleSpacesApi>();
      // final request = SpacesModuleCreateSpaceClimateIntentReq(
      //   data: SpacesModuleClimateIntent(
      //     type: SpacesModuleClimateIntentType.setpointDelta,
      //     delta: SpacesModuleSetpointDelta.medium,
      //     increase: increase,
      //   ),
      // );
      // final response = await spacesApi.createSpacesModuleSpaceClimateIntent(
      //   id: widget.page.spaceId,
      //   spacesModuleCreateSpaceClimateIntentReq: request,
      // );
      //
      // if (response.data?.newSetpoint != null) {
      //   setState(() {
      //     _targetTemperature = response.data!.newSetpoint;
      //   });
      // }
      //
      // For now, simulate the action
      await Future.delayed(const Duration(milliseconds: 300));

      if (!mounted) return;

      if (_targetTemperature != null) {
        final delta = 1.0;
        final newSetpoint = increase
            ? _targetTemperature! + delta
            : _targetTemperature! - delta;
        setState(() {
          _targetTemperature =
              newSetpoint.clamp(_minSetpoint, _maxSetpoint);
        });
      }

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
          _isClimateLoading = false;
        });
      }
    }
  }

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
              // Suggestion banner (shown when there's a suggestion)
              if (_suggestion != null) ...[
                _buildSuggestionBanner(context),
                AppSpacings.spacingMdVertical,
              ],
              // Lighting controls section
              _buildLightingControlsSection(context),
              // Climate controls section (only shown if space has climate devices)
              if (_climateState != ClimateState.noClimate) ...[
                AppSpacings.spacingMdVertical,
                _buildClimateControlsSection(context),
              ],
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

  Widget _buildClimateControlsSection(BuildContext context) {
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
                  MdiIcons.thermometer,
                  size: _screenService.scale(
                    24,
                    density: _visualDensityService.density,
                  ),
                ),
                AppSpacings.spacingSmHorizontal,
                Text(
                  _climateControlsTitle,
                  style: TextStyle(
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            AppSpacings.spacingMdVertical,
            if (_climateState == ClimateState.loading)
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Current temperature display
                  _buildTemperatureDisplay(
                    context,
                    _currentTempLabel,
                    _currentTemperature,
                    MdiIcons.thermometerLines,
                  ),
                  // Setpoint controls (if controllable) or target display
                  if (_climateState == ClimateState.controllable)
                    _buildSetpointControls(context)
                  else
                    _buildTemperatureDisplay(
                      context,
                      _targetTempLabel,
                      _targetTemperature,
                      MdiIcons.targetVariant,
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTemperatureDisplay(
    BuildContext context,
    String label,
    double? temperature,
    IconData icon,
  ) {
    final tempText = temperature != null
        ? '${temperature.toStringAsFixed(1)}°C'
        : '--.-°C';

    return Column(
      children: [
        Icon(
          icon,
          size: _screenService.scale(
            32,
            density: _visualDensityService.density,
          ),
          color: Theme.of(context).colorScheme.primary,
        ),
        AppSpacings.spacingXsVertical,
        Text(
          tempText,
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
    );
  }

  Widget _buildSetpointControls(BuildContext context) {
    final targetText = _targetTemperature != null
        ? '${_targetTemperature!.toStringAsFixed(1)}°C'
        : '--.-°C';

    final buttonSize = _screenService.scale(
      44,
      density: _visualDensityService.density,
    );

    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Decrease button
            SizedBox(
              width: buttonSize,
              height: buttonSize,
              child: _isClimateLoading
                  ? _buildLoadingButton(context)
                  : Theme(
                      data: ThemeData(
                        filledButtonTheme:
                            Theme.of(context).brightness == Brightness.light
                                ? AppFilledButtonsLightThemes.info
                                : AppFilledButtonsDarkThemes.info,
                      ),
                      child: FilledButton(
                        onPressed: () => _adjustSetpoint(false),
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
                          MdiIcons.minus,
                          size: _screenService.scale(
                            24,
                            density: _visualDensityService.density,
                          ),
                        ),
                      ),
                    ),
            ),
            AppSpacings.spacingMdHorizontal,
            // Target temperature display
            Column(
              children: [
                Text(
                  targetText,
                  style: TextStyle(
                    fontSize: AppFontSize.large,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  _targetTempLabel,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.regular
                        : AppTextColorDark.regular,
                  ),
                ),
              ],
            ),
            AppSpacings.spacingMdHorizontal,
            // Increase button
            SizedBox(
              width: buttonSize,
              height: buttonSize,
              child: _isClimateLoading
                  ? _buildLoadingButton(context)
                  : Theme(
                      data: ThemeData(
                        filledButtonTheme:
                            Theme.of(context).brightness == Brightness.light
                                ? AppFilledButtonsLightThemes.info
                                : AppFilledButtonsDarkThemes.info,
                      ),
                      child: FilledButton(
                        onPressed: () => _adjustSetpoint(true),
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
                          MdiIcons.plus,
                          size: _screenService.scale(
                            24,
                            density: _visualDensityService.density,
                          ),
                        ),
                      ),
                    ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildLoadingButton(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        color: Theme.of(context).brightness == Brightness.light
            ? AppBgColorLight.page.withValues(alpha: 0.7)
            : AppBgColorDark.overlay.withValues(alpha: 0.7),
      ),
      child: Center(
        child: SizedBox(
          width: _screenService.scale(
            16,
            density: _visualDensityService.density,
          ),
          height: _screenService.scale(
            16,
            density: _visualDensityService.density,
          ),
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: Theme.of(context).colorScheme.primary,
          ),
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

  Widget _buildSuggestionBanner(BuildContext context) {
    final suggestion = _suggestion!;
    final iconSize = _screenService.scale(
      20,
      density: _visualDensityService.density,
    );
    final buttonSize = _screenService.scale(
      36,
      density: _visualDensityService.density,
    );

    return Container(
      padding: AppSpacings.paddingSm,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        color: Theme.of(context).brightness == Brightness.light
            ? AppColors.info.withValues(alpha: 0.15)
            : AppColors.info.withValues(alpha: 0.2),
        border: Border.all(
          color: AppColors.info.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          // Suggestion icon
          Icon(
            MdiIcons.lightbulbOnOutline,
            size: iconSize,
            color: AppColors.info,
          ),
          AppSpacings.spacingSmHorizontal,
          // Suggestion content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  suggestion.title,
                  style: TextStyle(
                    fontSize: AppFontSize.small,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.primary
                        : AppTextColorDark.primary,
                  ),
                ),
                if (suggestion.reason != null) ...[
                  AppSpacings.spacingXxsVertical,
                  Text(
                    suggestion.reason!,
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.regular
                          : AppTextColorDark.regular,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          AppSpacings.spacingSmHorizontal,
          // Action buttons
          if (_isSuggestionLoading)
            SizedBox(
              width: buttonSize,
              height: buttonSize,
              child: Center(
                child: SizedBox(
                  width: iconSize,
                  height: iconSize,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.info,
                  ),
                ),
              ),
            )
          else ...[
            // Apply button
            SizedBox(
              width: buttonSize,
              height: buttonSize,
              child: Theme(
                data: ThemeData(
                  filledButtonTheme:
                      Theme.of(context).brightness == Brightness.light
                          ? AppFilledButtonsLightThemes.primary
                          : AppFilledButtonsDarkThemes.primary,
                ),
                child: FilledButton(
                  onPressed: _applySuggestion,
                  style: ButtonStyle(
                    padding: WidgetStateProperty.all(EdgeInsets.zero),
                    shape: WidgetStateProperty.all(
                      RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppBorderRadius.small),
                      ),
                    ),
                  ),
                  child: Icon(
                    MdiIcons.check,
                    size: iconSize,
                  ),
                ),
              ),
            ),
            AppSpacings.spacingXsHorizontal,
            // Dismiss button
            SizedBox(
              width: buttonSize,
              height: buttonSize,
              child: IconButton(
                onPressed: _dismissSuggestion,
                icon: Icon(
                  MdiIcons.close,
                  size: iconSize,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.regular
                      : AppTextColorDark.regular,
                ),
                padding: EdgeInsets.zero,
                constraints: BoxConstraints(
                  minWidth: buttonSize,
                  minHeight: buttonSize,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
