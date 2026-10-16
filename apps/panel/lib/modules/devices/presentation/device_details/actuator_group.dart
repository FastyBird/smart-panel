import 'package:fastybird_smart_panel/api/models/devices_virtual_plugin_data_cover_operation_readiness.dart';
import 'package:fastybird_smart_panel/api/models/devices_virtual_plugin_data_light_group_member.dart';
import 'package:fastybird_smart_panel/api/models/devices_virtual_plugin_data_light_group_reported_member.dart';
import 'dart:async';
import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_virtual_plugin_data_light_group_capability.dart';
import 'package:fastybird_smart_panel/api/models/devices_virtual_plugin_data_light_group_reported_property.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/models/composite_command.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/actuator_group_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/light_group_control.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

typedef GroupSender =
    Future<CompositeCommandOutcome> Function(List<PropertyCommandItem> targets);

/// All group categories retain their native metadata; requested values never replace reported feedback.
class ActuatorGroupDeviceDetail extends StatefulWidget {
  final DeviceView device;
  final ActuatorGroupState? state;
  final GroupSender? sender;
  const ActuatorGroupDeviceDetail({
    super.key,
    required this.device,
    this.state,
    this.sender,
  });
  @override
  State<ActuatorGroupDeviceDetail> createState() =>
      _ActuatorGroupDeviceDetailState();
}

class _ActuatorGroupDeviceDetailState extends State<ActuatorGroupDeviceDetail> {
  late final ActuatorGroupState _state;
  DevicesService? _devices;
  final Map<String, String> _requested = {};
  bool _busy = false;
  String? _error;
  String? _contract;
  CompositeCommandOutcome? _terminal;
  Timer? _clock;
  ChannelView? get _channel => widget.device.channels.firstWhereOrNull(
    (channel) => [
      'light',
      'switcher',
      'outlet',
      'fan',
      'window_covering',
    ].contains(channel.category.json),
  );
  @override
  void initState() {
    super.initState();
    if (widget.sender == null) _devices = context.read<DevicesService>();
    _state =
        widget.state ??
        ActuatorGroupState(
          channelId: _channel?.id ?? '',
          socket: locator<SocketService>(),
        );
    _state.addListener(_changed);
    _devices?.compositeCommands?.addListener(_changed);
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    unawaited(_state.refresh(explicit: true));
  }

  void _changed() {
    if (!mounted) return;
    final config = _state.configuration;
    final contract = config == null
        ? null
        : '${config.revision}:${config.commonCapabilities}';
    if (_contract != contract) {
      _requested.clear();
      _contract = contract;
    }
    setState(() {});
  }

  @override
  void dispose() {
    _clock?.cancel();
    _state.removeListener(_changed);
    _devices?.compositeCommands?.removeListener(_changed);
    if (widget.state == null) _state.dispose();
    super.dispose();
  }

  bool _writable(DevicesVirtualPluginDataLightGroupCapability cap) =>
      ['rw', 'wo'].contains(cap.access?.json) ||
      (_state.configuration?.profile.json == 'light' && cap.access == null);
  bool _ready(String category, [String? command]) {
    if (!_state.commandable || _busy) return false;
    if (_state.configuration?.profile.json != 'cover') return true;
    return _state.configuration?.operations?.any(
          (operation) =>
              operation.operation.json == (command ?? category) &&
              operation.commandable,
        ) ??
        false;
  }

