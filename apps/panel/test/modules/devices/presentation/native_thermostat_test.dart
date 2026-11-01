import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/native_thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _Socket extends SocketService {
  bool connected = true;
  @override
  bool get isConnected => connected;
  final listeners = <void Function(bool)>[];
  @override
  void addConnectionListener(void Function(bool) listener) =>
      listeners.add(listener);
  @override
  void removeConnectionListener(void Function(bool) listener) =>
      listeners.remove(listener);
  void connection(bool connected) {
    this.connected = connected;
    for (final listener in listeners.toList()) {
      listener(connected);
    }
  }
}

Map<String, dynamic> snapshot(
  String id, {
  bool compound = false,
  String mode = 'off',
  String provider = 'zigbee2mqtt',
}) => {
  'controller': id,
  'provider': provider,
  'control_strategy': 'native_unit',
  'revision': 7,
  'binding_state': 'bound',
  'requested': {'mode': mode, 'heatingSetpoint': 20.0, 'coolingSetpoint': 25.0},
  'observed': {
    'available': true,
    'temperature': 19.0,
    'mode': 'off',
    'heatingSetpoint': 18.0,
    'coolingSetpoint': 26.0,
    'activity': null,
    'observedAt': '2026-10-31T10:00:00Z',
    'reasons': [],
  },
  'capabilities': {
    'modes': ['off', 'heat', 'cool', if (compound) 'auto'],
    'heating': {'minimum': 10.0, 'maximum': 30.0, 'step': 0.5},
    'cooling': {'minimum': 10.0, 'maximum': 30.0, 'step': 0.5},
    'supportsCompound': compound,
  },
  'drift': ['heating_setpoint'],
  'latest_request': {
    'id': 'previous',
    'state': 'completed',
    'operations': [
      {'operation': 'mode', 'outcome': 'accepted', 'confirmed': false},
    ],
  },
};

Widget detail(String id) => MaterialApp(
  home: NativeThermostatDeviceDetail(
    device: ThermostatDeviceView(
      id: id,
      type: 'virtual',
      name: id,
      channels: const [],
    ),
  ),
);

Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 20));
}

