import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/illuminance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/illuminance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/level.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('IlluminanceChannelView', () {
    test(
      'supports a numeric illuminance channel without a qualitative level',
      () {
        final channel = IlluminanceChannelView(
          id: 'illuminance-1',
          type: 'illuminance',
          category: DevicesModuleChannelCategory.illuminance,
          device: 'sensor-1',
          properties: [
            IlluminanceChannelPropertyView(
              id: 'lux-1',
              type: 'illuminance',
              category: DevicesModulePropertyCategory.illuminance,
              channel: 'illuminance-1',
              valueState: PropertyValueState(value: NumberValueType(125)),
            ),
          ],
        );

        expect(channel.illuminance, 125);
        expect(channel.hasLevel, isFalse);
        expect(channel.level, isNull);
        expect(channel.availableLevels, isEmpty);
      },
    );

    test(
      'keeps level value, default, and supported formats when level exists',
      () {
        final channel = IlluminanceChannelView(
          id: 'illuminance-2',
          type: 'illuminance',
          category: DevicesModuleChannelCategory.illuminance,
          device: 'sensor-2',
          properties: [
            IlluminanceChannelPropertyView(
              id: 'lux-2',
              type: 'illuminance',
              category: DevicesModulePropertyCategory.illuminance,
              channel: 'illuminance-2',
              valueState: PropertyValueState(value: NumberValueType(250)),
            ),
            LevelChannelPropertyView(
              id: 'level-2',
              type: 'level',
              category: DevicesModulePropertyCategory.level,
              channel: 'illuminance-2',
              format: StringListFormatType(['bright', 'dark']),
              valueState: PropertyValueState(value: StringValueType('bright')),
            ),
          ],
        );

        expect(channel.hasLevel, isTrue);
        expect(channel.level, IlluminanceLevelValue.bright);
        expect(channel.availableLevels, [
          IlluminanceLevelValue.bright,
          IlluminanceLevelValue.dark,
        ]);
      },
    );

    test('uses the level default when there is no current value', () {
      final channel = IlluminanceChannelView(
        id: 'illuminance-3',
        type: 'illuminance',
        category: DevicesModuleChannelCategory.illuminance,
        device: 'sensor-3',
        properties: [
          IlluminanceChannelPropertyView(
            id: 'lux-3',
            type: 'illuminance',
            category: DevicesModulePropertyCategory.illuminance,
            channel: 'illuminance-3',
            valueState: PropertyValueState(value: NumberValueType(300)),
          ),
          LevelChannelPropertyView(
            id: 'level-3',
            type: 'level',
            category: DevicesModulePropertyCategory.level,
            channel: 'illuminance-3',
            defaultValue: StringValueType('moderate'),
          ),
        ],
      );

      expect(channel.level, IlluminanceLevelValue.moderate);
    });
  });
}
