import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations_en.dart';
import 'package:flutter/material.dart';

/// Server-owned comfort intent. Neither a countdown nor an accepted request is
/// evidence of physical heating/cooling. The parent retains modes and guards.
class VirtualThermostatComfort extends StatefulWidget {
  final String deviceId;
  final int? revision;
  final bool disabled;
  final VoidCallback onChanged;
  const VirtualThermostatComfort({
    super.key,
    required this.deviceId,
    required this.onChanged,
    this.revision,
    this.disabled = false,
  });

  @override
  State<VirtualThermostatComfort> createState() =>
      _VirtualThermostatComfortState();
}

class _VirtualThermostatComfortState extends State<VirtualThermostatComfort> {
  static const event = 'DevicesVirtualPlugin.Thermostat.RuntimeChanged';
  Map<String, dynamic>? _snapshot;
  String? _error, _readError;
  bool _pending = false, _reading = false, _ready = false, _editing = false;
  int _intentEpoch = 0;
  int _generation = 0, _operation = 0, _minimumRevision = 0, _ticks = 0;
  String? _expiredHint;
  Map<String, dynamic>? _selectionIntent;
  Timer? _timer;
  CancelToken? _readToken;
  SocketService? _socket;
  String get _path =>
      '/plugins/devices-virtual/producers/thermostats/${widget.deviceId}/comfort';
  AppLocalizations get l =>
      AppLocalizations.of(context) ?? AppLocalizationsEn();
  Map<String, dynamic>? _map(Object? raw) =>
      raw is Map ? Map<String, dynamic>.from(raw) : null;
  Map<String, dynamic>? get _configuration => _map(_snapshot?['configuration']);
  Map<String, dynamic>? get _override =>
      _map(_configuration?['temporary_override']);
  bool get _known =>
      _override == null ||
      [
        'active',
        'clock_uncertain',
        'expired',
        'cancelled',
      ].contains(_override?['status']);
  bool get _canAct => _ready && !_pending && !widget.disabled && _known;
  int? get _remaining {
    final end = DateTime.tryParse(_override?['expires_at']?.toString() ?? '');
    if (end == null) return null;
    return (end.difference(DateTime.now()).inMilliseconds / 1000).ceil().clamp(
      0,
      2147483647,
    );
  }

