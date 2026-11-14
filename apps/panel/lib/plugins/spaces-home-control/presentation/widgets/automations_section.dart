import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/automations/models/automation.dart';
import 'package:fastybird_smart_panel/modules/automations/service.dart';
import 'package:flutter/material.dart';

/// The automations owned by the space, each with its status and an enable
/// switch. Nothing else about an automation can be changed on the panel.
/// Hidden while the space has no automations.
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

        return Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
            vertical: AppSpacings.pSm,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                l.space_automations_title,
                style: theme.textTheme.titleSmall,
              ),
              for (final automation in automations)
                Row(
                  key: ValueKey('automation-${automation.id}'),
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(automation.name),
                          Text(
                            _status(l, automation),
                            key: ValueKey('automation-status-${automation.id}'),
                            style: theme.textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    Semantics(
                      label: automation.name,
                      child: Switch(
                        key: ValueKey('automation-switch-${automation.id}'),
                        value: automation.enabled,
                        onChanged: automation.pending
                            ? null
                            : (enabled) => _toggle(
                                context,
                                automationsService,
                                automation,
                                enabled,
                              ),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}
