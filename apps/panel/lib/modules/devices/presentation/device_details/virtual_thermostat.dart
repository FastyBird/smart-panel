import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
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
  Map<String, dynamic>? _configuration;
  Map<String, dynamic>? _runtime;
  String? _error;
  bool _busy = false;

  String get _path =>
      '/plugins/devices-virtual/producers/thermostats/${widget.device.id}';

  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => unawaited(_refresh()),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    if (!locator.isRegistered<Dio>() || _busy) return;
    try {
      final dio = locator<Dio>();
      final responses = await Future.wait([
        dio.get<Map<String, dynamic>>(_path),
        dio.get<Map<String, dynamic>>('$_path/runtime'),
      ]);
      if (!mounted) return;
      setState(() {
        _configuration = Map<String, dynamic>.from(
          responses[0].data?['data'] as Map? ?? {},
        );
        _runtime = Map<String, dynamic>.from(
          responses[1].data?['data'] as Map? ?? {},
        );
        _error = null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
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

  Future<void> _send(List<PropertyCommandItem> commands) async {
    if (_busy || commands.isEmpty || !locator.isRegistered<DevicesService>()) {
      return;
    }
    setState(() => _busy = true);
    try {
      final accepted = await locator<DevicesService>()
          .setMultiplePropertyValues(
            properties: commands,
            context: const PropertyCommandContext(origin: 'panel.device'),
          );
      if (!accepted) throw StateError('Thermostat command was rejected.');
      await _refreshAfterCommand();
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refreshAfterCommand() async {
    // The server accepts desired settings before physical readback settles.
    // Preserve the distinction by always fetching both contracts again.
    setState(() => _busy = false);
    await _refresh();
  }

  void _setMode(String mode) {
    final heating = _command(
      'heating_enabled',
      mode == 'heat' || mode == 'auto',
    );
    final cooling = _command(
      'cooling_enabled',
      mode == 'cool' || mode == 'auto',
    );
    final policy = _configuration?['policy'] as Map?;
    final hasHeating = _number(policy?['heatingSetpoint']) != null;
    final hasCooling = _number(policy?['coolingSetpoint']) != null;
    if ((hasHeating && heating == null) || (hasCooling && cooling == null)) {
      return;
    }
    unawaited(
      _send([if (heating != null) heating, if (cooling != null) cooling]),
    );
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
    final ambient = _number(runtime?['current_temperature']);
    final floor = _number(runtime?['floor_temperature']);

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
