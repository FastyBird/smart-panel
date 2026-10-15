import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDevicesService extends Mock implements DevicesService {}

void main() {
  testWidgets('shows requested heat separately from suspended physical output', (
    tester,
  ) async {
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
    // Comfort has its own HTTP lifecycle; these regressions count the mode/runtime pair.
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.endsWith('/comfort')) {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {
                    'controller': options.path
                        .split('/')
                        .reversed
                        .skip(1)
                        .first,
                    'revision': 1,
                    'graph_revision': 1,
                    'configuration': null,
                    'effective': {'source': 'manual', 'preset': null},
                    'clock_policy': 'server-policy',
                  },
                },
              ),
            );
          } else {
            handler.next(options);
          }
        },
      ),
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final runtime = options.path.endsWith('/runtime');
          handler.resolve(
            Response<Map<String, dynamic>>(
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
                        'inputs': [
                          {
                            'binding': 'ambient',
                            'role': 'ambient',
                            'source_kind': 'physical',
                            'status': 'stale',
                            'quality': 'unavailable',
                            'age_seconds': 120,
                            'maximum_age_seconds': 60,
                          },
                          {
                            'binding': 'floor',
                            'role': 'floor',
                            'source_kind': 'derived',
                            'status': 'unavailable',
                            'quality': 'unavailable',
                            'maximum_age_seconds': 30,
                            'reasons': ['source_fault'],
                          },
                          {
                            'binding': 'contact',
                            'role': 'contact',
                            'source_kind': 'unknown',
                            'status': 'missing',
                            'quality': 'unavailable',
                            'maximum_age_seconds': 60,
                          },
                        ],
                        'branches': [
                          {'role': 'heating', 'activity': 'off'},
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
            ),
          );
        },
      ),
    );
    locator.registerSingleton<Dio>(dio);
    addTearDown(() => locator.unregister<Dio>());

    final device = ThermostatDeviceView(
      id: 'controller',
      type: 'virtual',
      name: 'Room thermostat',
      channels: const [],
    );
    await tester.pumpWidget(
      MaterialApp(home: VirtualThermostatDeviceDetail(device: device)),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Requested mode: heat'), findsOneWidget);
    expect(find.text('Controller readiness: suspended'), findsOneWidget);
    expect(
      find.text('Floor protection is holding heating OFF.'),
      findsOneWidget,
    );
    expect(find.text('Inhibited: floor limit reached'), findsOneWidget);
    expect(find.text('off'), findsOneWidget);
    expect(find.text('ambient: stale (physical)'), findsOneWidget);
    expect(find.text('floor: unavailable (derived)'), findsOneWidget);
    expect(find.text('contact: missing (unknown)'), findsOneWidget);
    expect(find.textContaining('Allowed age: 60 s'), findsWidgets);
    expect(find.textContaining('Ambient: 19.5'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
  staleDeviceResponseTest();
  disposePendingCommandTest();
  commandSupersedesPollTest();
}

void commandSupersedesPollTest() {
  testWidgets('accepted command refresh supersedes an older pending poll', (
    tester,
  ) async {
    final service = MockDevicesService();
    when(
      () => service.setMultiplePropertyValues(
        properties: any(named: 'properties'),
        context: any(named: 'context'),
        requireAtomicBatch: any(named: 'requireAtomicBatch'),
      ),
    ).thenAnswer((_) async => true);
    locator.registerSingleton<DevicesService>(service);
    addTearDown(() => locator.unregister<DevicesService>());

    final heldPoll = <String, RequestInterceptorHandler>{};
    var holdPoll = false;
    var afterCommand = false;
    var requests = 0;
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
    // Comfort has its own HTTP lifecycle; these regressions count the mode/runtime pair.
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.endsWith('/comfort')) {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {
                    'controller': options.path
                        .split('/')
                        .reversed
                        .skip(1)
                        .first,
                    'revision': 1,
                    'graph_revision': 1,
                    'configuration': null,
                    'effective': {'source': 'manual', 'preset': null},
                    'clock_policy': 'server-policy',
                  },
                },
              ),
            );
          } else {
            handler.next(options);
          }
        },
      ),
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          requests++;
          if (holdPoll && !afterCommand) {
            heldPoll[options.path] = handler;
            return;
          }
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'data': options.path.endsWith('/runtime')
                    ? {
                        'requested_mode': afterCommand ? 'heat' : 'off',
                        'readiness': 'draft',
                        'reasons': [],
                      }
                    : {
                        'requested_mode': afterCommand ? 'heat' : 'off',
                        'locked': false,
                        'policy': {
                          'heatingSetpoint': null,
                          'coolingSetpoint': null,
                        },
                        'settings': [
                          {'setting': 'locked', 'property': 'locked'},
                        ],
                      },
              },
            ),
          );
        },
      ),
    );
    locator.registerSingleton<Dio>(dio);
    addTearDown(() => locator.unregister<Dio>());

    final device = ThermostatDeviceView(
      id: 'controller',
      type: 'virtual',
      name: 'Thermostat',
      channels: [
        ThermostatChannelView(
          id: 'thermostat',
          type: 'virtual',
          device: 'controller',
          properties: [
            LockedChannelPropertyView(
              id: 'locked',
              type: 'virtual',
              channel: 'thermostat',
              permission: const [DevicesModulePermissionType.rw],
            ),
          ],
        ),
      ],
    );
    await tester.pumpWidget(
      MaterialApp(home: VirtualThermostatDeviceDetail(device: device)),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Requested mode: off'), findsOneWidget);
    expect(requests, 2);

    holdPoll = true;
    await tester.pump(const Duration(seconds: 5));
    await tester.pump(const Duration(milliseconds: 100));
    expect(heldPoll, hasLength(2));
    expect(requests, 4);

    afterCommand = true;
    await tester.tap(find.text('Lock thermostat controls'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(requests, 6);
    expect(find.text('Requested mode: heat'), findsOneWidget);

    for (final entry in heldPoll.entries) {
      entry.value.resolve(
        Response<Map<String, dynamic>>(
          requestOptions: RequestOptions(path: entry.key),
          statusCode: 200,
          data: {
            'data': entry.key.endsWith('/runtime')
                ? {'requested_mode': 'off', 'readiness': 'draft', 'reasons': []}
                : {
                    'requested_mode': 'off',
                    'locked': false,
                    'policy': {
                      'heatingSetpoint': null,
                      'coolingSetpoint': null,
                    },
                    'settings': [
                      {'setting': 'locked', 'property': 'locked'},
                    ],
                  },
          },
        ),
      );
    }
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Requested mode: heat'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}

void disposePendingCommandTest() {
  testWidgets('does not update disposed detail when a command completes', (
    tester,
  ) async {
    final pendingCommand = Completer<bool>();
    final service = MockDevicesService();
    when(
      () => service.setMultiplePropertyValues(
        properties: any(named: 'properties'),
        context: any(named: 'context'),
        requireAtomicBatch: any(named: 'requireAtomicBatch'),
      ),
    ).thenAnswer((_) => pendingCommand.future);
    locator.registerSingleton<DevicesService>(service);
    addTearDown(() => locator.unregister<DevicesService>());

    final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
    // Comfort has its own HTTP lifecycle; these regressions count the mode/runtime pair.
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.endsWith('/comfort')) {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {
                    'controller': options.path
                        .split('/')
                        .reversed
                        .skip(1)
                        .first,
                    'revision': 1,
                    'graph_revision': 1,
                    'configuration': null,
                    'effective': {'source': 'manual', 'preset': null},
                    'clock_policy': 'server-policy',
                  },
                },
              ),
            );
          } else {
            handler.next(options);
          }
        },
      ),
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'data': options.path.endsWith('/runtime')
                    ? {
                        'requested_mode': 'off',
                        'readiness': 'draft',
                        'reasons': [],
                      }
                    : {
                        'requested_mode': 'off',
                        'locked': false,
                        'policy': {
                          'heatingSetpoint': null,
                          'coolingSetpoint': null,
                        },
                        'settings': [
                          {'setting': 'locked', 'property': 'locked'},
                        ],
                      },
              },
            ),
          );
        },
      ),
    );
    locator.registerSingleton<Dio>(dio);
    addTearDown(() => locator.unregister<Dio>());

    final device = ThermostatDeviceView(
      id: 'controller',
      type: 'virtual',
      name: 'Thermostat',
      channels: [
        ThermostatChannelView(
          id: 'thermostat',
          type: 'virtual',
          device: 'controller',
          properties: [
            LockedChannelPropertyView(
              id: 'locked',
              type: 'virtual',
              channel: 'thermostat',
              permission: const [DevicesModulePermissionType.rw],
            ),
          ],
        ),
      ],
    );
    await tester.pumpWidget(
      MaterialApp(home: VirtualThermostatDeviceDetail(device: device)),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.tap(find.text('Lock thermostat controls'));
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    pendingCommand.complete(true);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}

