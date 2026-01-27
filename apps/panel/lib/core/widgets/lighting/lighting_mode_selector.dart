import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/lighting/lighting_types.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Lighting mode/capability selector widget.
///
/// Displays tabs for switching between different lighting capabilities
/// (brightness, color temperature, color, white channel).
///
/// Supports both horizontal (portrait) and vertical (landscape) orientations.
class LightingModeSelector extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Set of available capabilities (excluding power-only)
  final Set<LightCapability> capabilities;

  /// Currently selected capability
  final LightCapability selectedCapability;

  /// Called when capability selection changes
  final ValueChanged<LightCapability> onCapabilityChanged;

  /// Whether to use vertical orientation (for landscape layouts)
  final bool isVertical;

  /// Whether to show labels (defaults to true for horizontal, false for vertical)
  final bool? showLabels;

  LightingModeSelector({
    super.key,
    required this.capabilities,
    required this.selectedCapability,
    required this.onCapabilityChanged,
    this.isVertical = false,
    this.showLabels,
  });

  double _scale(double s) =>
      _screenService.scale(s, density: _visualDensityService.density);

  /// Get the ordered list of enabled capabilities (excluding power)
  List<LightCapability> get _enabledCapabilities {
    return [
      LightCapability.brightness,
      LightCapability.colorTemp,
      LightCapability.color,
      LightCapability.white,
    ].where((cap) => capabilities.contains(cap)).toList();
  }

  IconData _getCapabilityIcon(LightCapability cap) {
    switch (cap) {
      case LightCapability.brightness:
        return Icons.brightness_6;
      case LightCapability.colorTemp:
        return Icons.thermostat;
      case LightCapability.color:
        return Icons.palette;
      case LightCapability.white:
        return Icons.wb_incandescent;
      default:
        return Icons.lightbulb;
    }
  }

  String _getCapabilityLabel(LightCapability cap, AppLocalizations localizations) {
    switch (cap) {
      case LightCapability.brightness:
        return localizations.light_mode_brightness;
      case LightCapability.colorTemp:
        return localizations.light_mode_temperature;
      case LightCapability.color:
        return localizations.light_mode_color;
      case LightCapability.white:
        return localizations.light_mode_white;
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final enabledCaps = _enabledCapabilities;

    // Don't render if only one capability
    if (enabledCaps.length <= 1) return const SizedBox.shrink();

    final modes = enabledCaps.map((cap) {
      return ModeOption<LightCapability>(
        value: cap,
        icon: _getCapabilityIcon(cap),
        label: _getCapabilityLabel(cap, localizations),
      );
    }).toList();

    if (isVertical) {
      return _buildVerticalSelector(context, modes);
    }

    return _buildHorizontalSelector(context, modes);
  }

  Widget _buildVerticalSelector(
    BuildContext context,
    List<ModeOption<LightCapability>> modes,
  ) {
    return ModeSelector<LightCapability>(
      modes: modes,
      selectedValue: selectedCapability,
      onChanged: (value) {
        HapticFeedback.selectionClick();
        onCapabilityChanged(value);
      },
      orientation: ModeSelectorOrientation.vertical,
      showLabels: showLabels ?? false,
    );
  }

  Widget _buildHorizontalSelector(
    BuildContext context,
    List<ModeOption<LightCapability>> modes,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: AppSpacings.paddingMd,
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.light : AppFillColorLight.light,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
          width: _scale(1),
        ),
      ),
      child: ModeSelector<LightCapability>(
        modes: modes,
        selectedValue: selectedCapability,
        iconPlacement: ModeSelectorIconPlacement.top,
        onChanged: (value) {
          HapticFeedback.selectionClick();
          onCapabilityChanged(value);
        },
        orientation: ModeSelectorOrientation.horizontal,
        showLabels: showLabels ?? !_screenService.isSmallScreen,
      ),
    );
  }
}
