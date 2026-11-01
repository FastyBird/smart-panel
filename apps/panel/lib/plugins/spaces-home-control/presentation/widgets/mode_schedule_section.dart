import 'package:fastybird_smart_panel/api/models/spaces_home_control_plugin_data_schedule_occurrence.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/mode_schedule.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class ModeScheduleSection extends StatefulWidget {
  const ModeScheduleSection({
    super.key,
    required this.spaceId,
    this.repository,
  });
  final String spaceId;
  final ModeScheduleRepository? repository;
  @override
  State<ModeScheduleSection> createState() => _ModeScheduleSectionState();
}

class _ModeScheduleSectionState extends State<ModeScheduleSection> {
  late ModeScheduleRepository _repository;
  ModeScheduleRegistry? _registry;
  @override
  void initState() {
    super.initState();
    _registry = widget.repository == null
        ? locator<ModeScheduleRegistry>()
        : null;
    _repository = widget.repository ?? _registry!.create();
    _repository.bind(widget.spaceId);
  }

  @override
  void didUpdateWidget(covariant ModeScheduleSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.spaceId != widget.spaceId) _repository.bind(widget.spaceId);
  }

  @override
  void dispose() {
    _registry?.release(_repository);
    super.dispose();
  }

  String _mode(AppLocalizations l, String? mode) => switch (mode) {
    'work' => l.space_activity_work,
    'relax' => l.space_activity_relax,
    'sleep' => l.space_activity_sleep,
    'entertainment' => l.space_activity_entertainment,
    'away' => l.space_activity_away,
    _ => l.filter_status_unknown,
  };
  String _occurrence(
    AppLocalizations l,
    SpacesHomeControlPluginDataScheduleOccurrence value,
  ) =>
      '${_mode(l, value.mode.json)} · ${DateFormat.yMd(l.localeName).format(value.localDate)} ${value.time} (${value.timezone})';

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _repository,
    builder: (context, _) {
      final r = _repository;
      final l = AppLocalizations.of(context)!;
      if (r.spaceId != widget.spaceId) return const SizedBox.shrink();
      final state = r.state;
      if (r.fresh && state != null && !state.enabled) {
        return const SizedBox.shrink();
      }
      final available =
          r.fresh && state != null && state.status.json == 'running';
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
              l.space_schedule_title,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            if (!available)
              Text(
                r.loading
                    ? l.space_schedule_loading
                    : state?.status.json == 'clock_uncertain' && r.fresh
                    ? l.space_schedule_clock_uncertain
                    : l.space_schedule_unavailable,
              )
            else ...[
              if (state.manualOverride)
                Text(
                  l.space_schedule_manual,
                  key: const ValueKey('schedule-manual'),
                ),
              if (state.current != null)
                Text(
                  '${l.space_schedule_current}: ${_occurrence(l, state.current!)}',
                  key: const ValueKey('schedule-current'),
                ),
              if (state.next != null)
                Text(
                  '${l.space_schedule_next}: ${_occurrence(l, state.next!)}',
                  key: const ValueKey('schedule-next'),
                )
              else
                Text(l.space_schedule_empty),
              if (state.lastAttemptStatus?.json == 'failed' ||
                  state.lastAttemptStatus?.json == 'conflict' ||
                  state.lastAttemptStatus?.json == 'interrupted')
                Text(l.space_schedule_last_failed),
              Text(
                l.space_schedule_plan_only,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      );
    },
  );
}
