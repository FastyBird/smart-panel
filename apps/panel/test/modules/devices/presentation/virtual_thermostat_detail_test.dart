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
  cachedSourceDeadlineTests();
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
                    'locked': false,
                    'policy': {
                      'heatingSetpoint': null,
                      'coolingSetpoint': null,
                    },
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
