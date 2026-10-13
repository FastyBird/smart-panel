import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows requested heat separately from suspended physical output',
      (tester) async {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
    dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      final runtime = options.path.endsWith('/runtime');
      handler.resolve(Response<Map<String, dynamic>>(
        requestOptions: options,
        statusCode: 200,
        data: {
          'data': runtime
              ? {
                  'requested_mode': 'heat',
                  'heating_setpoint': 21.0,
                  'cooling_setpoint': null,
                  'current_temperature': 19.5,
                  'floor_temperature': 29.0,
                  'floor_latched': true,
                  'readiness': 'suspended',
                  'reasons': ['floor limit reached'],
                  'branches': [
                    {'role': 'heating', 'activity': 'off'}
                  ],
                }
              : {
                  'requested_mode': 'heat',
                  'locked': false,
                  'policy': {
                    'heatingSetpoint': 21.0,
                    'coolingSetpoint': null,
                  },
                  'settings': [],
                },
        },
      ));
    }));
    locator.registerSingleton<Dio>(dio);
    addTearDown(() => locator.unregister<Dio>());

    final device = ThermostatDeviceView(
      id: 'controller',
      type: 'virtual',
      name: 'Room thermostat',
      channels: const [],
    );
    await tester.pumpWidget(MaterialApp(
      home: VirtualThermostatDeviceDetail(device: device),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Requested mode: heat'), findsOneWidget);
    expect(find.text('Controller readiness: suspended'), findsOneWidget);
    expect(find.text('Floor protection is holding heating OFF.'), findsOneWidget);
    expect(find.text('Inhibited: floor limit reached'), findsOneWidget);
    expect(find.text('off'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
