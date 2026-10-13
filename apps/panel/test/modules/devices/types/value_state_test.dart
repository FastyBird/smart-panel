import 'package:fastybird_smart_panel/api/models/property_value_state.dart'
    as api;
import 'package:fastybird_smart_panel/modules/devices/models/properties/generic_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/property.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> qualifiedValue(
  String quality, {
  dynamic value = 21,
  int revision = 1,
}) => {
  'value': value,
  'last_updated': '2026-10-13T09:00:00Z',
  'producer': {
    'quality': quality,
    'reasons': quality == 'good' ? <String>[] : ['source_stale'],
    'sampled_at': null,
    'evaluated_at': '2026-10-13T10:00:00Z',
    'expires_at': null,
    'revision': revision,
    'future_field': true,
  },
};

Map<String, dynamic> propertyJson(dynamic value) => {
  'id': 'ce557266-3554-49f9-bd41-56f7c84b1691',
  'channel': 'ce557266-3554-49f9-bd41-56f7c84b1692',
  'type': 'virtual',
  'category': 'generic',
  'data_type': 'float',
  'permissions': ['rw'],
  'value_origin': 'local',
  'value': value,
};

void main() {
  test('generated API parses legacy object envelopes without producer', () {
    for (final value in [0, false, 'legacy', null]) {
      final state = api.PropertyValueState.fromJson({'value': value});
      expect(state.value, value);
      expect(state.producer, isNull);
    }
  });

  for (final quality in PropertyProducerQuality.values) {
    test(
      'generated API parses ${quality.name} producer with nullable clocks',
      () {
        final state = api.PropertyValueState.fromJson(
          qualifiedValue(
            quality.name,
            value: quality == PropertyProducerQuality.unavailable ? null : 21,
          ),
        );
        expect(state.producer?.quality.json, quality.name);
        expect(state.producer?.sampledAt, isNull);
        expect(state.producer?.expiresAt, isNull);
        expect(state.producer?.evaluatedAt, DateTime.utc(2026, 10, 13, 10));
        expect(state.producer?.revision, 1);
        expect(
          state.value,
          quality == PropertyProducerQuality.unavailable ? null : 21,
        );
      },
    );
  }

  test('legacy scalar, object and null states remain compatible', () {
    for (final value in [0, false, 'legacy']) {
      expect(PropertyValueState.fromRaw(value)?.value?.value, value);
      expect(PropertyValueState.fromRaw({'value': value})?.value?.value, value);
      expect(PropertyValueState.fromRaw(value)?.producer, isNull);
    }
    expect(PropertyValueState.fromRaw(null), isNull);
  });

  for (final quality in PropertyProducerQuality.values) {
    test(
      'parses ${quality.name} metadata through virtual and generic models',
      () {
        final raw = propertyJson(
          qualifiedValue(
            quality.name,
            value: quality == PropertyProducerQuality.unavailable ? null : 21,
          ),
        );
        final virtual = VirtualChannelPropertyModel.fromJson(raw);
        final generic = GenericChannelPropertyModel.fromJson(raw);
        for (final model in [virtual, generic]) {
          final producer = model.valueState?.producer;
          expect(producer?.quality, quality);
          expect(producer?.sampledAt, isNull);
          expect(producer?.expiresAt, isNull);
          expect(producer?.evaluatedAt, DateTime.utc(2026, 10, 13, 10));
          expect(producer?.revision, 1);
          expect(model.copyWith().valueState?.producer, same(producer));
          expect(model.copyWith(clearValue: true).valueState, isNull);
        }
        expect(
          virtual.value?.value,
          quality == PropertyProducerQuality.unavailable ? null : 21,
        );
      },
    );
  }
}
