import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/device_information.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/model.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import '../../../../helpers/screen_service.dart';

class _MockDevicesService extends Mock implements DevicesService {}

const _deviceId = 'fan-1';

FanDeviceView _fan({required bool isOnline}) => FanDeviceView(
  id: _deviceId,
  type: 'fan',
  category: DevicesModuleDeviceCategory.fan,
  name: 'Ceiling fan',
  isOnline: isOnline,
  channels: [
    DeviceInformationChannelView(
      id: 'info',
      type: 'device_information',
      category: DevicesModuleChannelCategory.deviceInformation,
      device: _deviceId,
      properties: [
        ManufacturerChannelPropertyView(
          id: 'manufacturer',
          type: 'manufacturer',
          channel: 'info',
          valueState: PropertyValueState(value: StringValueType('Acme')),
        ),
        ModelChannelPropertyView(
          id: 'model',
          type: 'model',
          channel: 'info',
          valueState: PropertyValueState(value: StringValueType('F1')),
        ),
      ],
    ),
    FanChannelView(
      id: 'fan',
      type: 'fan',
      category: DevicesModuleChannelCategory.fan,
      device: _deviceId,
      properties: [
        OnChannelPropertyView(
          id: 'on',
          type: 'on',
          channel: 'fan',
          category: DevicesModulePropertyCategory.valueOn,
          valueState: PropertyValueState(value: BooleanValueType(true)),
        ),
      ],
    ),
  ],
);

void main() {
  setUpAll(() {
    registerTestScreenService();
    if (!locator.isRegistered<VisualDensityService>()) {
      locator.registerSingleton<VisualDensityService>(
        VisualDensityService(pixelRatio: 2),
      );
    }
  });

  late _MockDevicesService devices;
  final listeners = <VoidCallback>[];
  late FanDeviceView current;

  setUp(() {
    listeners.clear();
    devices = _MockDevicesService();
    when(() => devices.addListener(any())).thenAnswer(
      (invocation) =>
          listeners.add(invocation.positionalArguments.first as VoidCallback),
    );
    when(() => devices.removeListener(any())).thenAnswer(
      (invocation) => listeners.remove(invocation.positionalArguments.first),
    );
    when(() => devices.getDevice(_deviceId)).thenAnswer((_) => current);
    locator.registerSingleton<DevicesService>(devices);
  });

  tearDown(() => locator.unregister<DevicesService>());

  Future<void> pump(WidgetTester tester, FanDeviceView pushed) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightThemeFor(AppAccent.blue),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: FanDeviceDetail(device: pushed),
      ),
    );
    await tester.pump();
  }

  HeaderIconButton powerButton(WidgetTester tester) =>
      tester.widget<HeaderIconButton>(
        find.descendant(
          of: find.byType(DevicePowerButton),
          matching: find.byType(HeaderIconButton),
        ),
      );

  testWidgets('disables the header power button when the fan goes offline', (
    tester,
  ) async {
    // The climate view pushes the fan once; later updates come only from the
    // devices service.
    final pushed = _fan(isOnline: true);
    current = pushed;

    await pump(tester, pushed);
    expect(powerButton(tester).onTap, isNotNull);

    current = _fan(isOnline: false);
    for (final listener in List.of(listeners)) {
      listener();
    }
    await tester.pump();

    expect(powerButton(tester).onTap, isNull);
  });

  testWidgets(
    'enables the header power button when the fan comes back online',
    (tester) async {
      final pushed = _fan(isOnline: false);
      current = pushed;

      await pump(tester, pushed);
      expect(powerButton(tester).onTap, isNull);

      current = _fan(isOnline: true);
      for (final listener in List.of(listeners)) {
        listener();
      }
      await tester.pump();

      expect(powerButton(tester).onTap, isNotNull);
    },
  );
}
