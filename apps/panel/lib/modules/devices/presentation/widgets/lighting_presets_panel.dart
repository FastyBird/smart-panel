import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/horizontal_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/tile_wrappers.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/lighting_mode_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Lighting presets panel widget.
///
/// Displays quick preset buttons for the currently selected capability.
/// Supports both portrait (horizontal scroll) and landscape (grid) layouts.
class LightingPresetsPanel extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

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

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final presets = _getPresetsForCapability(selectedCapability, localizations);

    if (presets.isEmpty) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (selectedCapability == LightCapability.color) {
      return isLandscape
          ? _buildLandscapeColorPresets(context, isDark, presets)
          : _buildPortraitColorPresets(context, isDark, presets);
    }

    return isLandscape
        ? _buildLandscapePresets(context, isDark, presets, localizations)
        : _buildPortraitPresets(context, isDark, presets, localizations);
  }

  List<_LightingPreset> _getPresetsForCapability(
    LightCapability capability,
    AppLocalizations localizations,
  ) {
    switch (capability) {
      case LightCapability.brightness:
        return [
          _LightingPreset(
            icon: MdiIcons.brightness5,
            label: '25%',
            value: 25,
            type: _LightingPresetType.brightness,
          ),
          _LightingPreset(
            icon: MdiIcons.brightness6,
            label: '50%',
            value: 50,
            type: _LightingPresetType.brightness,
          ),
          _LightingPreset(
            icon: MdiIcons.brightness7,
            label: '75%',
            value: 75,
            type: _LightingPresetType.brightness,
          ),
          _LightingPreset(
            icon: MdiIcons.whiteBalanceSunny,
            label: '100%',
            value: 100,
            type: _LightingPresetType.brightness,
          ),
        ];
      case LightCapability.colorTemp:
        return [
          _LightingPreset(
            icon: MdiIcons.fire,
            label: localizations.light_preset_candle,
            value: 2700,
            type: _LightingPresetType.colorTemp,
          ),
          _LightingPreset(
            icon: MdiIcons.weatherNight,
            label: localizations.light_preset_warm,
            value: 3200,
            type: _LightingPresetType.colorTemp,
          ),
          _LightingPreset(
            icon: MdiIcons.whiteBalanceSunny,
            label: localizations.light_preset_daylight,
            value: 5000,
            type: _LightingPresetType.colorTemp,
          ),
          _LightingPreset(
            icon: MdiIcons.snowflake,
            label: localizations.light_preset_cool,
            value: 6500,
            type: _LightingPresetType.colorTemp,
          ),
        ];
      case LightCapability.color:
        return [
          _LightingPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_red,
            value: 0,
            type: _LightingPresetType.color,
            color: Colors.red,
          ),
          _LightingPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_orange,
            value: 30,
            type: _LightingPresetType.color,
            color: Colors.orange,
          ),
          _LightingPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_yellow,
            value: 60,
            type: _LightingPresetType.color,
            color: Colors.yellow,
          ),
          _LightingPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_green,
            value: 120,
            type: _LightingPresetType.color,
            color: Colors.green,
          ),
          _LightingPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_cyan,
            value: 180,
            type: _LightingPresetType.color,
            color: Colors.cyan,
          ),
          _LightingPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_blue,
            value: 240,
            type: _LightingPresetType.color,
            color: Colors.blue,
          ),
          _LightingPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_purple,
            value: 270,
            type: _LightingPresetType.color,
            color: Colors.purple,
          ),
          _LightingPreset(
            icon: MdiIcons.circle,
            label: localizations.light_color_pink,
            value: 330,
            type: _LightingPresetType.color,
            color: Colors.pink,
          ),
        ];
      case LightCapability.white:
        return [
          _LightingPreset(
            icon: MdiIcons.brightness5,
            label: '25%',
            value: 25,
            type: _LightingPresetType.white,
          ),
          _LightingPreset(
            icon: MdiIcons.brightness6,
            label: '50%',
            value: 50,
            type: _LightingPresetType.white,
          ),
          _LightingPreset(
            icon: MdiIcons.brightness7,
            label: '75%',
            value: 75,
            type: _LightingPresetType.white,
          ),
          _LightingPreset(
            icon: MdiIcons.whiteBalanceSunny,
            label: '100%',
            value: 100,
            type: _LightingPresetType.white,
          ),
        ];
      default:
        return [];
    }
  }

  bool _isPresetActive(_LightingPreset preset) {
    switch (preset.type) {
      case _LightingPresetType.brightness:
        return (brightness - preset.value).abs() < 5;
      case _LightingPresetType.colorTemp:
        return (colorTemp - preset.value).abs() < 200;
      case _LightingPresetType.color:
        if (color == null) return false;
        final hsv = HSVColor.fromColor(color!);
        final hueDiff = (hsv.hue - preset.value).abs();
        return hueDiff < 15 || (360 - hueDiff) < 15;
      case _LightingPresetType.white:
        return ((whiteChannel ?? 0) - preset.value).abs() < 5;
    }
  }

  void _applyPreset(_LightingPreset preset) {
    HapticFeedback.selectionClick();
    switch (preset.type) {
      case _LightingPresetType.brightness:
        onBrightnessChanged?.call(preset.value);
        break;
      case _LightingPresetType.colorTemp:
        onColorTempChanged?.call(preset.value);
        break;
      case _LightingPresetType.color:
        final presetColor =
            HSVColor.fromAHSV(1, preset.value.toDouble(), 1, 1).toColor();
        onColorChanged?.call(presetColor, 1.0);
        break;
      case _LightingPresetType.white:
        onWhiteChannelChanged?.call(preset.value);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Landscape layouts (grid)
  // --------------------------------------------------------------------------

  Widget _buildLandscapePresets(
    BuildContext context,
    bool isDark,
    List<_LightingPreset> presets,
    AppLocalizations localizations,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        GridView.count(
          crossAxisCount: 2,
          mainAxisSpacing: AppSpacings.pMd,
          crossAxisSpacing: AppSpacings.pMd,
          childAspectRatio: AppTileAspectRatio.square,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: presets.map((preset) {
            final isActive = _isPresetActive(preset);
            return VerticalTileLarge(
              icon: preset.icon,
              name: preset.label,
              isActive: isActive,
              onTileTap: () => _applyPreset(preset),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildLandscapeColorPresets(
    BuildContext context,
    bool isDark,
    List<_LightingPreset> presets,
  ) {
    final localizations = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        GridView.count(
          crossAxisCount: 2,
          mainAxisSpacing: AppSpacings.pMd,
          crossAxisSpacing: AppSpacings.pMd,
          childAspectRatio: AppTileAspectRatio.horizontal,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: presets.map((preset) {
            final isActive = _isPresetActive(preset);
            final presetColor = preset.color ?? Colors.white;
            return GestureDetector(
              onTap: () => _applyPreset(preset),
              child: Container(
                decoration: BoxDecoration(
                  color: presetColor,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  border: isActive
                      ? Border.all(
                          color: presetColor,
                          width: AppSpacings.scale(3),
                        )
                      : null,
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // Portrait layouts (horizontal scroll)
  // --------------------------------------------------------------------------

  Widget _buildPortraitPresets(
    BuildContext context,
    bool isDark,
    List<_LightingPreset> presets,
    AppLocalizations localizations,
  ) {
    final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
        HorizontalScrollWithGradient(
          height: tileHeight,
          layoutPadding: AppSpacings.pLg,
          itemCount: presets.length,
          separatorWidth: AppSpacings.pMd,
          itemBuilder: (context, index) {
            final preset = presets[index];
            return HorizontalTileCompact(
              icon: preset.icon,
              name: preset.label,
              isActive: _isPresetActive(preset),
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
    List<_LightingPreset> presets,
  ) {
    final localizations = AppLocalizations.of(context)!;
    final swatchHeight = AppSpacings.scale(AppTileHeight.horizontal);
    final swatchWidth =
        _screenService.isLargeScreen ? swatchHeight * 2 : swatchHeight;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pMd,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionTitle(
          title: localizations.window_covering_presets_label,
          icon: MdiIcons.viewGrid,
        ),
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
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                  border: Border.all(
                    color: isActive ? presetColor : borderColor,
                    width: isActive ? AppSpacings.scale(3) : AppSpacings.scale(1),
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

// ----------------------------------------------------------------------------
// Internal preset types (used only by LightingPresetsPanel)
// ----------------------------------------------------------------------------

enum _LightingPresetType { brightness, colorTemp, color, white }

class _LightingPreset {
  final IconData icon;
  final String label;
  final int value;
  final _LightingPresetType type;
  final Color? color;

  const _LightingPreset({
    required this.icon,
    required this.label,
    required this.value,
    required this.type,
    this.color,
  });
}
