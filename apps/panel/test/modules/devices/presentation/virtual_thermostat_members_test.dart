import 'package:dio/dio.dart';
import 'package:mocktail/mocktail.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_member.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/thermostat.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class MemberDevices extends Mock implements DevicesService {}

class MemberSocket extends SocketService {
  final handlers = <void Function(String, Map<String, dynamic>)>[];
  @override
  void registerEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) callback,
  ) => handlers.add(callback);
  @override
  void unregisterEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) callback,
  ) => handlers.remove(callback);
  @override
  void addConnectionListener(void Function(bool) listener) {}
  @override
  void removeConnectionListener(void Function(bool) listener) {}
  void hint(int sequence) {
    for (final handler in handlers.toList()) {
      handler('DevicesVirtualPlugin.Thermostat.RuntimeChanged', {
        'controller': 'controller',
        'epoch': 'epoch',
        'sequence': sequence,
      });
    }
  }
}

Map<String, dynamic> claim(String id, String role, String state) => {
  'id': id,
  'role': role,
  'state': state,
  'physical_identity': 'canonical-$id',
  'source_property': state == 'missing' ? null : 'relay-$id',
  'source_identity': 'retained-$id',
  'qualification_generation': 'generation-$id',
  'provider_profile': 'guarded-shelly',
  if (role == 'heating') 'protection': {'source_identity': 'floor-$id'},
};
Map<String, dynamic> protection(
  DateTime now,
  double temperature, {
  bool stale = false,
}) => {
  'status': stale ? 'stale' : 'fresh',
  'quality': 'good',
  'temperature': temperature,
  'sampled_at': now.toIso8601String(),
  'expires_at': now.add(const Duration(seconds: 2)).toIso8601String(),
  'age_seconds': 0,
  'maximum_age_seconds': 2,
  'latched': stale,
  'ready': !stale,
  'effective_cutoff': 28,
  'source_identity': 'protective-source',
  'reasons': stale ? ['floor_sample_stale', 'barrier_latched'] : <String>[],
};

