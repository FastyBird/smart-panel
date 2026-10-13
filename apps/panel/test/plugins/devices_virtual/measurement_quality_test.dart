import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/property.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/property.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final now = DateTime.now().toUtc();
  Map<String, dynamic> property({Map<String, dynamic>? producer}) => {
    'id': '550e8400-e29b-41d4-a716-446655440000',
    'channel': '550e8400-e29b-41d4-a716-446655440001',
    'category': 'value',
    'data_type': 'float',
    'permissions': ['ro'],
    'value_origin': 'derived',
    'unit': 'custom mV',
    'measurement_quantity': 'voltage',
    'value': {
      'value': 12.5,
      'last_updated': now.toIso8601String(),
      if (producer != null) 'producer': producer,
    },
  };
  Map<String, dynamic> lease(String quality, DateTime expires) => {
    'quality': quality,
    'reasons': [],
    'revision': 2,
    'evaluated_at': now.toIso8601String(),
    'sampled_at': now.subtract(const Duration(seconds: 2)).toIso8601String(),
    'expires_at': expires.toIso8601String(),
  };

  test('generic quantity and unit survive mapper and live-state updates', () {
    final model = VirtualChannelPropertyModel.fromJson(
      property(producer: lease('good', now.add(const Duration(minutes: 1)))),
    );
    final updated = model.copyWith(valueState: model.valueState);
    expect(updated.measurementQuantity, 'voltage');
    expect(buildChannelPropertyView(updated).unit, 'custom mV');
    expect(buildChannelPropertyView(updated).value, isNotNull);
  });
  test(
    'retained scalar without runtime qualification cannot become a reading',
    () {
      final view = buildChannelPropertyView(
        VirtualChannelPropertyModel.fromJson(property()),
      );
      expect(view.value, isNull);
      expect(
        view.valueState?.producer?.quality,
        PropertyProducerQuality.unavailable,
      );
    },
  );
  test(
    'unavailable and expired producer values stay hidden while history remains in state',
    () {
      for (final producer in [
        lease('unavailable', now.add(const Duration(minutes: 1))),
        lease('good', now.subtract(const Duration(seconds: 1))),
      ]) {
        final view = buildChannelPropertyView(
          VirtualChannelPropertyModel.fromJson(property(producer: producer)),
        );
        expect(view.value, isNull);
        expect(view.valueState?.value, isNotNull);
      }
    },
  );
  test(
    'degraded quorum output remains usable only until its original expiry',
    () {
      final producer = PropertyProducerState.fromJson(
        lease('degraded', now.add(const Duration(seconds: 5))),
      );
      expect(producer.isCurrentAt(now), isTrue);
      expect(
        producer.isCurrentAt(now.add(const Duration(seconds: 5))),
        isFalse,
      );
    },
  );
  test('generic FLOAT sensor formatting preserves fractional values', () {
    expect(
      SensorUtils.scaleForCategory(DevicesModuleChannelCategory.analogInput),
      3,
    );
  });
  test(
    'clock rollback and malformed evaluation timestamps cannot keep a lease current',
    () {
      final valid = lease('good', now.add(const Duration(seconds: 30)));
      expect(PropertyProducerState.fromJson(valid).isCurrentAt(now), isTrue);
      for (final evaluated in [
        null,
        'malformed',
        now.add(const Duration(seconds: 1)).toIso8601String(),
      ]) {
        expect(
          PropertyProducerState.fromJson({
            ...valid,
            'evaluated_at': evaluated,
          }).isCurrentAt(now),
          isFalse,
        );
      }
    },
  );
}
