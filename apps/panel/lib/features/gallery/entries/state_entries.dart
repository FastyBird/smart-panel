import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_details_sheet.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_indicator.dart';
import 'package:fastybird_smart_panel/core/widgets/skeleton.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_scope.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_sections.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/domain_state_view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// DR-9: the loading skeleton, the state templates, the outcome indicator
/// and the outcome details.
const List<GalleryEntry> stateEntries = [
  GalleryEntry(title: 'Loading skeleton: page', builder: _page),
  GalleryEntry(title: 'Loading skeleton: hero', builder: _hero),
  GalleryEntry(
    title: 'State templates: error, empty, not configured, blocked',
    builder: _templates,
  ),
  GalleryEntry(
    title: 'Outcome indicator: every outcome; Partial opens details',
    builder: _outcomes,
  ),
  GalleryEntry(title: 'Outcome details', builder: _details),
];

ScreenSizeClass _class(BuildContext context) =>
    GalleryScope.of(context).sizeClass;

/// Samples are at most this wide, so they fit the narrowest canvas.
Widget _narrow(Widget child, {double width = 360}) => ConstrainedBox(
  constraints: BoxConstraints(maxWidth: AppSpacings.scale(width)),
  child: child,
);

Widget _page(BuildContext context) {
  final scope = GalleryScope.of(context);
  final landscape = scope.orientation == Orientation.landscape;

  return SizedBox(
    height: AppSpacings.scale(landscape ? 200 : 320),
    child: DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).neutrals.surfacePage,
        border: Border.all(
          color: Theme.of(context).neutrals.borderLight,
          width: AppSpacings.scale(1),
        ),
      ),
      child: PageSkeleton(landscape: landscape, sizeClass: scope.sizeClass),
    ),
  );
}

Widget _hero(BuildContext context) => _narrow(
  SizedBox(
    height: AppSpacings.scale(220),
    child: HeroSkeleton(sizeClass: _class(context)),
  ),
);

Widget _templates(BuildContext context) {
  final sizeClass = _class(context);
  final localizations = AppLocalizations.of(context)!;

  Widget sample(Widget template) => Padding(
    padding: EdgeInsets.symmetric(vertical: AppSpacings.pMd),
    child: Center(child: template),
  );

  return _narrow(
    Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        sample(
          StateTemplate(
            state: AppScreenState.error,
            title: localizations.domain_data_load_failed('Lights'),
            message: 'The gateway answered with an error.',
            onAction: () {},
            sizeClass: sizeClass,
          ),
        ),
        sample(
          StateTemplate(
            state: AppScreenState.empty,
            title: 'No tiles on this page yet',
            message: 'Add tiles to this page in the admin app.',
            icon: MdiIcons.viewGridOutline,
            sizeClass: sizeClass,
          ),
        ),
        sample(
          StateTemplate(
            state: AppScreenState.notConfigured,
            title: 'No lighting roles assigned',
            message: 'Give the devices in this room a role in the admin app.',
            icon: MdiIcons.lightbulbOffOutline,
            domain: ThemeColors.lights,
            sizeClass: sizeClass,
          ),
        ),
        sample(
          StateTemplate(
            state: AppScreenState.blocked,
            title: 'Settings locked',
            message: 'Enter the code to change settings on this panel.',
            actionLabel: 'Unlock',
            onAction: () {},
            sizeClass: sizeClass,
          ),
        ),
      ],
    ),
  );
}

List<OutcomeDetailRow> _rows(BuildContext context) {
  final theme = Theme.of(context);

  return [
    OutcomeDetailRow(
      icon: MdiIcons.lightbulbOutline,
      iconColor: theme.domain(ThemeColors.lights).base,
      label: 'Lights',
      outcome: AppOutcome.completed,
    ),
    OutcomeDetailRow(
      icon: MdiIcons.thermometer,
      iconColor: theme.domain(ThemeColors.climate).base,
      label: 'Climate',
      outcome: AppOutcome.completed,
    ),
    OutcomeDetailRow(
      icon: MdiIcons.blindsHorizontal,
      iconColor: theme.domain(ThemeColors.shading).base,
      label: 'Shading',
      outcome: AppOutcome.partial,
    ),
    OutcomeDetailRow(
      icon: MdiIcons.play,
      iconColor: theme.domain(ThemeColors.media).base,
      label: 'Media',
      outcome: AppOutcome.noDevices,
    ),
    OutcomeDetailRow(
      icon: MdiIcons.shieldOutline,
      label: 'Security',
      outcome: AppOutcome.notSupported,
    ),
  ];
}

Widget _outcomes(BuildContext context) {
  final sizeClass = _class(context);
  final localizations = AppLocalizations.of(context)!;

  final samples = <Widget>[
    OutcomeIndicator(outcome: AppOutcome.pending, sizeClass: sizeClass),
    OutcomeIndicator(
      outcome: AppOutcome.pending,
      label: outcomeLine([
        localizations.outcome_sent,
        'waiting for the thermostat',
      ]),
      sizeClass: sizeClass,
    ),
    OutcomeIndicator(outcome: AppOutcome.completed, sizeClass: sizeClass),
    OutcomeIndicator(
      outcome: AppOutcome.partial,
      label: outcomeLine([
        localizations.outcome_partial,
        '1 light did not answer',
      ]),
      onDetails: () => showOutcomeDetailsSheet(
        context,
        title: 'Room mode: Relax',
        subtitle: 'Sent 21:30 · 1 part did not complete',
        rows: _rows(context),
        actionLabel: 'Retry Relax',
        onAction: () {},
      ),
      sizeClass: sizeClass,
    ),
    OutcomeIndicator(outcome: AppOutcome.failed, sizeClass: sizeClass),
    OutcomeIndicator(outcome: AppOutcome.superseded, sizeClass: sizeClass),
    OutcomeIndicator(outcome: AppOutcome.notConfirmed, sizeClass: sizeClass),
    OutcomeIndicator(
      outcome: AppOutcome.notConfirmed,
      label: outcomeLine([
        localizations.outcome_timed_out,
        localizations.outcome_refresh_before_retry,
      ]),
      sizeClass: sizeClass,
    ),
    OutcomeIndicator(outcome: AppOutcome.conflict, sizeClass: sizeClass),
    OutcomeIndicator(outcome: AppOutcome.mixed, sizeClass: sizeClass),
    OutcomeIndicator(outcome: AppOutcome.unavailable, sizeClass: sizeClass),
    OutcomeIndicator(
      outcome: AppOutcome.unavailable,
      label: localizations.outcome_last_update('12 min'),
      sizeClass: sizeClass,
    ),
    OutcomeIndicator(
      outcome: AppOutcome.offline,
      label: localizations.device_offline_line('21:10'),
      sizeClass: sizeClass,
    ),
  ];

  return _narrow(
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: AppSpacings.pSm,
      children: samples,
    ),
  );
}

Widget _details(BuildContext context) {
  final neutrals = Theme.of(context).neutrals;

  return _narrow(
    Container(
      padding: EdgeInsets.all(AppSpacings.pMdLg),
      decoration: BoxDecoration(
        color: neutrals.surfaceRaised,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: neutrals.borderLight,
          width: AppSpacings.scale(1),
        ),
      ),
      child: OutcomeDetailsList(
        rows: _rows(context),
        sizeClass: _class(context),
      ),
    ),
  );
}