  String? _output(String category) => _state.configuration?.members
      .expand((member) => member.bindings)
      .firstWhereOrNull((binding) => binding.quantity == category)
      ?.outputProperty;
  Future<void> _send(Map<String, dynamic> values) async {
    if (values.entries.any(
      (target) =>
          !_ready(
            target.key,
            target.key == 'command' ? target.value as String : null,
          ) ||
          _output(target.key) == null,
    )) {
      return;
    }
    final targets = values.entries
        .map(
          (target) => PropertyCommandItem(
            deviceId: widget.device.id,
            channelId: _state.channelId,
            propertyId: _output(target.key)!,
            value: target.value,
          ),
        )
        .toList();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final outcome = widget.sender != null
          ? await widget.sender!(targets)
          : await _devices!.setCompositeProperties(
              deviceId: widget.device.id,
              properties: targets,
            );
      if (!mounted) return;
      setState(() => _terminal = outcome);
      await _state.refresh();
    } catch (_) {
      if (mounted) setState(() => _error = 'uncertain');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  LightGroupNumericContract? _numeric(
    DevicesVirtualPluginDataLightGroupCapability cap,
  ) {
    final format = cap.format;
    if (format is! List) return null;
    return LightGroupNumericContract.fromMetadata(
      DevicesModuleDataType.fromJson(cap.dataType.json ?? 'unknown'),
      NumberListFormatType(format),
      cap.step?.toDouble(),
    );
  }

  String _value(
    DevicesVirtualPluginDataLightGroupReportedProperty reported,
    AppLocalizations l,
  ) {
    if (reported.provenance?.json != 'configured') {
      final expires = reported.expiresAt;
      if (expires != null) {
        if (!expires.isAfter(DateTime.now())) return l.groupUnknown;
      } else {
        final property = _channel?.properties.firstWhereOrNull(
          (property) => property.category.json == reported.category.json,
        );
        if (property?.valueState?.producer?.isCurrentAt(DateTime.now()) !=
            true) {
          return l.groupUnknown;
        }
      }
    }
    if (reported.mixed) return l.groupMixed;
    final value = reported.value;
    return value == null
        ? l.groupUnknown
        : value is bool
        ? (value ? l.groupOn : l.groupOff)
        : '$value';
  }

  String _field(String category, AppLocalizations l) => switch (category) {
    'on' => l.groupFieldOn,
    'speed' => l.groupFieldSpeed,
    'swing' => l.groupFieldSwing,
    'direction' => l.groupFieldDirection,
    'mode' => l.groupFieldMode,
    'position' => l.groupFieldPosition,
    'tilt' => l.groupFieldTilt,
    'type' => l.groupFieldType,
    'status' => l.groupFieldStatus,
    'obstruction' => l.groupFieldObstruction,
    'in_use' => l.groupFieldInUse,
    'brightness' => l.groupFieldBrightness,
    'color_temperature' => l.groupFieldColorTemperature,
    'color_red' => l.groupFieldColorRed,
    'color_green' => l.groupFieldColorGreen,
    'color_blue' => l.groupFieldColorBlue,
    'hue' => l.groupFieldHue,
    'saturation' => l.groupFieldSaturation,
    _ => category,
  };
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
    final config = _state.configuration;
    final outcome = _devices?.latestCompositeFor(widget.device.id) ?? _terminal;
    final caps =
        config?.commonCapabilities ??
        const <DevicesVirtualPluginDataLightGroupCapability>[];
    final exposed = caps.map((cap) => cap.category.json).toSet();
    return Scaffold(
      appBar: AppBar(title: Text(widget.device.name)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(l.groupActualFeedback),
          OutlinedButton(
            key: const ValueKey('group-reload'),
            onPressed: _state.pending
                ? null
                : () => _state.refresh(explicit: true),
            child: Text(l.groupReload),
          ),
          if (_state.pending) const LinearProgressIndicator(),
          if (_state.error != null || !_state.connected)
            Text(l.groupUnavailable),
          if (_state.needsReload) Text(l.groupRepair),
          if (_error != null) Text(l.groupUncertain),
          if (config?.profile.json == 'cover') Text(l.groupCoverMeaning),
          for (final reported
              in config?.reportedState?.properties ??
                  const <
                    DevicesVirtualPluginDataLightGroupReportedProperty
                  >[]) ...[
            Text(
              '${_field(reported.category.json ?? '', l)}: ${_value(reported, l)}',
              key: ValueKey('group-reported-${reported.category.json}'),
            ),
            Text(
              l.groupContributors(
                reported.contributors.length,
                config!.members.length,
              ),
            ),
            if (reported.provenance?.json == 'configured')
              Text(l.groupConfigured),
          ],
          if (config?.reportedState == null) Text(l.groupUnknown),
          for (final member
              in config?.members ??
                  const <DevicesVirtualPluginDataLightGroupMember>[]) ...[
            Text(
              '${member.sourceIdentity}${member.sourceChannel == null ? ' · ${l.groupMissing}' : ''}',
            ),
            for (final state
                in config?.reportedState?.members.where(
                      (state) => state.sourceIdentity == member.sourceIdentity,
                    ) ??
                    const <DevicesVirtualPluginDataLightGroupReportedMember>[])
              Text(state.reasons.join('; ')),
          ],
          for (final operation
              in config?.operations ??
                  const <
                    DevicesVirtualPluginDataCoverOperationReadiness
                  >[]) ...[
            if (['open', 'close', 'stop'].contains(operation.operation.json))
              OutlinedButton(
                key: ValueKey('group-command-${operation.operation.json}'),
                onPressed: _ready('command', operation.operation.json)
                    ? () => _send({'command': operation.operation.json})
                    : null,
                child: Text(switch (operation.operation.json) {
                  'open' => l.groupOpen,
                  'close' => l.groupClose,
                  _ => l.groupStop,
                }),
              ),
            if (!operation.commandable)
              Text(
                '${operation.operation.json}: ${operation.members.expand<String>((member) => member.reasons.map((reason) => '${member.sourceIdentity}: $reason')).join('; ')}',
              ),
          ],
          if (config?.profile.json == 'cover' &&
              (config?.operations?.isEmpty ?? true))
            Text(l.groupReadinessUnavailable),
          for (final cap in caps.where(
            (cap) => _writable(cap) && cap.category.json != 'command',
          ))
            _control(cap, l),
          for (final tuple in [
            const ['color_red', 'color_green', 'color_blue'],
            const ['hue', 'saturation'],
          ])
            if (tuple.every(exposed.contains))
              OutlinedButton(
                onPressed:
                    tuple.every(
                      (category) =>
                          _ready(category) &&
                          _numeric(
                                caps.firstWhere(
                                  (cap) => cap.category.json == category,
                                ),
                              )?.target(_requested[category] ?? '') !=
                              null,
                    )
                    ? () => _send({
                        for (final category in tuple)
                          category: _numeric(
                            caps.firstWhere(
                              (cap) => cap.category.json == category,
                            ),
                          )!.target(_requested[category]!),
                      })
                    : null,
                child: Text(l.groupApplyTogether),
              ),
          if (outcome != null)
            Semantics(
              liveRegion: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l.groupCommandOutcome(_status(outcome.status, l))),
                  for (final child in outcome.children)
                    Text(
                      '${child.memberIdentity ?? child.memberId}: ${_status(child.status, l)}${child.reason == null ? '' : ' · ${child.reason}'}',
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _control(
    DevicesVirtualPluginDataLightGroupCapability cap,
    AppLocalizations l,
  ) {
    final category = cap.category.json ?? '';
    final enabled = _ready(category);
    final numeric = _numeric(cap);
    final choices = cap.format is List
        ? (cap.format as List).whereType<String>().toList()
        : <String>[];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${_field(category, l)} ${cap.unit ?? ''}'),
            if (cap.dataType.json == 'bool')
              Wrap(
                children: [
                  for (final value in [true, false])
                    OutlinedButton(
                      key: ValueKey('group-$category-$value'),
                      onPressed: enabled
                          ? () => _send({category: value})
                          : null,
                      child: Text(value ? l.groupOn : l.groupOff),
                    ),
                ],
              )
            else if (cap.dataType.json == 'enum')
              DropdownButton<String>(
                key: ValueKey('group-enum-$category'),
                value: choices.contains(_requested[category])
                    ? _requested[category]
                    : null,
                hint: Text(l.groupSelectValue),
                items: choices
                    .map(
                      (value) =>
                          DropdownMenuItem(value: value, child: Text(value)),
                    )
                    .toList(),
                onChanged: enabled
                    ? (value) {
                        if (value != null) {
                          setState(() => _requested[category] = value);
                          unawaited(_send({category: value}));
                        }
                      }
                    : null,
              )
            else if (numeric != null &&
                (_state.configuration?.profile.json != 'cover' ||
                    _state.configuration?.operations?.any(
                          (operation) =>
                              operation.operation.json == category &&
                              operation.commandable,
                        ) ==
                        true)) ...[
              TextField(
                key: ValueKey('group-number-$category'),
                enabled: enabled,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                  signed: true,
                ),
                decoration: InputDecoration(
                  helperText:
                      '${numeric.min} – ${numeric.max}; ${l.groupStep(numeric.step?.toString() ?? '—')}',
                ),
                onChanged: (value) =>
                    setState(() => _requested[category] = value),
              ),
              if (![
                'color_red',
                'color_green',
                'color_blue',
                'hue',
                'saturation',
              ].contains(category))
                OutlinedButton(
                  onPressed:
                      !enabled ||
                          numeric.target(_requested[category] ?? '') == null
                      ? null
                      : () => _send({
                          category: numeric.target(_requested[category]!),
                        }),
                  child: Text(l.groupApply),
                ),
            ] else
              Text(l.groupReadinessUnavailable),
          ],
        ),
      ),
    );
  }
}
