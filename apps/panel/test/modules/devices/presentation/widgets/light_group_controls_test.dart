import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/models/composite_command.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/light_group_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockGroupDevicesService extends Mock implements DevicesService {}

LightChannelView channel({bool writableBlue = true}) => LightChannelView(
  id: 'light',
  type: 'virtual',
  device: 'group',
  properties: [
    OnChannelPropertyView(
      id: 'on',
      type: 'virtual',
      channel: 'light',
      category: DevicesModulePropertyCategory.valueOn,
      dataType: DevicesModuleDataType.valueBool,
      permission: [DevicesModulePermissionType.rw],
    ),
    for (final category in [
      DevicesModulePropertyCategory.colorRed,
      DevicesModulePropertyCategory.colorGreen,
      DevicesModulePropertyCategory.colorBlue,
    ])
      ChannelPropertyView(
        id: category.json!,
        type: 'virtual',
        channel: 'light',
        category: category,
        dataType: DevicesModuleDataType.float,
        permission:
            !writableBlue && category == DevicesModulePropertyCategory.colorBlue
            ? [DevicesModulePermissionType.ro]
            : [DevicesModulePermissionType.rw],
        format: NumberListFormatType([0.125, 1.125]),
        step: 0.25,
        unit: 'native',
      ),
  ],
);

void main() {
  setUpAll(() => registerFallbackValue(<PropertyCommandItem>[]));
  testWidgets(
    'unknown fractional color needs complete explicit input and sends one snapped tuple',
    (tester) async {
      final service = MockGroupDevicesService();
      when(
        () => service.setCompositeProperties(
          deviceId: any(named: 'deviceId'),
          properties: any(named: 'properties'),
        ),
      ).thenAnswer(
        (_) async => const CompositeCommandOutcome(
          id: 'parent',
          requestId: 'request',
          status: 'partial',
          children: [],
          terminal: true,
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LightGroupControls(
              deviceId: 'group',
              channel: channel(),
              service: service,
            ),
          ),
        ),
      );
      expect(find.textContaining('reported unknown'), findsNWidgets(3));
      final apply = find.widgetWithText(OutlinedButton, 'Apply together');
      expect(tester.widget<OutlinedButton>(apply).onPressed, isNull);
      for (final category in ['color_red', 'color_green', 'color_blue']) {
        await tester.enterText(
          find.byKey(ValueKey('group-target-$category')),
          '0.6',
        );
      }
      await tester.pump();
      expect(tester.widget<OutlinedButton>(apply).onPressed, isNotNull);
      await tester.ensureVisible(apply);
      await tester.tap(apply);
      await tester.pump();
      final calls = verify(
        () => service.setCompositeProperties(
          deviceId: 'group',
          properties: captureAny(named: 'properties'),
        ),
      ).captured;
      final targets = calls.single as List<PropertyCommandItem>;
      expect(targets.map((target) => target.value), [0.625, 0.625, 0.625]);
      expect(targets.map((target) => target.propertyId), [
        'color_red',
        'color_green',
        'color_blue',
      ]);
    },
  );
  testWidgets(
    'read-only tuple member exposes unavailable control rather than incompatible inputs',
    (tester) async {
      final service = MockGroupDevicesService();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: LightGroupControls(
              deviceId: 'group',
              channel: channel(writableBlue: false),
              service: service,
            ),
          ),
        ),
      );
      expect(find.textContaining('control unavailable'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      expect(find.text('Apply together'), findsNothing);
    },
  );
}