  @override
  void initState() {
    super.initState();
    if (locator.isRegistered<SocketService>()) {
      _socket = locator<SocketService>();
      _socket!.registerEventHandler(event, _hint);
      _socket!.addConnectionListener(_connection);
    }
    unawaited(_read());
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {});
      final expired = _override?['status'] == 'active' && _remaining == 0;
      if (expired && _expiredHint != _override?['id']) {
        _expiredHint = _override?['id']?.toString();
        unawaited(_read());
      } else if (++_ticks % 5 == 0 && !_editing) {
        unawaited(_read(background: _ready));
      }
    });
  }

  @override
  void didUpdateWidget(covariant VirtualThermostatComfort oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.deviceId != widget.deviceId) {
      _intentEpoch++;
      _generation++;
      _operation++;
      _snapshot = null;
      _pending = false;
      _ready = false;
      _reading = false;
      _editing = false;
      _minimumRevision = 0;
      _expiredHint = null;
      _selectionIntent = null;
      _error = null;
      _readError = null;
      unawaited(_read());
    } else if (oldWidget.revision != widget.revision ||
        oldWidget.disabled != widget.disabled) {
      _intentEpoch++;
      _generation++;
      _ready = false;
      _reading = false;
      if (!widget.disabled) unawaited(_read());
    }
  }

  @override
  void dispose() {
    _readToken?.cancel('comfort disposed');
    _generation++;
    _operation++;
    _timer?.cancel();
    _socket?.unregisterEventHandler(event, _hint);
    _socket?.removeConnectionListener(_connection);
    super.dispose();
  }

  void _connection(bool connected) {
    if (!mounted) return;
    setState(() {
      _intentEpoch++;
      _generation++;
      _ready = false;
      _reading = false;
    });
    if (connected) unawaited(_read());
  }

  void _hint(String name, Map<String, dynamic> payload) {
    if (!mounted || payload['controller'] != widget.deviceId) return;
    final revision = payload['configuration_revision'];
    if (revision is! num) return;
    if (revision.toInt() > _minimumRevision) {
      _intentEpoch++;
      _minimumRevision = revision.toInt();
    }
    if ((_snapshot?['revision'] as num? ?? -1) < _minimumRevision) {
      setState(() => _ready = false);
      if (!_reading) unawaited(_read());
    }
  }

  Future<void> _read({bool background = false}) async {
    if (!locator.isRegistered<Dio>() || _pending) return;
    if (background &&
        (widget.disabled || !_ready || !_known || _editing || _reading)) {
      return;
    }
    final id = widget.deviceId, ticket = ++_generation;
    setState(() {
      _reading = true;
      if (!background) {
        _intentEpoch++;
        _ready = false;
      }
    });
    try {
      _readToken?.cancel('comfort read superseded');
      final token = CancelToken();
      _readToken = token;
      final response = await locator<Dio>().get<Map<String, dynamic>>(
        _path,
        cancelToken: token,
      );
      if (!mounted || widget.deviceId != id || ticket != _generation) return;
      final state = _map(response.data?['data']);
      if (state == null ||
          state['controller'] != id ||
          state['revision'] is! num ||
          state['graph_revision'] is! num ||
          (state['revision'] as num) < _minimumRevision ||
          (state['revision'] as num) < (_snapshot?['revision'] as num? ?? -1) ||
          (state['graph_revision'] as num) <
              (_snapshot?['graph_revision'] as num? ?? -1)) {
        setState(() {
          _intentEpoch++;
          _ready = false;
          _readError = l.thermostatComfortError;
        });
        return;
      }
      setState(() {
        if (_snapshot?['revision'] != state['revision'] ||
            _snapshot?['graph_revision'] != state['graph_revision']) {
          _intentEpoch++;
        }
        _snapshot = state;
        _readError = null;
        _ready = _known;
        if (!_ready) _intentEpoch++;
      });
    } catch (error) {
      if (mounted && widget.deviceId == id && ticket == _generation) {
        setState(() {
          _intentEpoch++;
          _ready = false;
          _readError = error.toString();
        });
      }
    } finally {
      if (mounted && ticket == _generation) setState(() => _reading = false);
    }
  }

  Future<void> _act(String endpoint, Map<String, dynamic> input) async {
    if (!_canAct || _snapshot == null) return;
    final id = widget.deviceId, operation = ++_operation;
    final path = '$_path/$endpoint';
    final body = {
      ...input,
      'expected_revision': _snapshot!['revision'],
      'expected_graph_revision': _snapshot!['graph_revision'],
    };
    _readToken?.cancel('comfort action superseded read');
    setState(() {
      _intentEpoch++;
      _pending = true;
      _ready = false;
      _reading = false;
      _generation++;
      _error = null;
      _readError = null;
    });
    try {
      await locator<Dio>().post<Map<String, dynamic>>(path, data: body);
      if (mounted && widget.deviceId == id && operation == _operation) {
        widget.onChanged();
      }
    } catch (error) {
      if (mounted && widget.deviceId == id && operation == _operation) {
        setState(() => _error = error.toString());
      }
    } finally {
      if (mounted && widget.deviceId == id && operation == _operation) {
        setState(() => _pending = false);
        await _read(); // current baseline from server, including after conflicts
      }
    }
  }

  Future<void> _create() async {
    if (!_canAct || _configuration == null) return;
    final id = widget.deviceId,
        revision = _snapshot!['revision'],
        graph = _snapshot!['graph_revision'],
        epoch = _intentEpoch;
    _editing = true;
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) =>
          _ComfortOverrideDialog(configuration: _configuration!, labels: l),
    );
    if (!mounted || widget.deviceId != id) return;
    _editing = false;
    if (result != null &&
        _canAct &&
        _snapshot?['graph_revision'] == graph &&
        _intentEpoch == epoch &&
        _snapshot?['revision'] == revision &&
        (_snapshot?['revision'] as num? ?? -1) >= _minimumRevision) {
      await _act('override', result);
    } else if (result != null) {
      setState(() => _error = l.thermostatComfortError);
      await _read();
    }
  }

  Future<void> _openSelection(
    BuildContext buttonContext,
    String selected,
    List<Map> presets,
  ) async {
    if (!_canAct) return;
    final intent = <String, dynamic>{
      'controller': widget.deviceId,
      'revision': _snapshot?['revision'],
      'graph': _snapshot?['graph_revision'],
      'epoch': _intentEpoch,
    };
    _editing = true;
    _selectionIntent = intent;
    // Own the route future so rebuilds cannot replace either its opening token
    // or its cancellation callback (PopupMenuButton uses its latest callbacks).
    final button = buttonContext.findRenderObject()! as RenderBox;
    final overlay =
        Overlay.of(buttonContext).context.findRenderObject()! as RenderBox;
    final position = RelativeRect.fromRect(
      Rect.fromPoints(
        button.localToGlobal(Offset.zero, ancestor: overlay),
        button.localToGlobal(
          button.size.bottomRight(Offset.zero),
          ancestor: overlay,
        ),
      ),
      Offset.zero & overlay.size,
    );
    try {
      final value = await showMenu<String>(
        context: buttonContext,
        position: position,
        initialValue: selected,
        items: [
          PopupMenuItem(
            value: 'manual',
            child: Text(l.thermostatComfortManual),
          ),
          for (final preset in presets)
            if (preset['preset'] is String)
              PopupMenuItem(
                value: preset['preset'] as String,
                child: Text(_presetLabel(preset['preset'] as String)),
              ),
        ],
      );
      if (!mounted) return;
      if (value != null) await _select(value, intent);
    } finally {
      if (identical(intent, _selectionIntent)) {
        _editing = false;
        _selectionIntent = null;
      }
    }
  }

  Future<void> _select(String value, Map<String, dynamic> intent) async {
    // A retired route owns no state on a replacement controller or newer editor.
    if (!mounted ||
        !identical(intent, _selectionIntent) ||
        intent['controller'] != widget.deviceId) {
      return;
    }
    _selectionIntent = null;
    _editing = false;
    if (intent['revision'] == _snapshot?['revision'] &&
        intent['graph'] == _snapshot?['graph_revision'] &&
        intent['epoch'] == _intentEpoch &&
        _canAct) {
      await _act('selection', {
        'preset': value == 'manual' ? null : value,
        'clear_user_off': false,
      });
    } else {
      setState(() => _error = l.thermostatComfortError);
      await _read();
    }
  }

  String _presetLabel(String? value) => switch (value) {
    'comfort' => l.thermostatComfortComfort,
    'eco' => l.thermostatComfortEco,
    'away' => l.thermostatComfortAway,
    null || 'manual' => l.thermostatComfortManual,
    _ => value,
  };

  @override
  Widget build(BuildContext context) {
    final configuration = _configuration, override = _override;
    final presets = (configuration?['presets'] as List? ?? [])
        .whereType<Map>()
        .toList();
    final selected = configuration?['selected_preset']?.toString() ?? 'manual';
    final error = _error ?? _readError;
    final effective = _map(_snapshot?['effective']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(),
        Text(
          l.thermostatComfortTitle,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        Text(l.thermostatComfortHelp),
        if (error != null)
          Text(
            '${l.thermostatComfortError}: $error',
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        TextButton(
          onPressed: !_pending ? _read : null,
          child: Text(l.thermostatComfortReload),
        ),
        if (_snapshot != null && configuration == null)
          Text(l.thermostatComfortUnconfigured),
        if (effective != null)
          Text(
            '${l.thermostatComfortEffective}: ${effective['source']} / ${_presetLabel(effective['preset']?.toString())} · ${effective['heating_setpoint'] ?? '—'} / ${effective['cooling_setpoint'] ?? '—'} °C',
          ),
        if (configuration?['user_off'] == true) ...[
          Text(l.thermostatComfortOffHeld),
          TextButton(
            key: const ValueKey('comfort-clear-off'),
            onPressed: _canAct
                ? () => _act('selection', {
                    'preset': configuration?['selected_preset'],
                    'clear_user_off': true,
                  })
                : null,
            child: Text(l.thermostatComfortClearOff),
          ),
          Text(l.thermostatComfortOffClearHelp),
        ],
        if (override != null) ...[
          Text('${l.thermostatComfortStatus}: ${override['status']}'),
          if (!['active', 'expired', 'cancelled'].contains(override['status']))
            Text(l.thermostatComfortUncertain),
          Text('${l.thermostatComfortExpires}: ${override['expires_at']}'),
          if (override['status'] == 'active')
            Text(
              '${l.thermostatComfortRemaining}: ${_remaining ?? '—'} s. ${l.thermostatComfortExpiryHint}',
            ),
          if (['active', 'clock_uncertain'].contains(override['status']))
            TextButton(
              key: const ValueKey('comfort-cancel'),
              onPressed: _canAct
                  ? () =>
                        _act('override/cancel', {'override_id': override['id']})
                  : null,
              child: Text(l.thermostatComfortCancel),
            ),
        ],
        if (_snapshot != null)
          ExpansionTile(
            key: const ValueKey('comfort-diagnostics'),
            title: Text(l.thermostatComfortClockPolicy),
            children: [
              Text(
                '${l.thermostatComfortClockPolicy}: ${_snapshot!['clock_policy']}',
              ),
              if (override != null) ...[
                Text(
                  '${l.thermostatComfortSource}: ${override['source']} · ${l.thermostatComfortActor}: ${override['actor_id']}',
                ),
                Text(
                  '${l.thermostatComfortIdentity}: ${override['id']} · ${l.thermostatComfortRevision}: ${override['revision']}',
                ),
              ],
            ],
          ),
        if (configuration != null) ...[
          Text(l.thermostatComfortSelected),
          Builder(
            builder: (buttonContext) => TextButton(
              key: const ValueKey('comfort-selection'),
              onPressed: _canAct
                  ? () => _openSelection(buttonContext, selected, presets)
                  : null,
              child: Row(
                children: [
                  Expanded(child: Text(_presetLabel(selected))),
                  const Icon(Icons.arrow_drop_down),
                ],
              ),
            ),
          ),
          TextButton(
            key: const ValueKey('comfort-create'),
            onPressed: _canAct ? _create : null,
            child: Text(l.thermostatComfortCreate),
          ),
        ],
      ],
    );
  }
}

