import 'dart:async';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_details_sheet.dart';
import 'package:fastybird_smart_panel/core/widgets/outcome_indicator.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/covers_state/covers_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/intent_result/intent_result.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/domain_view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// One cover of a group, for the member tiles: its name and the position it
/// reports, null when it does not report one.
@immutable
class GroupedCoverMember {
  const GroupedCoverMember({required this.name, this.position});

  final String name;
  final int? position;
}

/// The Shading view of a room whose covers form a group (design canvas,
/// "Shading · grouped covers"): the group's reported position or Mixed,
/// Open all, Stop all and Close all, the members, and the command outcome
/// with its details behind a pill.
///
/// The covers domain retains its existing intent API. Requested endpoints never
/// replace actual state, and unavailable group position/tilt is not offered.
class GroupedCoversRoomControls extends StatefulWidget {
  final CoversStateModel state;
  final Future<CoversIntentResult?> Function(String operation) send;
  final Future<CoversStateModel?> Function() reload;
  final SocketService? socket;
  final VoidCallback? showDevices;

  /// The group's covers, for the member tiles.
  final List<GroupedCoverMember> members;
  const GroupedCoversRoomControls({
    super.key,
    required this.state,
    required this.send,
    required this.reload,
    this.showDevices,
    this.socket,
    this.members = const [],
  });
  @override
  State<GroupedCoversRoomControls> createState() =>
      _GroupedCoversRoomControlsState();
}

class _GroupedCoversRoomControlsState extends State<GroupedCoversRoomControls> {
  bool _busy = false;
  bool _available = true;
  CoversStateModel? _fresh;
  SocketService? _socket;
  Timer? _timer;
  Timer? _coalesce;
  int _generation = 0;
  bool _loading = false;
  bool _refreshQueued = false;
  @override
  void initState() {
    super.initState();
    _fresh = widget.state;
    _socket =
        widget.socket ??
        (locator.isRegistered<SocketService>()
            ? locator<SocketService>()
            : null);
    _available = false;
    _socket?.addConnectionListener(_connection);
    _socket?.registerEventHandler(
      'DevicesVirtual.LightGroup.ReportedStateChanged',
      _event,
    );
    unawaited(_refresh());
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
  }

  @override
  void dispose() {
    ++_generation;
    _timer?.cancel();
    _coalesce?.cancel();
    _socket?.removeConnectionListener(_connection);
    _socket?.unregisterEventHandler(
      'DevicesVirtual.LightGroup.ReportedStateChanged',
      _event,
    );
    super.dispose();
  }

  void _connection(bool value) {
    ++_generation;
    _loading = false;
    _refreshQueued = false;
    setState(() {
      _available = false;
      _fresh = null;
    });
    if (value) unawaited(_refresh());
  }

  void _event(String event, Map<String, dynamic> payload) {
    if (_coalesce != null) return;
    ++_generation;
    _loading = false;
    _refreshQueued = false;
    setState(() => _available = false);
    _coalesce = Timer(const Duration(milliseconds: 200), () {
      _coalesce = null;
      unawaited(_refresh());
    });
  }

  /// Coalesces a follow-up read so a pre-command fetch cannot satisfy command refresh.
  Future<void> _refresh() async {
    if (_socket?.isConnected == false || !mounted) return;
    if (_loading) {
      _refreshQueued = true;
      return;
    }
    final generation = ++_generation;
    _loading = true;
    try {
      final state = await widget.reload();
      if (mounted && generation == _generation && !_refreshQueued) {
        setState(() {
          _fresh = state;
          _available = state != null;
        });
      }
    } catch (_) {
      if (mounted && generation == _generation) {
        setState(() {
          _available = false;
          _fresh = null;
        });
      }
    } finally {
      if (generation == _generation) {
        _loading = false;
        if (_refreshQueued && mounted) {
          _refreshQueued = false;
          unawaited(_refresh());
        }
      }
    }
  }

