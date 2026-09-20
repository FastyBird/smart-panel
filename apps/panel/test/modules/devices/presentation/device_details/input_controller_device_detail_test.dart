import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/input_controller.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/analog_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/binary_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/button.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/input_controller.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/event.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/percentage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/serial_number.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/state.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/unit.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/value.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUpAll(() async {
    await locator.reset();
    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 1280, screenHeight: 800, pixelRatio: 1),
      dispose: (service) => service.dispose(),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 1),
    );
  });

  tearDownAll(() async {
    await locator.reset();
  });

  testWidgets('InputControllerDeviceDetail renders read-only tiles for input channels', (tester) async {
    final devInfo = DeviceInformationChannelView(
      id: 'info-1',
      type: 'device_information',
      category: DevicesModuleChannelCategory.deviceInformation,
      device: 'ic-1',
      properties: [
        ManufacturerChannelPropertyView(
          id: 'p-mfg',
          type: 'manufacturer',
          category: DevicesModulePropertyCategory.manufacturer,
          channel: 'info-1',
          valueState: PropertyValueState(value: StringValueType('FastyBird')),
        ),
        SerialNumberChannelPropertyView(
          id: 'p-sn',
          type: 'serial_number',
          category: DevicesModulePropertyCategory.serialNumber,
          channel: 'info-1',
          valueState: PropertyValueState(value: StringValueType('12345')),
        ),
      ],
    );

    final button = ButtonChannelView(
      id: 'btn-1',
      type: 'button',
      category: DevicesModuleChannelCategory.button,
      name: 'Button Channel',
      device: 'ic-1',
      properties: [
        EventChannelPropertyView(
          id: 'p-event',
          type: 'event',
          category: DevicesModulePropertyCategory.event,
          channel: 'btn-1',
          valueState: PropertyValueState(value: StringValueType('double_press')),
        ),
        DetectedChannelPropertyView(
          id: 'p-detected',
          type: 'detected',
          category: DevicesModulePropertyCategory.detected,
          channel: 'btn-1',
          valueState: PropertyValueState(value: BooleanValueType(false)),
        ),
      ],
    );

    final binaryInput = BinaryInputChannelView(
      id: 'bin-1',
      type: 'binary_input',
      category: DevicesModuleChannelCategory.binaryInput,
      name: 'Door Contact Input',
      device: 'ic-1',
      properties: [
        StateChannelPropertyView(
          id: 'p-state',
          type: 'state',
          category: DevicesModulePropertyCategory.state,
          channel: 'bin-1',
          valueState: PropertyValueState(value: BooleanValueType(true)),
        ),
      ],
    );

    final analogInput = AnalogInputChannelView(
      id: 'analog-1',
      type: 'analog_input',
      category: DevicesModuleChannelCategory.analogInput,
      name: 'Analog Slider Input',
      device: 'ic-1',
      properties: [
        ValueChannelPropertyView(
          id: 'p-val',
          type: 'value',
          category: DevicesModulePropertyCategory.value,
          channel: 'analog-1',
          valueState: PropertyValueState(value: NumberValueType(4.8)),
        ),
        UnitChannelPropertyView(
          id: 'p-u',
          type: 'unit',
          category: DevicesModulePropertyCategory.unit,
          channel: 'analog-1',
          valueState: PropertyValueState(value: StringValueType('V')),
        ),
      ],
    );

    final battery = BatteryChannelView(
      id: 'bat-1',
      type: 'battery',
      category: DevicesModuleChannelCategory.battery,
      name: 'Battery Status',
      device: 'ic-1',
      properties: [
        PercentageChannelPropertyView(
          id: 'p-bat-pct',
          type: 'percentage',
          category: DevicesModulePropertyCategory.percentage,
          channel: 'bat-1',
          valueState: PropertyValueState(value: NumberValueType(92)),
        ),
        StatusChannelPropertyView(
          id: 'p-bat-status',
          type: 'status',
          category: DevicesModulePropertyCategory.status,
          channel: 'bat-1',
          valueState: PropertyValueState(value: StringValueType('ok')),
        ),
      ],
    );

    final device = InputControllerDeviceView(
      id: 'ic-1',
      type: 'input_controller',
      category: DevicesModuleDeviceCategory.inputController,
      name: 'Test Controller',
      channels: [devInfo, button, binaryInput, analogInput, battery],
    );

    await tester.pumpWidget(MaterialApp(
      home: InputControllerDeviceDetail(device: device),
    ));
    await tester.pumpAndSettle();

    // Verify header title
    expect(find.text('Test Controller'), findsOneWidget);

    // Verify button tile rendered
    expect(find.text('Button Channel'), findsOneWidget);
    expect(find.text('double_press'), findsOneWidget);

    // Verify binary input tile rendered
    expect(find.text('Door Contact Input'), findsOneWidget);
    expect(find.text('ON'), findsOneWidget);

    // Verify analog input tile rendered
    expect(find.text('Analog Slider Input'), findsOneWidget);
    expect(find.text('4.8 V'), findsOneWidget);

    // Verify battery tile rendered
    expect(find.text('Battery Status'), findsOneWidget);
    expect(find.text('92%'), findsOneWidget);

    // Verify tiles are UniversalTiles
    expect(find.byType(UniversalTile), findsNWidgets(4));

    // Verify no interactive switch/slider controls are rendered
    expect(find.byType(Switch), findsNothing);
    expect(find.byType(Slider), findsNothing);
  });
}
