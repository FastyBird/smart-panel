import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Swatch picker for the panel accent (docs/display-ui-design-spec.md §2, §5).
///
/// One round swatch per [AppAccent]; the selected one has a ring and a check.
/// Below the swatches a preview row shows a primary button, a selected chip
/// and a switch in the chosen accent. "Room default" is not offered until the
/// backend has an accent field on spaces.
class AccentSwatchPicker extends StatelessWidget {
  const AccentSwatchPicker({
    super.key,
    required this.value,
    required this.onChanged,
    this.showPreview = true,
  });

  final AppAccent value;
  final ValueChanged<AppAccent> onChanged;

  /// The preview row; hidden on square panels, where it does not fit.
  final bool showPreview;

  /// The localized name of [accent].
  static String labelFor(AppLocalizations localizations, AppAccent accent) {
    return switch (accent) {
      AppAccent.blue => localizations.accent_blue,
      AppAccent.teal => localizations.accent_teal,
      AppAccent.sage => localizations.accent_sage,
      AppAccent.terracotta => localizations.accent_terracotta,
      AppAccent.rose => localizations.accent_rose,
      AppAccent.violet => localizations.accent_violet,
      AppAccent.sand => localizations.accent_sand,
      AppAccent.graphite => localizations.accent_graphite,
    };
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          container: true,
          label: localizations.settings_display_settings_accent_title,
          child: Wrap(
            spacing: AppSpacings.pSmMd,
            runSpacing: AppSpacings.pSmMd,
            children: [
              for (final accent in AppAccent.values)
                _Swatch(
                  key: ValueKey('accent-swatch-${accent.name}'),
                  color: AppAccentPalette.of(accent, theme.brightness).fill,
                  ringColor: theme.neutrals.textPrimary,
                  label: labelFor(localizations, accent),
                  selected: accent == value,
                  onTap: () => onChanged(accent),
                ),
            ],
          ),
        ),
        if (showPreview) ...[
          SizedBox(height: AppSpacings.pMd),
          _Preview(
            palette: AppAccentPalette.of(value, theme.brightness),
            caption: localizations.settings_display_settings_accent_preview,
            buttonLabel: localizations.settings_display_settings_accent_preview_button,
            chipLabel: localizations.settings_display_settings_accent_preview_chip,
            captionColor: theme.neutrals.textSecondary,
          ),
        ],
      ],
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({
    super.key,
    required this.color,
    required this.ringColor,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final Color color;
  final Color ringColor;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // 36 design px: the touch-target floor (9 mm at density 1.0).
    final outer = AppSpacings.scale(36);
    final inner = AppSpacings.scale(26);

    return Semantics(
      button: true,
      inMutuallyExclusiveGroup: true,
      checked: selected,
      label: label,
      onTap: onTap,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: AppAnimation.fast,
          width: outer,
          height: outer,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: selected ? ringColor : AppColors.blank,
              width: AppSpacings.scale(2),
            ),
          ),
          child: Container(
            width: inner,
            height: inner,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            child: selected
                ? Icon(
                    MdiIcons.check,
                    size: AppSpacings.scale(14),
                    color: AppColors.white,
                  )
                : null,
          ),
        ),
      ),
    );
  }
}

/// A non-interactive sample of the accent: primary button, selected chip and
/// switch.
class _Preview extends StatelessWidget {
  const _Preview({
    required this.palette,
    required this.caption,
    required this.buttonLabel,
    required this.chipLabel,
    required this.captionColor,
  });

  final AppAccentPalette palette;
  final String caption;
  final String buttonLabel;
  final String chipLabel;
  final Color captionColor;

  @override
  Widget build(BuildContext context) {
    final height = AppSpacings.scale(32);
    final labelStyle = TextStyle(
      fontSize: AppFontSize.small,
      fontWeight: FontWeight.w500,
    );

    return Semantics(
      container: true,
      label: caption,
      child: ExcludeSemantics(
        child: Row(
          key: const ValueKey('accent-preview'),
          children: [
            Container(
              key: const ValueKey('accent-preview-button'),
              height: height,
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMdLg),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: palette.fill,
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
              ),
              child: Text(
                buttonLabel,
                style: labelStyle.copyWith(color: palette.onFill),
              ),
            ),
            SizedBox(width: AppSpacings.pMd),
            Container(
              key: const ValueKey('accent-preview-chip'),
              height: height,
              padding: EdgeInsets.symmetric(horizontal: AppSpacings.pMd),
              decoration: BoxDecoration(
                color: palette.soft,
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    MdiIcons.check,
                    size: AppSpacings.scale(14),
                    color: palette.text,
                  ),
                  SizedBox(width: AppSpacings.pSm),
                  Text(
                    chipLabel,
                    style: labelStyle.copyWith(color: palette.text),
                  ),
                ],
              ),
            ),
            SizedBox(width: AppSpacings.pMd),
            Container(
              key: const ValueKey('accent-preview-switch'),
              width: AppSpacings.scale(40),
              height: AppSpacings.scale(22),
              padding: EdgeInsets.all(AppSpacings.scale(2)),
              alignment: Alignment.centerRight,
              decoration: BoxDecoration(
                color: palette.fill,
                borderRadius: BorderRadius.circular(AppBorderRadius.pill),
              ),
              child: Container(
                width: AppSpacings.scale(18),
                height: AppSpacings.scale(18),
                decoration: const BoxDecoration(
                  color: AppColors.white,
                  shape: BoxShape.circle,
                ),
              ),
            ),
            SizedBox(width: AppSpacings.pMd),
            Flexible(
              child: Text(
                caption,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  color: captionColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
