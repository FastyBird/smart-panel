import 'package:fastybird_smart_panel/api/models/spaces_home_control_plugin_data_schedule_occurrence.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:fastybird_smart_panel/core/widgets/list_row.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_details_sheet.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_indicator.dart';
import 'package:fastybird_smart_panel/core/widgets/right_drawer.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/automations/service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/automations_section.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_metrics.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/activity_modes.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/mode_schedule.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/occupancy.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

// ─────────────────────────────────────────────────────────────────────────
// Labels
// ─────────────────────────────────────────────────────────────────────────

/// A room mode's name: "Work", "Relax"…; null is Manual.
String roomModeLabel(AppLocalizations l, String? mode) => switch (mode) {
  'work' => l.space_activity_work,
  'relax' => l.space_activity_relax,
  'sleep' => l.space_activity_sleep,
  'entertainment' => l.space_activity_entertainment,
  'away' => l.space_activity_away,
  _ => l.space_activity_manual,
};

IconData roomModeIcon(String? mode) => switch (mode) {
  'work' => MdiIcons.briefcaseOutline,
  'relax' => MdiIcons.sofaSingleOutline,
  'sleep' => MdiIcons.weatherNight,
  'entertainment' => MdiIcons.televisionPlay,
  'away' => MdiIcons.exitRun,
  _ => MdiIcons.tuneVariant,
};

String _domainLabel(AppLocalizations l, String? domain) => switch (domain) {
  'lighting' => l.domain_lights,
  'climate' => l.domain_climate,
  'covers' => l.domain_shading,
  'media' => l.domain_media,
  'security' => l.space_activity_security,
  _ => l.filter_status_unknown,
};

IconData _domainIcon(String? domain) => switch (domain) {
  'lighting' => DomainType.lights.icon,
  'climate' => DomainType.climate.icon,
  'covers' => DomainType.shading.icon,
  'media' => DomainType.media.icon,
  'security' => MdiIcons.shieldHomeOutline,
  _ => MdiIcons.helpCircleOutline,
};

// ─────────────────────────────────────────────────────────────────────────
// Status
// ─────────────────────────────────────────────────────────────────────────

/// One choice in the room mode: a configured mode, or Manual ([config]
/// null), which clears the selection.
@immutable
class RoomModeOption {
  const RoomModeOption({
    required this.key,
    required this.config,
    required this.label,
    required this.icon,
  });

  final String? key;
  final ActivityModeConfig? config;
  final String label;
  final IconData icon;

  bool get manual => config == null;
}

/// What the room mode shows now (spec §7, §8), from its repository. The
/// outcome is about the commands sent, never a claim that the devices got
/// there.
///
/// | Repository | Outcome | Chip |
/// |---|---|---|
/// | sending | Sending, chips greyed | the current one |
/// | active | Completed | the mode |
/// | partial | Partial · Shading did not finish | the mode |
/// | failed | Failed | none |
/// | interrupted | Replaced by a newer request | the mode |
/// | unconfirmed, conflict | Not confirmed, Changed elsewhere | the mode |
/// | unavailable | Modes are unavailable, chips greyed | none |
/// | deactivated, none | — | Manual |
@immutable
class RoomModeStatus {
  const RoomModeStatus._({
    required this.options,
    required this.selectedKey,
    required this.selected,
    required this.outcome,
    required this.outcomeText,
    required this.busy,
    required this.enabled,
    required this.retry,
    required this.refresh,
  });