class _ComfortOverrideDialog extends StatefulWidget {
  final Map<String, dynamic> configuration;
  final AppLocalizations labels;
  const _ComfortOverrideDialog({
    required this.configuration,
    required this.labels,
  });
  @override
  State<_ComfortOverrideDialog> createState() => _ComfortOverrideDialogState();
}

class _ComfortOverrideDialogState extends State<_ComfortOverrideDialog> {
  final heat = TextEditingController(),
      cool = TextEditingController(),
      minutes = TextEditingController();
  String selection = 'explicit';
  @override
  void dispose() {
    heat.dispose();
    cool.dispose();
    minutes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.labels;
    final configuration = widget.configuration;
    final presets = (configuration['presets'] as List? ?? []).whereType<Map>();
    final heating = configuration['heating_range'] is Map,
        cooling = configuration['cooling_range'] is Map;
    final duration = int.tryParse(minutes.text);
    final heatValue = double.tryParse(heat.text.trim().replaceAll(',', '.')),
        coolValue = double.tryParse(cool.text.trim().replaceAll(',', '.'));
    bool validBranch(String branch, double? value) {
      final range = configuration['${branch}_range'];
      return range is! Map ||
          value != null &&
              value.isFinite &&
              range['minimum'] is num &&
              range['maximum'] is num &&
              value >= (range['minimum'] as num) &&
              value <= (range['maximum'] as num);
    }

    final valid =
        duration != null &&
        duration >= 1 &&
        duration <= 10080 &&
        (selection != 'explicit' ||
            (heating || cooling) &&
                validBranch('heating', heatValue) &&
                validBranch('cooling', coolValue));
    String presetLabel(String value) => switch (value) {
      'comfort' => l.thermostatComfortComfort,
      'eco' => l.thermostatComfortEco,
      'away' => l.thermostatComfortAway,
      _ => value,
    };
    return AlertDialog(
      title: Text(l.thermostatComfortOverride),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButton<String>(
              key: const ValueKey('override-preset'),
              value: selection,
              isExpanded: true,
              items: [
                DropdownMenuItem(
                  value: 'explicit',
                  child: Text(l.thermostatComfortExplicit),
                ),
                for (final preset in presets)
                  if (preset['preset'] is String)
                    DropdownMenuItem(
                      value: preset['preset'] as String,
                      child: Text(presetLabel(preset['preset'] as String)),
                    ),
              ],
              onChanged: (value) =>
                  setState(() => selection = value ?? 'explicit'),
            ),
            if (selection == 'explicit' && heating)
              TextField(
                key: const ValueKey('override-heating'),
                controller: heat,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                  signed: true,
                ),
                decoration: InputDecoration(
                  labelText: '${l.thermostatComfortHeating} (°C)',
                ),
                onChanged: (_) => setState(() {}),
              ),
            if (selection == 'explicit' && cooling)
              TextField(
                key: const ValueKey('override-cooling'),
                controller: cool,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                  signed: true,
                ),
                decoration: InputDecoration(
                  labelText: '${l.thermostatComfortCooling} (°C)',
                ),
                onChanged: (_) => setState(() {}),
              ),
            TextField(
              key: const ValueKey('override-duration'),
              controller: minutes,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: l.thermostatComfortDuration,
              ),
              onChanged: (_) => setState(() {}),
            ),
            Text(l.thermostatComfortServerValidation),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l.button_cancel),
        ),
        FilledButton(
          key: const ValueKey('override-submit'),
          onPressed: valid
              ? () => Navigator.pop(context, {
                  'preset': selection == 'explicit' ? null : selection,
                  'setpoints': selection == 'explicit'
                      ? {
                          'heating_setpoint': heating ? heatValue : null,
                          'cooling_setpoint': cooling ? coolValue : null,
                        }
                      : null,
                  'expires_at': DateTime.now()
                      .toUtc()
                      .add(Duration(minutes: duration))
                      .toIso8601String(),
                })
              : null,
          child: Text(l.thermostatComfortCreate),
        ),
      ],
    );
  }
}
