import 'package:fastybird_smart_panel/core/widgets/bottom_navigation.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Available light control modes
enum LightMode {
  /// Power on/off toggle
  off,

  /// Brightness control
  brightness,

  /// Color (hue/saturation) control
  color,

  /// Color temperature control
  temperature,

  /// White channel control
  white,
}

/// Bottom navigation bar for switching between light control modes.
///
/// Provides a consistent navigation experience across device detail
/// and role detail pages.
class LightModeNavigation extends StatelessWidget {
  /// List of available modes based on device capabilities
  final List<LightMode> availableModes;

  /// Currently selected mode
  final LightMode currentMode;

  /// Whether any light is currently on (affects power button label)
  final bool anyOn;

  /// Callback when a mode is selected
  final void Function(LightMode mode) onModeSelected;

  /// Callback when power button is tapped (toggle on/off)
  final VoidCallback onPowerToggle;

  const LightModeNavigation({
    super.key,
    required this.availableModes,
    required this.currentMode,
    required this.anyOn,
    required this.onModeSelected,
    required this.onPowerToggle,
  });

  /// Create available modes list from device capabilities
  static List<LightMode> createModesList({
    required bool hasBrightness,
    required bool hasColor,
    required bool hasTemperature,
    required bool hasWhite,
  }) {
    final modes = <LightMode>[LightMode.off];

    if (hasBrightness) {
      modes.add(LightMode.brightness);
    }
    if (hasColor) {
      modes.add(LightMode.color);
    }
    if (hasTemperature) {
      modes.add(LightMode.temperature);
    }
    if (hasWhite) {
      modes.add(LightMode.white);
    }

    return modes;
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final currentIndex = availableModes.indexOf(currentMode);

    return AppBottomNavigationBar(
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
      enableFloatingNavBar: false,
      onTap: (int index) {
        final selectedMode = availableModes[index];

        if (selectedMode == LightMode.off) {
          // Power button toggles lights
          onPowerToggle();
          // Also switch to brightness mode after toggle
          if (availableModes.contains(LightMode.brightness)) {
            onModeSelected(LightMode.brightness);
          }
        } else {
          onModeSelected(selectedMode);
        }
      },
      items: availableModes.map((mode) {
        return _buildNavigationItem(localizations, mode);
      }).toList(),
    );
  }

  AppBottomNavigationItem _buildNavigationItem(
    AppLocalizations localizations,
    LightMode mode,
  ) {
    switch (mode) {
      case LightMode.off:
        // Show "On" when lights are off, "Off" when lights are on
        return AppBottomNavigationItem(
          icon: Icon(MdiIcons.power),
          label: anyOn
              ? localizations.light_mode_off
              : localizations.light_mode_on,
        );
      case LightMode.brightness:
        return AppBottomNavigationItem(
          icon: Icon(MdiIcons.weatherSunny),
          label: localizations.light_mode_brightness,
        );
      case LightMode.color:
        return AppBottomNavigationItem(
          icon: Icon(MdiIcons.paletteOutline),
          label: localizations.light_mode_color,
        );
      case LightMode.temperature:
        return AppBottomNavigationItem(
          icon: Icon(MdiIcons.thermometer),
          label: localizations.light_mode_temperature,
        );
      case LightMode.white:
        return AppBottomNavigationItem(
          icon: Icon(MdiIcons.lightbulbOutline),
          label: localizations.light_mode_white,
        );
    }
  }
}
