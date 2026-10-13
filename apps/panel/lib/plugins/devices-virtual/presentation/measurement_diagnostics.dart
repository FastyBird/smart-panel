import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:flutter/material.dart';

String measurementDiagnosticLabel(AppLocalizations l, String value) {
  final parts = value.split(':');
  final label = switch (parts.first) {
    'good' => l.virtual_measurement_state_good,
    'degraded' => l.virtual_measurement_state_degraded,
    'input_degraded' => l.virtual_measurement_state_input_degraded,
    'unavailable' => l.virtual_measurement_state_unavailable,
    'runtime_unavailable' => l.virtual_measurement_state_runtime_unavailable,
    'ready' => l.virtual_measurement_state_ready,
    'configured' => l.virtual_measurement_state_configured,
    'missing' => l.virtual_measurement_state_missing,
    'incompatible' => l.virtual_measurement_state_incompatible,
    'incompatible_source' => l.virtual_measurement_state_incompatible_source,
    'incompatible_output' => l.virtual_measurement_state_incompatible_output,
    'incompatible_ntc_semantics' =>
      l.virtual_measurement_state_incompatible_ntc_semantics,
    'offline' => l.virtual_measurement_state_offline,
    'invalid' => l.virtual_measurement_state_invalid,
    'invalid_input' => l.virtual_measurement_state_invalid_input,
    'invalid_result' => l.virtual_measurement_state_invalid_result,
    'nonfinite_output' => l.virtual_measurement_state_nonfinite_output,
    'stale' => l.virtual_measurement_state_stale,
    'expired' => l.virtual_measurement_state_expired,
    'disabled' => l.virtual_measurement_state_disabled,
    'output_disabled' => l.virtual_measurement_state_output_disabled,
    'quorum_lost' => l.virtual_measurement_state_quorum_lost,
    'invalid_policy' => l.virtual_measurement_state_invalid_policy,
    'invalid_configuration' =>
      l.virtual_measurement_state_invalid_configuration,
    'awaiting_fresh_sample' =>
      l.virtual_measurement_state_awaiting_fresh_sample,
    'runtime_error' => l.virtual_measurement_state_runtime_error,
    'graph_quarantined' => l.virtual_measurement_state_graph_quarantined,
    'input_out_of_range' => l.virtual_measurement_state_input_out_of_range,
    'output_out_of_range' => l.virtual_measurement_state_output_out_of_range,
    'invalid_domain' => l.virtual_measurement_state_invalid_domain,
    'producer_disposed' => l.virtual_measurement_state_producer_disposed,
    _ => '${l.virtual_measurement_state_unknown} ($value)',
  };
  return parts.length > 1 ? '$label · ${parts.skip(1).join(':')}' : label;
}

class MeasurementInputDiagnostic {
  final String identity;
  final String? sourceId;
  final num? value;
  final String? unit;
  final String? exclusion;
  final DateTime? sampledAt;
  final DateTime? expiresAt;
  const MeasurementInputDiagnostic({
    required this.identity,
    this.sourceId,
    this.value,
    this.unit,
    this.exclusion,
    this.sampledAt,
    this.expiresAt,
  });
  num? valueAt(DateTime now) =>
      sampledAt != null &&
          !sampledAt!.isAfter(now) &&
          expiresAt?.isAfter(now) == true &&
          ![
            'missing',
            'offline',
            'disabled',
            'stale',
            'incompatible',
            'invalid',
          ].contains(exclusion)
      ? value
      : null;
}

class MeasurementDiagnostics {
  final bool transform;
  final List<MeasurementInputDiagnostic> inputs;
  final List<String> errors;
  const MeasurementDiagnostics({
    required this.transform,
    required this.inputs,
    this.errors = const [],
  });
}

typedef MeasurementDiagnosticsLoader =
    Future<MeasurementDiagnostics> Function(String outputId);

