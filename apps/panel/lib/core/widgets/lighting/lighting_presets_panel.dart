import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/lighting_types.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Lighting presets panel widget.
///
/// Displays quick preset buttons for the currently selected capability.
/// Supports both portrait (horizontal scroll) and landscape (grid) layouts.
class LightingPresetsPanel extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Currently selected capability (determines which presets to show)
  final LightCapability selectedCapability;

  /// Current brightness value (for highlighting active preset)
  final int brightness;

  /// Current color temperature value (for highlighting active preset)
  final int colorTemp;

  /// Current color (for highlighting active preset)
  final Color? color;

  /// Current white channel value (for highlighting active preset)
  final int? whiteChannel;

  /// Whether to use landscape layout (grid instead of horizontal scroll)
  final bool isLandscape;

  /// Called when brightness preset is selected
  final ValueChanged<int>? onBrightnessChanged;

  /// Called when color temperature preset is selected
  final ValueChanged<int>? onColorTempChanged;

  /// Called when color preset is selected (color, saturation)
  final Function(Color, double)? onColorChanged;

  /// Called when white channel preset is selected
  final ValueChanged<int>? onWhiteChannelChanged;

  LightingPresetsPanel({
    super.key,
    required this.selectedCapability,
    this.brightness = 100,
    this.colorTemp = 4000,
    this.color,
    this.whiteChannel,
    this.isLandscape = false,
    this.onBrightnessChanged,
    this.onColorTempChanged,
    this.onColorChanged,
    this.onWhiteChannelChanged,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final presets = _getPresetsForCapability(selectedCapability, localizations);

    if (presets.isEmpty) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Special handling for color presets
    if (selectedCapability == LightCapability.color) {
      return isLandscape
          ? _buildLandscapeColorPresets(context, isDark, presets)
          : _buildPortraitColorPresets(context, isDark, presets);
    }

    return isLandscape
        ? _buildLandscapePresets(context, isDark, presets, localizations)
        : _buildPortraitPresets(context, isDark, presets, localizations);
  }

  List<_LightPreset> _getPresetsForCapability(
    LightCapability capability,
    AppLocalizations localizations,
  ) {
    switch (capability) {
      case LightCapability.brightness:
        return [
          _LightPreset(
            icon: MdiIcons.brightness5,
            label: '25%',
            value: 25,
            type: _PresetType.brightness,
          ),
          _LightPreset(
            icon: MdiIcons.brightness6,
            label: '50%',
            value: 50,
            type: _PresetType.brightness,
          ),
          _LightPreset(
            icon: MdiIcons.brightness7,
            label: '75%',
            value: 75,
            type: _PresetType.brightness,
          ),
          _LightPreset(
            icon: MdiIcons.whiteBalanceSunny,
            label: '100%',
            value: 100,
            type: _PresetType.brightness,
          ),
        ];
      case LightCapability.colorTemp:
        return [
          _LightPreset(
            icon: MdiIcons.fire,
            label: localizations.light_preset_candle,
            value: 2700,
            type: _PresetType.colorTemp,
          ),
          _LightPreset(
            icon: MdiIcons.weatherNight,
            label: localizations.light_preset_warm,
            value: 3200,
            type: _PresetType.colorTemp,
          ),
          _LightPreset(
            icon: MdiIcons.whiteBalanceSunny,
            label: localizations.light_preset_daylight,
            value: 5000,
            type: _PresetType.colorTemp,
          ),
          _LightPreset(
            icon: MdiIcons.snowflake,
            label: localizations.light_preset_cool,
            value: 6500,
            type: _PresetType.colorTemp,
          ),
        ];
      case LightCapability.color:
        return [
          _LightPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_red,
            value: 0,
            type: _PresetType.color,
            color: Colors.red,
          ),
          _LightPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_orange,
            value: 30,
            type: _PresetType.color,
            color: Colors.orange,
          ),
          _LightPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_yellow,
            value: 60,
            type: _PresetType.color,
            color: Colors.yellow,
          ),
          _LightPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_green,
            value: 120,
            type: _PresetType.color,
            color: Colors.green,
          ),
          _LightPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_cyan,
            value: 180,
            type: _PresetType.color,
            color: Colors.cyan,
          ),
          _LightPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_blue,
            value: 240,
            type: _PresetType.color,
            color: Colors.blue,
          ),
          _LightPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_purple,
            value: 270,
            type: _PresetType.color,
            color: Colors.purple,
          ),
          _LightPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_pink,
            value: 330,
            type: _PresetType.color,
            color: Colors.pink,
          ),
        ];
      case LightCapability.white:
        return [
          _LightPreset(
            icon: MdiIcons.brightness5,
            label: '25%',
            value: 25,
            type: _PresetType.white,
          ),
          _LightPreset(
            icon: MdiIcons.brightness6,
            label: '50%',
            value: 50,
            type: _PresetType.white,
          ),
          _LightPreset(
            icon: MdiIcons.brightness7,
            label: '75%',
            value: 75,
            type: _PresetType.white,
          ),
          _LightPreset(
            icon: MdiIcons.whiteBalanceSunny,
            label: '100%',
            value: 100,
            type: _PresetType.white,
          ),
        ];
      default:
        return [];
    }
  }

  bool _isPresetActive(_LightPreset preset) {
    switch (preset.type) {
      case _PresetType.brightness:
        return (brightness - preset.value).abs() < 5;
      case _PresetType.colorTemp:
        return (colorTemp - preset.value).abs() < 200;
      case _PresetType.color:
        if (color == null) return false;
        final hsv = HSVColor.fromColor(color!);
        final hueDiff = (hsv.hue - preset.value).abs();
        return hueDiff < 15 || (360 - hueDiff) < 15;
      case _PresetType.white:
        return ((whiteChannel ?? 0) - preset.value).abs() < 5;
    }
  }

  void _applyPreset(_LightPreset preset) {
    HapticFeedback.selectionClick();
    switch (preset.type) {
      case _PresetType.brightness:
        onBrightnessChanged?.call(preset.value);
        break;
      case _PresetType.colorTemp:
        onColorTempChanged?.call(preset.value);
        break;
      case _PresetType.color:
        final presetColor = HSVColor.fromAHSV(1, preset.value.toDouble(), 1, 1).toColor();
        onColorChanged?.call(presetColor, 1.0);
        break;
      case _PresetType.white:
        onWhiteChannelChanged?.call(preset.value);
        break;
    }
  }

  // ============================================================================
  // LANDSCAPE LAYOUTS
  // ============================================================================

  Widget _buildLandscapePresets(
    BuildContext context,
    bool isDark,
    List<_LightPreset> presets,
    AppLocalizations localizations,
  ) {
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final isLargeScreen = _screenService.isLargeScreen;

    // Large screens: 2 vertical tiles per row (square)
    // Small/medium: 1 horizontal tile per row with fixed height
    if (isLargeScreen) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          SectionTitle(
            title: localizations.window_covering_presets_label,
            icon: MdiIcons.viewGrid,
          ),
          AppSpacings.spacingSmVertical,
          GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacings.pMd,
            crossAxisSpacing: AppSpacings.pMd,
            childAspectRatio: AppTileAspectRatio.square,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: presets.map((preset) {
              final bool isActive = _isPresetActive(preset);

              return VerticalTileLarge(
                icon: preset.icon,
                name: preset.label,
                isActive: isActive,
                activeColor: primaryColor,
                onTileTap: () => _applyPreset(preset),
              );
            }).toList(),
          ),
        ],
      );
    }

    // Small/medium: Column of fixed-height horizontal tiles
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        AppSpacings.spacingSmVertical,
        ...presets.asMap().entries.map((entry) {
          final index = entry.key;
          final preset = entry.value;
          final bool isActive = _isPresetActive(preset);
          final isLast = index == presets.length - 1;

          return Padding(
            padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacings.pMd),
            child: HorizontalTileStretched(
              icon: preset.icon,
              name: preset.label,
              isActive: isActive,
              activeColor: primaryColor,
              onTileTap: () => _applyPreset(preset),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildLandscapeColorPresets(
    BuildContext context,
    bool isDark,
    List<_LightPreset> presets,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final swatchSize = _scale(36);
    final borderColor =
        isDark ? AppBorderColorDark.base : AppBorderColorLight.base;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        AppSpacings.spacingSmVertical,
        GridView.count(
          crossAxisCount: 4,
          mainAxisSpacing: AppSpacings.pSm,
          crossAxisSpacing: AppSpacings.pSm,
          childAspectRatio: 1.0,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: presets.map((preset) {
            final bool isActive = _isPresetActive(preset);
            final presetColor = preset.color ?? Colors.white;

            return GestureDetector(
              onTap: () => _applyPreset(preset),
              child: Container(
                width: swatchSize,
                height: swatchSize,
                decoration: BoxDecoration(
                  color: presetColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  border: Border.all(
                    color: isActive ? presetColor : borderColor,
                    width: isActive ? _scale(3) : _scale(1),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  // ============================================================================
  // PORTRAIT LAYOUTS
  // ============================================================================

  Widget _buildPortraitPresets(
    BuildContext context,
    bool isDark,
    List<_LightPreset> presets,
    AppLocalizations localizations,
  ) {
    final primaryColor =
        isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final tileHeight = _scale(AppTileHeight.horizontal);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: EdgeInsets.only(
            top: AppSpacings.pSm,
          ),
          child: SectionTitle(
            title: localizations.window_covering_presets_label,
            icon: MdiIcons.viewGrid,
          ),
        ),
        AppSpacings.spacingSmVertical,
        HorizontalScrollWithGradient(
          height: tileHeight,
          layoutPadding: AppSpacings.pLg,
          itemCount: presets.length,
          separatorWidth: AppSpacings.pMd,
          itemBuilder: (context, index) {
            final preset = presets[index];
            final isActive = _isPresetActive(preset);

            return HorizontalTileCompact(
              icon: preset.icon,
              name: preset.label,
              isActive: isActive,
              activeColor: primaryColor,
              onTileTap: () => _applyPreset(preset),
            );
          },
        ),
      ],
    );
  }

  Widget _buildPortraitColorPresets(
    BuildContext context,
    bool isDark,
    List<_LightPreset> presets,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final swatchHeight = _scale(AppTileHeight.horizontal);
    final swatchWidth = _screenService.isLargeScreen ? swatchHeight * 2 : swatchHeight;
    final borderColor =
        isDark ? AppBorderColorDark.base : AppBorderColorLight.base;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: EdgeInsets.only(
            top: AppSpacings.pSm,
          ),
          child: SectionTitle(
            title: localizations.window_covering_presets_label,
            icon: MdiIcons.viewGrid,
          ),
        ),
        AppSpacings.spacingSmVertical,
        HorizontalScrollWithGradient(
          height: swatchHeight,
          layoutPadding: AppSpacings.pLg,
          itemCount: presets.length,
          separatorWidth: AppSpacings.pMd,
          itemBuilder: (context, index) {
            final preset = presets[index];
            final isActive = _isPresetActive(preset);
            final presetColor = preset.color ?? Colors.white;

            return GestureDetector(
              onTap: () => _applyPreset(preset),
              child: Container(
                width: swatchWidth,
                height: swatchHeight,
                decoration: BoxDecoration(
                  color: presetColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                  border: Border.all(
                    color: isActive ? presetColor : borderColor,
                    width: isActive ? 3 : 1,
                  ),
                  boxShadow: isActive
                      ? [
                          BoxShadow(
                            color: presetColor.withValues(alpha: 0.5),
                            blurRadius: 8,
                            spreadRadius: 2,
                          ),
                        ]
                      : null,
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

enum _PresetType {
  brightness,
  colorTemp,
  color,
  white,
}

class _LightPreset {
  final IconData icon;
  final String label;
  final int value;
  final _PresetType type;
  final Color? color;

  const _LightPreset({
    required this.icon,
    required this.label,
    required this.value,
    required this.type,
    this.color,
  });
}