  factory RoomModeStatus.of(ActivityModesRepository r, AppLocalizations l) {
    final state = r.state;
    final selectedKey = state?.selectedActivityMode?.json;
    final status = state?.activityStatus.json;
    final pending = r.busy || status == 'activating';
    final issue = r.issue;

    final options = [
      for (final config in r.modes)
        RoomModeOption(
          key: config.activityMode.json,
          config: config,
          label: roomModeLabel(l, config.activityMode.json),
          icon: roomModeIcon(config.activityMode.json),
        ),
      RoomModeOption(
        key: null,
        config: null,
        label: l.space_activity_manual,
        icon: roomModeIcon(null),
      ),
    ];

    AppOutcome? outcome;
    String? text;

    if (issue != null) {
      outcome = switch (issue) {
        ActivityModeIssue.unconfirmed => AppOutcome.notConfirmed,
        ActivityModeIssue.conflict => AppOutcome.conflict,
        ActivityModeIssue.unavailable => AppOutcome.unavailable,
      };
      text = issue == ActivityModeIssue.unavailable
          ? l.room_mode_unavailable
          : outcomeLabel(l, outcome);
    } else if (pending) {
      outcome = AppOutcome.pending;
      text = l.space_activity_pending;
    } else if (selectedKey != null) {
      outcome = switch (status) {
        'active' => AppOutcome.completed,
        'partial' => AppOutcome.partial,
        'failed' => AppOutcome.failed,
        'interrupted' => AppOutcome.superseded,
        _ => null,
      };

      if (outcome != null) {
        text = outcomeLabel(l, outcome);

        if (outcome == AppOutcome.partial) {
          final unfinished = state?.activityResults
              .where((result) => result.status.json != 'succeeded')
              .firstOrNull;

          if (unfinished != null) {
            text = outcomeLine([
              text,
              l.room_mode_part_unfinished(
                _domainLabel(l, unfinished.domain.json),
              ),
            ]);
          }
        }
      }
    }

    final unavailable = issue == ActivityModeIssue.unavailable;
    final known = options.any((o) => !o.manual && o.key == selectedKey);

    // A selection kept while its mode was disabled still names the mode.
    if (selectedKey != null && !known && text != null) {
      text = outcomeLine([roomModeLabel(l, selectedKey), text]);
    }

    RoomModeOption? selected;
    if (!unavailable && status != 'failed') {
      if (selectedKey == null) {
        if (r.fresh || state != null) selected = options.last;
      } else {
        selected = options.where((o) => o.key == selectedKey).firstOrNull;
      }
    }

    final retryable =
        outcome == AppOutcome.partial ||
        outcome == AppOutcome.failed ||
        outcome == AppOutcome.superseded;

    return RoomModeStatus._(
      options: options,
      selectedKey: selectedKey,
      selected: selected,
      outcome: outcome,
      outcomeText: text,
      busy: pending || unavailable,
      enabled: r.canSubmit && !pending,
      retry: retryable && known
          ? options.firstWhere((o) => o.key == selectedKey)
          : null,
      refresh: issue != null,
    );
  }

  /// Whether the room has room modes to show.
  static bool visible(ActivityModesRepository r) =>
      r.modes.isNotEmpty || r.issue != null;

  /// The configured modes, then Manual.
  final List<RoomModeOption> options;

  /// The selected mode's key; null for Manual.
  final String? selectedKey;

  /// The chip to show as selected, if any.
  final RoomModeOption? selected;

  final AppOutcome? outcome;
  final String? outcomeText;

  /// Chips greyed: sending, or modes unavailable.
  final bool busy;

  /// Whether a tap is accepted now.
  final bool enabled;

  /// The mode "Retry {mode}" sends again.
  final RoomModeOption? retry;

  /// Whether the details offer "Retry", which refreshes the selection.
  final bool refresh;

  /// Whether the outcome needs attention: the details button turns amber and
  /// Compact's mode button shows a warning mark.
  bool get attention =>
      outcome != null &&
      outcome != AppOutcome.completed &&
      outcome != AppOutcome.pending;

  /// The name the mode button and the details title show.
  String name(AppLocalizations l) =>
      selected?.label ??
      (selectedKey == null ? l.room_mode_title : roomModeLabel(l, selectedKey));

  IconData get icon => selected?.icon ?? roomModeIcon(selectedKey);

