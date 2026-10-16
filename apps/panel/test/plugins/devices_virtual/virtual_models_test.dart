import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/actuator_group.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/api/models/devices_virtual_plugin_data_channel_property_value_origin.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/property.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final deviceJson = <String, dynamic>{
    'id': 'dddcdbb1-b4ab-4fa2-84c0-7db0f3f23e59',
    'type': 'virtual',
    'category': 'sensor',
    'name': 'Temperature',
  };
  final propertyJson = <String, dynamic>{
    'id': '74335b47-f4d2-475a-b76f-26c1cf7f43a5',
    'channel': 'ad549e41-c4d8-4a8e-9700-814599d647a4',
    'type': 'virtual',
    'category': 'temperature',
    'data_type': 'float',
    'permissions': ['ro'],
  };

  test('legacy omitted mode/origin retain projection/source defaults', () {
    expect(
      VirtualDeviceModel.fromJson(deviceJson).mode,
      VirtualDeviceMode.projection,
    );
    final property = VirtualChannelPropertyModel.fromJson(propertyJson);
    expect(
      property.valueOrigin,
      DevicesVirtualPluginDataChannelPropertyValueOrigin.source,
    );
    expect(property.isProjecting, isTrue);
    expect(property.isOrphaned, isTrue);
  });

  test('typed modes parse and unknown modes never become projection', () {
    expect(
      VirtualDeviceModel.fromJson({
        ...deviceJson,
        'mode': 'sensor_aggregate',
        'future_field': 1,
      }).mode,
      VirtualDeviceMode.sensorAggregate,
    );
    expect(
      VirtualDeviceModel.fromJson({
        ...deviceJson,
        'mode': 'sensor_transform',
      }).mode,
      VirtualDeviceMode.sensorTransform,
    );
    expect(
      VirtualDeviceModel.fromJson({...deviceJson, 'mode': 'future_mode'}).mode,
      VirtualDeviceMode.unknown,
    );
  });

  test('composed mapper retains group commands and thermostat diagnostics', () {
    final group = buildDeviceView(
      VirtualDeviceModel.fromJson({
        ...deviceJson,
        'category': 'lighting',
        'mode': 'actuator_group',
      }),
      const [],
    );
    expect(group, isA<LightingDeviceView>());
    expect((group as LightingDeviceView).isCompositeGroup, isTrue);
    final thermostat = buildDeviceView(
      VirtualDeviceModel.fromJson({
        ...deviceJson,
        'category': 'thermostat',
        'mode': 'climate_controller',
      }),
      const [],
    );
    expect(thermostat, isA<ThermostatDeviceView>());
    expect(buildDeviceWidget(thermostat), isA<VirtualThermostatDeviceDetail>());
    final projection = buildDeviceView(
      VirtualDeviceModel.fromJson({
        ...deviceJson,
        'category': 'lighting',
        'mode': 'projection',
      }),
      const [],
    );
    expect((projection as LightingDeviceView).isCompositeGroup, isFalse);
  });

  for (final category in [
    'lighting',
    'switcher',
    'outlet',
    'fan',
    'window_covering',
  ]) {
    test(
      '$category group retains native category and uses composite detail; projection stays ordinary',
      () {
        final group = buildDeviceView(
          VirtualDeviceModel.fromJson({
            ...deviceJson,
            'category': category,
            'mode': 'actuator_group',
          }),
          const [],
        );
        expect(group.category.json, category);
        expect(group.isCompositeGroup, isTrue);
        expect(buildDeviceWidget(group), isA<ActuatorGroupDeviceDetail>());
        final projection = buildDeviceView(
          VirtualDeviceModel.fromJson({
            ...deviceJson,
            'category': category,
            'mode': 'projection',
          }),
          const [],
        );
        expect(projection.isCompositeGroup, isFalse);
      },
    );
  }

  test('derived origin owns its series and survives copyWith', () {
    final property = VirtualChannelPropertyModel.fromJson({
      ...propertyJson,
      'value_origin': 'derived',
    });
    expect(property.isDerived, isTrue);
    expect(property.isProjecting, isFalse);
    expect(property.isOrphaned, isFalse);
    expect(property.copyWith().isDerived, isTrue);
  });
}
