import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_indicator.dart';
import 'package:fastybird_smart_panel/core/widgets/right_drawer.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

/// The outcome details rows' sizes (design canvas, "Navigation layers",
/// the details sheet).
class OutcomeDetailsMetrics {
  OutcomeDetailsMetrics._();

  static double rowHeightFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 30,
    ScreenSizeClass.regular => 40,
    ScreenSizeClass.expanded => 48,
  };

  static const double rowPadding = 8;
  static const double rowGap = 4;
  static const double gap = 8;
  static const double icon = 16;
  static const double statusIcon = 12;
  static const double statusGap = 4;

  /// The most of a row the status may take.
  static const double statusShare = 0.5;

  /// The part's name.
  static const double label = 12;

  /// The status: 10 on Compact, 12 otherwise.
  static double statusFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.compact ? 10 : 12;

  /// The note under the rows.
  static const double note = 10;
}

/// One part of an outcome: a room mode's domain, a group's member, a
/// thermostat's zone.
@immutable
class OutcomeDetailRow {
  const OutcomeDetailRow({
    required this.icon,
    required this.label,
    required this.outcome,
    this.iconColor,
    this.status,
  });

  final IconData icon;
  final String label;
  final AppOutcome outcome;

  /// The part's colour (its domain); defaults to `text.secondary`.
  final Color? iconColor;

  /// Defaults to [outcomeLabel].
  final String? status;
}

/// The rows of the outcome details layer (spec §7, §8): one per part with
/// its short status, and the note that these are command results.
class OutcomeDetailsList extends StatelessWidget {
  const OutcomeDetailsList({
    super.key,
    required this.rows,
    this.note,
    this.sizeClass,
  });

  final List<OutcomeDetailRow> rows;

  /// Defaults to "Results of the commands sent, not what the devices are
  /// doing now."; pass an empty string for none.
  final String? note;

  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final localizations = AppLocalizations.of(context)!;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final effectiveNote = note ?? localizations.outcome_details_note;
    final radius = BorderRadius.circular(AppBorderRadius.base);

    Widget row(OutcomeDetailRow part) {
      final style = OutcomeStyle.of(theme, part.outcome);
      final status = part.status ?? outcomeLabel(localizations, part.outcome);

      return Semantics(
        container: true,
        label: '${part.label}, $status',
        excludeSemantics: true,
        child: Container(
          constraints: BoxConstraints(
            minHeight: AppSpacings.scale(
              OutcomeDetailsMetrics.rowHeightFor(resolvedClass),
            ),
          ),
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.scale(OutcomeDetailsMetrics.rowPadding),
          ),
          decoration: BoxDecoration(
            color: neutrals.fillLight,
            borderRadius: radius,
          ),
          // The status keeps its natural width, up to half the row; the name
          // takes the rest and ellipsizes.
          child: LayoutBuilder(
            builder: (context, constraints) => Row(
              spacing: AppSpacings.scale(OutcomeDetailsMetrics.gap),
              children: [
                Icon(
                  part.icon,
                  size: AppSpacings.scale(OutcomeDetailsMetrics.icon),
                  color: part.iconColor ?? neutrals.textSecondary,
                ),
                Expanded(
                  child: Text(
                    part.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: neutrals.textPrimary,
                      fontSize: AppSpacings.scale(OutcomeDetailsMetrics.label),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth:
                        constraints.maxWidth *
                        OutcomeDetailsMetrics.statusShare,
                  ),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        if (style.icon != null)
                          WidgetSpan(
                            alignment: PlaceholderAlignment.middle,
                            child: Padding(
                              padding: EdgeInsetsDirectional.only(
                                end: AppSpacings.scale(
                                  OutcomeDetailsMetrics.statusGap,
                                ),
                              ),
                              child: Icon(
                                style.icon,
                                size: AppSpacings.scale(
                                  OutcomeDetailsMetrics.statusIcon,
                                ),
                                color: style.color,
                              ),
                            ),
                          ),
                        TextSpan(text: status),
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.end,
                    style: TextStyle(
                      color: style.color,
                      fontSize: AppSpacings.scale(
                        OutcomeDetailsMetrics.statusFor(resolvedClass),
                      ),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: AppSpacings.scale(OutcomeDetailsMetrics.rowGap),
      children: [
        for (final part in rows) row(part),
        if (effectiveNote.isNotEmpty)
          Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacings.scale(OutcomeDetailsMetrics.rowPadding),
              AppSpacings.scale(2),
              AppSpacings.scale(OutcomeDetailsMetrics.rowPadding),
              0,
            ),
            child: Text(
              effectiveNote,
              style: TextStyle(
                color: neutrals.textSecondary,
                fontSize: AppSpacings.scale(OutcomeDetailsMetrics.note),
                height: 1.4,
              ),
            ),
          ),
      ],
    );
  }
}

/// Opens the one outcome details layer (spec §7) for room modes, schedules,
/// groups and thermostats: a bottom sheet in portrait, a right drawer in
/// landscape. [title] names the request ("Room mode: Relax"), [subtitle] when
/// and how it went ("Sent 21:30 · 1 part did not complete"). An optional
/// [actionLabel] ("Retry Relax") closes the layer and calls [onAction].
Future<void> showOutcomeDetailsSheet(
  BuildContext context, {
  required String title,
  String? subtitle,
  required List<OutcomeDetailRow> rows,
  String? note,
  String? actionLabel,
  VoidCallback? onAction,
  bool? landscape,
}) async {
  final screen = locator<ScreenService>();
  final sizeClass = screen.sizeClass;
  final isLandscape = landscape ?? screen.isLandscape;

  // Built inside the layer, so it closes the layer's own route.
  final Widget? action = actionLabel == null || onAction == null
      ? null
      : Builder(
          builder: (layerContext) => AppDialogButton(
            label: actionLabel,
            primary: true,
            sizeClass: sizeClass,
            onTap: () {
              Navigator.of(layerContext).pop();
              onAction();
            },
          ),
        );

  final list = OutcomeDetailsList(rows: rows, note: note, sizeClass: sizeClass);

  if (isLandscape) {
    await showRightDrawer<void>(
      context,
      title: title,
      subtitle: subtitle,
      content: list,
      footerSection: action,
    );

    return;
  }

  showBottomSheetDialog(
    context,
    title: title,
    subtitle: subtitle,
    content: Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.scale(SheetMetrics.paddingFor(sizeClass)),
      ),
      child: list,
    ),
    bottomSection: action,
  );
}
