import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/automations/models/automation.dart';
import 'package:fastybird_smart_panel/modules/automations/service.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_metrics.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The automations owned by the space, each with its status and an enable
/// switch, in one card under an "Automations" label (design canvas, "Room
/// overview"). Nothing else about an automation can be changed on the panel.
/// Hidden while the space has no automations.
///
/// Listed on the overview on Expanded, in the mode details on Regular and in
/// the mode chooser on Compact (docs/display-ui-design-spec.md §4).
class AutomationsSection extends StatelessWidget {
  const AutomationsSection({super.key, required this.spaceId, this.service});

  final String spaceId;
  final AutomationsService? service;

  String _status(AppLocalizations l, AutomationView automation) {
    final parts = <String>[
      automation.enabled ? l.space_automations_on : l.space_automations_off,
      if (automation.status == AutomationStatus.invalid)
        l.space_automations_invalid
      else if (automation.status == AutomationStatus.suspended)
        l.space_automations_suspended
      else if (automation.lastRunStatus == AutomationRunStatus.failed)
        l.space_automations_last_failed,
    ];

    return parts.join(' · ');
  }

  /// Whether the status needs attention: shown in the warning colour with
  /// an alert icon.
  bool _attention(AutomationView automation) =>
      automation.status == AutomationStatus.invalid ||
      automation.status == AutomationStatus.suspended ||
      automation.lastRunStatus == AutomationRunStatus.failed;

  Future<void> _toggle(
    BuildContext context,
    AutomationsService service,
    AutomationView automation,
    bool enabled,
  ) async {
    final l = AppLocalizations.of(context)!;
    final result = await service.setEnabled(automation.id, enabled);

    if (!context.mounted) return;

    final message = switch (result) {
      AutomationToggleResult.success || AutomationToggleResult.ignored => null,
      AutomationToggleResult.incomplete =>
        l.space_automations_toggle_incomplete,
      AutomationToggleResult.notFound => l.space_automations_toggle_not_found,
      AutomationToggleResult.failed => l.space_automations_toggle_failed,
    };

    if (message != null) Toast.showError(context, message: message);
  }

  @override
  Widget build(BuildContext context) {
    final automationsService = service ?? locator<AutomationsService>();

    return ListenableBuilder(
      listenable: automationsService,
      builder: (context, _) {
        final automations = automationsService.automationsForSpace(spaceId);

        if (automations.isEmpty) return const SizedBox.shrink();

        final l = AppLocalizations.of(context)!;
        final theme = Theme.of(context);
        final neutrals = theme.neutrals;
        final warning = theme.status(AppStatus.warning);
        final hairline = AppSpacings.scale(1);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          spacing: AppSpacings.scale(RoomOverviewMetrics.modeGap),
          children: [
            SectionLabel(label: l.space_automations_title),
            Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: neutrals.surfaceCard,
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
                border: Border.all(
                  color: neutrals.borderLight,
                  width: hairline,
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  for (final (i, automation) in automations.indexed)
                    Container(
                      key: ValueKey('automation-${automation.id}'),
                      constraints: BoxConstraints(
                        minHeight: AppSpacings.scale(
                          RoomOverviewMetrics.automationRow,
                        ),
                      ),
                      decoration: BoxDecoration(
                        border: i == 0
                            ? null
                            : Border(
                                top: BorderSide(
                                  color: neutrals.borderLight,
                                  width: hairline,
                                ),
                              ),
                      ),
                      padding: EdgeInsetsDirectional.only(
                        start: AppSpacings.scale(
                          RoomOverviewMetrics.automationPadding,
                        ),
                      ),
                      child: Row(
                        spacing: AppSpacings.pSm,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  automation.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: neutrals.textPrimary,
                                    fontSize: AppSpacings.scale(
                                      RoomOverviewMetrics.automationName,
                                    ),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                Row(
                                  spacing: AppSpacings.scale(4),
                                  children: [
                                    if (_attention(automation))
                                      Icon(
                                        MdiIcons.alertOutline,
                                        size: AppSpacings.scale(
                                          RoomOverviewMetrics.automationStatus,
                                        ),
                                        color: warning.text,
                                      ),
                                    Flexible(
                                      child: Text(
                                        _status(l, automation),
                                        key: ValueKey(
                                          'automation-status-${automation.id}',
                                        ),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: _attention(automation)
                                              ? warning.text
                                              : neutrals.textSecondary,
                                          fontSize: AppSpacings.scale(
                                            RoomOverviewMetrics
                                                .automationStatus,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          AppSwitch(
                            key: ValueKey('automation-switch-${automation.id}'),
                            value: automation.enabled,
                            semanticLabel: automation.name,
                            state: automation.pending
                                ? ControlState.pending
                                : ControlState.idle,
                            onChanged: automation.pending
                                ? null
                                : (enabled) => _toggle(
                                    context,
                                    automationsService,
                                    automation,
                                    enabled,
                                  ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
