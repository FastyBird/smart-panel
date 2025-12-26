import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/space_page.dart';
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

enum LightingState {
  loading,
  noLighting,
  available,
}

enum DevicesState {
  loading,
  noDevices,
  sensorsOnly,
  available,
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

  // Lighting state
  LightingState _lightingState = LightingState.loading;

  // Climate state
  bool _isClimateLoading = false;
  ClimateState _climateState = ClimateState.loading;
  double? _currentTemperature;
  double? _targetTemperature;
  final double _minSetpoint = 5.0;
  final double _maxSetpoint = 35.0;

  // Devices state
  DevicesState _devicesState = DevicesState.loading;

  // Lighting status (for header badge)
  int _lightsOnCount = 0;

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

  // Empty state messages
  static const String _emptyStateTitle = 'No Controls Available';
  static const String _emptyStateDescription =
      'This space has no controllable devices configured yet';
  static const String _sensorsOnlyTitle = 'Sensors Only';
  static const String _sensorsOnlyDescription =
      'This space only has sensors — no controllable devices';

  @override
  void initState() {
    super.initState();
    _loadLightingState();
    _loadClimateState();
    _loadDevicesState();
    _loadSuggestion();
  }

  Future<void> _loadLightingState() async {
    setState(() {
      _lightingState = LightingState.loading;
    });

    try {
      // TODO: Replace with actual API call after running `melos rebuild-api`
      // Example:
      // final spacesApi = locator<SpacesModuleSpacesApi>();
      // final response = await spacesApi.getSpacesModuleSpaceLighting(
      //   id: widget.page.spaceId,
      // );
      // final data = response.data;
      //
      // setState(() {
      //   _lightingState = data.hasLighting
      //       ? LightingState.available
      //       : LightingState.noLighting;
      // });
      //
      // For now, simulate lighting available (most spaces will have lights)
      await Future.delayed(const Duration(milliseconds: 300));

      if (!mounted) return;

      setState(() {
        // Default to available for now - when API is integrated this will check actual data
        _lightingState = LightingState.available;
        // Simulated lights on count - when API is integrated:
        // _lightsOnCount = data.lightsOn;
        _lightsOnCount = 0;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _lightingState = LightingState.noLighting;
      });
    }
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

  Future<void> _loadDevicesState() async {
    setState(() {
      _devicesState = DevicesState.loading;
    });

    try {
      // TODO: Replace with actual API call after running `melos rebuild-api`
      // Example:
      // final spacesApi = locator<SpacesModuleSpacesApi>();
      // final response = await spacesApi.getSpacesModuleSpaceDevices(
      //   id: widget.page.spaceId,
      // );
      // final data = response.data;
      //
      // setState(() {
      //   _devicesState = data.devices.isEmpty
      //       ? DevicesState.noDevices
      //       : data.hasControllableDevices
      //           ? DevicesState.available
      //           : DevicesState.sensorsOnly;
      // });
      //
      // For now, simulate no devices (placeholder)
      await Future.delayed(const Duration(milliseconds: 300));

      if (!mounted) return;

      setState(() {
        // Default to noDevices for now - when API is integrated this will check actual data
        _devicesState = DevicesState.noDevices;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _devicesState = DevicesState.noDevices;
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

      // Update the active mode and lights count based on the suggestion
      if (_suggestion?.lightingMode != null) {
        setState(() {
          _activeMode = _suggestion!.lightingMode;
          // Simulate lights on count - when API is integrated:
          // _lightsOnCount = response.data.affectedDevices;
          _lightsOnCount = 3;
        });
      } else if (_suggestion?.type == 'lighting_off') {
        // Handle LIGHTING_OFF suggestion type which has null lightingMode
        setState(() {
          _activeMode = LightingMode.off;
          _lightsOnCount = 0;
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
        // Simulate lights on count - when API is integrated:
        // _lightsOnCount = response.data.affectedDevices;
        _lightsOnCount = mode == LightingMode.off ? 0 : 3;
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

  /// Returns true if we're still loading space capabilities
  bool get _isLoadingCapabilities =>
      _lightingState == LightingState.loading ||
      _climateState == ClimateState.loading ||
      _devicesState == DevicesState.loading;

  /// Returns true if space has lighting controls available
  bool get _hasLighting => _lightingState == LightingState.available;

  /// Returns true if space has climate controls available
  bool get _hasClimate =>
      _climateState == ClimateState.readOnly ||
      _climateState == ClimateState.controllable;

  /// Returns true if space has sensors (read-only devices)
  bool get _hasSensors => _devicesState == DevicesState.sensorsOnly;

  /// Returns true if space has no controllable sections (empty state)
  /// Note: Spaces with sensors should show content with "Sensors Only" message
  bool get _hasNoControls => !_hasLighting && !_hasClimate && !_hasSensors;

  /// Builds the status badges for the header
  List<Widget> _buildStatusBadges(BuildContext context) {
    final badges = <Widget>[];

    // Lighting status badge
    if (_lightingState == LightingState.available) {
      badges.add(_buildLightingBadge(context));
    }

    // Climate status badge (temperature)
    if (_hasClimate && _currentTemperature != null) {
      if (badges.isNotEmpty) {
        badges.add(AppSpacings.spacingSmHorizontal);
      }
      badges.add(_buildClimateBadge(context));
    }

    return badges;
  }

  Widget _buildLightingBadge(BuildContext context) {
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
        border: Border.all(
          color: isOn
              ? (Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.warning.withValues(alpha: 0.3)
                  : AppColorsDark.warning.withValues(alpha: 0.3))
              : (Theme.of(context).brightness == Brightness.light
                  ? AppBorderColorLight.light
                  : AppBorderColorDark.light),
          width: _screenService.scale(
            1,
            density: _visualDensityService.density,
          ),
        ),
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
            isOn ? '$_lightsOnCount' : 'Off',
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

  Widget _buildClimateBadge(BuildContext context) {
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
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.secondaryLight5
              : AppColorsDark.infoLight5,
          width: _screenService.scale(
            1,
            density: _visualDensityService.density,
          ),
        ),
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
            '${_currentTemperature!.toStringAsFixed(1)}°',
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: widget.page.showTopBar
          ? AppTopBar(
              title: widget.page.title,
              icon: widget.page.icon ?? MdiIcons.homeOutline,
              actions: _buildStatusBadges(context),
            )
          : null,
      body: SafeArea(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: _isLoadingCapabilities
              ? _buildLoadingState(context)
              : _hasNoControls
                  ? _buildEmptyState(context)
                  : _buildContent(context),
        ),
      ),
    );
  }

  Widget _buildLoadingState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: _screenService.scale(
              32,
              density: _visualDensityService.density,
            ),
            height: _screenService.scale(
              32,
              density: _visualDensityService.density,
            ),
            child: CircularProgressIndicator(
              strokeWidth: 3,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Suggestion banner (shown when there's a suggestion)
        if (_suggestion != null) ...[
          _buildSuggestionBanner(context),
          AppSpacings.spacingMdVertical,
        ],
        // Empty state card
        Expanded(
          child: Center(
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
                  _emptyStateTitle,
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
                  _emptyStateDescription,
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
          ),
        ),
      ],
    );
  }

  Widget _buildContent(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Suggestion banner (shown when there's a suggestion)
        if (_suggestion != null) ...[
          _buildSuggestionBanner(context),
          AppSpacings.spacingMdVertical,
        ],
        // Lighting controls section (only shown if space has lighting devices)
        if (_hasLighting) ...[
          _buildLightingControlsSection(context),
        ],
        // Climate controls section (only shown if space has climate devices)
        if (_hasClimate) ...[
          if (_hasLighting) AppSpacings.spacingMdVertical,
          _buildClimateControlsSection(context),
        ],
        // Add spacing before devices section only when control sections are displayed
        if (_hasLighting || _hasClimate) AppSpacings.spacingLgVertical,
        // Placeholder for device list
        Expanded(
          child: _buildDevicesSection(context),
        ),
      ],
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
            _buildQuickActionsRow(context),
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

  /// Builds the row of quick action buttons based on configured quick actions.
  Widget _buildQuickActionsRow(BuildContext context) {
    final quickActions = widget.page.quickActions;

    if (quickActions.isEmpty) {
      // Fallback to default lighting controls
      return Row(
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
      );
    }

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: quickActions.map((action) {
        return _buildQuickActionButton(context, action);
      }).toList(),
    );
  }

  /// Builds a single quick action button.
  Widget _buildQuickActionButton(BuildContext context, QuickActionType action) {
    final info = _getQuickActionInfo(action);
    final isActive = _isQuickActionActive(action);

    if (action == QuickActionType.brightnessUp ||
        action == QuickActionType.brightnessDown) {
      return _buildBrightnessButton(context, action, info);
    }

    if (action == QuickActionType.climateUp ||
        action == QuickActionType.climateDown) {
      return _buildClimateButton(context, action, info);
    }

    // For lighting mode buttons, use the existing lighting mode button builder
    final mode = _quickActionToLightingMode(action);
    if (mode != null) {
      return _buildLightingModeButton(
        context,
        mode,
        info.icon,
        info.label,
        isActive: isActive,
      );
    }

    // Fallback: generic button (shouldn't happen for known actions)
    return _buildLightingModeButton(
      context,
      LightingMode.off,
      info.icon,
      info.label,
      isActive: false,
    );
  }

  /// Gets the icon and label for a quick action.
  ({IconData icon, String label}) _getQuickActionInfo(QuickActionType action) {
    switch (action) {
      case QuickActionType.lightingOff:
        return (icon: MdiIcons.power, label: _modeOff);
      case QuickActionType.lightingWork:
        return (icon: MdiIcons.desktopClassic, label: _modeWork);
      case QuickActionType.lightingRelax:
        return (icon: MdiIcons.sofaOutline, label: _modeRelax);
      case QuickActionType.lightingNight:
        return (icon: MdiIcons.weatherNight, label: _modeNight);
      case QuickActionType.brightnessUp:
        return (icon: MdiIcons.brightnessHigh, label: '+');
      case QuickActionType.brightnessDown:
        return (icon: MdiIcons.brightnessLow, label: '-');
      case QuickActionType.climateUp:
        return (icon: MdiIcons.thermometerChevronUp, label: '+');
      case QuickActionType.climateDown:
        return (icon: MdiIcons.thermometerChevronDown, label: '-');
    }
  }

  /// Checks if a quick action is currently active.
  bool _isQuickActionActive(QuickActionType action) {
    switch (action) {
      case QuickActionType.lightingOff:
        return _activeMode == null;
      case QuickActionType.lightingWork:
        return _activeMode == LightingMode.work;
      case QuickActionType.lightingRelax:
        return _activeMode == LightingMode.relax;
      case QuickActionType.lightingNight:
        return _activeMode == LightingMode.night;
      case QuickActionType.brightnessUp:
      case QuickActionType.brightnessDown:
      case QuickActionType.climateUp:
      case QuickActionType.climateDown:
        return false; // Action buttons, not toggles
    }
  }

  /// Converts a quick action to a lighting mode (if applicable).
  LightingMode? _quickActionToLightingMode(QuickActionType action) {
    switch (action) {
      case QuickActionType.lightingOff:
        return LightingMode.off;
      case QuickActionType.lightingWork:
        return LightingMode.work;
      case QuickActionType.lightingRelax:
        return LightingMode.relax;
      case QuickActionType.lightingNight:
        return LightingMode.night;
      default:
        return null;
    }
  }

  /// Builds a brightness control button.
  Widget _buildBrightnessButton(
    BuildContext context,
    QuickActionType action,
    ({IconData icon, String label}) info,
  ) {
    final buttonSize = _screenService.scale(
      60,
      density: _visualDensityService.density,
    );
    final isIncrease = action == QuickActionType.brightnessUp;

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
                            ? AppFilledButtonsLightThemes.info
                            : AppFilledButtonsDarkThemes.info,
                  ),
                  child: FilledButton(
                    onPressed: () => _executeBrightnessIntent(isIncrease),
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
                      info.icon,
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
          info.label,
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

  /// Executes a brightness delta intent.
  Future<void> _executeBrightnessIntent(bool increase) async {
    if (_isLoading) return;

    setState(() {
      _isLoading = true;
    });

    try {
      // TODO: Replace with actual API call after running `melos rebuild-api`
      // Example:
      // final spacesApi = locator<SpacesModuleSpacesApi>();
      // final request = SpacesModuleCreateSpaceLightingIntentReq(
      //   data: SpacesModuleCreateSpaceLightingIntentReqDataUnion
      //       .spacesModuleLightingIntentBrightnessDelta(
      //     SpacesModuleLightingIntentBrightnessDelta(
      //       type: SpacesModuleLightingIntentType.brightnessDelta,
      //       delta: SpacesModuleBrightnessDelta.medium,
      //       increase: increase,
      //     ),
      //   ),
      // );
      // await spacesApi.createSpacesModuleSpaceLightingIntent(
      //   id: widget.page.spaceId,
      //   spacesModuleCreateSpaceLightingIntentReq: request,
      // );
      //
      // For now, simulate the action with a delay
      await Future.delayed(const Duration(milliseconds: 500));

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

  /// Builds a climate control button (temperature up/down).
  Widget _buildClimateButton(
    BuildContext context,
    QuickActionType action,
    ({IconData icon, String label}) info,
  ) {
    final buttonSize = _screenService.scale(
      60,
      density: _visualDensityService.density,
    );
    final isIncrease = action == QuickActionType.climateUp;

    return Column(
      children: [
        SizedBox(
          width: buttonSize,
          height: buttonSize,
          child: _isClimateLoading
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
                            ? AppFilledButtonsLightThemes.info
                            : AppFilledButtonsDarkThemes.info,
                  ),
                  child: FilledButton(
                    onPressed: () => _executeClimateQuickAction(isIncrease),
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
                      info.icon,
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
          info.label,
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

  /// Executes a climate setpoint adjustment via quick action.
  Future<void> _executeClimateQuickAction(bool increase) async {
    // Delegate to existing setpoint adjustment logic
    await _adjustSetpoint(increase);
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
          child: _buildDevicesSectionContent(context),
        ),
      ],
    );
  }

  Widget _buildDevicesSectionContent(BuildContext context) {
    // Loading state
    if (_devicesState == DevicesState.loading) {
      return Center(
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
      );
    }

    // Sensors only state
    if (_devicesState == DevicesState.sensorsOnly) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.eyeOutline,
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
              _sensorsOnlyTitle,
              style: TextStyle(
                fontSize: AppFontSize.small,
                fontWeight: FontWeight.w600,
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
              textAlign: TextAlign.center,
            ),
            AppSpacings.spacingXsVertical,
            Text(
              _sensorsOnlyDescription,
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
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

    // Devices available state
    // TODO: Replace with actual device list when API is integrated
    if (_devicesState == DevicesState.available) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.formatListBulleted,
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
      );
    }

    // No devices state
    return Center(
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
            ? AppColorsLight.info.withValues(alpha: 0.15)
            : AppColorsDark.info.withValues(alpha: 0.2),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.info.withValues(alpha: 0.3)
              : AppColorsDark.info.withValues(alpha: 0.3),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          // Suggestion icon
          Icon(
            MdiIcons.lightbulbOnOutline,
            size: iconSize,
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.info
                : AppColorsDark.info,
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
                  AppSpacings.spacingXsVertical,
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
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppColorsLight.info
                        : AppColorsDark.info,
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
