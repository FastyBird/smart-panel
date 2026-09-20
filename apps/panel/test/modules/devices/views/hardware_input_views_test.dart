import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/analog_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/binary_input.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/button.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/input_controller.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/switcher.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/event.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/percentage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/serial_number.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/state.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/unit.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/value.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/room_domain_classifier.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Hardware Input Property Views', () {
    test('ValueChannelPropertyView reads numeric and generic values', () {
      final numProp = ValueChannelPropertyView(
        id: 'p1',
        type: 'value',
        category: DevicesModulePropertyCategory.value,
        channel: 'c1',
        valueState: PropertyValueState(value: NumberValueType(42.5)),
      );
      expect(numProp.valueNum, 42.5);
      expect(numProp.propertyValue, 42.5);

      final strProp = ValueChannelPropertyView(
        id: 'p2',
        type: 'value',
        category: DevicesModulePropertyCategory.value,
        channel: 'c1',
        valueState: PropertyValueState(value: StringValueType('test')),
      );
      expect(strProp.valueNum, isNull);
      expect(strProp.propertyValue, 'test');
    });

    test('UnitChannelPropertyView reads unit string', () {
      final unitProp = UnitChannelPropertyView(
        id: 'p3',
        type: 'unit',
        category: DevicesModulePropertyCategory.unit,
        channel: 'c1',
        valueState: PropertyValueState(value: StringValueType('V')),
      );
      expect(unitProp.unitString, 'V');
    });

    test('StateChannelPropertyView handles boolean and string states', () {
      final boolProp = StateChannelPropertyView(
        id: 'p4',
        type: 'state',
        category: DevicesModulePropertyCategory.state,
        channel: 'c1',
        valueState: PropertyValueState(value: BooleanValueType(true)),
      );
      expect(boolProp.stateBool, isTrue);
      expect(boolProp.stateString, 'true');

      final strProp = StateChannelPropertyView(
        id: 'p5',
        type: 'state',
        category: DevicesModulePropertyCategory.state,
        channel: 'c1',
        valueState: PropertyValueState(value: StringValueType('closed')),
      );
      expect(strProp.stateBool, isNull);
      expect(strProp.stateString, 'closed');
    });
  });

  group('Hardware Input Channel Views', () {
    test('ButtonChannelView exposes event, detected, and active', () {
      final button = ButtonChannelView(
        id: 'btn-1',
        type: 'button',
        category: DevicesModuleChannelCategory.button,
        name: 'Button 1',
        device: 'd1',
        properties: [
          EventChannelPropertyView(
            id: 'p-event',
            type: 'event',
            category: DevicesModulePropertyCategory.event,
            channel: 'btn-1',
            valueState: PropertyValueState(value: StringValueType('single_press')),
          ),
          DetectedChannelPropertyView(
            id: 'p-detected',
            type: 'detected',
            category: DevicesModulePropertyCategory.detected,
            channel: 'btn-1',
            valueState: PropertyValueState(value: BooleanValueType(true)),
          ),
          ActiveChannelPropertyView(
            id: 'p-active',
            type: 'active',
            category: DevicesModulePropertyCategory.active,
            channel: 'btn-1',
            valueState: PropertyValueState(value: BooleanValueType(true)),
          ),
        ],
      );

      expect(button.event, 'single_press');
      expect(button.hasDetected, isTrue);
      expect(button.detected, isTrue);
      expect(button.hasActive, isTrue);
      expect(button.isActive, isTrue);
    });

    test('BinaryInputChannelView exposes state and active', () {
      final binaryInput = BinaryInputChannelView(
        id: 'bin-1',
        type: 'binary_input',
        category: DevicesModuleChannelCategory.binaryInput,
        name: 'Contact Input',
        device: 'd1',
        properties: [
          StateChannelPropertyView(
            id: 'p-state',
            type: 'state',
            category: DevicesModulePropertyCategory.state,
            channel: 'bin-1',
            valueState: PropertyValueState(value: BooleanValueType(true)),
          ),
          ActiveChannelPropertyView(
            id: 'p-active',
            type: 'active',
            category: DevicesModulePropertyCategory.active,
            channel: 'bin-1',
            valueState: PropertyValueState(value: BooleanValueType(true)),
          ),
        ],
      );

      expect(buttonState(binaryInput), isTrue);
      expect(binaryInput.hasActive, isTrue);
      expect(binaryInput.isActive, isTrue);
    });

    test('AnalogInputChannelView exposes value, unit, and active', () {
      final analogInput = AnalogInputChannelView(
        id: 'analog-1',
        type: 'analog_input',
        category: DevicesModuleChannelCategory.analogInput,
        name: 'Voltage Input',
        device: 'd1',
        properties: [
          ValueChannelPropertyView(
            id: 'p-value',
            type: 'value',
            category: DevicesModulePropertyCategory.value,
            channel: 'analog-1',
            valueState: PropertyValueState(value: NumberValueType(12.4)),
          ),
          UnitChannelPropertyView(
            id: 'p-unit',
            type: 'unit',
            category: DevicesModulePropertyCategory.unit,
            channel: 'analog-1',
            valueState: PropertyValueState(value: StringValueType('V')),
          ),
        ],
      );

      expect(analogInput.value, 12.4);
      expect(analogInput.unit, 'V');
      expect(analogInput.hasActive, isFalse);
    });
  });

  group('InputControllerDeviceView', () {
    test('exposes channels and mixins properly', () {
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

      final battery = BatteryChannelView(
        id: 'bat-1',
        type: 'battery',
        category: DevicesModuleChannelCategory.battery,
        device: 'ic-1',
        properties: [
          PercentageChannelPropertyView(
            id: 'p-bat-pct',
            type: 'percentage',
            category: DevicesModulePropertyCategory.percentage,
            channel: 'bat-1',
            valueState: PropertyValueState(value: NumberValueType(85)),
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

      final button = ButtonChannelView(
        id: 'btn-1',
        type: 'button',
        category: DevicesModuleChannelCategory.button,
        name: 'Top Button',
        device: 'ic-1',
        properties: [
          EventChannelPropertyView(
            id: 'p-event',
            type: 'event',
            category: DevicesModulePropertyCategory.event,
            channel: 'btn-1',
            valueState: PropertyValueState(value: StringValueType('single_press')),
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
        name: 'Reed Switch',
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
        id: 'an-1',
        type: 'analog_input',
        category: DevicesModuleChannelCategory.analogInput,
        name: 'Potentiometer',
        device: 'ic-1',
        properties: [
          ValueChannelPropertyView(
            id: 'p-val',
            type: 'value',
            category: DevicesModulePropertyCategory.value,
            channel: 'an-1',
            valueState: PropertyValueState(value: NumberValueType(75)),
          ),
          UnitChannelPropertyView(
            id: 'p-u',
            type: 'unit',
            category: DevicesModulePropertyCategory.unit,
            channel: 'an-1',
            valueState: PropertyValueState(value: StringValueType('%')),
          ),
        ],
      );

      final controller = InputControllerDeviceView(
        id: 'ic-1',
        type: 'input_controller',
        category: DevicesModuleDeviceCategory.inputController,
        name: 'Wall Controller',
        channels: [devInfo, battery, button, binaryInput, analogInput],
      );

      expect(controller.deviceInformationChannel, devInfo);
      expect(controller.batteryChannel, battery);
      expect(controller.hasBattery, isTrue);
      expect(controller.batteryPercentage, 85);

      expect(controller.buttonChannel, button);
      expect(controller.hasButton, isTrue);
      expect(controller.buttonEvent, 'single_press');
      expect(controller.buttonChannels.length, 1);

      expect(controller.binaryInputChannel, binaryInput);
      expect(controller.hasBinaryInput, isTrue);
      expect(controller.binaryInputState, isTrue);
      expect(controller.binaryInputChannels.length, 1);

      expect(controller.analogInputChannel, analogInput);
      expect(controller.hasAnalogInput, isTrue);
      expect(controller.analogInputValue, 75);
      expect(controller.analogInputUnit, '%');
      expect(controller.analogInputChannels.length, 1);
    });
  });

  group('Mixed Device Actuator Isolation', () {
    test('LightingDeviceView isOn ignores button and binary_input states', () {
      final devInfo = DeviceInformationChannelView(
        id: 'info-l',
        type: 'device_information',
        category: DevicesModuleChannelCategory.deviceInformation,
        device: 'light-1',
        properties: [
          ManufacturerChannelPropertyView(
            id: 'p-mfg',
            type: 'manufacturer',
            category: DevicesModulePropertyCategory.manufacturer,
            channel: 'info-l',
            valueState: PropertyValueState(value: StringValueType('Shelly')),
          ),
          SerialNumberChannelPropertyView(
            id: 'p-sn',
            type: 'serial_number',
            category: DevicesModulePropertyCategory.serialNumber,
            channel: 'info-l',
            valueState: PropertyValueState(value: StringValueType('shelly-1')),
          ),
        ],
      );

      final lightChannel = LightChannelView(
        id: 'l-1',
        type: 'light',
        category: DevicesModuleChannelCategory.light,
        device: 'light-1',
        properties: [
          OnChannelPropertyView(
            id: 'p-on',
            type: 'on',
            category: DevicesModulePropertyCategory.valueOn,
            channel: 'l-1',
            valueState: PropertyValueState(value: BooleanValueType(false)),
          ),
        ],
      );

      final binaryInputChannel = BinaryInputChannelView(
        id: 'bin-1',
        type: 'binary_input',
        category: DevicesModuleChannelCategory.binaryInput,
        device: 'light-1',
        properties: [
          StateChannelPropertyView(
            id: 'p-bin-state',
            type: 'state',
            category: DevicesModulePropertyCategory.state,
            channel: 'bin-1',
            valueState: PropertyValueState(value: BooleanValueType(true)), // HIGH/ON input
          ),
        ],
      );

      final lightingDevice = LightingDeviceView(
        id: 'light-1',
        type: 'lighting',
        category: DevicesModuleDeviceCategory.lighting,
        name: 'Shelly Dimmer with Button',
        channels: [devInfo, lightChannel, binaryInputChannel],
      );

      // Even though binary input is true, the lighting actuator power state isOn must remain false
      expect(lightingDevice.isOn, isFalse);
      expect(lightingDevice.hasBinaryInput, isTrue);
      expect(lightingDevice.binaryInputState, isTrue);
    });

    test('SwitcherDeviceView isOn ignores button and binary_input states', () {
      final devInfo = DeviceInformationChannelView(
        id: 'info-s',
        type: 'device_information',
        category: DevicesModuleChannelCategory.deviceInformation,
        device: 'sw-1',
        properties: [
          ManufacturerChannelPropertyView(
            id: 'p-mfg',
            type: 'manufacturer',
            category: DevicesModulePropertyCategory.manufacturer,
            channel: 'info-s',
            valueState: PropertyValueState(value: StringValueType('Shelly')),
          ),
          SerialNumberChannelPropertyView(
            id: 'p-sn',
            type: 'serial_number',
            category: DevicesModulePropertyCategory.serialNumber,
            channel: 'info-s',
            valueState: PropertyValueState(value: StringValueType('shelly-sw')),
          ),
        ],
      );

      final switcherChannel = SwitcherChannelView(
        id: 'sw-c1',
        type: 'switcher',
        category: DevicesModuleChannelCategory.switcher,
        device: 'sw-1',
        properties: [
          OnChannelPropertyView(
            id: 'p-sw-on',
            type: 'on',
            category: DevicesModulePropertyCategory.valueOn,
            channel: 'sw-c1',
            valueState: PropertyValueState(value: BooleanValueType(false)),
          ),
        ],
      );

      final buttonChannel = ButtonChannelView(
        id: 'btn-1',
        type: 'button',
        category: DevicesModuleChannelCategory.button,
        device: 'sw-1',
        properties: [
          DetectedChannelPropertyView(
            id: 'p-det',
            type: 'detected',
            category: DevicesModulePropertyCategory.detected,
            channel: 'btn-1',
            valueState: PropertyValueState(value: BooleanValueType(true)),
          ),
        ],
      );

      final switcherDevice = SwitcherDeviceView(
        id: 'sw-1',
        type: 'switcher',
        category: DevicesModuleDeviceCategory.switcher,
        name: 'Shelly Plus 1',
        channels: [devInfo, switcherChannel, buttonChannel],
      );

      expect(switcherDevice.isOn, isFalse);
      expect(switcherDevice.hasButton, isTrue);
      expect(switcherDevice.isButtonDetected, isTrue);
    });
  });

  group('Domain and Room Classification', () {
    test('InputController is not assigned to any room domain', () {
      final domain = classifyDeviceToDomain(DevicesModuleDeviceCategory.inputController);
      expect(domain, isNull);
    });

    test('InputController device is not counted as energy device', () {
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
        device: 'ic-1',
        properties: [],
      );

      final controller = InputControllerDeviceView(
        id: 'ic-1',
        type: 'input_controller',
        category: DevicesModuleDeviceCategory.inputController,
        name: 'Wall Controller',
        channels: [devInfo, button],
      );

      expect(countEnergyDevices([controller]), 0);
    });
  });
}

bool? buttonState(BinaryInputChannelView view) => view.state;
