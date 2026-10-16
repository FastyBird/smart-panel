import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/activity_modes.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Saved selection and command outcomes, never a claim of physical convergence.
class ActivityModesSection extends StatefulWidget {
  final String spaceId;
  final ActivityModesRepository? repository;
  const ActivityModesSection({
    super.key,
    required this.spaceId,
    this.repository,
  });

  @override
  State<ActivityModesSection> createState() => _ActivityModesSectionState();
}

class _ActivityModesSectionState extends State<ActivityModesSection> {
  late ActivityModesRepository _repository;
  ActivityModesRegistry? _registry;
  @override
  void initState() {
    super.initState();
    _registry = widget.repository == null
        ? locator<ActivityModesRegistry>()
        : null;
    _repository = widget.repository ?? _registry!.create();
    _repository.bind(widget.spaceId);
  }

  @override
  void didUpdateWidget(covariant ActivityModesSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.spaceId != oldWidget.spaceId) _repository.bind(widget.spaceId);
  }

  @override
  void dispose() {
    _registry?.release(_repository);
    super.dispose();
  }

  String _label(AppLocalizations l, String mode) => switch (mode) {
    'work' => l.space_activity_work,
    'relax' => l.space_activity_relax,
    'sleep' => l.space_activity_sleep,
    'entertainment' => l.space_activity_entertainment,
    'away' => l.space_activity_away,
    _ => l.space_activity_manual,
  };

  IconData _icon(String mode) => switch (mode) {
    'work' => MdiIcons.briefcase,
    'relax' => MdiIcons.sofaSingle,
    'sleep' => MdiIcons.bedKing,
    'entertainment' => MdiIcons.televisionPlay,
    'away' => MdiIcons.exitRun,
    _ => MdiIcons.handBackRightOutline,
  };

  String _status(AppLocalizations l, String status) => switch (status) {
    'active' => l.space_activity_active,
    'partial' => l.space_activity_partial,
    'failed' => l.space_activity_failed,
    'interrupted' => l.space_activity_interrupted,
    'activating' => l.space_activity_pending,
    'deactivated' => l.space_activity_manual,
    _ => l.space_activity_unavailable,
  };

  String _domain(AppLocalizations l, String domain) => switch (domain) {
    'lighting' => l.domain_lights,
    'climate' => l.domain_climate,
    'covers' => l.domain_shading,
    'media' => l.domain_media,
    'security' => l.space_activity_security,
    _ => l.filter_status_unknown,
  };

  String _domainStatus(AppLocalizations l, String status) => switch (status) {
    'succeeded' => l.space_activity_commands_sent,
    'failed' => l.space_activity_failed,
    'disabled' => l.space_activity_disabled,
    'no_targets' => l.space_activity_no_targets,
    'unsupported' => l.space_activity_unsupported,
    _ => l.filter_status_unknown,
  };

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _repository,
    builder: (context, _) {
      final l = AppLocalizations.of(context)!;
      final r = _repository;
      if (r.spaceId != widget.spaceId) return const SizedBox.shrink();
      if (!r.loading && r.modes.isEmpty && r.issue == null) {
        return const SizedBox.shrink();
      }
      final selected = r.state?.selectedActivityMode?.json;
      final status = r.state?.activityStatus.json;
      final pending = r.busy || status == 'activating';
      final enabled = r.canSubmit && !pending;
      return Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pSm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Text(
                  l.space_activity_title,
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                if (r.loading || pending) ...[
                  SizedBox(width: AppSpacings.pSm),
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ],
                const Spacer(),
                if (r.state != null)
                  IconButton(
                    tooltip: l.space_activity_details,
                    icon: const Icon(Icons.info_outline),
                    onPressed: () => _details(context),
                  ),
              ],
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                spacing: AppSpacings.pSm,
                children: [
                  for (final mode in r.modes)
                    Builder(
                      builder: (_) {
                        final key = mode.activityMode.json!;
                        return FilterChip(
                          label: Text(_label(l, key)),
                          avatar: Icon(_icon(key), size: 18),
                          selected: selected == key,
                          onSelected: enabled
                              ? (_) {
                                  if (selected == key) {
                                    r.deactivate();
                                  } else {
                                    r.activate(mode);
                                  }
                                }
                              : null,
                        );
                      },
                    ),
                  if (selected != null)
                    ActionChip(
                      label: Text(l.space_activity_manual),
                      onPressed: enabled ? r.deactivate : null,
                    ),
                ],
              ),
            ),
            if (r.busy)
              Text(l.space_activity_pending)
            else if (r.issue != null)
              Row(
                children: [
                  Expanded(
                    child: Text(switch (r.issue!) {
                      ActivityModeIssue.unconfirmed =>
                        l.space_activity_unconfirmed,
                      ActivityModeIssue.conflict => l.space_activity_conflict,
                      ActivityModeIssue.unavailable =>
                        l.space_activity_unavailable,
                    }),
                  ),
                  TextButton(
                    onPressed: r.loading ? null : r.refresh,
                    child: Text(l.button_retry),
                  ),
                ],
              )
            else if (status == 'activating')
              Text(l.space_activity_pending)
            else if (status != null)
              Row(
                children: [
                  if (status == 'partial' ||
                      status == 'failed' ||
                      status == 'interrupted')
                    const Icon(Icons.warning_amber_rounded, size: 18),
                  Flexible(
                    child: Text(
                      selected != null &&
                              !r.modes.any(
                                (mode) => mode.activityMode.json == selected,
                              )
                          ? '${_label(l, selected)} · ${_status(l, status)}'
                          : _status(l, status),
                    ),
                  ),
                ],
              )
            else if (r.fresh)
              Text(l.space_activity_manual),
          ],
        ),
      );
    },
  );

  void _details(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final results =
        _repository.state?.activityResults
            .map((result) => result.toJson())
            .toList() ??
        [];
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l.space_activity_details),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l.space_activity_outcome_notice),
              for (final value in results)
                Padding(
                  padding: EdgeInsets.only(top: AppSpacings.pSm),
                  child: Text(
                    '${_domain(l, value['domain'] as String? ?? '')}: ${_domainStatus(l, value['status'] as String? ?? '')}',
                  ),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(MaterialLocalizations.of(context).closeButtonLabel),
          ),
        ],
      ),
    );
  }
}