Future<MeasurementDiagnostics> loadMeasurementDiagnostics(String id) async {
  final client = locator<ApiClient>().devicesVirtualPlugin;
  try {
    final response = await client.getDevicesVirtualPluginTransformConfiguration(
      id: id,
    );
    final source = response.data.data.source;
    return MeasurementDiagnostics(
      transform: true,
      errors: response.data.data.errors,
      inputs: [
        MeasurementInputDiagnostic(
          identity: source.sourceIdentity,
          sourceId: source.sourceProperty,
          value: source.currentValue,
          unit: source.unit,
          exclusion: source.exclusion,
          sampledAt: source.sampledAt,
          expiresAt: source.sampledAt?.add(
            Duration(seconds: response.data.data.maximumAgeSeconds.toInt()),
          ),
        ),
      ],
    );
  } on DioException catch (failure) {
    if (failure.response?.statusCode != 404) rethrow;
    final response = await client.getDevicesVirtualPluginAggregateConfiguration(
      id: id,
    );
    return MeasurementDiagnostics(
      transform: false,
      inputs: response.data.data.inputs
          .map(
            (source) => MeasurementInputDiagnostic(
              identity: source.sourceIdentity,
              sourceId: source.sourceProperty,
              value: source.currentValue,
              unit: source.unit,
              exclusion: source.exclusion?.json,
              sampledAt: source.sampledAt,
              expiresAt: source.sampledAt?.add(
                Duration(seconds: response.data.data.maximumAgeSeconds.toInt()),
              ),
            ),
          )
          .toList(),
    );
  }
}

/// Read-only producer diagnostics. A fetched configuration never changes the live property state.
class VirtualMeasurementDiagnostics extends StatefulWidget {
  final ChannelPropertyView property;
  final MeasurementDiagnosticsLoader? loader;
  const VirtualMeasurementDiagnostics({
    super.key,
    required this.property,
    this.loader,
  });

  @override
  State<VirtualMeasurementDiagnostics> createState() =>
      _VirtualMeasurementDiagnosticsState();
}

class _VirtualMeasurementDiagnosticsState
    extends State<VirtualMeasurementDiagnostics> {
  MeasurementDiagnostics? _data;
  bool _failed = false;
  bool _loading = false;
  int _request = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
  }

  @override
  void didUpdateWidget(covariant VirtualMeasurementDiagnostics oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.property.id != widget.property.id) {
      _request++;
      _loading = false;
      _data = null;
      _refresh();
    }
  }

  Future<void> _refresh() async {
    if (_loading) return;
    _loading = true;
    final request = ++_request;
    try {
      final data = await (widget.loader ?? loadMeasurementDiagnostics)(
        widget.property.id,
      );
      if (mounted && request == _request) {
        setState(() {
          _data = data;
          _failed = false;
        });
      }
    } catch (_) {
      if (mounted && request == _request) {
        setState(() {
          _data = null;
          _failed = true;
        });
      }
    } finally {
      if (request == _request) _loading = false;
    }
  }

  @override
  void dispose() {
    _request++;
    _timer?.cancel();
    super.dispose();
  }

  String _sourceLabel(MeasurementInputDiagnostic input) {
    if (!locator.isRegistered<DevicesService>()) return input.identity;
    final service = locator<DevicesService>();
    final property = input.sourceId == null
        ? null
        : service.getChannelProperty(input.sourceId!);
    final channel = property == null
        ? null
        : service.getChannel(property.channel);
    final device = channel == null ? null : service.getDevice(channel.device);
    return device == null
        ? input.identity
        : '${device.name} / ${channel!.name}';
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final producer = widget.property.valueState?.producer;
    final current = producer?.isCurrentAt(DateTime.now()) == true;
    final quality = current
        ? producer!.quality.name
        : PropertyProducerQuality.unavailable.name;
    final reasons = [
      ...?producer?.reasons,
      if (producer?.expiresAt != null &&
          !producer!.expiresAt!.isAfter(DateTime.now()))
        'stale',
    ];
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l.virtual_measurement_quality(measurementDiagnosticLabel(l, quality)),
          key: const ValueKey('measurement-quality'),
        ),
        if (reasons.isNotEmpty)
          Text(
            reasons
                .map((reason) => measurementDiagnosticLabel(l, reason))
                .join(', '),
          ),
        if (_failed)
          TextButton(
            onPressed: _refresh,
            child: Text(l.virtual_measurement_retry),
          ),
        if (_data != null) ...[
          Text(
            _data!.transform
                ? l.virtual_measurement_conversion
                : l.virtual_measurement_members,
          ),
          for (final input in _data!.inputs)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Text(
                '${_sourceLabel(input)}: ${input.valueAt(DateTime.now()) ?? '—'} ${input.unit ?? ''}${input.exclusion == null ? '' : ' · ${measurementDiagnosticLabel(l, input.exclusion!)}'}',
              ),
            ),
          if (_data!.errors.isNotEmpty)
            Text(
              _data!.errors
                  .map((error) => measurementDiagnosticLabel(l, error))
                  .join(', '),
            ),
        ],
      ],
    );
  }
}