  /// Selects [option]: a mode sends it, Manual clears the selection, the
  /// selected one does nothing.
  void select(ActivityModesRepository r, RoomModeOption option) {
    if (!enabled || identical(option, selected)) return;

    if (option.manual) {
      r.deactivate();
    } else {
      r.activate(option.config!);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Schedule and occupancy
// ─────────────────────────────────────────────────────────────────────────

String _occurrence(
  AppLocalizations l,
  SpacesHomeControlPluginDataScheduleOccurrence value,
) =>
    '${roomModeLabel(l, value.mode.json)} · ${DateFormat.yMd(l.localeName).format(value.localDate)} ${value.time} (${value.timezone})';

/// Whether the schedule has anything to say: hidden once a fresh read says
/// it is off.
bool roomScheduleVisible(ModeScheduleRepository? r) {
  if (r == null) return false;
  final state = r.state;

  return !(r.fresh && state != null && !state.enabled);
}

bool _scheduleRunning(ModeScheduleRepository r) =>
    r.fresh && r.state != null && r.state!.status.json == 'running';

bool _scheduleFailed(ModeScheduleRepository r) {
  final last = r.state?.lastAttemptStatus?.json;

  return last == 'failed' || last == 'conflict' || last == 'interrupted';
}

/// The schedule's one line on the overview: "Sleep at 22:30", "Schedule
/// paused · clock not set", "Work at 08:00 did not start".
String roomScheduleLine(AppLocalizations l, ModeScheduleRepository r) {
  final state = r.state;

  if (!_scheduleRunning(r)) {
    if (r.loading) return l.space_schedule_loading;
    if (r.fresh && state?.status.json == 'clock_uncertain') {
      return l.room_schedule_paused;
    }

    return l.space_schedule_unavailable;
  }

  final last = state!.lastAttempt;
  if (_scheduleFailed(r) && last != null) {
    return l.room_schedule_failed(roomModeLabel(l, last.mode.json), last.time);
  }

  final next = state.next;
  if (next == null) return l.space_schedule_empty;

  return l.room_schedule_at(roomModeLabel(l, next.mode.json), next.time);
}

/// The schedule's lines in the mode details.
List<Widget> roomScheduleDetails(
  AppLocalizations l,
  ModeScheduleRepository r,
  TextStyle style,
  TextStyle note,
) {
  final state = r.state;

  if (!_scheduleRunning(r)) {
    return [
      Text(
        r.loading
            ? l.space_schedule_loading
            : state?.status.json == 'clock_uncertain' && r.fresh
            ? l.space_schedule_clock_uncertain
            : l.space_schedule_unavailable,
        style: style,
      ),
    ];
  }

  return [
    if (state!.manualOverride)
      Text(
        l.space_schedule_manual,
        key: const ValueKey('schedule-manual'),
        style: style,
      ),
    if (state.current != null)
      Text(
        '${l.space_schedule_current}: ${_occurrence(l, state.current!)}',
        key: const ValueKey('schedule-current'),
        style: style,
      ),
    if (state.next != null)
      Text(
        '${l.space_schedule_next}: ${_occurrence(l, state.next!)}',
        key: const ValueKey('schedule-next'),
        style: style,
      )
    else
      Text(l.space_schedule_empty, style: style),
    if (_scheduleFailed(r)) Text(l.space_schedule_last_failed, style: style),
    Text(l.space_schedule_plan_only, style: note),
  ];
}

/// Whether occupancy has anything to say: hidden once a fresh read says it
/// is off.
bool roomOccupancyVisible(OccupancyRepository? r) =>
    r != null && !(r.fresh && r.state?.enabled == false);

/// Whether the room has something for the room mode control to hold
/// besides modes: a running schedule, occupancy that is on, or (with
/// [automations]) automations. Then the control stays reachable in a room
/// with no modes.
bool roomModeExtras(RoomModeSources s, {required bool automations}) {
  final schedule = s.schedule;
  final occupancy = s.occupancy;

  return (schedule != null &&
          schedule.fresh &&
          schedule.state?.enabled == true) ||
      (occupancy != null &&
          occupancy.fresh &&
          occupancy.state?.enabled == true) ||
      (automations &&
          (s.automations?.automationsForSpace(s.spaceId).isNotEmpty ?? false));
}

String _occupancyStatus(AppLocalizations l, OccupancyRepository r) {
  final state = r.state;
  final status = r.fresh && state?.running == true ? state?.status.json : null;

  return switch (status) {
    'occupied' => l.space_occupancy_occupied,
    'vacant' => l.space_occupancy_vacant,
    _ => l.room_occupancy_unknown,
  };
}

/// Occupancy's one line: "Occupied", "Vacant · automation on", "Manual ·
/// automation paused".
String roomOccupancyLine(AppLocalizations l, OccupancyRepository r) {
  final state = r.state;

  if (r.fresh && state?.manualOverride == true) {
    return l.room_occupancy_manual;
  }

  final status = _occupancyStatus(l, r);

  return r.fresh && state?.running == true && state?.status.json == 'vacant'
      ? outcomeLine([status, l.room_occupancy_automation_on])
      : status;
}

/// Occupancy's lines in the mode details.
List<Widget> roomOccupancyDetails(
  AppLocalizations l,
  OccupancyRepository r,
  TextStyle style,
) {
  final state = r.state;

  return [
    Text(
      r.fresh && state?.running == true
          ? _occupancyStatus(l, r)
          : l.space_occupancy_unknown,
      key: const ValueKey('occupancy-status'),
      style: style,
    ),
    if (r.fresh && state?.manualOverride == true)
      Text(
        l.space_occupancy_manual,
        key: const ValueKey('occupancy-manual'),
        style: style,
      )
    else if (r.fresh && state?.running == true)
      Text(
        l.space_occupancy_automatic,
        key: const ValueKey('occupancy-automatic'),
        style: style,
      ),
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// Sources
// ─────────────────────────────────────────────────────────────────────────

/// The room mode's read models for one space: the selected mode, the
/// schedule, occupancy and the space's automations. Only [activity] is
/// required; the others are left out where their module is.
class RoomModeSources {
  RoomModeSources({
    required this.spaceId,
    required this.activity,
    this.schedule,
    this.occupancy,
    this.automations,
  });

  final String spaceId;
  final ActivityModesRepository activity;
  final ModeScheduleRepository? schedule;
  final OccupancyRepository? occupancy;
  final AutomationsService? automations;

  Listenable get listenable =>
      Listenable.merge([activity, ?schedule, ?occupancy, ?automations]);
}

/// Opens and binds the room mode's read models for [spaceId] while it is
/// mounted, and hands them to [builder] (null when the room modes module is
/// not loaded). [builder] runs again whenever any of them changes.
///
/// Pass [sources] to use read models you own (tests, the gallery); they are
/// then neither bound nor released here.
class RoomModeScope extends StatefulWidget {
  const RoomModeScope({
    super.key,
    required this.spaceId,
    required this.builder,
    this.sources,
  });

  final String spaceId;
  final RoomModeSources? sources;
  final Widget Function(BuildContext context, RoomModeSources? sources) builder;

  @override
  State<RoomModeScope> createState() => _RoomModeScopeState();
}

class _RoomModeScopeState extends State<RoomModeScope> {
  ActivityModesRegistry? _activityRegistry;
  ModeScheduleRegistry? _scheduleRegistry;
  OccupancyRegistry? _occupancyRegistry;
  RoomModeSources? _owned;

  RoomModeSources? get _sources => widget.sources ?? _owned;

  @override
  void initState() {
    super.initState();
    if (widget.sources == null) _open();
  }

  void _open() {
    if (!locator.isRegistered<ActivityModesRegistry>()) return;

    _activityRegistry = locator<ActivityModesRegistry>();
    if (locator.isRegistered<ModeScheduleRegistry>()) {
      _scheduleRegistry = locator<ModeScheduleRegistry>();
    }
    if (locator.isRegistered<OccupancyRegistry>()) {
      _occupancyRegistry = locator<OccupancyRegistry>();
    }

    _owned = RoomModeSources(
      spaceId: widget.spaceId,
      activity: _activityRegistry!.create(),
      schedule: _scheduleRegistry?.create(),
      occupancy: _occupancyRegistry?.create(),
      automations: locator.isRegistered<AutomationsService>()
          ? locator<AutomationsService>()
          : null,
    );
    _bind(widget.spaceId);
  }

  void _bind(String spaceId) {
    final owned = _owned;
    if (owned == null) return;

    owned.activity.bind(spaceId);
    owned.schedule?.bind(spaceId);
    owned.occupancy?.bind(spaceId);
  }

  /// Releases the read models this scope opened.
  void _release() {
    final owned = _owned;
    if (owned != null) {
      _activityRegistry?.release(owned.activity);
      if (owned.schedule != null) _scheduleRegistry?.release(owned.schedule!);
      if (owned.occupancy != null) {
        _occupancyRegistry?.release(owned.occupancy!);
      }
    }
    _owned = null;
  }

  @override
  void didUpdateWidget(covariant RoomModeScope oldWidget) {
    super.didUpdateWidget(oldWidget);

    final owns = widget.sources == null;
    final owned = oldWidget.sources == null;

    if (owned && !owns) {
      // Supplied sources now: stop polling our own.
      _release();
    } else if (!owned && owns) {
      // Back to our own: open and bind them for the current room.
      _open();
    } else if (widget.spaceId != oldWidget.spaceId && _owned != null) {
      _owned = RoomModeSources(
        spaceId: widget.spaceId,
        activity: _owned!.activity,
        schedule: _owned!.schedule,
        occupancy: _owned!.occupancy,
        automations: _owned!.automations,
      );
      _bind(widget.spaceId);
    }
  }

  @override
  void dispose() {
    _release();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sources = _sources;

    if (sources == null) return widget.builder(context, null);

    // Every source: the schedule, occupancy or a new automation can bring
    // the control in a room with no modes.
    return ListenableBuilder(
      listenable: sources.listenable,
      builder: (context, _) => widget.builder(context, sources),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Regular and up: the chip row
// ─────────────────────────────────────────────────────────────────────────

/// The Room mode on Regular and Expanded (spec §4, §9): the "Room mode"
/// label with the outcome, a row of chips (the modes, then Manual) that
/// scrolls sideways, a details button, and the schedule and occupancy line.
class RoomModePanel extends StatelessWidget {
  const RoomModePanel({
    super.key,
    required this.sources,
    this.sizeClass,
    this.landscape,
    this.automationsInDetails = true,
  });

  final RoomModeSources sources;
  final ScreenSizeClass? sizeClass;
  final bool? landscape;

  /// Lists the automations in the details layer (Regular; Expanded lists
  /// them on the overview).
  final bool automationsInDetails;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;

    return ListenableBuilder(
      listenable: sources.listenable,
      builder: (context, _) {
        final status = RoomModeStatus.of(sources.activity, l);
        final chipHeight = AppSpacings.scale(
          RoomOverviewMetrics.chipHeightFor(resolvedClass),
        );
        final line = _ScheduleLine(sources: sources, sizeClass: resolvedClass);

        void details() => showRoomModeDetails(
          context,
          sources: sources,
          automations: automationsInDetails,
          landscape: landscape,
          sizeClass: resolvedClass,
        );

        // No modes: the schedule and occupancy line (or the automations'
        // label) and the details button, no label or chips.
        if (!RoomModeStatus.visible(sources.activity)) {
          return Row(
            spacing: AppSpacings.scale(RoomOverviewMetrics.chipGap),
            children: [
              Expanded(
                child: line.hasContent
                    ? line
                    : SectionLabel(label: l.space_automations_title),
              ),
              RoomModeDetailsButton(
                attention: false,
                size: chipHeight,
                onTap: details,
              ),
            ],
          );
        }

        return Semantics(
          container: true,
          explicitChildNodes: true,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: AppSpacings.scale(RoomOverviewMetrics.modeGap),
            children: [
              ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: AppSpacings.scale(
                    RoomOverviewMetrics.modeLabelHeight,
                  ),
                ),
                child: Row(
                  spacing: AppSpacings.scale(RoomOverviewMetrics.modeLabelGap),
                  children: [
                    Semantics(
                      header: true,
                      child: Text(
                        l.room_mode_title.toUpperCase(),
                        maxLines: 1,
                        style: TextStyle(
                          color: neutrals.textSecondary,
                          fontSize: AppSpacings.scale(
                            RoomOverviewMetrics.modeLabelFont,
                          ),
                          fontWeight: FontWeight.w700,
                          letterSpacing: AppSpacings.scale(
                            SectionLabelMetrics.letterSpacing,
                          ),
                        ),
                      ),
                    ),
                    if (status.outcome != null)
                      Flexible(
                        child: RoomModeOutcome(
                          outcome: status.outcome!,
                          text: status.outcomeText!,
                        ),
                      ),
                  ],
                ),
              ),
              ConstrainedBox(
                constraints: BoxConstraints(minHeight: chipHeight),
                child: Row(
                  spacing: AppSpacings.scale(RoomOverviewMetrics.chipGap),
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          spacing: AppSpacings.scale(
                            RoomOverviewMetrics.chipGap,
                          ),
                          children: [
                            for (final option in status.options)
                              RoomModeChip(
                                option: option,
                                selected: identical(option, status.selected),
                                busy: status.busy,
                                onTap: status.enabled
                                    ? () => status.select(
                                        sources.activity,
                                        option,
                                      )
                                    : null,
                                sizeClass: resolvedClass,
                              ),
                          ],
                        ),
                      ),
                    ),
                    RoomModeDetailsButton(
                      attention: status.attention,
                      size: chipHeight,
                      onTap: details,
                    ),
                  ],
                ),
              ),
              if (line.hasContent) line,
            ],
          ),
        );
      },
    );
  }
}