// A detail State is reused when navigation changes between virtual thermostats.
// The older network response must never replace the new device's state.
void staleDeviceResponseTest() {
  testWidgets('discards an earlier device response after the device changes', (
    tester,
  ) async {
    final pending = <String, RequestInterceptorHandler>{};
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
    // Comfort has its own HTTP lifecycle; these regressions count the mode/runtime pair.
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.endsWith('/comfort')) {
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {
                    'controller': options.path
                        .split('/')
                        .reversed
                        .skip(1)
                        .first,
                    'revision': 1,
                    'graph_revision': 1,
                    'configuration': null,
                    'effective': {'source': 'manual', 'preset': null},
                    'clock_policy': 'server-policy',
                  },
                },
              ),
            );
          } else {
            handler.next(options);
          }
        },
      ),
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          pending[options.path] = handler;
        },
      ),
    );
    locator.registerSingleton<Dio>(dio);
    addTearDown(() => locator.unregister<Dio>());

    final oldDevice = ThermostatDeviceView(
      id: 'old',
      type: 'virtual',
      name: 'Old',
      channels: const [],
    );
    final newDevice = ThermostatDeviceView(
      id: 'new',
      type: 'virtual',
      name: 'New',
      channels: const [],
    );
    await tester.pumpWidget(
      MaterialApp(home: VirtualThermostatDeviceDetail(device: oldDevice)),
    );
    await tester.pump();
    await tester.pumpWidget(
      MaterialApp(home: VirtualThermostatDeviceDetail(device: newDevice)),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(
      pending.keys,
      contains('/plugins/devices-virtual/producers/thermostats/new'),
    );

    void complete(String device, String mode) {
      final path = '/plugins/devices-virtual/producers/thermostats/$device';
      for (final suffix in ['', '/runtime']) {
        final options = RequestOptions(path: '$path$suffix');
        pending['$path$suffix']!.resolve(
          Response<Map<String, dynamic>>(
            requestOptions: options,
            statusCode: 200,
            data: {
              'data': {
                'requested_mode': mode,
                if (suffix.isEmpty) ...{
                  'locked': false,
                  'policy': {'heatingSetpoint': null, 'coolingSetpoint': null},
                  'settings': [],
                } else ...{
                  'readiness': 'suspended',
                  'reasons': [],
                },
              },
            },
          ),
        );
      }
    }

    complete('new', 'off');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    complete('old', 'heat');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Requested mode: off'), findsOneWidget);
    expect(find.text('Requested mode: heat'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
}
