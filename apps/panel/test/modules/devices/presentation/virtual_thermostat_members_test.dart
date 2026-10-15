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
      // Loading has no authoritative membership and must preserve expiry.
      fence.expiredClaims([], Duration.zero, now);
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
      // Explicit authoritative removal drops the watermark and bounds memory.
      fence.retainClaims([]);
      expect(fence.expiredClaims([sample(now)], Duration.zero, now), isEmpty);
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
      expect(textIn('h1', 'Server protection readiness: true'), findsOneWidget);
      expect(textIn('h1', 'Protection latched: false'), findsOneWidget);
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
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      expect(find.text('Inhibited: member_branch_blocked'), findsNothing);
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
      expect(
        textIn('h1', 'Server protection readiness: Unavailable'),
        findsOneWidget,
      );
      expect(textIn('h1', 'Protection latched: Unavailable'), findsOneWidget);
      expect(textIn('h1', 'Server protection readiness: true'), findsNothing);
      expect(textIn('h1', 'Protection latched: false'), findsNothing);
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
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      expect(find.text('Inhibited: member_branch_blocked'), findsNothing);
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
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'ready controller becomes unavailable on a hint and on stalled poll expiry',
    (tester) async {
      final fixture = MemberDetailFixture();
      final now = DateTime.now();
      fixture.sample = protection(now, 0);
      await fixture.mount(tester);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
      expect(find.text('Controller readiness: ready'), findsNothing);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      fixture.sample = {
        ...protection(now.add(const Duration(seconds: 1)), 0),
        'maximum_age_seconds': 60,
        'expires_at': now.add(const Duration(minutes: 2)).toIso8601String(),
      };
      fixture.hold = true;
      fixture.socket.hint(++fixture.revision);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump();
      expect(find.text('Controller readiness: ready'), findsNothing);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      await fixture.flush(tester);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      // No new hint: the periodic poll stalls and the HTTP snapshot itself expires.
      fixture.hold = true;
      await tester.pump(const Duration(seconds: 6));
      expect(find.text('Controller readiness: ready'), findsNothing);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );

  testWidgets(
    'same-id loading preserves newer and expired sample fences until qualified recovery',
    (tester) async {
      final fixture = MemberDetailFixture();
      final now = DateTime.now();
      Map<String, dynamic> sample(
        DateTime time,
        double temperature, {
        int maximumAge = 60,
      }) => {
        ...protection(time, temperature),
        'maximum_age_seconds': maximumAge,
        'expires_at': now.add(const Duration(minutes: 2)).toIso8601String(),
      };
      fixture.sample = sample(now, 10);
      await fixture.mount(tester);
      expect(find.text('Live protection reading: 10.0 °C'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      // Both readings are unexpired; replacing the model must retain the newer watermark.
      fixture.sample = sample(now.subtract(const Duration(seconds: 1)), 9);
      fixture.revision++;
      fixture.hold = true;
      await fixture.mount(tester);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      await fixture.flush(tester);
      expect(find.text('Live protection reading: 9.0 °C'), findsNothing);
      expect(find.text('Live protection reading: Unavailable'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsNothing);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      expect(find.text('Server protection readiness: true'), findsNothing);

      fixture.sample = sample(
        now.add(const Duration(seconds: 1)),
        11,
        maximumAge: 2,
      );
      await fixture.refetch(tester);
      expect(find.text('Live protection reading: 11.0 °C'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      expect(find.text('Protection latched: false'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
      expect(find.text('Live protection reading: Unavailable'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsNothing);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      expect(
        find.text('Server protection readiness: Unavailable'),
        findsOneWidget,
      );
      // Simulate a cached age/expiry rollback across another same-id loading phase.
      fixture.sample = sample(now.add(const Duration(seconds: 1)), 11);
      fixture.revision++;
      fixture.hold = true;
      await fixture.mount(tester);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      await fixture.flush(tester);
      expect(find.text('Live protection reading: 11.0 °C'), findsNothing);
      expect(find.text('Protection latched: false'), findsNothing);
      expect(find.text('Live protection reading: Unavailable'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsNothing);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      fixture.sample = sample(now, 10);
      await fixture.refetch(tester);
      expect(find.text('Live protection reading: 10.0 °C'), findsNothing);
      // Only genuinely newer qualified evidence recovers the live reading and flags.
      fixture.sample = sample(now.add(const Duration(seconds: 2)), 12);
      await fixture.refetch(tester);
      expect(find.text('Live protection reading: 12.0 °C'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      expect(find.text('Server protection readiness: true'), findsOneWidget);
      expect(find.text('Protection latched: false'), findsOneWidget);
      fixture.hasMember = false;
      await fixture.refetch(tester);
      expect(find.byKey(const ValueKey('thermostat-member-one')), findsNothing);
      await fixture.dispose(tester);
    },
  );
  for (final role in ['ambient', 'floor', 'contact']) {
    testWidgets(
      'declared $role evidence must be present and current for a ready heading',
      (tester) async {
        final fixture = MemberDetailFixture()..hasMember = false;
        final now = DateTime.now();
        fixture.sources = [
          {'id': 'required-$role', 'role': role},
        ];
        Map<String, dynamic> input(DateTime time) => {
          ...protection(time, 0),
          'binding': 'required-$role',
          'role': role,
          'expires_at': now.add(const Duration(minutes: 2)).toIso8601String(),
        };
        fixture.inputs = [input(now)];
        await fixture.mount(tester);
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        await tester.pump(const Duration(seconds: 3));
        expect(find.text('Controller readiness: ready'), findsNothing);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        fixture.inputs = [input(now.add(const Duration(seconds: 1)))];
        await fixture.refetch(tester);
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        fixture.inputs = [];
        await fixture.refetch(tester);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        fixture.inputs = [
          {
            ...input(now.add(const Duration(seconds: 2))),
            'quality': 'degraded',
          },
        ];
        await fixture.refetch(tester);
        expect(find.text('Controller readiness: ready'), findsNothing);
        await fixture.dispose(tester);
      },
    );
  }

  testWidgets(
    'unselected runtime-only retained protection with missing input withholds ready',
    (tester) async {
      final fixture = MemberDetailFixture();
      final now = DateTime.now();
      fixture.sample = {
        ...protection(now, 0),
        'maximum_age_seconds': 60,
        'expires_at': now.add(const Duration(minutes: 2)).toIso8601String(),
      };
      fixture.displayFloorClaim = 'one';
      fixture.extraBranches = [
        {
          'claim': 'retained',
          'role': 'heating',
          'claim_state': 'missing',
          'physical_identity': 'retained-relay',
          'protection': {
            'source_identity': 'retained-floor',
            'status': 'missing',
            'quality': 'unavailable',
          },
        },
      ];
      await fixture.mount(tester);
      expect(find.text('Live protection reading: 0.0 °C'), findsOneWidget);
      expect(
        find.text(
          'Selected member floor (not an average): canonical-one: 0.0 °C',
        ),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('thermostat-member-retained')),
        findsOneWidget,
      );
      expect(find.text('Controller readiness: ready'), findsNothing);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      fixture.extraBranches = [];
      await fixture.refetch(tester);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );

  testWidgets(
    'runtime-only retained samples keep watermarks across matched refetches and prune only after removal',
    (tester) async {
      final fixture = MemberDetailFixture()..configurationRevision = 1;
      final now = DateTime.now();
      Map<String, dynamic> sample(
        DateTime time,
        double temperature, {
        int maximumAge = 60,
      }) => {
        ...protection(time, temperature),
        'maximum_age_seconds': maximumAge,
        'expires_at': now.add(const Duration(minutes: 2)).toIso8601String(),
      };
      fixture.sample = sample(now, 0);
      fixture.displayFloorClaim = 'one';
      void retained(
        DateTime time,
        double temperature, {
        int maximumAge = 60,
        String state = 'reserved',
      }) {
        fixture.extraBranches = [
          {
            'claim': 'retained',
            'role': 'heating',
            'claim_state': state,
            'physical_identity': 'retained-relay',
            'protection': sample(time, temperature, maximumAge: maximumAge),
          },
        ];
      }

      Finder reading(String text) => find.descendant(
        of: find.byKey(const ValueKey('thermostat-member-retained')),
        matching: find.text(text),
      );
      void unavailable() {
        expect(reading('Live protection reading: Unavailable'), findsOneWidget);
        expect(find.text('Controller readiness: ready'), findsNothing);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      }

      final t1 = now;
      final t2 = now.add(const Duration(seconds: 1));
      final t3 = now.add(const Duration(seconds: 2));
      final t4 = now.add(const Duration(seconds: 3));
      retained(t2, 22);
      await fixture.mount(tester);
      expect(reading('Live protection reading: 22.0 °C'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      // Configuration revision/membership stays fixed; only runtime sequence changes.
      retained(t1, 21);
      await fixture.refetch(tester);
      unavailable();
      expect(reading('Live protection reading: 21.0 °C'), findsNothing);
      retained(t3, 23, maximumAge: 2);
      await fixture.refetch(tester);
      expect(reading('Live protection reading: 23.0 °C'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
      unavailable();
      // A refetch with rolled-back age/expiry cannot renew an expired sample.
      retained(t3, 23);
      await fixture.refetch(tester);
      unavailable();
      retained(t1, 21);
      await fixture.refetch(tester);
      unavailable();
      retained(t4, 24);
      await fixture.refetch(tester);
      expect(reading('Live protection reading: 24.0 °C'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      // Once absent from BOTH accepted sources, its watermark may be discarded.
      fixture.extraBranches = [];
      await fixture.refetch(tester);
      expect(
        find.byKey(const ValueKey('thermostat-member-retained')),
        findsNothing,
      );
      retained(t1, 21);
      await fixture.refetch(tester);
      expect(reading('Live protection reading: 21.0 °C'), findsOneWidget);
      // Released runtime rows are excluded from the same active projection.
      retained(t1, 21, state: 'released');
      await fixture.refetch(tester);
      expect(
        find.byKey(const ValueKey('thermostat-member-retained')),
        findsNothing,
      );
      retained(now.subtract(const Duration(seconds: 1)), 20);
      await fixture.refetch(tester);
      expect(reading('Live protection reading: 20.0 °C'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );

  testWidgets(
    'legacy singleton without declared protection and empty membership preserve snapshot readiness',
    (tester) async {
      final fixture = MemberDetailFixture()..declaresMemberProtection = false;
      await fixture.mount(tester);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      fixture.hasMember = false;
      await fixture.refetch(tester);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );
}

/// HTTP and socket fixture for the real detail lifecycle, including held reads.
class MemberDetailFixture {
  final socket = MemberSocket();
  final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
  final held = <void Function()>[];
  int revision = 1;
  int? configurationRevision;
  bool hold = false, hasMember = true, declaresMemberProtection = true;
  List<Map<String, dynamic>> sources = [], inputs = [], extraBranches = [];
  String? displayFloorClaim;
  Map<String, dynamic>? sample;

  MemberDetailFixture() {
    locator.registerSingleton<Dio>(dio);
    locator.registerSingleton<SocketService>(socket);
    addTearDown(() {
      locator.unregister<Dio>();
      locator.unregister<SocketService>();
    });
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final data = options.path.endsWith('/comfort')
              ? {
                  'controller': 'controller',
                  'revision': revision,
                  'graph_revision': revision,
                  'configuration': null,
                  'effective': {'source': 'manual'},
                }
              : options.path.endsWith('/runtime')
              ? {
                  'epoch': 'epoch',
                  'sequence': revision,
                  'configuration_revision': configurationRevision ?? revision,
                  'requested_mode': 'heat',
                  'readiness': 'ready',
                  'reasons': <String>[],
                  'inputs': inputs,
                  'branches': [
                    ...extraBranches,
                    if (hasMember)
                      {
                        'claim': 'one',
                        'role': 'heating',
                        'activity': 'off',
                        'protection': sample,
                      },
                  ],
                }
              : {
                  'revision': configurationRevision ?? revision,
                  'locked': false,
                  'policy': {'heatingSetpoint': 21},
                  'settings': <Map>[],
                  'sources': sources,
                  'display_floor_claim': displayFloorClaim,
                  'actuators': [
                    if (hasMember)
                      {
                        ...claim('one', 'heating', 'reserved'),
                        if (!declaresMemberProtection) 'protection': null,
                      },
                  ],
                };
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
  }

  Future<void> mount(WidgetTester tester) async {
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
  }

  Future<void> flush(WidgetTester tester) async {
    hold = false;
    final pending = held.toList();
    held.clear();
    for (final respond in pending) {
      respond();
    }
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump();
  }

  Future<void> refetch(WidgetTester tester) async {
    socket.hint(++revision);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump();
  }

  Future<void> dispose(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await flush(tester);
    expect(tester.takeException(), isNull);
  }
}