  CoversIntentResult? _result;
  bool _uncertain = false;
  Future<void> _send(String operation) async {
    if (_busy ||
        !_available ||
        !(_fresh?.groupOperations?.any(
              (entry) => entry.operation == operation && entry.commandable,
            ) ??
            false)) {
      return;
    }
    setState(() {
      _busy = true;
      _result = null;
      _uncertain = false;
    });
    try {
      final result = await widget.send(operation);
      if (!mounted) return;
      setState(() {
        _result = result;
        _uncertain = result == null;
        _available = false;
      });
      await _refresh();
    } catch (_) {
      if (mounted) setState(() => _uncertain = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _status(String status, AppLocalizations l) => switch (status) {
    'accepted' || 'pending' => l.groupPending,
    'confirmed' => l.groupConfirmed,
    'partial' => l.groupPartial,
    'failed' => l.groupFailed,
    'superseded' => l.groupSuperseded,
    'timed_out' => l.groupTimedOut,
    _ => l.groupUnavailable,
  };

  static AppOutcome _outcomeOf(String status) => switch (status) {
    'accepted' || 'pending' => AppOutcome.pending,
    'confirmed' => AppOutcome.completed,
    'partial' => AppOutcome.partial,
    'failed' => AppOutcome.failed,
    'superseded' => AppOutcome.superseded,
    'timed_out' => AppOutcome.notConfirmed,
    _ => AppOutcome.unavailable,
  };

  String _operationLabel(String operation, AppLocalizations l) =>
      switch (operation) {
        'open' => l.groupOpenAll,
        'close' => l.groupCloseAll,
        _ => l.groupStopAll,
      };

  /// The details layer: what each operation and member answered, and what
  /// the group's commands mean (spec §8, "Long sentences replaced").
  void _showDetails(List<OutcomeDetailRow> rows, {String? subtitle}) {
    final l = AppLocalizations.of(context)!;
    showOutcomeDetailsSheet(
      context,
      title: l.domain_shading,
      subtitle: subtitle,
      rows: rows,
      note: l.groupCoverMeaning,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = _fresh;
    final actual =
        _available && state?.groupExpiresAt?.isAfter(DateTime.now()) == true;
    final operations = state?.groupOperations ?? const <GroupCoverOperation>[];
    final result = _result;
    final mixed = actual && state!.isPositionMixed;
    final position = actual && !mixed ? state!.averagePosition : null;

    final unavailableRows = [
      for (final operation in operations.where((entry) => !entry.commandable))
        OutcomeDetailRow(
          icon: MdiIcons.blindsHorizontal,
          label:
              '${operation.operation}: ${operation.reasons.isEmpty ? l.groupReadinessUnavailable : operation.reasons.join('; ')}',
          outcome: AppOutcome.unavailable,
        ),
    ];

    final Widget feedback;
    if (_busy) {
      feedback = HeroFeedback(text: l.groupPending, icon: MdiIcons.refresh);
    } else if (_uncertain) {
      feedback = OutcomeIndicator(
        outcome: AppOutcome.notConfirmed,
        onDetails: () => _showDetails([
          OutcomeDetailRow(
            icon: MdiIcons.blindsHorizontal,
            label: l.groupUncertain,
            outcome: AppOutcome.notConfirmed,
          ),
          ...unavailableRows,
        ]),
      );
    } else if (result != null &&
        !(result.success && unavailableRows.isNotEmpty)) {
      // A completed command gives way to the reason a button is off.
      final outcome = result.success
          ? AppOutcome.completed
          : result.affectedDevices > 0
          ? AppOutcome.partial
          : AppOutcome.failed;
      final rows = [
        for (final target in result.failedTargets ?? <String>[])
          OutcomeDetailRow(
            icon: MdiIcons.blindsHorizontal,
            label: target,
            outcome: AppOutcome.failed,
          ),
        for (final composite in result.composites) ...[
          OutcomeDetailRow(
            icon: MdiIcons.blindsHorizontal,
            label: l.groupCommandOutcome(_status(composite.status, l)),
            outcome: _outcomeOf(composite.status),
          ),
          for (final child in composite.children)
            OutcomeDetailRow(
              icon: MdiIcons.blindsHorizontal,
              label:
                  '${child.memberIdentity ?? child.memberId}: ${_status(child.status, l)}${child.reason == null ? '' : ' — ${child.reason}'}',
              outcome: _outcomeOf(child.status),
            ),
        ],
        ...unavailableRows,
      ];
      feedback = outcome == AppOutcome.completed
          ? OutcomeIndicator(outcome: outcome)
          : OutcomeIndicator(
              outcome: outcome,
              onDetails: () => _showDetails(rows),
            );
    } else if (unavailableRows.isNotEmpty) {
      feedback = OutcomeIndicator(
        outcome: AppOutcome.unavailable,
        label: l.groupReadinessUnavailable,
        onDetails: () => _showDetails(unavailableRows),
      );
    } else {
      feedback = HeroFeedback(text: l.groupActualFeedback);
    }

    bool commandable(String operation) =>
        !_busy &&
        _available &&
        operations.any(
          (entry) => entry.operation == operation && entry.commandable,
        );

    HeroButtonData button(String operation, IconData icon) => HeroButtonData(
      key: ValueKey('room-cover-$operation'),
      label: _operationLabel(operation, l),
      icon: icon,
      onTap: commandable(operation) ? () => _send(operation) : null,
    );

    final header = PageHeader(
      title: l.domain_shading,
      subtitle: mixed
          ? '${l.shading_group_label} · ${l.shading_group_positions_differ}'
          : l.shading_group_label,
      subtitleColor: mixed
          ? Theme.of(context).status(AppStatus.warning).text
          : null,
      leading: HeaderMainIcon(
        icon: MdiIcons.blindsHorizontal,
        color: ThemeColors.shading,
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pMd,
        children: [
          HeaderIconButton(
            key: const ValueKey('room-cover-reload'),
            icon: MdiIcons.refresh,
            semanticLabel: l.groupReload,
            onTap: _busy ? null : _refresh,
          ),
          if (widget.showDevices != null)
            HeaderIconButton(
              key: const ValueKey('room-cover-devices'),
              icon: MdiIcons.windowShutterSettings,
              semanticLabel: l.shading_devices_title,
              onTap: widget.showDevices,
            ),
        ],
      ),
    );

    return DomainViewLayout(
      header: header,
      hero: HeroCard.slots(
        key: const ValueKey('room-cover-hero'),
        fill: true,
        value: !actual
            ? l.groupUnknown
            : mixed
            ? l.groupMixed
            : position == null
            ? l.groupUnknown
            : '$position',
        unit: position == null ? null : ' %',
        dimmed: _busy || position == null,
        feedback: feedback,
        buttons: HeroButtonRow(
          color: ThemeColors.shading,
          buttons: [
            button('open', MdiIcons.arrowUp),
            button('stop', MdiIcons.stop),
            button('close', MdiIcons.arrowDown),
          ],
        ),
      ),
      tiles: [
        for (final member in widget.members)
          DomainTile(
            name: member.name,
            value: member.position == null
                ? l.groupUnknown
                : '${member.position} %',
            color: ThemeColors.shading,
            valueMuted: member.position == null,
          ),
      ],
    );
  }
}
