import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_commands.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_input.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:flutter/material.dart';

/// Device-scoped controls for a virtual climate controller. Physical thermostat
/// details use their own controller and must never command these claimed leaves.
class VirtualThermostatDeviceDetail extends StatefulWidget {
  final ThermostatDeviceView device;

  const VirtualThermostatDeviceDetail({super.key, required this.device});

  @override
  State<VirtualThermostatDeviceDetail> createState() =>
      _VirtualThermostatDeviceDetailState();
}

class _VirtualThermostatDeviceDetailState
    extends State<VirtualThermostatDeviceDetail> {
  Timer? _refreshTimer;
  Timer? _freshnessTimer;
  Timer? _resyncTimer;
  SocketService? _socket;
  static const _runtimeEvent = 'DevicesVirtualPlugin.Thermostat.RuntimeChanged';
  Map<String, dynamic>? _latestHint;
  int _hintSerial = 0;
  bool _hintRefreshNeeded = false;
  bool _configurationMismatchSeen = false;
  DateTime? _runtimeReceivedAt;
  Map<String, dynamic>? _configuration;
  Map<String, dynamic>? _runtime;
  String? _error;
  bool _busy = false;
  int _refreshGeneration = 0;
  String? _refreshInFlightFor;

  String get _path =>
      '/plugins/devices-virtual/producers/thermostats/${widget.device.id}';

  @override
  void initState() {
    super.initState();
    if (locator.isRegistered<SocketService>()) {
      _socket = locator<SocketService>();
      _socket!.registerEventHandler(_runtimeEvent, _runtimeChanged);
      _socket!.addConnectionListener(_connectionChanged);
    }
    unawaited(_refresh());
    _freshnessTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(_refresh()),
    );
  }

  @override
  void dispose() {
    _refreshGeneration++;
    _refreshInFlightFor = null;
    _refreshTimer?.cancel();
    _freshnessTimer?.cancel();
    _resyncTimer?.cancel();
    _socket?.unregisterEventHandler(_runtimeEvent, _runtimeChanged);
    _socket?.removeConnectionListener(_connectionChanged);
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant VirtualThermostatDeviceDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.device.id == widget.device.id) return;
    _refreshGeneration++;
    _resyncTimer?.cancel();
    _latestHint = null;
    _hintRefreshNeeded = false;
    _configurationMismatchSeen = false;
    _configuration = null;
    _runtime = null;
    _error = null;
    _busy = false;
    unawaited(_refresh());
  }

  bool _coversHint(Map<String, dynamic>? runtime, Map<String, dynamic>? hint) =>
      runtime != null &&
      hint != null &&
      runtime['epoch'] is String &&
      runtime['epoch'] == hint['epoch'] &&
      runtime['sequence'] is num &&
      hint['sequence'] is num &&
      (runtime['sequence'] as num) >= (hint['sequence'] as num);

  void _runtimeChanged(String event, Map<String, dynamic> payload) {
    if (!mounted || payload['controller'] != widget.device.id) return;
    // Events are invalidation hints only. They never overwrite an HTTP snapshot.
    if (_coversHint(_runtime, payload) || _coversHint(_latestHint, payload)) {
      return;
    }
    _latestHint = Map<String, dynamic>.from(payload);
    _hintSerial++;
    _hintRefreshNeeded = true;
    _scheduleResync();
  }

  void _connectionChanged(bool connected) {
    if (!mounted || !connected) return;
    // A new connection may represent a new server epoch. Fence older HTTP work.
    _refreshGeneration++;
    _refreshInFlightFor = null;
    _latestHint = null;
    _hintSerial++;
    _hintRefreshNeeded = true;
    _scheduleResync();
  }

  void _scheduleResync() {
    if (!mounted ||
        _busy ||
        _refreshInFlightFor != null ||
        _resyncTimer?.isActive == true) {
      return;
    }
    _resyncTimer = Timer(const Duration(milliseconds: 100), () {
      if (mounted && _hintRefreshNeeded) unawaited(_refresh(force: true));
    });
  }

  Future<void> _refresh({bool force = false}) async {
    if (!locator.isRegistered<Dio>() || _busy) return;
    final path = _path;
    if (!force && _refreshInFlightFor == path) return;
    final generation = ++_refreshGeneration;
    final hintSerial = _hintSerial;
    _refreshInFlightFor = path;
    try {
      final dio = locator<Dio>();
      final responses = await Future.wait([
        dio.get<Map<String, dynamic>>(path),
        dio.get<Map<String, dynamic>>('$path/runtime'),
      ]);
      if (!mounted || generation != _refreshGeneration) return;
      final candidate = Map<String, dynamic>.from(
        responses[1].data?['data'] as Map? ?? {},
      );
      // A runtime GET also publishes an event. Its matching stamp acknowledges
      // that hint, preventing a fetch/event loop while rejecting older snapshots.
      if (_hintSerial != hintSerial && !_coversHint(candidate, _latestHint)) {
        return;
      }
      final configuration = Map<String, dynamic>.from(
        responses[0].data?['data'] as Map? ?? {},
      );
      final configurationRevision = configuration['revision'];
      final runtimeRevision = candidate['configuration_revision'];
      if (configurationRevision is num &&
          runtimeRevision is num &&
          runtimeRevision > 0 &&
          configurationRevision != runtimeRevision) {
        // Concurrent GETs can straddle an edit. Retry once promptly, then let
        // the bounded poll resync if authoring continues to change underneath us.
        _hintRefreshNeeded = !_configurationMismatchSeen;
        _configurationMismatchSeen = true;
        return;
      }
      _configurationMismatchSeen = false;
      _hintRefreshNeeded = false;
      setState(() {
        _configuration = configuration;
        _runtime = Map<String, dynamic>.from(
          responses[1].data?['data'] as Map? ?? {},
        );
        _runtimeReceivedAt = DateTime.now();
        _error = null;
      });
    } catch (error) {
      if (mounted && generation == _refreshGeneration) {
        // The bounded poll retries failed HTTP reads.
        _hintRefreshNeeded = false;
        setState(() {
          _error = error.toString();
          _runtime = null;
        });
      }
    } finally {
      if (generation == _refreshGeneration) {
        _refreshInFlightFor = null;
        if (_hintRefreshNeeded) _scheduleResync();
      }
    }
  }

  String? _settingProperty(String role) {
    for (final raw in (_configuration?['settings'] as List? ?? const [])) {
      if (raw is Map && raw['setting'] == role && raw['property'] is String) {
        return raw['property'] as String;
      }
    }
    return null;
  }

  PropertyCommandItem? _command(String role, Object value) {
    final propertyId = _settingProperty(role);
    if (propertyId == null) return null;
    for (final channel in widget.device.channels) {
      for (final property in channel.properties) {
        if (property.id == propertyId && property.isWritable) {
          return PropertyCommandItem(
            deviceId: widget.device.id,
            channelId: channel.id,
            propertyId: property.id,
            value: value,
          );
        }
      }
    }
    return null;
  }

  Future<void> _send(
    List<PropertyCommandItem> commands, {
    bool requireAtomicBatch = false,
  }) async {
    if (_busy || commands.isEmpty || !locator.isRegistered<DevicesService>()) {
      return;
    }
    final deviceId = widget.device.id;
    setState(() => _busy = true);
    try {
      final accepted = await locator<DevicesService>()
          .setMultiplePropertyValues(
            properties: commands,
            context: const PropertyCommandContext(origin: 'panel.device'),
            requireAtomicBatch: requireAtomicBatch,
          );
      if (!mounted || widget.device.id != deviceId) return;
      if (!accepted) throw StateError('Thermostat command was rejected.');
      await _refreshAfterCommand();
    } catch (error) {
      if (mounted && widget.device.id == deviceId) {
        setState(() => _error = error.toString());
      }
    } finally {
      if (mounted && widget.device.id == deviceId) {
        setState(() => _busy = false);
        if (_hintRefreshNeeded) _scheduleResync();
      }
    }
  }

  Future<void> _refreshAfterCommand() async {
    // The server accepts desired settings before physical readback settles.
    // Preserve the distinction by always fetching both contracts again.
    if (!mounted) return;
    setState(() => _busy = false);
    await _refresh(force: true);
  }

  void _setMode(String mode) {
    final heating = _command('heating_enabled', false);
    final cooling = _command('cooling_enabled', false);
    final policy = _configuration?['policy'] as Map?;
    final hasHeating = _number(policy?['heatingSetpoint']) != null;
    final hasCooling = _number(policy?['coolingSetpoint']) != null;
    final commands = virtualThermostatModeCommands(
      mode: mode,
      hasHeating: hasHeating,
      hasCooling: hasCooling,
      heatingEnabled: heating,
      coolingEnabled: cooling,
    );
    if (commands != null) unawaited(_send(commands, requireAtomicBatch: true));
  }

  void _adjustSetpoint(String role, double current, double delta) {
    final command = _command(role, current + delta);
    if (command != null) unawaited(_send([command]));
  }

  double? _number(Object? value) => value is num ? value.toDouble() : null;

  @override
  Widget build(BuildContext context) {
    final config = _configuration;
    final runtime = _runtime;
    final policy = config?['policy'] is Map
        ? config!['policy'] as Map
        : const <String, dynamic>{};
    final requestedMode =
        (runtime?['requested_mode'] ?? config?['requested_mode'])?.toString();
    final readiness =
        runtime?['readiness']?.toString() ??
        config?['readiness']?.toString() ??
        'loading';
    final reasons = runtime?['reasons'] is List
        ? runtime!['reasons'] as List
        : config?['reasons'] is List
        ? config!['reasons'] as List
        : const [];
    final branches = runtime?['branches'] is List
        ? runtime!['branches'] as List
        : const [];
    final heatSetpoint =
        _number(runtime?['heating_setpoint']) ??
        _number(policy['heatingSetpoint']);
    final coolSetpoint =
        _number(runtime?['cooling_setpoint']) ??
        _number(policy['coolingSetpoint']);
    // Desired settings remain editable during a protective pause. Runtime
    // readiness still gates physical output at the backend.
    final canControl = config != null && config['locked'] != true && !_busy;
    final now = DateTime.now();
    final elapsed = _runtimeReceivedAt == null
        ? Duration.zero
        : now.difference(_runtimeReceivedAt!);
    final inputs =
        (runtime?['inputs'] is List ? runtime!['inputs'] as List : const [])
            .whereType<Map>()
            .map(VirtualThermostatInput.fromJson)
            .toList();
    bool roleFresh(String role) => !inputs.any(
      (input) =>
          input.role == role && input.currentStatus(elapsed, now) != 'fresh',
    );
    final ambient = roleFresh('ambient')
        ? _number(runtime?['current_temperature'])
        : null;
    final floor = roleFresh('floor')
        ? _number(runtime?['floor_temperature'])
        : null;

    return Scaffold(
      appBar: AppBar(title: Text(widget.device.name)),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (config == null) const LinearProgressIndicator(),
            if (_error != null)
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            Text('Requested mode: ${requestedMode ?? 'unknown'}'),
            Text('Controller readiness: $readiness'),
            if (ambient != null)
              Text('Ambient: ${ambient.toStringAsFixed(1)} °C'),
            if (floor != null) Text('Floor: ${floor.toStringAsFixed(1)} °C'),
            if (runtime?['floor_latched'] == true)
              const Text('Floor protection is holding heating OFF.'),
            for (final reason in reasons) Text('Inhibited: $reason'),
            if (inputs.isNotEmpty) ...[
              const Divider(),
              const Text('Input freshness'),
              for (final input in inputs)
                ListTile(
                  title: Text(
                    '${input.role}: ${input.currentStatus(elapsed, now)} (${input.sourceKind})',
                  ),
                  subtitle: Text(
                    [
                      'Quality: ${input.quality}',
                      if (input.age(elapsed) != null)
                        'Sample age: ${input.age(elapsed)!.toStringAsFixed(0)} s',
                      if (input.maximumAgeSeconds != null)
                        'Allowed age: ${input.maximumAgeSeconds!.toStringAsFixed(0)} s',
                      if (input.sampledAt != null)
                        'Sampled: ${input.sampledAt!.toUtc().toIso8601String()}',
                      if (input.expiresAt != null)
                        'Expires: ${input.expiresAt!.toUtc().toIso8601String()}',
                      ...input.reasons,
                    ].join(' • '),
                  ),
                ),
            ],
            if (_settingProperty('locked') != null)
              SwitchListTile(
                title: const Text('Lock thermostat controls'),
                value: config?['locked'] == true,
                onChanged: !_busy
                    ? (value) {
                        final command = _command('locked', value);
                        if (command != null) unawaited(_send([command]));
                      }
                    : null,
              ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: [
                for (final mode in const ['off', 'heat', 'cool', 'auto'])
                  if ((mode != 'heat' && mode != 'auto' ||
                          heatSetpoint != null) &&
                      (mode != 'cool' && mode != 'auto' ||
                          coolSetpoint != null))
                    ChoiceChip(
                      label: Text(mode.toUpperCase()),
                      selected: requestedMode == mode,
                      onSelected:
                          canControl &&
                              (heatSetpoint == null ||
                                  _settingProperty('heating_enabled') !=
                                      null) &&
                              (coolSetpoint == null ||
                                  _settingProperty('cooling_enabled') != null)
                          ? (_) => _setMode(mode)
                          : null,
                    ),
              ],
            ),
            if (heatSetpoint != null)
              _setpointRow(
                'Heating target',
                'heating_setpoint',
                heatSetpoint,
                canControl,
              ),
            if (coolSetpoint != null)
              _setpointRow(
                'Cooling target',
                'cooling_setpoint',
                coolSetpoint,
                canControl,
              ),
            const Divider(),
            const Text('Reported output activity'),
            for (final raw in branches)
              if (raw is Map)
                ListTile(
                  title: Text(raw['role']?.toString() ?? 'Branch'),
                  subtitle: Text(
                    raw['fault']?.toString() ??
                        raw['activity']?.toString() ??
                        'unknown',
                  ),
                  trailing: raw['release_pending'] == true
                      ? const Icon(Icons.warning_amber)
                      : null,
                ),
          ],
        ),
      ),
    );
  }

  Widget _setpointRow(String label, String role, double value, bool enabled) {
    final writable = enabled && _settingProperty(role) != null;
    return Row(
      children: [
        Expanded(child: Text('$label: ${value.toStringAsFixed(1)} °C')),
        IconButton(
          onPressed: writable ? () => _adjustSetpoint(role, value, -0.5) : null,
          icon: const Icon(Icons.remove),
        ),
        IconButton(
          onPressed: writable ? () => _adjustSetpoint(role, value, 0.5) : null,
          icon: const Icon(Icons.add),
        ),
      ],
    );
  }
}
