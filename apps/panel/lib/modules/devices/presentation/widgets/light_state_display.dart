import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Displays the current state of a light or group of lights.
///
/// Shows:
/// - For simple lights: "ON" / "OFF" text
/// - For brightness lights: percentage (e.g., "75%")
/// - When mixed state: sync-off icon
class LightStateDisplay extends StatelessWidget {
  /// Average brightness percentage (0-100)
  final int brightness;

  /// Whether any light is on
  final bool anyOn;

  /// Whether the light(s) have brightness control
  final bool hasBrightness;

  /// Whether devices are in mixed state (some on, some off, or different brightness)
  final bool isMixed;

  /// Whether to use singular text (for single device/channel) vs plural (for roles)
  final bool useSingular;

  /// Optional: override the displayed brightness value (for optimistic UI)
  final int? overrideBrightness;

  /// Optional: override the displayed on state (for optimistic UI)
  final bool? overrideAnyOn;

  const LightStateDisplay({
    super.key,
    required this.brightness,
    required this.anyOn,
    required this.hasBrightness,
    this.isMixed = false,
    this.useSingular = false,
    this.overrideBrightness,
    this.overrideAnyOn,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();

    final displayAnyOn = overrideAnyOn ?? anyOn;
    final displayBrightness = overrideBrightness ?? brightness;

    // For simple on/off lights (no brightness)
    if (!hasBrightness) {
      return _buildSimpleStateDisplay(
        context,
        localizations,
        screenService,
        visualDensityService,
        displayAnyOn,
      );
    }

    // For brightness-capable lights
    return _buildBrightnessStateDisplay(
      context,
      localizations,
      screenService,
      visualDensityService,
      displayAnyOn,
      displayBrightness,
    );
  }

  Widget _buildSimpleStateDisplay(
    BuildContext context,
    AppLocalizations localizations,
    ScreenService screenService,
    VisualDensityService visualDensityService,
    bool displayAnyOn,
  ) {
    final textColor = Theme.of(context).brightness == Brightness.light
        ? AppTextColorLight.regular
        : AppTextColorDark.regular;

    final fontSize = screenService.scale(
      60,
      density: visualDensityService.density,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isMixed)
          Icon(
            MdiIcons.syncOff,
            size: fontSize,
            color: textColor,
          )
        else
          Text(
            displayAnyOn
                ? localizations.light_state_on
                : localizations.light_state_off,
            style: TextStyle(
              color: textColor,
              fontSize: fontSize,
              fontFamily: 'DIN1451',
              fontWeight: FontWeight.w100,
              height: 1.0,
            ),
          ),
        Text(
          isMixed
              ? localizations.light_role_not_synced_description
              : (displayAnyOn
                  ? (useSingular
                      ? localizations.light_state_on_description
                      : localizations.light_role_on_description)
                  : (useSingular
                      ? localizations.light_state_off_description
                      : localizations.light_role_off_description)),
          style: TextStyle(
            color: textColor,
            fontSize: AppFontSize.base,
          ),
        ),
      ],
    );
  }

  Widget _buildBrightnessStateDisplay(
    BuildContext context,
    AppLocalizations localizations,
    ScreenService screenService,
    VisualDensityService visualDensityService,
    bool displayAnyOn,
    int displayBrightness,
  ) {
    final textColor = Theme.of(context).brightness == Brightness.light
        ? AppTextColorLight.regular
        : AppTextColorDark.regular;

    final mainFontSize = screenService.scale(
      60,
      density: visualDensityService.density,
    );

    final percentFontSize = screenService.scale(
      25,
      density: visualDensityService.density,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isMixed)
          Icon(
            MdiIcons.syncOff,
            size: mainFontSize,
            color: textColor,
          )
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                displayAnyOn
                    ? '$displayBrightness'
                    : localizations.light_state_off,
                style: TextStyle(
                  color: textColor,
                  fontSize: mainFontSize,
                  fontFamily: 'DIN1451',
                  fontWeight: FontWeight.w100,
                  height: 1.0,
                ),
              ),
              if (displayAnyOn)
                Text(
                  '%',
                  style: TextStyle(
                    color: textColor,
                    fontSize: percentFontSize,
                    fontFamily: 'DIN1451',
                    fontWeight: FontWeight.w100,
                    height: 1.0,
                  ),
                ),
            ],
          ),
        Text(
          isMixed
              ? localizations.light_role_not_synced_description
              : (displayAnyOn
                  ? localizations.light_state_brightness_description
                  : (useSingular
                      ? localizations.light_state_off_description
                      : localizations.light_role_off_description)),
          style: TextStyle(
            color: textColor,
            fontSize: AppFontSize.base,
          ),
        ),
      ],
    );
  }
}
