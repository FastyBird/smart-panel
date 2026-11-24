import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The outcome of a command, one per row of the outcome table
/// (docs/display-ui-design-spec.md §7), plus the two statuses the details
/// sheet lists per part (§8).
enum AppOutcome {
  /// Sending, pending or accepted: "Setting", "Sent · waiting for the
  /// thermostat".
  pending,

  /// Confirmed or completed.
  completed,

  /// Some parts did not complete: "Partial · 1 light did not answer".
  partial,

  /// Failed or refused.
  failed,

  /// Interrupted or superseded: "Replaced by a newer request".
  superseded,

  /// Timed out, unconfirmed or unknown: "Not confirmed", "Timed out · refresh
  /// before retrying". Never the same look as [pending].
  notConfirmed,

  /// Changed from somewhere else.
  conflict,

  /// Members report different values; the word takes the numeral's place.
  mixed,

  /// Unavailable or stale: "No data", "Last update 12 min ago", "Not
  /// reporting".
  unavailable,

  /// The device is offline: "Offline · last seen 21:10".
  offline,

  /// A part with no devices (details sheet rows).
  noDevices,

  /// A part that does not support the command (details sheet rows).
  notSupported,
}

/// The outcome indicator's sizes (design canvas, the domain view's feedback
/// line and pill).
class OutcomeMetrics {
  OutcomeMetrics._();

  static const double icon = 12;
  static const double gap = 4;

  /// The warning pill: 24 high, and taller with a larger text size.
  static const double pillHeight = 24;
  static const double pillPadding = 8;
  static const double pillVerticalPadding = 2;

  /// A tappable pill's touch zone (spec §4).
  static const double touch = 36;

  /// The label: 10, or 12 on Expanded.
  static double fontFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.expanded ? 12 : 10;
}

/// How an outcome looks: its icon and colour, and whether it is a pill.
@immutable
class OutcomeStyle {
  const OutcomeStyle({
    required this.icon,
    required this.color,
    this.soft,
    this.border,
    required this.opensDetails,
  });

  /// Null for [AppOutcome.mixed]: the word stands alone.
  final IconData? icon;

  /// The icon and label colour.
  final Color color;

  /// A pill's tint and outline; null for a plain line.
  final Color? soft;
  final Color? border;

  /// Whether the outcome has a details layer (spec §7, "Opens details").
  final bool opensDetails;

  bool get isPill => soft != null;

  static OutcomeStyle of(ThemeData theme, AppOutcome outcome) {
    final neutrals = theme.neutrals;
    final ok = theme.status(AppStatus.ok);
    final warning = theme.status(AppStatus.warning);
    final info = theme.status(AppStatus.info);

    OutcomeStyle pill(IconData icon, AppStatusPalette palette) => OutcomeStyle(
      icon: icon,
      color: palette.text,
      soft: palette.soft,
      border: palette.border,
      opensDetails: true,
    );

    return switch (outcome) {
      AppOutcome.pending => OutcomeStyle(
        icon: MdiIcons.refresh,
        color: neutrals.textSecondary,
        opensDetails: false,
      ),
      AppOutcome.completed => OutcomeStyle(
        icon: MdiIcons.check,
        color: ok.text,
        opensDetails: false,
      ),
      AppOutcome.partial ||
      AppOutcome.failed ||
      AppOutcome.notConfirmed ||
      AppOutcome.conflict => pill(MdiIcons.alertOutline, warning),
      AppOutcome.superseded => pill(MdiIcons.informationOutline, info),
      AppOutcome.mixed => OutcomeStyle(
        icon: null,
        color: neutrals.textSecondary,
        opensDetails: false,
      ),
      AppOutcome.unavailable => OutcomeStyle(
        icon: MdiIcons.clockAlertOutline,
        color: warning.text,
        opensDetails: false,
      ),
      AppOutcome.offline => OutcomeStyle(
        icon: MdiIcons.alertOutline,
        color: warning.text,
        opensDetails: false,
      ),
      AppOutcome.noDevices || AppOutcome.notSupported => OutcomeStyle(
        icon: MdiIcons.informationOutline,
        color: info.text,
        opensDetails: false,
      ),
    };
  }
}

/// The short label of an [outcome] (spec §7, §8): "Setting", "Completed",
/// "Partial", "Not confirmed"…
String outcomeLabel(AppLocalizations localizations, AppOutcome outcome) =>
    switch (outcome) {
      AppOutcome.pending => localizations.outcome_setting,
      AppOutcome.completed => localizations.outcome_completed,
      AppOutcome.partial => localizations.outcome_partial,
      AppOutcome.failed => localizations.outcome_failed,
      AppOutcome.superseded => localizations.outcome_superseded,
      AppOutcome.notConfirmed => localizations.outcome_not_confirmed,
      AppOutcome.conflict => localizations.outcome_conflict,
      AppOutcome.mixed => localizations.outcome_mixed,
      AppOutcome.unavailable => localizations.outcome_no_data,
      AppOutcome.offline => localizations.device_status_offline,
      AppOutcome.noDevices => localizations.outcome_no_devices,
      AppOutcome.notSupported => localizations.outcome_not_supported,
    };

