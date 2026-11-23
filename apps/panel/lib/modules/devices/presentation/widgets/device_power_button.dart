import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The device power button. It lives in the page header
/// (docs/display-ui-design-spec.md §5): a [HeaderIconButton] with the power
/// icon, tinted with [themeColor] while the device is on.
class DevicePowerButton extends StatelessWidget {
  const DevicePowerButton({
    super.key,
    required this.isOn,
    this.themeColor,
    this.onTap,
  });

  final bool isOn;

  /// Tint while on; defaults to [ThemeColors.primary] (the accent).
  final ThemeColors? themeColor;

  /// Without it the button is disabled.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context);
    final onTap = this.onTap;

    return HeaderIconButton(
      icon: MdiIcons.power,
      color: isOn ? (themeColor ?? ThemeColors.primary) : ThemeColors.neutral,
      semanticLabel: localizations == null
          ? null
          : isOn
          ? localizations.power_hint_tap_to_turn_off
          : localizations.power_hint_tap_to_turn_on,
      onTap: onTap == null
          ? null
          : () {
              HapticFeedback.mediumImpact();
              onTap();
            },
    );
  }
}

/// "On" or "Off" in the body of a device whose power button moved to the
/// header, until its screen moves onto the redesign.
///
/// A screen shown without its header passes [onTap]: the icon then becomes a
/// [DevicePowerButton], so the device keeps its power control.
class DevicePowerState extends StatelessWidget {
  const DevicePowerState({
    super.key,
    required this.isOn,
    this.themeColor,
    this.onTap,
  });

  final bool isOn;

  /// Colour while on; defaults to [ThemeColors.primary] (the accent).
  final ThemeColors? themeColor;

  /// Toggles the power; only for a screen without its header.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localizations = AppLocalizations.of(context)!;
    final key = themeColor ?? ThemeColors.primary;
    final onColor = key == ThemeColors.primary
        ? theme.accent.text
        : ThemeColorFamily.get(theme.brightness, key).base;

    return Padding(
      padding: AppSpacings.paddingLg,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: AppSpacings.pSm,
          children: [
            if (onTap != null)
              DevicePowerButton(
                isOn: isOn,
                themeColor: themeColor,
                onTap: onTap,
              )
            else
              Icon(
                MdiIcons.power,
                size: AppSpacings.scale(28),
                color: isOn ? onColor : theme.neutrals.textSecondary,
              ),
            Text(
              isOn ? localizations.on_state_on : localizations.on_state_off,
              style: TextStyle(
                fontSize: AppFontSize.extraLarge,
                fontWeight: FontWeight.w500,
                color: isOn ? onColor : theme.neutrals.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