/// The outcome beside the "Room mode" label: an icon and a short line in
/// the outcome's colour.
class RoomModeOutcome extends StatelessWidget {
  const RoomModeOutcome({super.key, required this.outcome, required this.text});

  final AppOutcome outcome;
  final String text;

  @override
  Widget build(BuildContext context) {
    final style = OutcomeStyle.of(Theme.of(context), outcome);

    return Semantics(
      liveRegion: true,
      label: text,
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.scale(3),
        children: [
          if (style.icon != null)
            Icon(
              style.icon,
              size: AppSpacings.scale(OutcomeMetrics.icon),
              color: style.color,
            ),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: style.color,
                fontSize: AppSpacings.scale(RoomOverviewMetrics.modeLabelFont),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One room mode chip: the accent while selected; greyed while a mode is
/// being sent or modes are unavailable.
class RoomModeChip extends StatelessWidget {
  const RoomModeChip({
    super.key,
    required this.option,
    required this.selected,
    this.busy = false,
    this.onTap,
    this.sizeClass,
  });

  final RoomModeOption option;
  final bool selected;
  final bool busy;
  final VoidCallback? onTap;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final accent = theme.accent;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final radius = BorderRadius.circular(AppBorderRadius.base);
    final Color fill = selected
        ? (busy ? neutrals.fillBase : accent.fill)
        : neutrals.surfaceCard;
    final Color line = selected && !busy ? accent.fill : neutrals.borderLight;
    final Color foreground = busy
        ? neutrals.textDisabled
        : selected
        ? accent.onFill
        : neutrals.textPrimary;

    return Semantics(
      container: true,
      button: true,
      inMutuallyExclusiveGroup: true,
      selected: selected,
      enabled: onTap != null,
      label: option.label,
      onTap: onTap,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minHeight: AppSpacings.scale(
            RoomOverviewMetrics.chipHeightFor(resolvedClass),
          ),
        ),
        child: Material(
          color: fill,
          shape: RoundedRectangleBorder(
            borderRadius: radius,
            side: BorderSide(color: line, width: AppSpacings.scale(1)),
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: radius,
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacings.scale(RoomOverviewMetrics.chipPadding),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                spacing: AppSpacings.scale(RoomOverviewMetrics.chipGap),
                children: [
                  Icon(
                    option.icon,
                    size: AppSpacings.scale(RoomOverviewMetrics.chipIcon),
                    color: foreground,
                  ),
                  Text(
                    option.label,
                    maxLines: 1,
                    style: TextStyle(
                      color: foreground,
                      fontSize: AppSpacings.scale(
                        RoomOverviewMetrics.chipFontFor(resolvedClass),
                      ),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The square details button after the chips; amber when the outcome needs
/// attention.
class RoomModeDetailsButton extends StatelessWidget {
  const RoomModeDetailsButton({
    super.key,
    required this.attention,
    required this.size,
    required this.onTap,
  });

  final bool attention;
  final double size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final warning = theme.status(AppStatus.warning);
    final radius = BorderRadius.circular(AppBorderRadius.base);

    return Semantics(
      container: true,
      button: true,
      label: AppLocalizations.of(context)!.space_activity_details,
      onTap: onTap,
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: size,
        child: Material(
          color: attention ? warning.soft : neutrals.surfaceCard,
          shape: RoundedRectangleBorder(
            borderRadius: radius,
            side: BorderSide(
              color: attention ? warning.text : neutrals.borderLight,
              width: AppSpacings.scale(1),
            ),
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: radius,
            child: Icon(
              MdiIcons.informationOutline,
              size: AppSpacings.scale(RoomOverviewMetrics.chipIcon),
              color: attention ? warning.text : neutrals.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

/// The schedule and occupancy line under the chips.
class _ScheduleLine extends StatelessWidget {
  const _ScheduleLine({required this.sources, required this.sizeClass});

  final RoomModeSources sources;
  final ScreenSizeClass sizeClass;

  bool get hasContent =>
      roomScheduleVisible(sources.schedule) ||
      roomOccupancyVisible(sources.occupancy);

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final neutrals = Theme.of(context).neutrals;
    final font = AppSpacings.scale(
      RoomOverviewMetrics.scheduleFontFor(sizeClass),
    );

    Widget part(IconData icon, String text, Key key) => Row(
      key: key,
      mainAxisSize: MainAxisSize.min,
      spacing: AppSpacings.scale(RoomOverviewMetrics.scheduleIconGap),
      children: [
        Icon(
          icon,
          size: AppSpacings.scale(RoomOverviewMetrics.scheduleIcon),
          color: neutrals.textSecondary,
        ),
        Text(
          text,
          maxLines: 1,
          style: TextStyle(color: neutrals.textSecondary, fontSize: font),
        ),
      ],
    );

    return ConstrainedBox(
      constraints: BoxConstraints(
        minHeight: AppSpacings.scale(RoomOverviewMetrics.scheduleHeight),
      ),
      child: ClipRect(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const NeverScrollableScrollPhysics(),
          child: Row(
            spacing: AppSpacings.scale(RoomOverviewMetrics.scheduleGap),
            children: [
              if (roomScheduleVisible(sources.schedule))
                part(
                  MdiIcons.calendarClockOutline,
                  roomScheduleLine(l, sources.schedule!),
                  const ValueKey('room-schedule-line'),
                ),
              if (roomOccupancyVisible(sources.occupancy))
                part(
                  MdiIcons.accountOutline,
                  roomOccupancyLine(l, sources.occupancy!),
                  const ValueKey('room-occupancy-line'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Compact: the button and the chooser
// ─────────────────────────────────────────────────────────────────────────

/// The Room mode on Compact (spec §4): one button in the accent showing the
/// current mode, with a warning mark when the outcome needs attention. It
/// opens the chooser.
class RoomModeButton extends StatelessWidget {
  const RoomModeButton({
    super.key,
    required this.sources,
    this.sizeClass,
    this.landscape,
  });

  final RoomModeSources sources;
  final ScreenSizeClass? sizeClass;
  final bool? landscape;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final accent = Theme.of(context).accent;
    final radius = BorderRadius.circular(AppBorderRadius.base);

    return ListenableBuilder(
      listenable: sources.activity,
      builder: (context, _) {
        final status = RoomModeStatus.of(sources.activity, l);
        final name = status.name(l);

        void open() => showRoomModeChooser(
          context,
          sources: sources,
          landscape: landscape,
          sizeClass: sizeClass,
        );

        // No modes: a details button opens the schedule, occupancy and
        // automations.
        if (!RoomModeStatus.visible(sources.activity)) {
          return RoomModeDetailsButton(
            attention: false,
            size: AppSpacings.scale(RoomOverviewMetrics.modeButtonHeight),
            onTap: open,
          );
        }

        return Semantics(
          container: true,
          button: true,
          label: l.room_mode_button(name),
          value: status.attention ? status.outcomeText : null,
          onTap: open,
          excludeSemantics: true,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: AppSpacings.scale(
                RoomOverviewMetrics.modeButtonHeight,
              ),
            ),
            child: Material(
              color: accent.fill,
              shape: RoundedRectangleBorder(borderRadius: radius),
              child: InkWell(
                onTap: open,
                borderRadius: radius,
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.scale(
                      RoomOverviewMetrics.modeButtonPadding,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    spacing: AppSpacings.scale(
                      RoomOverviewMetrics.modeButtonGap,
                    ),
                    children: [
                      Icon(
                        status.icon,
                        size: AppSpacings.scale(
                          RoomOverviewMetrics.modeButtonIcon,
                        ),
                        color: accent.onFill,
                      ),
                      Text(
                        name,
                        maxLines: 1,
                        style: TextStyle(
                          color: accent.onFill,
                          fontSize: AppSpacings.scale(
                            RoomOverviewMetrics.modeButtonFont,
                          ),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (status.attention)
                        Icon(
                          MdiIcons.alertOutline,
                          key: const ValueKey('room-mode-attention'),
                          size: AppSpacings.scale(
                            RoomOverviewMetrics.modeButtonMark,
                          ),
                          color: accent.onFill,
                        ),
                      Icon(
                        MdiIcons.chevronDown,
                        size: AppSpacings.scale(
                          RoomOverviewMetrics.modeButtonMark,
                        ),
                        color: accent.onFill,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Opens the Room mode chooser (Compact): the modes as rows, then the
/// outcome, schedule, occupancy and automations. A bottom sheet in
/// portrait, a right drawer in landscape; choosing a mode closes it.
Future<void> showRoomModeChooser(
  BuildContext context, {
  required RoomModeSources sources,
  bool? landscape,
  ScreenSizeClass? sizeClass,
}) {
  final l = AppLocalizations.of(context)!;

  return _showRoomModeLayer(
    context,
    title: l.room_mode_title,
    sources: sources,
    landscape: landscape,
    sizeClass: sizeClass,
    content: (layerContext, resolvedClass) => ListenableBuilder(
      listenable: sources.listenable,
      builder: (context, _) {
        final status = RoomModeStatus.of(sources.activity, l);
        final modes = RoomModeStatus.visible(sources.activity);

        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: AppSpacings.scale(RoomOverviewMetrics.padFor(resolvedClass)),
          children: [
            if (modes && status.outcome != null)
              RoomModeOutcome(
                outcome: status.outcome!,
                text: status.outcomeText!,
              ),
            if (modes)
              for (final option in status.options)
                AppListRow(
                  key: ValueKey('room-mode-option-${option.key ?? 'manual'}'),
                  title: option.label,
                  icon: option.icon,
                  selected: identical(option, status.selected),
                  enabled: status.enabled,
                  onTap: () {
                    Navigator.of(layerContext).pop();
                    status.select(sources.activity, option);
                  },
                ),
            RoomModeDetails(
              sources: sources,
              automations: true,
              onClose: () => Navigator.of(layerContext).pop(),
              sizeClass: resolvedClass,
            ),
          ],
        );
      },
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Details
// ─────────────────────────────────────────────────────────────────────────

/// Opens the mode details (Regular and up): per-part results of the last
/// request, the schedule, occupancy and, on Regular, the automations, with
/// "Retry {mode}" or "Retry" when the outcome calls for it.
Future<void> showRoomModeDetails(
  BuildContext context, {
  required RoomModeSources sources,
  bool automations = true,
  bool? landscape,
  ScreenSizeClass? sizeClass,
}) {
  final l = AppLocalizations.of(context)!;

  // The header, the outcome and Retry live in the content, so they follow
  // the selection while the layer is open.
  return _showRoomModeLayer(
    context,
    title: l.room_mode_title,
    sources: sources,
    landscape: landscape,
    sizeClass: sizeClass,
    content: (layerContext, resolvedClass) => RoomModeDetails(
      sources: sources,
      automations: automations,
      header: true,
      onClose: () => Navigator.of(layerContext).pop(),
      sizeClass: resolvedClass,
    ),
  );
}

/// What Retry does now: send the selected mode again after Partial, Failed
/// or Replaced, refresh after Not confirmed or Changed elsewhere.
(String, VoidCallback)? _retryAction(
  AppLocalizations l,
  RoomModeSources sources,
  RoomModeStatus status,
) {
  final retry = status.retry;
  if (retry != null) {
    return (
      l.room_mode_retry(retry.label),
      () => sources.activity.activate(retry.config!),
    );
  }
  if (status.refresh) return (l.action_retry, sources.activity.refresh);

  return null;
}

Future<void> _showRoomModeLayer(
  BuildContext context, {
  required String title,
  required RoomModeSources sources,
  required Widget Function(BuildContext, ScreenSizeClass) content,
  bool? landscape,
  ScreenSizeClass? sizeClass,
}) async {
  final screen = locator<ScreenService>();
  final resolvedClass = sizeClass ?? screen.sizeClass;
  final isLandscape = landscape ?? screen.isLandscape;

  // Built inside the layer, so a tap closes the layer's own route.
  final body = Builder(
    builder: (layerContext) => content(layerContext, resolvedClass),
  );

  if (isLandscape) {
    await showRightDrawer<void>(
      context,
      title: title,
      content: body,
      sizeClass: resolvedClass,
    );

    return;
  }

  await showBottomSheetDialog(
    context,
    title: title,
    content: Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.scale(SheetMetrics.paddingFor(resolvedClass)),
      ),
      child: body,
    ),
    sizeClass: resolvedClass,
  );
}

/// The details layer's content, all of it live: with [header] the mode and
/// its outcome, then the last request's results per part, the schedule,
/// occupancy and, with [automations], the space's automations, and Retry
/// when the outcome calls for it ([onClose] closes the layer first).
class RoomModeDetails extends StatelessWidget {
  const RoomModeDetails({
    super.key,
    required this.sources,
    this.automations = true,
    this.header = false,
    this.onClose,
    this.sizeClass,
  });

  final RoomModeSources sources;
  final bool automations;
  final bool header;
  final VoidCallback? onClose;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final neutrals = Theme.of(context).neutrals;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final style = TextStyle(
      color: neutrals.textPrimary,
      fontSize: AppFontSize.small,
    );
    final note = TextStyle(
      color: neutrals.textSecondary,
      fontSize: AppFontSize.extraSmall,
    );
    List<Widget> section(String title, List<Widget> lines) => [
      SectionLabel(label: title),
      ...lines,
    ];

    return ListenableBuilder(
      listenable: sources.listenable,
      builder: (context, _) {
        final results = sources.activity.state?.activityResults ?? const [];
        final status = RoomModeStatus.of(sources.activity, l);
        final modes = RoomModeStatus.visible(sources.activity);
        final retry = modes ? _retryAction(l, sources, status) : null;

        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: AppSpacings.pSm,
          children: [
            if (header && modes) ...[
              Text(
                status.selectedKey == null
                    ? status.name(l)
                    : l.room_mode_details_title(status.name(l)),
                key: const ValueKey('room-mode-details-title'),
                style: style.copyWith(fontWeight: FontWeight.w500),
              ),
              if (status.outcome != null)
                RoomModeOutcome(
                  outcome: status.outcome!,
                  text: status.outcomeText!,
                ),
            ],
            if (results.isNotEmpty)
              OutcomeDetailsList(
                rows: [
                  for (final result in results)
                    _resultRow(l, result.domain.json, result.status.json),
                ],
                note: l.space_activity_outcome_notice,
                sizeClass: resolvedClass,
              ),
            if (roomScheduleVisible(sources.schedule))
              ...section(
                l.space_schedule_title,
                roomScheduleDetails(l, sources.schedule!, style, note),
              ),
            if (roomOccupancyVisible(sources.occupancy))
              ...section(
                l.space_occupancy_title,
                roomOccupancyDetails(l, sources.occupancy!, style),
              ),
            if (automations && sources.automations != null)
              AutomationsSection(
                spaceId: sources.spaceId,
                service: sources.automations,
              ),
            if (retry != null)
              AppDialogButton(
                key: const ValueKey('room-mode-retry'),
                label: retry.$1,
                primary: true,
                sizeClass: resolvedClass,
                onTap: () {
                  onClose?.call();
                  retry.$2();
                },
              ),
          ],
        );
      },
    );
  }

  OutcomeDetailRow _resultRow(
    AppLocalizations l,
    String? domain,
    String? status,
  ) {
    final (AppOutcome outcome, String? label) = switch (status) {
      'succeeded' => (AppOutcome.completed, null),
      'failed' => (AppOutcome.failed, null),
      'disabled' => (AppOutcome.notSupported, l.space_activity_disabled),
      'no_targets' => (AppOutcome.noDevices, null),
      'unsupported' => (AppOutcome.notSupported, null),
      _ => (AppOutcome.unavailable, l.filter_status_unknown),
    };

    return OutcomeDetailRow(
      icon: _domainIcon(domain),
      label: _domainLabel(l, domain),
      outcome: outcome,
      status: label,
    );
  }
}
