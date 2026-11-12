import 'package:fastybird_smart_panel/plugins/devices-modbus/constants.dart';
import 'package:fastybird_smart_panel/plugins/devices-modbus/mappers/mappers.dart';
import 'package:fastybird_smart_panel/plugins/devices-modbus/models/channel.dart';
import 'package:fastybird_smart_panel/plugins/devices-modbus/models/device.dart';
import 'package:fastybird_smart_panel/plugins/devices-modbus/models/property.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const endpointId = '0f1d3c7a-6a8e-4b0e-9d52-2a3a8f1c9b11';

  final deviceJson = <String, dynamic>{
    'id': 'dddcdbb1-b4ab-4fa2-84c0-7db0f3f23e59',
    'type': modbusDeviceType,
    'category': 'sensor',
    'name': 'Energy meter',
    'endpoint_id': endpointId,
    'unit_id': 7,
    'poll_interval_ms': 2000,
    'byte_order': 'big',
    'future_field': 1,
  };

  test('device json of type devices-modbus maps to the Modbus device model', () {
    final model = buildModbusDeviceModel(deviceJson);

    expect(model, isA<ModbusDeviceModel>());
    final device = model as ModbusDeviceModel;
    expect(device.type, 'devices-modbus');
    expect(device.unitId, 7);
    expect(device.endpointId, endpointId);
    expect(device.pollIntervalMs, 2000);
  });

  test('nullable device fields stay null', () {
    final device = ModbusDeviceModel.fromJson({
      ...deviceJson,
      'endpoint_id': null,
      'poll_interval_ms': null,
    });

    expect(device.endpointId, isNull);
    expect(device.pollIntervalMs, isNull);
    expect(device.unitId, 7);
  });

  test('channel json maps to the Modbus channel model', () {
    final model = buildModbusChannelModel({
      'id': 'ad549e41-c4d8-4a8e-9700-814599d647a4',
      'type': modbusDeviceType,
      'category': 'generic',
      'device': 'dddcdbb1-b4ab-4fa2-84c0-7db0f3f23e59',
    });

    expect(model, isA<ModbusChannelModel>());
    expect(model.type, 'devices-modbus');
  });

  test('property json maps to the Modbus property model', () {
    final model = buildModbusChannelPropertyModel({
      'id': '74335b47-f4d2-475a-b76f-26c1cf7f43a5',
      'channel': 'ad549e41-c4d8-4a8e-9700-814599d647a4',
      'type': modbusDeviceType,
      'category': 'generic',
      'data_type': 'float',
      'permissions': ['ro'],
    });

    expect(model, isA<ModbusChannelPropertyModel>());
    expect(model.type, 'devices-modbus');
  });
}
