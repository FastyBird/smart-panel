import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/light_group_control.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/material.dart';

class LightGroupControls extends StatefulWidget {
  final String deviceId;
  final LightChannelView channel;
  final DevicesService service;
  const LightGroupControls({
    super.key,
    required this.deviceId,
    required this.channel,
    required this.service,
  });
  @override
  State<LightGroupControls> createState() => _LightGroupControlsState();
}

class _LightGroupControlsState extends State<LightGroupControls> {
  final Map<String, String> _requested = {};
  bool _busy = false;
  String? _error;

  Future<void> _send(List<PropertyCommandItem> targets) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.service.setCompositeProperties(
        deviceId: widget.deviceId,
        properties: targets,
      );
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Command outcome unknown. Refresh reported state before another attempt.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _reported(ChannelPropertyView property) {
    final producer = property.valueState?.producer;
    if (producer == null ||
        producer.quality == PropertyProducerQuality.unavailable ||
        (producer.expiresAt != null &&
            !producer.expiresAt!.isAfter(DateTime.now()))) {
      return 'unknown';
    }
    if (producer.reasons.any((reason) => reason.contains('mixed'))) {
      return 'mixed';
    }
    final value = property.value;
    return switch (value) {
      NumberValueType() => '${value.value}',
      BooleanValueType() => '${value.value}',
      _ => 'unknown',
    };
  }

  @override
  Widget build(BuildContext context) {
    final properties = widget.channel.properties;
    final on = widget.channel.onProp;
    final writable = on.permission.contains(DevicesModulePermissionType.rw);
    final groups = [
      ['brightness'],
      ['color_temperature'],
      ['color_red', 'color_green', 'color_blue'],
      ['hue', 'saturation'],
    ];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Reported power: ${_reported(on)}'),
        Wrap(
          spacing: 12,
          children: [
            for (final enabled in [true, false])
              OutlinedButton(
                onPressed: !_busy && writable
                    ? () => _send([
                        PropertyCommandItem(
                          deviceId: widget.deviceId,
                          channelId: widget.channel.id,
                          propertyId: on.id,
                          value: enabled,
                        ),
                      ])
                    : null,
                child: Text(enabled ? 'Turn on' : 'Turn off'),
              ),
          ],
        ),
        if (_error != null) Text(_error!),
        for (final categories in groups)
          if (properties.any(
            (property) => categories.contains(property.category.json),
          ))
            _numericControls(
              categories,
              properties
                  .where(
                    (property) => categories.contains(property.category.json),
                  )
                  .toList(),
            ),
      ],
    );
  }

  Widget _numericControls(
    List<String> categories,
    List<ChannelPropertyView> properties,
  ) {
    final available =
        properties.length == categories.length &&
        properties.every(
          (property) =>
              LightGroupNumericContract.fromProperty(property) != null,
        );
    final targets = available
        ? lightGroupNumericTargets(
            deviceId: widget.deviceId,
            channelId: widget.channel.id,
            properties: properties,
            requested: _requested,
          )
        : null;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!available)
              Text(
                '${categories.join(' / ')}: control unavailable for the exposed native contract',
              ),
            for (final property in properties) ...[
              Text(
                '${property.name}: reported ${_reported(property)} ${property.unit ?? ''}',
              ),
              if (available)
                TextField(
                  key: ValueKey('group-target-${property.id}'),
                  enabled: !_busy,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                    signed: true,
                  ),
                  decoration: InputDecoration(
                    labelText: '${property.name} ${property.unit ?? ''}',
                    helperText:
                        '${LightGroupNumericContract.fromProperty(property)!.min} – ${LightGroupNumericContract.fromProperty(property)!.max}; step ${LightGroupNumericContract.fromProperty(property)!.step ?? 'continuous'}',
                  ),
                  onChanged: (value) =>
                      setState(() => _requested[property.id] = value),
                ),
            ],
            if (available)
              OutlinedButton(
                onPressed: !_busy && targets != null
                    ? () => _send(targets)
                    : null,
                child: const Text('Apply together'),
              ),
          ],
        ),
      ),
    );
  }
}
