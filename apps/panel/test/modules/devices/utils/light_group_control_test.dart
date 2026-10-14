import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/light_group_control.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter_test/flutter_test.dart';

ChannelPropertyView property(
  String id,
  DevicesModulePropertyCategory category, {
  List<DevicesModulePermissionType> permissions = const [
    DevicesModulePermissionType.rw,
  ],
  double? step = 0.25,
}) => ChannelPropertyView(
  id: id,
  type: 'virtual',
  channel: 'light',
  category: category,
  permission: permissions,
  dataType: DevicesModuleDataType.float,
  format: NumberListFormatType([0.125, 1.125]),
  step: step,
  unit: 'native',
);

void main() {
  test(
    'snaps fractional native values onto an offset common grid without integer narrowing',
    () {
      final contract = LightGroupNumericContract.fromProperty(
        property('brightness', DevicesModulePropertyCategory.brightness),
      )!;
      expect(contract.target('0.6'), 0.625);
      expect(contract.target('0.125'), 0.125);
      expect(contract.target('1.125'), 1.125);
      for (final invalid in ['0.124', '1.126', 'NaN', 'Infinity', '']) {
        expect(contract.target(invalid), isNull);
      }
    },
  );
  test(
    'refuses unsupported range/step and read-only metadata before transport',
    () {
      expect(
        LightGroupNumericContract.fromProperty(
          property('a', DevicesModulePropertyCategory.brightness, step: 0),
        ),
        isNull,
      );
      expect(
        LightGroupNumericContract.fromProperty(
          property(
            'a',
            DevicesModulePropertyCategory.brightness,
            permissions: [DevicesModulePermissionType.ro],
          ),
        ),
        isNull,
      );
    },
  );
  test(
    'supports continuous native float contracts and refuses unrepresentable step precision',
    () {
      final continuous = LightGroupNumericContract.fromProperty(
        property(
          'brightness',
          DevicesModulePropertyCategory.brightness,
          step: null,
        ),
      )!;
      expect(continuous.target('0.6'), 0.6);
      expect(
        LightGroupNumericContract.fromProperty(
          property(
            'brightness',
            DevicesModulePropertyCategory.brightness,
            step: 0.0000001,
          ),
        ),
        isNull,
      );
    },
  );
  test(
    'requires a complete tuple and every explicit bounded finite native target',
    () {
      final tuple = [
        property('red', DevicesModulePropertyCategory.colorRed),
        property('green', DevicesModulePropertyCategory.colorGreen),
        property('blue', DevicesModulePropertyCategory.colorBlue),
      ];
      final requested = {'red': '0.6', 'green': '0.125', 'blue': '1.125'};
      List<dynamic>? targets(
        List<ChannelPropertyView> props,
        Map<String, String> values,
      ) => lightGroupNumericTargets(
        deviceId: 'group',
        channelId: 'light',
        properties: props,
        requested: values,
      );
      expect(targets(tuple, requested)!.map((target) => target.value), [
        0.625,
        0.125,
        1.125,
      ]);
      expect(targets(tuple.take(2).toList(), requested), isNull);
      expect(targets(tuple, {...requested}..remove('blue')), isNull);
      expect(targets(tuple, {...requested, 'blue': '2'}), isNull);
      expect(targets(tuple, {...requested, 'green': 'NaN'}), isNull);
    },
  );
}
