import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_comfort.dart';
import 'package:fastybird_smart_panel/plugins/devices-virtual/models/device.dart';
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
  cachedSourceDeadlineTests();
  sameIdMappedViewLifecycleTests();
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
                        'configuration_revision': 1,
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
                        'revision': 1,
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
    expect(find.text('Reported observation: Unavailable'), findsOneWidget);
    expect(find.text('ambient: stale (physical)'), findsOneWidget);
    expect(find.text('floor: unavailable (derived)'), findsOneWidget);
    expect(find.text('contact: missing (unknown)'), findsOneWidget);
    expect(find.textContaining('Allowed age: 60 s'), findsWidgets);
    expect(find.textContaining('Ambient: 19.5'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  });
  staleDeviceResponseTest();
  staleDeviceResponseTest(sameId: true);
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
                        'configuration_revision': 1,
                        'requested_mode': afterCommand ? 'heat' : 'off',
                        'readiness': 'draft',
                        'reasons': [],
                      }
                    : {
                        'revision': 1,
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
                ? {
                    'configuration_revision': 1,
                    'requested_mode': 'off',
                    'readiness': 'draft',
                    'reasons': [],
                  }
                : {
                    'revision': 1,
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
                        'configuration_revision': 1,
                        'requested_mode': 'off',
                        'readiness': 'draft',
                        'reasons': [],
                      }
                    : {
                        'revision': 1,
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
void staleDeviceResponseTest({bool sameId = false}) {
  testWidgets(
    'discards an earlier device response after ${sameId ? 'the same device model' : 'the device'} changes',
    (tester) async {
      final pending = <String, List<RequestInterceptorHandler>>{};
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
            (pending[options.path] ??= []).add(handler);
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
        id: sameId ? 'old' : 'new',
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
        contains(
          '/plugins/devices-virtual/producers/thermostats/${newDevice.id}',
        ),
      );

      void complete(String device, String mode, {int index = 0}) {
        final path = '/plugins/devices-virtual/producers/thermostats/$device';
        for (final suffix in ['', '/runtime']) {
          final options = RequestOptions(path: '$path$suffix');
          pending['$path$suffix']![index].resolve(
            Response<Map<String, dynamic>>(
              requestOptions: options,
              statusCode: 200,
              data: {
                'data': {
                  'requested_mode': mode,
                  if (suffix.isEmpty) ...{
                    'revision': 1,
                    'locked': false,
                    'policy': {
                      'heatingSetpoint': null,
                      'coolingSetpoint': null,
                    },
                    'settings': [],
                  } else ...{
                    'configuration_revision': 1,
                    'readiness': 'suspended',
                    'reasons': [],
                  },
                },
              },
            ),
          );
        }
      }

      complete(newDevice.id, 'off', index: sameId ? 1 : 0);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      complete('old', 'heat');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('Requested mode: off'), findsOneWidget);
      expect(find.text('Requested mode: heat'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
    },
  );
}

void cachedSourceDeadlineTests() {
  for (final role in ['ambient', 'floor', 'contact']) {
    for (final gap in ['omitted', 'mismatched']) {
      testWidgets(
        '$role runtime property $gap cannot recover at the same sample in actual detail',
        (tester) async {
          final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
          final initial = DateTime.now().subtract(
            const Duration(milliseconds: 10),
          );
          final expiry = initial.add(const Duration(minutes: 1));
          var stamp = initial;
          var broken = false;
          var reads = 0;
          Map declared(String id, String sourceRole) => {
            'id': id,
            'role': sourceRole,
            'source_identity': id,
            'source_property': 'property-$id',
          };
          Map diagnostic(String id, String sourceRole) => {
            'binding': id,
            'role': sourceRole,
            if (!(broken && sourceRole == role && gap == 'omitted'))
              'source_property':
                  broken && sourceRole == role && gap == 'mismatched'
                  ? 'wrong-property'
                  : 'property-$id',
            'source_kind': 'physical',
            'status': 'fresh',
            'quality': 'good',
            'sampled_at': (sourceRole == role ? stamp : initial)
                .toIso8601String(),
            'expires_at': expiry.toIso8601String(),
            'age_seconds': 0,
            'maximum_age_seconds': 60,
          };
          dio.interceptors.add(
            InterceptorsWrapper(
              onRequest: (options, handler) {
                final runtime = options.path.endsWith('/runtime'),
                    comfort = options.path.endsWith('/comfort');
                if (runtime) reads++;
                handler.resolve(
                  Response(
                    requestOptions: options,
                    statusCode: 200,
                    data: {
                      'data': comfort
                          ? {
                              'controller': 'controller',
                              'revision': 1,
                              'graph_revision': 1,
                              'configuration': null,
                              'effective': {'source': 'manual'},
                            }
                          : runtime
                          ? {
                              'configuration_revision': 1,
                              'readiness': 'ready',
                              'current_temperature': 19.5,
                              'floor_temperature': 22,
                              'inputs': [
                                diagnostic('ambient', 'ambient'),
                                if (role != 'ambient') diagnostic(role, role),
                              ],
                              'branches': [],
                            }
                          : {
                              'revision': 1,
                              'locked': false,
                              'policy': {},
                              'settings': [],
                              'actuators': [],
                              'sources': [
                                declared('ambient', 'ambient'),
                                if (role != 'ambient') declared(role, role),
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
          addTearDown(() async {
            await tester.pumpWidget(const SizedBox());
            await tester.pumpAndSettle();
          });
          await tester.binding.setSurfaceSize(const Size(1200, 4000));
          addTearDown(() => tester.binding.setSurfaceSize(null));
          await tester.pumpWidget(
            MaterialApp(
              home: VirtualThermostatDeviceDetail(
                device: ThermostatDeviceView(
                  id: 'controller',
                  type: 'virtual',
                  name: 'Room',
                  channels: const [],
                ),
              ),
            ),
          );
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 100));
          expect(reads, 1);
          expect(find.text('Controller readiness: ready'), findsOneWidget);
          if (role == 'ambient') {
            expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
          }
          if (role == 'floor') {
            expect(find.text('Floor: 22.0 °C'), findsOneWidget);
          }
          broken = true;
          await tester.pump(const Duration(seconds: 3));
          await tester.pump();
          expect(reads, 2);
          expect(
            find.text('Controller readiness: Unavailable'),
            findsOneWidget,
          );
          if (role == 'ambient') {
            expect(find.textContaining('Ambient: 19.5'), findsNothing);
          }
          if (role == 'floor') {
            expect(find.textContaining('Floor: 22.0'), findsNothing);
          }
          broken = false;
          // Restoring the property without a publication must not resurrect S.
          await tester.pump(const Duration(seconds: 3));
          await tester.pump();
          expect(reads, 3);
          expect(
            find.text('Controller readiness: Unavailable'),
            findsOneWidget,
          );
          if (role == 'ambient') {
            expect(find.textContaining('Ambient: 19.5'), findsNothing);
          }
          if (role == 'floor') {
            expect(find.textContaining('Floor: 22.0'), findsNothing);
          }
          stamp = DateTime.now();
          expect(stamp.isAfter(initial), isTrue);
          await tester.pump(const Duration(seconds: 3));
          await tester.pump();
          expect(reads, 4);
          expect(find.text('Controller readiness: ready'), findsOneWidget);
          if (role == 'ambient') {
            expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
          }
          if (role == 'floor') {
            expect(find.text('Floor: 22.0 °C'), findsOneWidget);
          }
          await tester.pumpWidget(const SizedBox());
          await tester.pumpAndSettle();
        },
      );
    }
  }

  for (final role in ['member', 'ambient', 'floor', 'contact', 'contacts']) {
    testWidgets(
      'cached $role HTTP before an expired frame cannot renew its original monotonic deadline',
      (tester) async {
        final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
        final initial = DateTime.now().subtract(
          const Duration(milliseconds: 10),
        );
        var stamp = initial;
        Map diagnostic(
          String binding,
          String inputRole, {
          bool longLived = false,
        }) => {
          'binding': binding,
          'role': inputRole,
          'source_property': binding,
          'source_kind': 'physical',
          'status': 'fresh',
          'quality': 'good',
          'sampled_at': (longLived ? initial : stamp).toIso8601String(),
          'expires_at':
              (longLived
                      ? initial.add(const Duration(minutes: 1))
                      : stamp.add(const Duration(seconds: 2)))
                  .toIso8601String(),
          'age_seconds': 0,
          'maximum_age_seconds': longLived ? 60 : 2,
        };
        Map declared(String binding, String inputRole) => {
          'id': binding,
          'role': inputRole,
          'source_property': binding,
          'source_identity': binding,
        };
        final member = {
          'id': 'one',
          'role': 'heating',
          'state': 'reserved',
          'source_identity': 'relay',
          'physical_identity': 'relay',
          'protection': {'source_identity': 'floor-sensor'},
        };
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              final comfort = options.path.endsWith('/comfort'),
                  runtime = options.path.endsWith('/runtime');
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'data': comfort
                        ? {
                            'controller': 'controller',
                            'revision': 1,
                            'graph_revision': 1,
                            'configuration': null,
                            'effective': {'source': 'manual'},
                          }
                        : runtime
                        ? {
                            'configuration_revision': 1,
                            'requested_mode': 'heat',
                            'readiness': 'ready',
                            'reasons': [],
                            'current_temperature': 19.5,
                            'floor_temperature': 22,
                            'inputs': [
                              diagnostic(
                                'ambient',
                                'ambient',
                                longLived: role != 'ambient',
                              ),
                              if (role == 'floor' || role == 'contact')
                                diagnostic(role, role),
                              if (role == 'contacts') ...[
                                diagnostic(
                                  'contact-a',
                                  'contact',
                                  longLived: true,
                                ),
                                diagnostic('contact-b', 'contact'),
                              ],
                            ],
                            'branches': [
                              if (role == 'member')
                                {
                                  'claim': 'one',
                                  'physical_identity': 'relay',
                                  'role': 'heating',
                                  'activity': 'off',
                                  'protection': {
                                    ...diagnostic('floor-sensor', 'floor'),
                                    'claim': 'one',
                                    'source_identity': 'floor-sensor',
                                    'temperature': 20,
                                    'ready': true,
                                    'latched': false,
                                  },
                                },
                            ],
                          }
                        : {
                            'revision': 1,
                            'locked': false,
                            'policy': {'heatingSetpoint': 21},
                            'settings': [],
                            'sources': [
                              declared('ambient', 'ambient'),
                              if (role == 'floor' || role == 'contact')
                                declared(role, role),
                              if (role == 'contacts') ...[
                                declared('contact-a', 'contact'),
                                declared('contact-b', 'contact'),
                              ],
                            ],
                            'actuators': [if (role == 'member') member],
                          },
                  },
                ),
              );
            },
          ),
        );
        locator.registerSingleton<Dio>(dio);
        addTearDown(() => locator.unregister<Dio>());
        addTearDown(() async {
          await tester.pumpWidget(const SizedBox());
          await tester.pumpAndSettle();
        });
        await tester.binding.setSurfaceSize(const Size(1200, 4000));
        addTearDown(() => tester.binding.setSurfaceSize(null));
        await tester.pumpWidget(
          MaterialApp(
            home: VirtualThermostatDeviceDetail(
              device: ThermostatDeviceView(
                id: 'controller',
                type: 'virtual',
                name: 'Room',
                channels: const [],
              ),
            ),
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        if (role == 'ambient') {
          expect(find.textContaining('Ambient: 19.5'), findsOneWidget);
        }
        if (role == 'member') {
          expect(
            find.textContaining('Live protection reading: 20.0'),
            findsOneWidget,
          );
        }
        // Coalesced fake monotonic time. Real wall remains before original expiry;
        // cached HTTP arrives before any frame has observed expiration.
        await tester.pump(const Duration(seconds: 3));
        await tester.pump();
        expect(find.text('Controller readiness: ready'), findsNothing);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        if (role == 'ambient') {
          expect(find.textContaining('Ambient: 19.5'), findsNothing);
        }
        if (role == 'member') {
          expect(
            find.text('Live protection reading: Unavailable'),
            findsOneWidget,
          );
        }
        // A genuine later wall timestamp, not fetch/config identity, recovers.
        stamp = DateTime.now();
        expect(stamp.isAfter(initial), isTrue);
        await tester.pump(const Duration(seconds: 3));
        await tester.pump();
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
      },
    );
  }

  for (final role in ['ambient', 'floor']) {
    for (final missing in ['declaration', 'diagnostic']) {
      testWidgets(
        'positive $role value requires declared joined evidence: missing $missing',
        (tester) async {
          final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
          final now = DateTime.now();
          dio.interceptors.add(
            InterceptorsWrapper(
              onRequest: (options, handler) {
                final runtime = options.path.endsWith('/runtime'),
                    comfort = options.path.endsWith('/comfort');
                handler.resolve(
                  Response(
                    requestOptions: options,
                    statusCode: 200,
                    data: {
                      'data': comfort
                          ? {
                              'controller': 'controller',
                              'revision': 1,
                              'graph_revision': 1,
                              'configuration': null,
                            }
                          : runtime
                          ? {
                              'configuration_revision': 1,
                              'readiness': 'ready',
                              'current_temperature': 19.5,
                              'floor_temperature': 22,
                              'branches': [],
                              'inputs': [
                                if (missing != 'diagnostic')
                                  {
                                    'binding': role,
                                    'role': role,
                                    'source_kind': 'physical',
                                    'status': 'fresh',
                                    'quality': 'good',
                                    'sampled_at': now.toIso8601String(),
                                    'expires_at': now
                                        .add(const Duration(minutes: 1))
                                        .toIso8601String(),
                                    'age_seconds': 0,
                                    'maximum_age_seconds': 60,
                                  },
                              ],
                            }
                          : {
                              'revision': 1,
                              'locked': false,
                              'policy': {},
                              'settings': [],
                              'actuators': [],
                              'sources': [
                                if (missing != 'declaration')
                                  {
                                    'id': role,
                                    'role': role,
                                    'source_identity': role,
                                  },
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
          await tester.pumpWidget(
            MaterialApp(
              home: VirtualThermostatDeviceDetail(
                device: ThermostatDeviceView(
                  id: 'controller',
                  type: 'virtual',
                  name: 'Room',
                  channels: const [],
                ),
              ),
            ),
          );
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 100));
          expect(find.textContaining('Ambient: 19.5'), findsNothing);
          expect(find.textContaining('Selected floor: 22'), findsNothing);
          expect(find.text('Controller readiness: ready'), findsNothing);
          await tester.pumpWidget(const SizedBox());
          await tester.pumpAndSettle();
        },
      );
    }
  }
  for (final scenario in [
    'opaque-suspended',
    'opaque-ready',
    'overflow-ready',
  ]) {
    testWidgets(
      'member identity classification $scenario never invents qualified readiness',
      (tester) async {
        final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
        final now = DateTime.now();
        dio.interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              final runtime = options.path.endsWith('/runtime'),
                  comfort = options.path.endsWith('/comfort');
              handler.resolve(
                Response(
                  requestOptions: options,
                  statusCode: 200,
                  data: {
                    'data': comfort
                        ? {
                            'controller': 'controller',
                            'revision': 1,
                            'graph_revision': 1,
                            'configuration': null,
                          }
                        : runtime
                        ? {
                            'configuration_revision': 1,
                            'readiness': scenario == 'opaque-suspended'
                                ? 'suspended'
                                : 'ready',
                            'inputs': [],
                            'branches': scenario.startsWith('opaque')
                                ? [
                                    {'role': 'heating', 'activity': 'off'},
                                  ]
                                : [
                                    for (var n = 0; n < 17; n++)
                                      {
                                        'claim': 'claim$n',
                                        'role': 'heating',
                                        'protection': {
                                          'status': 'fresh',
                                          'quality': 'good',
                                          'temperature': 20,
                                          'sampled_at': now.toIso8601String(),
                                          'expires_at': now
                                              .add(const Duration(minutes: 1))
                                              .toIso8601String(),
                                          'age_seconds': 0,
                                          'maximum_age_seconds': 60,
                                        },
                                      },
                                  ],
                          }
                        : {
                            'revision': 1,
                            'locked': false,
                            'policy': {},
                            'settings': [],
                            'sources': [],
                            'actuators': [],
                          },
                  },
                ),
              );
            },
          ),
        );
        locator.registerSingleton<Dio>(dio);
        addTearDown(() => locator.unregister<Dio>());
        await tester.pumpWidget(
          MaterialApp(
            home: VirtualThermostatDeviceDetail(
              device: ThermostatDeviceView(
                id: 'controller',
                type: 'virtual',
                name: 'Room',
                channels: const [],
              ),
            ),
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
        expect(find.text('Controller readiness: ready'), findsNothing);
        expect(
          find.text(
            'Controller readiness: ${scenario == 'opaque-suspended' ? 'suspended' : 'Unavailable'}',
          ),
          findsOneWidget,
        );
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
      },
    );
  }
}

// Exercise the same production mapper that DevicesService uses after repository
// updates. Only command transport is mocked; no private widget state/clock seam.
class _MappedDetailFixture {
  final elapsed = Stopwatch()..start();
  final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
  final service = MockDevicesService();
  final command = Completer<bool>();
  final held = <MapEntry<RequestOptions, RequestInterceptorHandler>>[];
  final writes = <Map<String, dynamic>>[];
  late DateTime sample = DateTime.now().subtract(
    const Duration(milliseconds: 1),
  );
  late final DateTime expiry = sample.add(const Duration(minutes: 2));
  bool holdDetail = false;
  int revision = 4, detailGets = 0, comfortGets = 0, commandCalls = 0;

  _MappedDetailFixture() {
    when(
      () => service.setMultiplePropertyValues(
        properties: any(named: 'properties'),
        context: any(named: 'context'),
        requireAtomicBatch: any(named: 'requireAtomicBatch'),
      ),
    ).thenAnswer((_) {
      commandCalls++;
      return command.future;
    });
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path.contains('/comfort')) {
            if (options.method == 'GET') comfortGets++;
            if (options.method == 'POST') {
              writes.add(Map<String, dynamic>.from(options.data as Map));
            }
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': comfort(options.path.split('/')[5])},
              ),
            );
            return;
          }
          detailGets++;
          if (holdDetail) {
            held.add(MapEntry(options, handler));
          } else {
            resolve(MapEntry(options, handler));
          }
        },
      ),
    );
  }

  Map<String, dynamic> comfort(String id) => {
    'controller': id,
    'revision': revision,
    'graph_revision': 9,
    'configuration': {
      'heating_range': {'minimum': 0, 'maximum': 30},
      'presets': [
        {
          'preset': 'eco',
          'setpoints': {'heating_setpoint': 17, 'cooling_setpoint': null},
        },
      ],
      'selected_preset': null,
      'user_off': false,
      'automation_enabled': false,
      'temporary_override': null,
    },
    'effective': {'source': 'manual', 'preset': null},
    'clock_policy': 'bounded_absolute_recovery_with_uncertainty_inhibit',
  };

  Map<String, dynamic> snapshot(bool runtime, {double target = 21}) => runtime
      ? {
          'configuration_revision': revision,
          'requested_mode': 'heat',
          'heating_setpoint': target,
          'readiness': 'ready',
          'current_temperature': 19.5,
          'branches': [],
          'inputs': [
            {
              'binding': 'ambient',
              'role': 'ambient',
              'source_property': 'temperature',
              'source_kind': 'physical',
              'status': 'fresh',
              'quality': 'good',
              'sampled_at': sample.toIso8601String(),
              'expires_at': expiry.toIso8601String(),
              'age_seconds': 0,
              'maximum_age_seconds': 2,
            },
          ],
        }
      : {
          'revision': revision,
          'locked': false,
          'requested_mode': 'heat',
          'policy': {'heatingSetpoint': target, 'coolingSetpoint': null},
          'settings': [
            {'setting': 'locked', 'property': 'locked'},
          ],
          'actuators': [],
          'sources': [
            {
              'id': 'ambient',
              'role': 'ambient',
              'source_identity': 'ambient-sensor',
              'source_property': 'temperature',
            },
          ],
        };

  ThermostatDeviceView mapped({
    String id = '11111111-1111-4111-8111-111111111111',
    String name = 'Room',
  }) =>
      buildDeviceView(
            VirtualDeviceModel(
              id: id,
              name: name,
              category: DevicesModuleDeviceCategory.thermostat,
              mode: VirtualDeviceMode.climateController,
            ),
            [
              ThermostatChannelView(
                id: 'thermostat',
                type: 'virtual',
                device: id,
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
          )
          as ThermostatDeviceView;

  void resolve(
    MapEntry<RequestOptions, RequestInterceptorHandler> request, {
    double target = 21,
    bool nullRuntime = false,
  }) {
    final runtime = request.key.path.endsWith('/runtime');
    request.value.resolve(
      Response(
        requestOptions: request.key,
        statusCode: 200,
        data: {
          'data': runtime && nullRuntime
              ? null
              : snapshot(runtime, target: target),
        },
      ),
    );
  }

  void completeHeld({
    double target = 21,
    bool nullRuntime = false,
    bool fail = false,
  }) {
    final batch = List.of(held);
    held.clear();
    for (final request in batch) {
      if (fail) {
        request.value.reject(
          DioException(
            requestOptions: request.key,
            message: 'controlled read failure',
            type: DioExceptionType.connectionError,
          ),
        );
      } else {
        resolve(request, target: target, nullRuntime: nullRuntime);
      }
    }
  }

  Future<void> flush(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  Future<void> mount(WidgetTester tester, ThermostatDeviceView view) async {
    await tester.pumpWidget(
      MaterialApp(home: VirtualThermostatDeviceDetail(device: view)),
    );
    await flush(tester);
  }

  Future<void> read(WidgetTester tester) async {
    final work = tester
        .widget<RefreshIndicator>(find.byType(RefreshIndicator))
        .onRefresh();
    await flush(tester);
    await work;
  }

  Future<void> tap(WidgetTester tester, String key) async {
    final finder = find.byKey(ValueKey(key));
    await tester.ensureVisible(finder);
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  Future<void> install(WidgetTester tester) async {
    locator.registerSingleton<Dio>(dio);
    locator.registerSingleton<DevicesService>(service);
    await tester.binding.setSurfaceSize(const Size(1200, 4000));
    addTearDown(() async {
      await tester.pumpWidget(const SizedBox());
      completeHeld();
      if (!command.isCompleted) command.complete(false);
      dio.close(force: true);
      await tester.pumpAndSettle();
      await locator.unregister<Dio>();
      await locator.unregister<DevicesService>();
      await tester.binding.setSurfaceSize(null);
      elapsed.stop();
    });
    await mount(tester, mapped());
    // Initial readiness only: never settle inside a deliberately held read gap.
    await tester.pumpAndSettle();
    expect(detailGets, 2);
    expect(comfortGets, 2);
    expect(
      tester
          .widget<TextButton>(find.byKey(const ValueKey('comfort-create')))
          .onPressed,
      isNotNull,
    );
    expect(
      tester
          .widget<TextButton>(find.byKey(const ValueKey('comfort-selection')))
          .onPressed,
      isNotNull,
    );
    expect(find.text('Heating target: 21.0 °C'), findsOneWidget);
    expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
    expect(find.text('Controller readiness: ready'), findsOneWidget);
  }
}

void sameIdMappedViewLifecycleTests() {
  testWidgets(
    'same-ID mapped update retains accepted settings and discards older held GET',
    (tester) async {
      final h = _MappedDetailFixture();
      await h.install(tester);
      final child = tester.state(find.byType(VirtualThermostatComfort));
      h.holdDetail = true;
      final oldRead = tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
      await h.flush(tester);
      final oldBatch = List.of(h.held);
      h.held.clear();
      final priorView = tester
          .widget<VirtualThermostatDeviceDetail>(
            find.byType(VirtualThermostatDeviceDetail),
          )
          .device;
      final replacement = h.mapped(name: 'Updated room');
      expect(replacement.id, priorView.id);
      expect(identical(replacement, priorView), isFalse);
      await h.mount(tester, replacement);
      expect(h.detailGets, 6);
      expect(find.text('Heating target: 21.0 °C'), findsOneWidget);
      expect(tester.state(find.byType(VirtualThermostatComfort)), same(child));
      expect(find.text('Ambient: 19.5 °C'), findsNothing);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      h.completeHeld();
      await h.flush(tester);
      for (final request in oldBatch) {
        h.resolve(request, target: 29);
      }
      await h.flush(tester);
      await oldRead;
      expect(find.text('Heating target: 21.0 °C'), findsOneWidget);
      expect(find.text('Heating target: 29.0 °C'), findsNothing);
      expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
    },
  );

  for (final failure in ['HTTP failure', 'null runtime']) {
    testWidgets(
      'same-ID $failure retains configuration without renewing original sample budget',
      (tester) async {
        final h = _MappedDetailFixture();
        final fakeStart = tester.binding.clock.now();
        await h.install(tester);
        h.holdDetail = true;
        await h.mount(tester, h.mapped(name: 'Updated room'));
        h.completeHeld(
          fail: failure == 'HTTP failure',
          nullRuntime: failure == 'null runtime',
        );
        await h.flush(tester);
        expect(find.text('Heating target: 21.0 °C'), findsOneWidget);
        expect(find.text('Ambient: 19.5 °C'), findsNothing);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        h.holdDetail = false;
        await h.read(tester);
        expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
        // Measured past-original-budget check, followed by fresh cached HTTP: not
        // a literal 2s widget boundary and not merely the five-second display TTL.
        final fakeElapsed = tester.binding.clock.now().difference(fakeStart);
        final bound = h.elapsed.elapsed > fakeElapsed
            ? h.elapsed.elapsed
            : fakeElapsed;
        await tester.pump(bound + const Duration(seconds: 3));
        await h.flush(tester);
        await h.read(tester);
        expect(find.text('Heating target: 21.0 °C'), findsOneWidget);
        expect(find.text('Ambient: 19.5 °C'), findsNothing);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        h.sample = DateTime.now();
        await h.read(tester);
        expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
      },
    );
  }

  for (final accepted in [true, false]) {
    testWidgets(
      'same-ID update during held command defers one refresh after accepted=$accepted',
      (tester) async {
        final h = _MappedDetailFixture();
        await h.install(tester);
        await tester.tap(find.text('Lock thermostat controls'));
        await h.flush(tester);
        expect(h.commandCalls, 1);
        h.holdDetail = true;
        await h.mount(tester, h.mapped(name: 'Update during command'));
        expect(h.detailGets, 2);
        expect(find.text('Heating target: 21.0 °C'), findsOneWidget);
        expect(
          tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged,
          isNull,
        );
        expect(find.text('Ambient: 19.5 °C'), findsNothing);
        h.holdDetail = false;
        h.command.complete(accepted);
        await h.flush(tester);
        await h.flush(tester);
        expect(h.detailGets, 4);
        expect(h.commandCalls, 1);
        expect(
          tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged,
          isNotNull,
        );
        await h.flush(tester);
        expect(h.detailGets, 4);
        expect(h.commandCalls, 1);
      },
    );
  }

  for (final route in ['dialog', 'menu']) {
    for (final changedRevision in [false, true]) {
      testWidgets(
        'same-ID mapped update retains $route and fences CAS changedRevision=$changedRevision',
        (tester) async {
          final h = _MappedDetailFixture();
          await h.install(tester);
          final child = tester.state(find.byType(VirtualThermostatComfort));
          await h.tap(
            tester,
            route == 'dialog' ? 'comfort-create' : 'comfort-selection',
          );
          if (route == 'dialog') {
            await tester.enterText(
              find.byKey(const ValueKey('override-heating')),
              '23.5',
            );
            await tester.enterText(
              find.byKey(const ValueKey('override-duration')),
              '10',
            );
          }
          h.holdDetail = true;
          await h.mount(tester, h.mapped(name: 'Updated while editing'));
          expect(
            tester.state(find.byType(VirtualThermostatComfort)),
            same(child),
          );
          expect(find.text('Heating target: 21.0 °C'), findsOneWidget);
          if (route == 'dialog') {
            expect(
              tester
                  .widget<TextField>(
                    find.byKey(const ValueKey('override-heating')),
                  )
                  .controller!
                  .text,
              '23.5',
            );
            expect(
              tester
                  .widget<TextField>(
                    find.byKey(const ValueKey('override-duration')),
                  )
                  .controller!
                  .text,
              '10',
            );
          } else {
            expect(
              find.widgetWithText(PopupMenuItem<String>, 'Eco'),
              findsOneWidget,
            );
          }
          if (changedRevision) {
            h.revision = 5;
            h.completeHeld();
            await h.flush(tester);
          }
          if (route == 'dialog') {
            await h.tap(tester, 'override-submit');
          } else {
            await tester.tap(find.widgetWithText(PopupMenuItem<String>, 'Eco'));
            await tester.pumpAndSettle();
          }
          expect(h.writes.length, changedRevision ? 0 : 1);
          if (!changedRevision) {
            expect(h.writes.single['expected_revision'], 4);
            expect(h.writes.single['expected_graph_revision'], 9);
            if (route == 'dialog') {
              expect(
                (h.writes.single['setpoints'] as Map)['heating_setpoint'],
                23.5,
              );
            } else {
              expect(h.writes.single['preset'], 'eco');
            }
          }
        },
      );
    }
  }

  testWidgets(
    'different-ID mapped replacement clears settings and retires old popup without side effects',
    (tester) async {
      final h = _MappedDetailFixture();
      await h.install(tester);
      await h.tap(tester, 'comfort-selection');
      h.holdDetail = true;
      await h.mount(
        tester,
        h.mapped(
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Replacement',
        ),
      );
      expect(find.text('Heating target: 21.0 °C'), findsNothing);
      expect(find.text('Ambient: 19.5 °C'), findsNothing);
      expect(find.text('Controller readiness: ready'), findsNothing);
      final readsBefore = h.detailGets;
      await tester.tap(find.widgetWithText(PopupMenuItem<String>, 'Eco'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(h.writes, isEmpty);
      expect(h.detailGets, readsBefore);
      expect(find.text('Heating target: 21.0 °C'), findsNothing);
      h.completeHeld();
      await h.flush(tester);
      expect(find.text('Heating target: 21.0 °C'), findsOneWidget);
    },
  );
}
