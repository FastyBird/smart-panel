import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations_en.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:flutter/material.dart';
import 'package:uuid/uuid.dart';

/// Probes the dedicated native contract. Only an initial 404 selects guarded UI.
/// Requests are explicit UUID/CAS operations; HTTP acceptance is never activity.
class NativeThermostatDeviceDetail extends StatefulWidget {
  final ThermostatDeviceView device;

  const NativeThermostatDeviceDetail({super.key, required this.device});

  @override
  State<NativeThermostatDeviceDetail> createState() =>
      _NativeThermostatDeviceDetailState();
}

class _NativeThermostatDeviceDetailState
    extends State<NativeThermostatDeviceDetail> {
  static const _deadline = Duration(seconds: 10);
  static const _freshness = Duration(seconds: 15);
  final _heatingDraft = TextEditingController();
  final _coolingDraft = TextEditingController();
  Timer? _poll;
  Timer? _clock;
  SocketService? _socket;
  CancelToken? _readToken;
  CancelToken? _writeToken;
  Map<String, dynamic>? _snapshot;
  bool _guarded = false;
  bool _knownNative = false;
  bool _busy = false;
  bool _connected = true;
  bool _failed = false;
  bool _uncertain = false;
  bool _refused = false;
  int _scope = 0;
  int _readGeneration = 0;
  Duration _age = Duration.zero;
  final _stopwatch = Stopwatch()..start();
  Duration _receivedAt = Duration.zero;

  String get _path =>
      '/plugins/devices-virtual/producers/thermostats/native/${widget.device.id}';
  bool get _fresh =>
      _snapshot != null &&
      _age < _freshness &&
      _stopwatch.elapsed - _receivedAt < _freshness;

  @override
  void initState() {
    super.initState();
    if (locator.isRegistered<SocketService>()) {
      _socket = locator<SocketService>();
      _connected = _socket!.isConnected;
      _socket!.addConnectionListener(_connectionChanged);
    }
    unawaited(_refresh());
    _poll = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!_guarded && !_busy && _readToken == null) unawaited(_refresh());
    });
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && !_guarded) {
        setState(() => _age += const Duration(seconds: 1));
      }
    });
  }

  void _fence() {
    _scope++;
    _readGeneration++;
    _readToken?.cancel();
    _writeToken?.cancel();
    _readToken = null;
    _writeToken = null;
    _snapshot = null;
    _busy = false;
  }

  @override
  void didUpdateWidget(covariant NativeThermostatDeviceDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.device.id == widget.device.id) return;
    _fence();
    _knownNative = false;
    _heatingDraft.clear();
    _coolingDraft.clear();
    _guarded = false;
    _failed = false;
    _uncertain = false;
    _refused = false;
    unawaited(_refresh());
  }

  void _connectionChanged(bool connected) {
    if (!mounted || _guarded) return;
    // Disconnect revokes stale observations and every pending completion too.
    setState(() {
      _connected = connected;
      if (_busy) _uncertain = true;
      _fence();
    });
    if (connected) unawaited(_refresh());
  }

  @override
  void dispose() {
    _fence();
    _poll?.cancel();
    _clock?.cancel();
    _stopwatch.stop();
    _heatingDraft.dispose();
    _coolingDraft.dispose();
    _socket?.removeConnectionListener(_connectionChanged);
    super.dispose();
  }

  Map<String, dynamic> _decode(
    Response<Map<String, dynamic>> response,
    String controller,
  ) {
    final data = Map<String, dynamic>.from(
      response.data?['data'] as Map? ?? {},
    );
    final revision = data['revision'];
    if (data['controller'] != controller ||
        data['control_strategy'] != 'native_unit' ||
        revision is! int ||
        revision < 1) {
      throw const FormatException('Invalid native thermostat response');
    }
    return data;
  }

  Future<void> _refresh() async {
    if (_busy || _guarded || !_connected || !locator.isRegistered<Dio>()) {
      return;
    }
    final scope = _scope;
    final generation = ++_readGeneration;
    final id = widget.device.id;
    _readToken?.cancel();
    final token = CancelToken();
    setState(() => _readToken = token);
    try {
      final response = await locator<Dio>()
          .get<Map<String, dynamic>>(
            _path,
            cancelToken: token,
            options: Options(receiveTimeout: _deadline, sendTimeout: _deadline),
          )
          .timeout(
            _deadline,
            onTimeout: () {
              token.cancel('Read deadline');
              throw TimeoutException('Native thermostat read deadline');
            },
          );
      if (!mounted || scope != _scope || generation != _readGeneration) return;
      final snapshot = _decode(response, id);
      setState(() {
        _snapshot = snapshot;
        _knownNative = true;
        _failed = false;
        _uncertain = false;
        _age = Duration.zero;
        _receivedAt = _stopwatch.elapsed;
      });
    } catch (error) {
      if (!mounted || scope != _scope || generation != _readGeneration) return;
      setState(() {
        _snapshot = null;
        if (!_knownNative &&
            error is DioException &&
            error.response?.statusCode == 404) {
          _guarded = true;
        } else {
          _failed = true;
        }
      });
    } finally {
      if (mounted && scope == _scope && generation == _readGeneration) {
        setState(() => _readToken = null);
      }
    }
  }

  Future<void> _request(Map<String, dynamic> patch) async {
    if (!_fresh ||
        !_connected ||
        _busy ||
        _uncertain ||
        _snapshot?['binding_state'] != 'bound') {
      return;
    }
    final revision = _snapshot!['revision'];
    final scope = _scope;
    final id = widget.device.id;
    final path = _path;
    _readGeneration++;
    _readToken?.cancel();
    _readToken = null;
    final token = CancelToken();
    _writeToken = token;
    setState(() {
      _busy = true;
      _refused = false;
    });
    try {
      final response = await locator<Dio>()
          .post<Map<String, dynamic>>(
            '$path/requests',
            data: {
              'request_id': const Uuid().v4(),
              'expected_revision': revision,
              ...patch,
            },
            cancelToken: token,
            options: Options(receiveTimeout: _deadline, sendTimeout: _deadline),
          )
          .timeout(
            _deadline,
            onTimeout: () {
              token.cancel('Write deadline');
              throw TimeoutException('Native thermostat request deadline');
            },
          );
      if (!mounted || scope != _scope) return;
      final snapshot = _decode(response, id);
      setState(() {
        _snapshot = snapshot;
        _age = Duration.zero;
        _receivedAt = _stopwatch.elapsed;
        _failed = false;
      });
    } catch (error) {
      if (!mounted || scope != _scope) return;
      // Never resend an unknown request. Only an authoritative GET can restore
      // command admission after a lost response, refusal or revision conflict.
      setState(() {
        _snapshot = null;
        _uncertain = true;
        final status = error is DioException
            ? error.response?.statusCode
            : null;
        _refused =
            status != null && status >= 400 && status < 500 && status != 408;
      });
    } finally {
      if (mounted && scope == _scope) {
        setState(() => _busy = false);
        _writeToken = null;
        unawaited(_refresh());
      }
    }
  }

  Map<String, dynamic> _map(Object? value) =>
      value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
  double? _number(Object? value) =>
      value is num && value.isFinite ? value.toDouble() : null;

  @override
  Widget build(BuildContext context) {
    if (_guarded) return VirtualThermostatDeviceDetail(device: widget.device);
    final l = AppLocalizations.of(context) ?? AppLocalizationsEn();
    final data = _snapshot;
    final requested = _map(data?['requested']);
    final observed = _map(data?['observed']);
    final capabilities = _map(data?['capabilities']);
    final enabled =
        _fresh &&
        _connected &&
        !_busy &&
        !_uncertain &&
        data?['binding_state'] == 'bound' &&
        capabilities.isNotEmpty;
    final available = _fresh && observed['available'] == true;
    String value(Object? value) => value?.toString() ?? l.value_not_available;
    Widget row(String label, Object? content) =>
        Text('$label: ${value(content)}');
    final modes = capabilities['modes'] is List
        ? capabilities['modes'] as List
        : const [];
    final heatDraft = double.tryParse(_heatingDraft.text);
    final coolDraft = double.tryParse(_coolingDraft.text);
    final validRange =
        _validTarget(capabilities['heating'], heatDraft) &&
        _validTarget(capabilities['cooling'], coolDraft) &&
        heatDraft! < coolDraft!;
    final latest = _map(data?['latest_request']);
    final operations = latest['operations'] is List
        ? latest['operations'] as List
        : const [];

    return Material(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            widget.device.name,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          Text(l.native_thermostat_title),
          Text(l.native_thermostat_explanation),
          if (_busy) const LinearProgressIndicator(),
          if (_uncertain && !_refused) Text(l.native_thermostat_unknown),
          if (_refused) Text(l.native_thermostat_refused),
          if (!_connected || _failed || (data != null && !_fresh))
            Text(l.native_thermostat_stale),
          if (_connected && data == null && !_failed && !_uncertain)
            Text(l.value_loading),
          row(l.native_thermostat_binding, data?['binding_state']),
          row(l.native_thermostat_requested_mode, requested['mode']),
          row(l.native_thermostat_requested_heat, requested['heatingSetpoint']),
          row(l.native_thermostat_requested_cool, requested['coolingSetpoint']),
          row(
            l.native_thermostat_observed_temperature,
            available ? observed['temperature'] : null,
          ),
          row(
            l.native_thermostat_observed_mode,
            available ? observed['mode'] : null,
          ),
          row(
            l.native_thermostat_observed_heat,
            available ? observed['heatingSetpoint'] : null,
          ),
          row(
            l.native_thermostat_observed_cool,
            available ? observed['coolingSetpoint'] : null,
          ),
          row(
            l.native_thermostat_activity,
            available ? observed['activity'] : null,
          ),
          row(
            l.native_thermostat_observed_at,
            available ? observed['observedAt'] : null,
          ),
          for (final reason
              in observed['reasons'] is List
                  ? observed['reasons'] as List
                  : const [])
            Text(value(reason)),
          if (data?['drift'] is List && (data!['drift'] as List).isNotEmpty)
            row(l.native_thermostat_drift, (data['drift'] as List).join(', ')),
          if (latest.isNotEmpty)
            row(l.native_thermostat_request_state, latest['state']),
          for (final operation in operations)
            if (operation is Map)
              Text(
                '${value(operation['operation'])}: ${switch (operation['outcome']) {
                  'accepted' => l.native_thermostat_accepted,
                  'refused' => l.native_thermostat_refused,
                  _ => l.native_thermostat_unknown,
                }}${operation['reason'] == null ? '' : ' (${operation['reason']})'}',
              ),
          Wrap(
            spacing: 8,
            children: [
              for (final mode in modes.whereType<String>())
                // AUTO is a range request, never a mode-only substitute.
                if (mode != 'auto' && mode != 'heat_cool')
                  OutlinedButton(
                    key: ValueKey('native-mode-$mode'),
                    onPressed: enabled
                        ? () => unawaited(_request({'mode': mode}))
                        : null,
                    child: Text(mode),
                  ),
            ],
          ),
          for (final branch in ['heating', 'cooling'])
            if (capabilities[branch] is Map)
              _targetControls(branch, capabilities, requested, enabled, l),
          // One explicit combined HA range command, only with qualified bounds.
          if (capabilities['supportsCompound'] == true &&
              modes.contains('auto'))
            OutlinedButton(
              key: const ValueKey('native-auto'),
              onPressed: enabled && validRange
                  ? () => unawaited(
                      _request({
                        'mode': 'auto',
                        'heating_setpoint': heatDraft,
                        'cooling_setpoint': coolDraft,
                      }),
                    )
                  : null,
              child: Text(l.native_thermostat_auto),
            ),
          TextButton(
            key: const ValueKey('native-refresh'),
            onPressed: _busy || _readToken != null || !_connected
                ? null
                : () => unawaited(_refresh()),
            child: Text(l.native_thermostat_refresh),
          ),
        ],
      ),
    );
  }

  bool _validTarget(Object? bounds, double? target) {
    final range = _map(bounds);
    final minimum = _number(range['minimum']);
    final maximum = _number(range['maximum']);
    final step = _number(range['step']);
    if (target == null ||
        !target.isFinite ||
        minimum == null ||
        maximum == null ||
        step == null ||
        step <= 0 ||
        target < minimum ||
        target > maximum) {
      return false;
    }
    final steps = (target - minimum) / step;
    return (steps - steps.round()).abs() < 0.000001;
  }

  Map<String, dynamic>? _targetAction(
    String branch,
    double? target,
    Map<String, dynamic> capabilities,
  ) {
    if (!_validTarget(capabilities[branch], target)) return null;
    final action = <String, dynamic>{'${branch}_setpoint': target};
    if (_snapshot?['provider'] != 'home-assistant' ||
        capabilities['heating'] is! Map ||
        capabilities['cooling'] is! Map) {
      return action;
    }
    final modes = capabilities['modes'] as List? ?? const [];
    final mode = branch == 'heating' ? 'heat' : 'cool';
    if (modes.contains(mode)) return {'mode': mode, ...action};
    final heat = branch == 'heating'
        ? target
        : double.tryParse(_heatingDraft.text);
    final cool = branch == 'cooling'
        ? target
        : double.tryParse(_coolingDraft.text);
    if (capabilities['supportsCompound'] != true ||
        !modes.contains('auto') ||
        !_validTarget(capabilities['heating'], heat) ||
        !_validTarget(capabilities['cooling'], cool) ||
        heat! >= cool!) {
      return null;
    }
    return {'mode': 'auto', 'heating_setpoint': heat, 'cooling_setpoint': cool};
  }

  Widget _targetControls(
    String branch,
    Map<String, dynamic> capabilities,
    Map<String, dynamic> requested,
    bool enabled,
    AppLocalizations l,
  ) {
    final range = _map(capabilities[branch]);
    final minimum = _number(range['minimum']);
    final maximum = _number(range['maximum']);
    final step = _number(range['step']);
    // Never seed requested intent from a synthetic default or an observation.
    final current = _number(requested['${branch}Setpoint']);
    final valid =
        minimum != null &&
        maximum != null &&
        minimum <= maximum &&
        step != null &&
        step > 0 &&
        current != null;
    final draft = branch == 'heating' ? _heatingDraft : _coolingDraft;
    final target = double.tryParse(draft.text);
    final action = _targetAction(branch, target, capabilities);
    final canApply = enabled && action != null;
    final mode = branch == 'heating' ? 'heat' : 'cool';
    final modes = capabilities['modes'] as List? ?? const [];
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                branch == 'heating'
                    ? l.native_thermostat_requested_heat
                    : l.native_thermostat_requested_cool,
              ),
            ),
            for (final direction in [-1, 1])
              IconButton(
                key: ValueKey('native-$branch-$direction'),
                tooltip: direction < 0
                    ? l.native_thermostat_decrease
                    : l.native_thermostat_increase,
                onPressed:
                    enabled &&
                        valid &&
                        current + direction * step >= minimum &&
                        current + direction * step <= maximum &&
                        _targetAction(
                              branch,
                              current + direction * step,
                              capabilities,
                            ) !=
                            null
                    ? () {
                        final action = _targetAction(
                          branch,
                          current + direction * step,
                          capabilities,
                        );
                        if (action != null) unawaited(_request(action));
                      }
                    : null,
                icon: Icon(direction < 0 ? Icons.remove : Icons.add),
              ),
          ],
        ),
        TextField(
          key: ValueKey('native-$branch-draft'),
          controller: draft,
          enabled: enabled,
          keyboardType: const TextInputType.numberWithOptions(
            decimal: true,
            signed: true,
          ),
          decoration: InputDecoration(labelText: l.native_thermostat_draft),
          onChanged: (_) => setState(() {}),
        ),
        Wrap(
          spacing: 8,
          children: [
            OutlinedButton(
              key: ValueKey('native-$branch-apply'),
              onPressed: canApply ? () => unawaited(_request(action)) : null,
              child: Text(l.native_thermostat_apply),
            ),
            if (capabilities['supportsCompound'] == true &&
                modes.contains(mode))
              OutlinedButton(
                key: ValueKey('native-$branch-mode-apply'),
                onPressed: canApply
                    ? () => unawaited(
                        _request({'mode': mode, '${branch}_setpoint': target}),
                      )
                    : null,
                child: Text('${l.native_thermostat_apply}: $mode'),
              ),
          ],
        ),
      ],
    );
  }
}