void main() {
  test(
    'claim join preserves missing members, false and zero, and fences history',
    () {
      final now = DateTime.utc(2026, 10, 15);
      final config = {
        'actuators': [
          claim('one', 'heating', 'reserved'),
          claim('two', 'heating', 'missing'),
        ],
      };
      final runtime = {
        'branches': [
          {
            'claim': 'one',
            'activity': 'off',
            'pending_on': false,
            'protection': protection(now, 0),
          },
        ],
      };
      final members = VirtualThermostatMember.read(config, runtime);
      expect(members.length, 2);
      expect(members[0].liveTemperature(Duration.zero, now, true), 0);
      expect(members[0].diagnostic?['pending_on'], false);
      expect(members[1].identity, 'canonical-two');
      expect(members[1].observed(true), 'unknown');
      expect(
        members[0].liveTemperature(const Duration(seconds: 3), now, true),
        isNull,
      );
      expect(
        members[0].liveTemperature(
          Duration.zero,
          now.add(const Duration(seconds: 2)),
          true,
        ),
        isNull,
      );
      expect(members[0].liveTemperature(Duration.zero, now, false), isNull);
      final historical = VirtualThermostatMember(
        members[0].configuration,
        members[0].diagnostic,
        historical: true,
      );
      expect(historical.liveTemperature(Duration.zero, now, true), isNull);
      expect(historical.observed(true), 'unavailable');
    },
  );

  test(
    'expired sample cannot revive through a cached refetch or an older revision',
    () {
      final now = DateTime.utc(2026, 10, 15);
      final fence = VirtualThermostatReadingFence();
      VirtualThermostatMember sample(DateTime time) => VirtualThermostatMember(
        claim('one', 'heating', 'reserved'),
        {'protection': protection(time, 0)},
      );
      expect(fence.expiredClaims([sample(now)], Duration.zero, now), isEmpty);
      expect(
        fence.expiredClaims([sample(now)], const Duration(seconds: 3), now),
        contains('one'),
      );
      expect(
        fence.expiredClaims([sample(now)], Duration.zero, now),
        contains('one'),
      );
      final newer = now.add(const Duration(seconds: 4));
      expect(
        fence.expiredClaims([sample(newer)], Duration.zero, newer),
        isEmpty,
      );
      expect(
        fence.expiredClaims([sample(now)], Duration.zero, now),
        contains('one'),
      );
      final noTimestamp = VirtualThermostatMember(
        claim('one', 'heating', 'reserved'),
        {
          'protection': {...protection(now, 0), 'sampled_at': null},
        },
      );
      expect(noTimestamp.liveTemperature(Duration.zero, now, true), isNull);
      expect(
        fence.expiredClaims([noTimestamp], Duration.zero, now),
        contains('one'),
      );
    },
  );

  test('physical detail still uses its native thermostat implementation', () {
    final detail = deviceWidgetMappers[DevicesModuleDeviceCategory.thermostat]!(
      ThermostatDeviceView(
        id: 'physical',
        type: 'shelly',
        name: 'Physical',
        channels: const [],
      ),
    );
    expect(detail, isA<ThermostatDeviceDetail>());
    expect(detail, isNot(isA<VirtualThermostatDeviceDetail>()));
  });

  testWidgets(
    'ordinary mode and setpoint commands target virtual settings only; acceptance and refusal never establish ON',
    (tester) async {
      final devices = MemberDevices();
      final commands = <List<PropertyCommandItem>>[];
      var accept = true;
      when(
        () => devices.setMultiplePropertyValues(
          properties: any(named: 'properties'),
          context: any(named: 'context'),
          requireAtomicBatch: any(named: 'requireAtomicBatch'),
        ),
      ).thenAnswer((invocation) async {
        commands.add(
          invocation.namedArguments[#properties] as List<PropertyCommandItem>,
        );
        return accept;
      });
      locator.registerSingleton<DevicesService>(devices);
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
      locator.registerSingleton<Dio>(dio);
      addTearDown(() {
        locator.unregister<Dio>();
        locator.unregister<DevicesService>();
      });
      final paths = <String>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            paths.add('${options.method} ${options.path}');
            final data = options.path.endsWith('/comfort')
                ? {
                    'controller': 'controller',
                    'revision': 1,
                    'graph_revision': 1,
                    'configuration': null,
                    'effective': {'source': 'manual'},
                  }
                : options.path.endsWith('/runtime')
                ? {
                    'requested_mode': 'heat',
                    'heating_setpoint': 21,
                    'branches': [
                      {
                        'claim': 'one',
                        'role': 'heating',
                        'activity': 'off',
                        'pending_on': true,
                      },
                    ],
                  }
                : {
                    'requested_mode': 'heat',
                    'revision': 1,
                    'locked': false,
                    'policy': {'heatingSetpoint': 21},
                    'settings': [
                      {
                        'setting': 'heating_enabled',
                        'property': 'virtual-enable',
                      },
                      {
                        'setting': 'heating_setpoint',
                        'property': 'virtual-target',
                      },
                    ],
                    'actuators': [claim('one', 'heating', 'reserved')],
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
      final device = ThermostatDeviceView(
        id: 'controller',
        type: 'virtual',
        name: 'Room',
        channels: [
          ThermostatChannelView(
            id: 'settings',
            type: 'virtual',
            device: 'controller',
            properties: [
              OnChannelPropertyView(
                id: 'virtual-enable',
                type: 'virtual',
                channel: 'settings',
                permission: const [DevicesModulePermissionType.rw],
              ),
              TemperatureChannelPropertyView(
                id: 'virtual-target',
                type: 'virtual',
                channel: 'settings',
                permission: const [DevicesModulePermissionType.rw],
              ),
            ],
          ),
        ],
      );
      await tester.binding.setSurfaceSize(const Size(1200, 4000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(
        MaterialApp(home: VirtualThermostatDeviceDetail(device: device)),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.text('OFF'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(commands.single.single.deviceId, 'controller');
      expect(commands.single.single.propertyId, 'virtual-enable');
      expect(commands.single.single.value, false);
      expect(find.text('Reported observation: off'), findsOneWidget);
      expect(find.text('Unresolved ON: true'), findsOneWidget);
      await tester.tap(find.byIcon(Icons.add).first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(commands.last.single.propertyId, 'virtual-target');
      expect(commands.last.single.value, 21.5);
      accept = false;
      await tester.tap(find.text('HEAT'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      expect(
        find.textContaining('Thermostat command was rejected'),
        findsOneWidget,
      );
      expect(find.text('Reported observation: off'), findsOneWidget);
      expect(
        commands
            .expand((batch) => batch)
            .every(
              (command) =>
                  command.deviceId == 'controller' &&
                  command.propertyId.startsWith('virtual-'),
            ),
        true,
      );
      expect(paths.every((path) => path.startsWith('GET ')), true);
      verify(
        () => devices.setMultiplePropertyValues(
          properties: any(named: 'properties'),
          context: any(named: 'context'),
          requireAtomicBatch: any(named: 'requireAtomicBatch'),
        ),
      ).called(3);
      verifyNoMoreInteractions(devices);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    },
  );

  testWidgets(
    'detail retains all mandatory members and history, expires live values and fences socket revisions',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1200, 10000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final now = DateTime.now();
      final socket = MemberSocket();
      locator.registerSingleton<SocketService>(socket);
      final paths = <String>[];
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
      locator.registerSingleton<Dio>(dio);
      addTearDown(() {
        locator.unregister<Dio>();
        locator.unregister<SocketService>();
      });
      var revision = 1;
      var hold = false;
      final held = <void Function()>[];
      final config = <String, dynamic>{
        'revision': 1,
        'requested_mode': 'heat',
        'locked': false,
        'settings': [],
        'policy': {
          'heatingSetpoint': 21.0,
          'coolingSetpoint': 25.0,
          'floor': {'limit': 30, 'recoveryHysteresis': 2},
        },
        'display_floor_claim': 'h1',
        'actuators': [
          claim('h1', 'heating', 'reserved'),
          claim('h2', 'heating', 'missing'),
          claim('c1', 'cooling', 'releasing'),
        ],
        'released_actuators': [
          {
            ...claim('old', 'heating', 'released'),
            'released_at': '2026-10-14T00:00:00Z',
            'release_evidence': {'drained': false, 'pending': 0},
          },
        ],
      };
      Map<String, dynamic> runtime(int rev) => {
        'epoch': 'epoch',
        'sequence': rev,
        'configuration_revision': rev,
        'requested_mode': 'heat',
        'readiness': 'suspended',
        'reasons': ['member_branch_blocked'],
        'floor_temperature': 99,
        'branches': [
          {
            'claim': 'h1',
            'role': 'heating',
            'activity': rev == 1 ? 'off' : 'on',
            'pending_on': false,
            'release_pending': false,
            'release_attempts': 0,
            'release_proven': true,
            'protection': protection(now, 0),
          },
          {
            'claim': 'h2',
            'role': 'heating',
            'activity': 'unknown',
            'pending_on': true,
            'release_pending': true,
            'fault': 'actuator_missing',
            'protection': protection(now, 35, stale: true),
          },
          {
            'claim': 'c1',
            'role': 'cooling',
            'activity': 'unknown',
            'pending_on': true,
            'release_pending': true,
            'fault': 'hardware_qualification_missing',
          },
        ],
      };
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            paths.add('${options.method} ${options.path}');
            final rev = revision;
            final data = options.path.endsWith('/comfort')
                ? {
                    'controller': 'controller',
                    'revision': rev,
                    'graph_revision': rev,
                    'configuration': null,
                    'effective': {'source': 'manual'},
                  }
                : options.path.endsWith('/runtime')
                ? runtime(rev)
                : {...config, 'revision': rev};
            void respond() => handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {'data': data},
              ),
            );
            if (hold && !options.path.endsWith('/comfort')) {
              held.add(respond);
            } else {
              respond();
            }
          },
        ),
      );
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
      Finder card(String id) => find.byKey(ValueKey('thermostat-member-$id'));
      Finder textIn(String id, String text) =>
          find.descendant(of: card(id), matching: find.text(text));
      for (final id in ['h1', 'h2', 'c1', 'history-old']) {
        expect(card(id), findsOneWidget);
      }
      expect(textIn('h1', 'Live protection reading: 0.0 °C'), findsOneWidget);
      expect(
        textIn('h2', 'Live protection reading: Unavailable'),
        findsOneWidget,
      );
      expect(textIn('h2', 'Historical reading only: 35.0 °C'), findsOneWidget);
      expect(textIn('h2', 'Unresolved ON: true'), findsOneWidget);
      expect(textIn('h2', 'Server blocker: actuator_missing'), findsOneWidget);
      expect(
        textIn('c1', 'Server blocker: hardware_qualification_missing'),
        findsOneWidget,
      );
      expect(textIn('history-old', 'drained: false'), findsOneWidget);
      expect(textIn('history-old', 'pending: 0'), findsOneWidget);
      expect(
        textIn('history-old', 'Retained recovery generation: generation-old'),
        findsOneWidget,
      );
      expect(
        find.text(
          'Selected member floor (not an average): canonical-h1: 0.0 °C',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('99.0 °C'), findsNothing);
      expect(find.byIcon(Icons.delete), findsNothing);
      // A hint invalidates the old observed state before its HTTP replacement.
      hold = true;
      socket.hint(2);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump();
      expect(textIn('h1', 'Reported observation: unavailable'), findsOneWidget);
      revision = 3;
      socket.hint(3);
      for (final respond in held.toList()) {
        respond();
      }
      held.clear();
      hold = false;
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump();
      expect(textIn('h1', 'Reported observation: on'), findsOneWidget);
      // No accepted setting or healthy sibling changes the missing-member card.
      expect(textIn('h2', 'Unresolved ON: true'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
      expect(
        textIn('h1', 'Live protection reading: Unavailable'),
        findsOneWidget,
      );
      expect(textIn('h1', 'Historical reading only: 0.0 °C'), findsOneWidget);
      expect(textIn('h2', 'Server blocker: barrier_latched'), findsOneWidget);
      // A repeated cached HTTP record cannot renew an expired live reading.
      await tester.pump(const Duration(seconds: 2));
      await tester.pump();
      expect(
        textIn('h1', 'Live protection reading: Unavailable'),
        findsOneWidget,
      );
      // A failed/pending poll cannot keep the old diagnostic live indefinitely.
      hold = true;
      await tester.pump(const Duration(seconds: 6));
      expect(textIn('h1', 'Reported observation: unavailable'), findsOneWidget);
      expect(
        paths.every(
          (path) =>
              path.startsWith('GET ') &&
              !path.contains('installations') &&
              !path.contains('recovery'),
        ),
        true,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      for (final respond in held) {
        respond();
      }
      await tester.pump();
      expect(tester.takeException(), isNull);
    },
  );
}