void main() {
  late Dio dio;
  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
    locator.registerSingleton<Dio>(dio);
  });
  tearDown(() async {
    dio.close(force: true);
    if (locator.isRegistered<SocketService>()) {
      await locator.unregister<SocketService>();
    }
    await locator.unregister<Dio>();
  });

  Future<void> size(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1000, 2000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets(
    'explicit Z2M commands carry UUID and CAS; acceptance never fabricates activity',
    (tester) async {
      await size(tester);
      final writes = <RequestOptions>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.method == 'POST') writes.add(options);
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': snapshot(
                    'one',
                    mode: writes.isEmpty ? 'off' : 'heat',
                  ),
                },
              ),
            );
          },
        ),
      );
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      expect(find.text('Observed activity: N/A'), findsOneWidget);
      expect(find.text('mode: Accepted / unconfirmed'), findsOneWidget);
      expect(writes, isEmpty);
      await tester.tap(find.byKey(const ValueKey('native-mode-heat')));
      await settle(tester);
      expect(writes, hasLength(1));
      expect(
        writes.single.path,
        '/plugins/devices-virtual/producers/thermostats/native/one/requests',
      );
      final body = Map<String, dynamic>.from(writes.single.data as Map);
      expect(body.keys.toSet(), {'request_id', 'expected_revision', 'mode'});
      expect(body['expected_revision'], 7);
      expect(body['mode'], 'heat');
      expect(
        body['request_id'],
        matches(
          RegExp(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
          ),
        ),
      );
      expect(find.text('Requested mode: heat'), findsOneWidget);
      expect(find.text('Observed mode: off'), findsOneWidget);
      expect(find.text('Observed activity: N/A'), findsOneWidget);
      expect(find.byKey(const ValueKey('native-auto')), findsNothing);
      expect(
        find.byKey(const ValueKey('native-heating-mode-apply')),
        findsNothing,
      );
      await tester.enterText(
        find.byKey(const ValueKey('native-heating-draft')),
        '20.25',
      );
      await tester.pump();
      expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const ValueKey('native-heating-apply')),
            )
            .onPressed,
        isNull,
      );
      await tester.enterText(
        find.byKey(const ValueKey('native-heating-draft')),
        '21.5',
      );
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('native-heating-apply')));
      await settle(tester);
      expect(writes, hasLength(2));
      final target = writes.last.data as Map;
      expect(target.keys.toSet(), {
        'request_id',
        'expected_revision',
        'heating_setpoint',
      });
      expect(target['heating_setpoint'], 21.5);
      expect(target['request_id'], isNot(body['request_id']));
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'preserves an advertised Fahrenheit quantum when incrementing its Celsius target',
    (tester) async {
      await size(tester);
      final writes = <Map>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.method == 'POST') writes.add(options.data as Map);
            final data = snapshot('one', compound: true);
            final prior = data['capabilities'] as Map;
            data['capabilities'] = <String, dynamic>{
              ...prior,
              'modes': ['off', 'heat'],
              'cooling': null,
              'heating': <String, dynamic>{
                ...prior['heating'] as Map,
                'step': 1 / 18,
              },
            };
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': data},
              ),
            );
          },
        ),
      );
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      await tester.tap(find.byKey(const ValueKey('native-heating-1')));
      await settle(tester);
      expect(writes, hasLength(1));
      // 20°C is 68°F; one physical step must remain 68.1°F without decimal truncation.
      expect(
        (writes.single['heating_setpoint'] as num) * 9 / 5 + 32,
        closeTo(68.1, 1e-9),
      );
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'HA range command requires two explicit ordered drafts and sends one combined patch',
    (tester) async {
      await size(tester);
      final writes = <Map>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.method == 'POST') writes.add(options.data as Map);
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': snapshot('one', compound: true)},
              ),
            );
          },
        ),
      );
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      final auto = find.byKey(const ValueKey('native-auto'));
      expect(tester.widget<OutlinedButton>(auto).onPressed, isNull);
      await tester.enterText(
        find.byKey(const ValueKey('native-heating-draft')),
        '24',
      );
      await tester.enterText(
        find.byKey(const ValueKey('native-cooling-draft')),
        '22',
      );
      await tester.pump();
      expect(tester.widget<OutlinedButton>(auto).onPressed, isNull);
      await tester.enterText(
        find.byKey(const ValueKey('native-cooling-draft')),
        '26',
      );
      await tester.pump();
      await tester.tap(auto);
      await settle(tester);
      expect(writes, hasLength(1));
      expect(writes.single, containsPair('mode', 'auto'));
      expect(writes.single, containsPair('heating_setpoint', 24.0));
      expect(writes.single, containsPair('cooling_setpoint', 26.0));
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'auto-only HA target controls send a complete range and wait for both drafts',
    (tester) async {
      await size(tester);
      final writes = <Map>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            if (options.method == 'POST') writes.add(options.data as Map);
            final data = snapshot(
              'one',
              compound: true,
              provider: 'home-assistant',
            );
            (data['capabilities'] as Map)['modes'] = ['off', 'auto'];
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': data},
              ),
            );
          },
        ),
      );
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      final apply = find.byKey(const ValueKey('native-heating-apply'));
      final increase = find.byKey(const ValueKey('native-heating-1'));
      expect(tester.widget<OutlinedButton>(apply).onPressed, isNull);
      expect(tester.widget<IconButton>(increase).onPressed, isNull);
      await tester.enterText(
        find.byKey(const ValueKey('native-heating-draft')),
        '21.5',
      );
      await tester.pump();
      expect(tester.widget<OutlinedButton>(apply).onPressed, isNull);
      await tester.enterText(
        find.byKey(const ValueKey('native-cooling-draft')),
        '25',
      );
      await tester.pump();
      await tester.tap(apply);
      await settle(tester);
      expect(writes, hasLength(1));
      expect(writes.single, containsPair('mode', 'auto'));
      expect(writes.single, containsPair('heating_setpoint', 21.5));
      expect(writes.single, containsPair('cooling_setpoint', 25.0));
      await tester.tap(increase);
      await settle(tester);
      expect(writes, hasLength(2));
      expect(writes.last, containsPair('mode', 'auto'));
      expect(writes.last, containsPair('heating_setpoint', 20.5));
      expect(writes.last, containsPair('cooling_setpoint', 25.0));
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'provider-unavailable observations stay unavailable despite a fresh successful HTTP response',
    (tester) async {
      await size(tester);
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            final data = snapshot('one');
            (data['observed'] as Map).addAll(<String, Object?>{
              'available': false,
              'temperature': 19.0,
              'activity': 'heating',
              'reasons': ['provider_offline'],
            });
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': data},
              ),
            );
          },
        ),
      );
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      expect(find.text('Observed temperature: N/A'), findsOneWidget);
      expect(find.text('Observed activity: N/A'), findsOneWidget);
      expect(find.textContaining('Observed temperature: 19'), findsNothing);
      expect(find.text('Binding: bound'), findsOneWidget);
      expect(find.text('provider_offline'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'network failure never probes guarded; only initial native 404 falls back',
    (tester) async {
      await size(tester);
      final paths = <String>[];
      var missing = false;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            paths.add(options.path);
            handler.reject(
              DioException(
                requestOptions: options,
                type: missing
                    ? DioExceptionType.badResponse
                    : DioExceptionType.connectionError,
                response: missing
                    ? Response(requestOptions: options, statusCode: 404)
                    : null,
              ),
            );
          },
        ),
      );
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      expect(find.byType(VirtualThermostatDeviceDetail), findsNothing);
      expect(paths.every((path) => path.contains('/native/')), isTrue);
      missing = true;
      await tester.tap(find.byKey(const ValueKey('native-refresh')));
      await settle(tester);
      expect(find.byType(VirtualThermostatDeviceDetail), findsOneWidget);
      await settle(
        tester,
      ); // Join the newly mounted guarded client's original HTTP dispatch.
      expect(paths.any((path) => !path.contains('/native/')), isTrue);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'late old-device reads and writes cannot replace a new controller',
    (tester) async {
      await size(tester);
      final held = <void Function()>[];
      var hold = false;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            final id = options.path.split('/')[6];
            void respond() => handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': snapshot(id, mode: id == 'one' ? 'heat' : 'cool'),
                },
              ),
            );
            if (hold && id == 'one') {
              held.add(respond);
            } else {
              respond();
            }
          },
        ),
      );
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      hold = true;
      await tester.tap(find.byKey(const ValueKey('native-mode-heat')));
      await settle(tester);
      expect(held, hasLength(1));
      await tester.pumpWidget(detail('two'));
      await settle(tester);
      held.single();
      await settle(tester);
      expect(find.text('Requested mode: cool'), findsOneWidget);
      expect(find.text('Requested mode: heat'), findsNothing);
      // A second pending read is fenced by a subsequent ID replacement too.
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      expect(held, hasLength(2));
      await tester.pumpWidget(detail('two'));
      await settle(tester);
      held.last();
      await settle(tester);
      expect(find.text('Requested mode: cool'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'lost write response is unknown, never replayed, and requires authoritative refresh',
    (tester) async {
      await size(tester);
      var writes = 0;
      var reads = 0;
      final held = <void Function()>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            void respond() => handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': snapshot('one')},
              ),
            );
            if (options.method == 'POST') {
              writes++;
              held.add(respond);
            } else if (++reads == 1) {
              respond();
            } else {
              held.add(respond);
            }
          },
        ),
      );
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      await tester.tap(find.byKey(const ValueKey('native-mode-heat')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 10));
      await settle(tester);
      expect(writes, 1);
      expect(find.textContaining('Unknown outcome'), findsOneWidget);
      expect(find.text('Observed activity: N/A'), findsOneWidget);
      // Completing the original request cannot restore a snapshot after its deadline.
      held.first();
      await settle(tester);
      expect(find.textContaining('Unknown outcome'), findsOneWidget);
      held.last();
      await settle(tester);
      expect(find.textContaining('Unknown outcome'), findsNothing);
      expect(writes, 1);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'poll deadline withholds stale observations, reconnect fences read, disposal unregisters',
    (tester) async {
      await size(tester);
      final socket = _Socket();
      locator.registerSingleton<SocketService>(socket);
      var reads = 0;
      final held = <void Function()>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            void respond() => handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': snapshot('one')},
              ),
            );
            if (++reads == 1) {
              respond();
            } else {
              held.add(respond);
            }
          },
        ),
      );
      await tester.pumpWidget(detail('one'));
      await settle(tester);
      expect(socket.listeners, hasLength(1));
      expect(find.text('Observed temperature: 19.0'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5));
      await settle(tester);
      socket.connection(false);
      await tester.pump();
      expect(find.text('Observed temperature: N/A'), findsOneWidget);
      held.first();
      await settle(tester);
      expect(find.text('Observed temperature: N/A'), findsOneWidget);
      socket.connection(true);
      await settle(tester);
      held.last();
      await settle(tester);
      expect(find.text('Observed temperature: 19.0'), findsOneWidget);
      await tester.pump(const Duration(seconds: 16));
      await settle(tester);
      expect(find.text('Observed temperature: N/A'), findsOneWidget);
      final mode = find.byKey(const ValueKey('native-mode-heat'));
      if (mode.evaluate().isNotEmpty) {
        expect(tester.widget<OutlinedButton>(mode).onPressed, isNull);
      }
      await tester.pumpWidget(const SizedBox());
      expect(socket.listeners, isEmpty);
    },
  );
}
