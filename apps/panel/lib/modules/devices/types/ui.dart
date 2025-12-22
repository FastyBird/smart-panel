import 'package:fastybird_smart_panel/core/utils/enum.dart';

enum DeviceType {
  devicesThirdParty('devices-third-party'),
  devicesHomeAssistant('devices-home-assistant'),
  devicesShellyNg('devices-shelly-ng'),
  devicesShellyV1('devices-shelly-v1'),
  devicesWled('devices-wled'),
  devicesZigbee2mqtt('devices-zigbee2mqtt');

  final String value;

  const DeviceType(this.value);

  static final utils = StringEnumUtils(
    DeviceType.values,
    (DeviceType payload) => payload.value,
  );

  static DeviceType? fromValue(String value) => utils.fromValue(value);

  static bool contains(String value) => utils.contains(value);
}