/// Joins the parts of an outcome line with " · ", skipping empty ones:
/// `outcomeLine(['Partial', '1 light did not answer'])`.
String outcomeLine(Iterable<String?> parts) =>
    parts.whereType<String>().where((part) => part.isNotEmpty).join(' · ');

/// The one outcome indicator (spec §7): an icon and a short label.
///
/// - Setting, Completed, Mixed, No data and Offline are a plain line.
/// - Partial, Failed, Not confirmed and Changed elsewhere are a warning pill;
///   Replaced by a newer request an info pill. Never confirmed therefore
///   never looks like Setting.
/// - With [onDetails] the indicator ends with a chevron and opens the details
///   layer; screen readers hear "{label}. Show details".
///
/// The label is one line and ellipsizes; anything longer belongs in the
/// details layer (spec §8).
class OutcomeIndicator extends StatelessWidget {
  const OutcomeIndicator({
    super.key,
    required this.outcome,
    this.label,
    this.icon,
    this.onDetails,
    this.sizeClass,
  });

  final AppOutcome outcome;

  /// Defaults to [outcomeLabel]; pass a longer line such as
  /// `outcomeLine([partial, '1 light did not answer'])`.
  final String? label;

  /// Replaces the outcome's icon (a clock for stale data, for one).
  final IconData? icon;

  /// Opens the details layer.
  final VoidCallback? onDetails;

  /// The class to size for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final localizations = AppLocalizations.of(context)!;
    final style = OutcomeStyle.of(theme, outcome);
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final text = label ?? outcomeLabel(localizations, outcome);
    final effectiveIcon = icon ?? style.icon;
    final fontSize = AppSpacings.scale(OutcomeMetrics.fontFor(resolvedClass));
    final iconSize = AppSpacings.scale(OutcomeMetrics.icon);
    final gap = AppSpacings.scale(OutcomeMetrics.gap);
    final tappable = onDetails != null;

    WidgetSpan iconSpan(IconData data, {required bool leading}) => WidgetSpan(
      alignment: PlaceholderAlignment.middle,
      child: Padding(
        padding: EdgeInsetsDirectional.only(
          end: leading ? gap : 0,
          start: leading ? 0 : gap,
        ),
        child: Icon(data, size: iconSize, color: style.color),
      ),
    );

    // One text with the icons inline: natural width when there is room,
    // ellipsized when not, also in a row without a width to share.
    final line = Text.rich(
      TextSpan(
        children: [
          if (effectiveIcon != null) iconSpan(effectiveIcon, leading: true),
          TextSpan(text: text),
          if (tappable) iconSpan(MdiIcons.chevronRight, leading: false),
        ],
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: style.color,
        fontSize: fontSize,
        fontWeight: style.isPill ? FontWeight.w500 : FontWeight.w400,
      ),
    );

    Widget indicator = style.isPill
        ? Container(
            constraints: BoxConstraints(
              minHeight: AppSpacings.scale(OutcomeMetrics.pillHeight),
            ),
            padding: EdgeInsets.symmetric(
              horizontal: AppSpacings.scale(OutcomeMetrics.pillPadding),
              vertical: AppSpacings.scale(OutcomeMetrics.pillVerticalPadding),
            ),
            decoration: BoxDecoration(
              color: style.soft,
              borderRadius: BorderRadius.circular(AppBorderRadius.pill),
              border: Border.all(
                color: style.border!,
                width: AppSpacings.scale(1),
              ),
            ),
            // Shrinks to the label; a Container alignment would stretch.
            child: Center(widthFactor: 1, heightFactor: 1, child: line),
          )
        : line;

    if (tappable) {
      indicator = InkWell(
        onTap: onDetails,
        borderRadius: BorderRadius.circular(AppBorderRadius.pill),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: AppSpacings.scale(OutcomeMetrics.touch),
          ),
          child: Align(
            alignment: AlignmentDirectional.centerStart,
            widthFactor: 1,
            heightFactor: 1,
            child: indicator,
          ),
        ),
      );
    }

    return Semantics(
      container: true,
      button: tappable ? true : null,
      label: tappable ? localizations.outcome_show_details(text) : text,
      onTap: onDetails,
      excludeSemantics: true,
      child: Material(type: MaterialType.transparency, child: indicator),
    );
  }
}
