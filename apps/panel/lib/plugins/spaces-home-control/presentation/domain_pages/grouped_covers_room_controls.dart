import 'dart:async';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/covers_state/covers_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/intent_result/intent_result.dart';
import 'package:flutter/material.dart';

/// The covers domain retains its existing intent API. Requested endpoints never
/// replace actual state, and unavailable group position/tilt is not offered.
class GroupedCoversRoomControls extends StatefulWidget {
  final CoversStateModel state;
  final Future<CoversIntentResult?> Function(String operation) send;
  final Future<CoversStateModel?> Function() reload;
  final SocketService? socket;
  final VoidCallback? showDevices;
  const GroupedCoversRoomControls({
    super.key,
    required this.state,
    required this.send,
    required this.reload,
    this.showDevices,
    this.socket,
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
    setState(() => _available = false);
    _coalesce = Timer(const Duration(milliseconds: 200), () {
      _coalesce = null;
      unawaited(_refresh());
    });
  }

  Future<void> _refresh() async {
    if (_loading || _socket?.isConnected == false) return;
    final generation = ++_generation;
    _loading = true;
    try {
      final state = await widget.reload();
      if (mounted && generation == _generation) {
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
      if (generation == _generation) _loading = false;
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
  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final state = _fresh;
    final actual =
        _available && state?.groupExpiresAt?.isAfter(DateTime.now()) == true;
    final operations = state?.groupOperations ?? const <GroupCoverOperation>[];
    final result = _result;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          l.domain_shading,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        Text(l.groupActualFeedback),
        Text(
          !actual
              ? l.groupUnknown
              : state!.isPositionMixed
              ? l.groupMixed
              : state.averagePosition == null
              ? l.groupUnknown
              : '${state.averagePosition}%',
        ),
        Text(l.groupCoverMeaning),
        if (_busy) ...[const LinearProgressIndicator(), Text(l.groupPending)],
        if (_uncertain) Text(l.groupUncertain),
        Wrap(
          spacing: 12,
          children: [
            for (final operation in ['open', 'close', 'stop'])
              FilledButton(
                key: ValueKey('room-cover-$operation'),
                onPressed:
                    !_busy &&
                        _available &&
                        operations.any(
                          (entry) =>
                              entry.operation == operation && entry.commandable,
                        )
                    ? () => _send(operation)
                    : null,
                child: Text(switch (operation) {
                  'open' => l.groupOpenAll,
                  'close' => l.groupCloseAll,
                  _ => l.groupStopAll,
                }),
              ),
            TextButton(
              onPressed: _busy ? null : _refresh,
              child: Text(l.groupReload),
            ),
            if (widget.showDevices != null)
              TextButton(
                onPressed: widget.showDevices,
                child: Text(l.shading_devices_title),
              ),
          ],
        ),
        for (final operation in operations.where((entry) => !entry.commandable))
          Text(
            '${operation.operation}: ${operation.reasons.isEmpty ? l.groupReadinessUnavailable : operation.reasons.join('; ')}',
          ),
        if (result != null) ...[
          Text(
            result.success
                ? l.groupConfirmed
                : result.affectedDevices > 0
                ? l.groupPartial
                : l.groupFailed,
          ),
          for (final target in result.failedTargets ?? <String>[]) Text(target),
          for (final composite in result.composites) ...[
            Text(l.groupCommandOutcome(_status(composite.status, l))),
            for (final child in composite.children)
              Text(
                '${child.memberIdentity ?? child.memberId}: ${_status(child.status, l)}${child.reason == null ? '' : ' — ${child.reason}'}',
              ),
          ],
        ],
      ],
    );
  }
}
