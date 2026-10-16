import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
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
  if (role == 'heating') 'protection': {'source_identity': 'protective-source'},
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

Map<String, dynamic> activityObservation(
  DateTime time,
  String activity, {
  Duration lifetime = const Duration(seconds: 30),
  bool? qualification = true,
}) => {
  'activity': activity,
  'qualification_ready': qualification,
  'activity_sampled_at': time.toIso8601String(),
  'activity_expires_at': time.add(lifetime).toIso8601String(),
};

void main() {
  deadlineFenceTests();
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
      expect(members[1].observed(true, now), isNull);
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
      expect(historical.observed(true, now), isNull);
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
      fence.accept([sample(now)], now, Duration.zero);
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
      fence.accept([sample(newer)], newer, const Duration(seconds: 4));
      expect(
        fence.expiredClaims([sample(newer)], Duration.zero, newer),
        isEmpty,
      );
      expect(
        fence.expiredClaims([sample(now)], Duration.zero, now),
        contains('one'),
      );
      // Removal frees the record but keeps the qualified retirement floor.
      fence.retainClaims([]);
      fence.accept([sample(now)], now, const Duration(seconds: 4));
      expect(
        fence.expiredClaims([sample(now)], Duration.zero, now),
        contains('one'),
      );
      final recovery = newer.add(const Duration(seconds: 1));
      fence.accept([sample(recovery)], recovery, const Duration(seconds: 5));
      expect(
        fence.expiredClaims(
          [sample(recovery)],
          Duration.zero,
          recovery,
          clock: const Duration(seconds: 5),
        ),
        isEmpty,
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
                        ...activityObservation(
                          DateTime.now().subtract(const Duration(seconds: 1)),
                          'off',
                        ),
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
            ...activityObservation(
              now.subtract(Duration(seconds: 4 - rev)),
              rev == 1 ? 'off' : 'on',
            ),
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
      expect(textIn('h1', 'Reported observation: Unavailable'), findsOneWidget);
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
      expect(textIn('h1', 'Reported observation: Unavailable'), findsOneWidget);
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
    'three-second polling tolerates a one-second response but never extends the five-second display budget',
    (tester) async {
      final fixture = MemberDetailFixture();
      final now = DateTime.now();
      fixture.sample = {
        ...protection(now, 20),
        'maximum_age_seconds': 60,
        'expires_at': now.add(const Duration(minutes: 1)).toIso8601String(),
      };
      await fixture.mount(tester);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      fixture.hold = true;
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();
      expect(fixture.held, hasLength(2));
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await fixture.flush(tester);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      fixture.hold = true;
      await tester.pump(const Duration(seconds: 6));
      expect(fixture.held, hasLength(2));
      expect(find.text('Controller readiness: ready'), findsNothing);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      await fixture.flush(tester);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      // A genuinely newer hint is never classified as a harmless self event,
      // even with a request already in flight and unexpired member evidence.
      fixture.hold = true;
      await tester.pump(const Duration(seconds: 3));
      await tester.pump();
      fixture.socket.hint(++fixture.revision);
      await tester.pump();
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsNothing);
      await fixture.flush(tester);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump();
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await fixture.dispose(tester);
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
        ...protection(DateTime.now(), 0),
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

      final recovered = DateTime.now();
      expect(recovered.isAfter(now), isTrue);
      fixture.sample = sample(recovered, 11, maximumAge: 2);
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
      fixture.sample = sample(recovered, 11);
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
      final newest = DateTime.now();
      expect(newest.isAfter(recovered), isTrue);
      fixture.sample = sample(newest, 12);
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
        if (role == 'ambient') {
          fixture.sources.clear();
          fixture.inputs.clear();
        }
        final ambientInputs = fixture.inputs.toList();
        fixture.sources.add({'id': 'required-$role', 'role': role});
        Map<String, dynamic> input(DateTime time) => {
          ...protection(time, 0),
          'binding': 'required-$role',
          'role': role,
          'expires_at': now.add(const Duration(minutes: 2)).toIso8601String(),
        };
        fixture.inputs = [...ambientInputs, input(now)];
        await fixture.mount(tester);
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        await tester.pump(const Duration(seconds: 3));
        expect(find.text('Controller readiness: ready'), findsNothing);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        fixture.inputs = [...ambientInputs, input(DateTime.now())];
        await fixture.refetch(tester);
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        fixture.inputs = ambientInputs.toList();
        await fixture.refetch(tester);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        fixture.inputs = [
          ...ambientInputs,
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

      final t1 = now.subtract(const Duration(milliseconds: 100));
      final t2 = now;
      retained(t2, 22);
      await fixture.mount(tester);
      expect(reading('Live protection reading: 22.0 °C'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      // Configuration revision/membership stays fixed; only runtime sequence changes.
      retained(t1, 21);
      await fixture.refetch(tester);
      unavailable();
      expect(reading('Live protection reading: 21.0 °C'), findsNothing);
      final t3 = DateTime.now();
      expect(t3.isAfter(t2), isTrue);
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
      final t4 = DateTime.now();
      expect(t4.isAfter(t3), isTrue);
      retained(t4, 24);
      await fixture.refetch(tester);
      expect(reading('Live protection reading: 24.0 °C'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      // Removal frees capacity but the retirement floor refuses the old sample.
      fixture.extraBranches = [];
      await fixture.refetch(tester);
      expect(
        find.byKey(const ValueKey('thermostat-member-retained')),
        findsNothing,
      );
      retained(t1, 21);
      await fixture.refetch(tester);
      unavailable();
      expect(reading('Live protection reading: 21.0 °C'), findsNothing);
      final afterRemoval = DateTime.now();
      expect(afterRemoval.isAfter(t4), isTrue);
      retained(afterRemoval, 25);
      await fixture.refetch(tester);
      expect(reading('Live protection reading: 25.0 °C'), findsOneWidget);
      // Released runtime rows are excluded from the same active projection.
      retained(t1, 21, state: 'released');
      await fixture.refetch(tester);
      expect(
        find.byKey(const ValueKey('thermostat-member-retained')),
        findsNothing,
      );
      retained(now.subtract(const Duration(seconds: 1)), 20);
      await fixture.refetch(tester);
      unavailable();
      expect(reading('Live protection reading: 20.0 °C'), findsNothing);
      final afterRelease = DateTime.now();
      expect(afterRelease.isAfter(afterRemoval), isTrue);
      retained(afterRelease, 26);
      await fixture.refetch(tester);
      expect(reading('Live protection reading: 26.0 °C'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );

  test(
    'relay fence keeps original budget through rollback, source gaps and older samples',
    () {
      final now = DateTime.utc(2026, 10, 15, 12);
      final fence = VirtualThermostatActivityFence();
      VirtualThermostatMember member(Map<String, dynamic> observation) =>
          VirtualThermostatMember(claim('one', 'heating', 'reserved'), {
            'claim': 'one',
            ...observation,
          });
      final first = activityObservation(
        now,
        'on',
        lifetime: const Duration(seconds: 2),
      );
      expect(
        fence.unavailableClaims([member(first)], now, Duration.zero),
        isEmpty,
      );
      // Wall time rolls back; the independent monotonic budget still expires.
      expect(
        fence.unavailableClaims(
          [member(first)],
          now,
          const Duration(seconds: 3),
        ),
        contains('one'),
      );
      expect(
        fence.unavailableClaims(
          [
            member({
              ...first,
              'activity_expires_at': now
                  .add(const Duration(minutes: 1))
                  .toIso8601String(),
            }),
          ],
          now,
          const Duration(seconds: 3),
        ),
        contains('one'),
      );
      final next = activityObservation(
        now.add(const Duration(seconds: 1)),
        'off',
      );
      expect(
        fence.unavailableClaims(
          [member(next)],
          now.add(const Duration(seconds: 1)),
          const Duration(seconds: 4),
        ),
        isEmpty,
      );
      expect(
        fence.unavailableClaims(
          [
            member({'activity': 'unknown'}),
          ],
          now,
          const Duration(seconds: 4),
        ),
        contains('one'),
      );
      expect(
        fence.unavailableClaims(
          [member(next)],
          now.add(const Duration(seconds: 1)),
          const Duration(seconds: 4),
        ),
        contains('one'),
      );
      fence.retainClaims([]);
      expect(
        fence.unavailableClaims([member(first)], now, Duration.zero),
        isEmpty,
      );
    },
  );

  testWidgets(
    'relay expiry cannot be renewed by a fresh HTTP poll; guard check is independent',
    (tester) async {
      final fixture = MemberDetailFixture()..declaresMemberProtection = false;
      final now = DateTime.now();
      fixture.observation = activityObservation(
        now,
        'on',
        lifetime: const Duration(seconds: 2),
        qualification: false,
      );
      await fixture.mount(tester);
      expect(find.text('Reported observation: on'), findsOneWidget);
      expect(
        find.text('Server guard/target check (snapshot): false'),
        findsOneWidget,
      );
      await tester.pump(const Duration(seconds: 1));
      await fixture.refetch(tester);
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Reported observation: on'), findsNothing);
      expect(find.text('Reported observation: Unavailable'), findsOneWidget);
      // The registry/target check is a current HTTP boolean, not relay feedback.
      expect(
        find.text('Server guard/target check (snapshot): false'),
        findsOneWidget,
      );
      fixture.observation = {
        ...fixture.observation,
        'activity_expires_at': now
            .add(const Duration(minutes: 1))
            .toIso8601String(),
      };
      await fixture.refetch(tester);
      expect(find.text('Reported observation: Unavailable'), findsOneWidget);
      fixture.observation = activityObservation(DateTime.now(), 'off');
      await fixture.refetch(tester);
      expect(find.text('Reported observation: off'), findsOneWidget);
      expect(
        find.text('Server guard/target check (snapshot): true'),
        findsOneWidget,
      );
      await fixture.dispose(tester);
    },
  );

  testWidgets(
    'relay and guard snapshots invalidate on source, socket and model changes',
    (tester) async {
      final fixture = MemberDetailFixture()..declaresMemberProtection = false;
      final original = DateTime.now().subtract(const Duration(seconds: 1));
      final first = activityObservation(original, 'on');
      fixture.observation = first;
      await fixture.mount(tester);
      expect(find.text('Reported observation: on'), findsOneWidget);
      fixture.hold = true;
      fixture.socket.hint(++fixture.revision);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump();
      expect(find.text('Reported observation: Unavailable'), findsOneWidget);
      expect(
        find.text('Server guard/target check (snapshot): Unavailable'),
        findsOneWidget,
      );
      await fixture.flush(tester);
      expect(find.text('Reported observation: on'), findsOneWidget);
      fixture.observation = {
        'activity': 'unknown',
        'qualification_ready': null,
        'activity_sampled_at': null,
        'activity_expires_at': null,
      };
      await fixture.refetch(tester);
      expect(find.text('Reported observation: Unavailable'), findsOneWidget);
      expect(
        find.text('Server guard/target check (snapshot): Unavailable'),
        findsOneWidget,
      );
      fixture.observation = first;
      await fixture.refetch(tester);
      expect(find.text('Reported observation: on'), findsNothing);
      fixture.observation = activityObservation(DateTime.now(), 'off');
      await fixture.refetch(tester);
      expect(find.text('Reported observation: off'), findsOneWidget);
      fixture.observation = activityObservation(
        original.subtract(const Duration(seconds: 1)),
        'on',
      );
      fixture.revision++;
      fixture.hold = true;
      await fixture.mount(tester);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      expect(find.text('Reported observation: off'), findsNothing);
      expect(
        find.text('Server guard/target check (snapshot): true'),
        findsNothing,
      );
      await fixture.flush(tester);
      expect(find.text('Reported observation: Unavailable'), findsOneWidget);
      // Missing/invalid dates can never make a legacy ON or historical OFF live.
      fixture.observation = {
        'activity': 'on',
        'qualification_ready': false,
        'last_verified_off_at': DateTime.now().toIso8601String(),
      };
      await fixture.refetch(tester);
      expect(find.text('Reported observation: on'), findsNothing);
      expect(
        find.text('Server guard/target check (snapshot): false'),
        findsOneWidget,
      );
      fixture.observation = {
        'activity': 'off',
        'qualification_ready': true,
        'activity_sampled_at': 'bad',
        'activity_expires_at': 'bad',
      };
      await fixture.refetch(tester);
      expect(find.text('Reported observation: off'), findsNothing);
      expect(
        find.text('Server guard/target check (snapshot): true'),
        findsOneWidget,
      );
      fixture.hold = true;
      await tester.pump(const Duration(seconds: 6));
      expect(
        find.text('Server guard/target check (snapshot): true'),
        findsNothing,
      );
      expect(
        find.text('Server guard/target check (snapshot): Unavailable'),
        findsOneWidget,
      );
      await fixture.dispose(tester);
    },
  );

  testWidgets(
    'runtime-only relay watermark survives refetch and stays independent of floor expiry',
    (tester) async {
      final fixture = MemberDetailFixture()..configurationRevision = 1;
      final now = DateTime.now();
      fixture.sample = protection(now, 0);
      fixture.observation = activityObservation(now, 'off');
      final t2 = now.subtract(const Duration(seconds: 1));
      void retained(DateTime time) => fixture.extraBranches = [
        {
          'claim': 'retained',
          'role': 'heating',
          'claim_state': 'reserved',
          'physical_identity': 'relay-retained',
          ...activityObservation(time, 'on'),
        },
      ];
      Finder activity(String value) => find.descendant(
        of: find.byKey(const ValueKey('thermostat-member-retained')),
        matching: find.text('Reported observation: $value'),
      );
      retained(t2);
      await fixture.mount(tester);
      expect(activity('on'), findsOneWidget);
      retained(t2.subtract(const Duration(seconds: 1)));
      await fixture.refetch(tester);
      expect(activity('Unavailable'), findsOneWidget);
      retained(DateTime.now());
      await fixture.refetch(tester);
      expect(activity('on'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
      expect(find.text('Live protection reading: Unavailable'), findsOneWidget);
      expect(activity('on'), findsOneWidget);
      expect(find.text('Reported observation: off'), findsOneWidget);
      fixture.extraBranches = [];
      await fixture.refetch(tester);
      retained(t2.subtract(const Duration(seconds: 1)));
      await fixture.refetch(tester);
      expect(activity('on'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );

  const observationLocales = {
    'en': (
      'Server guard/target check (snapshot)',
      'not full controller admission',
      'Unavailable',
    ),
    'cs': (
      'Kontrola ochrany/cíle serverem (snímek)',
      'není úplné povolení',
      'Nedostupné',
    ),
    'de': (
      'Server-Schutz-/Zielprüfung (Snapshot)',
      'keine vollständige Reglerfreigabe',
      'Nicht verfügbar',
    ),
    'es': (
      'Comprobación de protección/destino del servidor (instantánea)',
      'no es admisión completa',
      'No disponible',
    ),
    'pl': (
      'Kontrola zabezpieczenia/celu przez serwer (migawka)',
      'nie oznacza pełnego dopuszczenia',
      'Niedostępne',
    ),
    'sk': (
      'Kontrola ochrany/cieľa serverom (snímka)',
      'nie je úplné povolenie',
      'Nedostupné',
    ),
  };
  for (final entry in observationLocales.entries) {
    testWidgets('narrow guard check and unknown state render in ${entry.key}', (
      tester,
    ) async {
      final fixture = MemberDetailFixture()
        ..declaresMemberProtection = false
        ..locale = Locale(entry.key)
        ..observation = {'qualification_ready': false, 'activity': 'on'};
      await fixture.mount(tester);
      expect(find.text('${entry.value.$1}: false'), findsOneWidget);
      expect(find.textContaining(entry.value.$2), findsOneWidget);
      fixture.observation = {'qualification_ready': null, 'activity': 'on'};
      await fixture.refetch(tester);
      expect(find.text('${entry.value.$1}: ${entry.value.$3}'), findsOneWidget);
      await fixture.dispose(tester);
    });
  }

  testWidgets(
    'legacy singleton and empty membership require qualified ambient evidence for ready',
    (tester) async {
      final fixture = MemberDetailFixture()
        ..declaresMemberProtection = false
        ..sources = []
        ..inputs = [];
      await fixture.mount(tester);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      fixture.hasMember = false;
      await fixture.refetch(tester);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      fixture.addQualifiedAmbient();
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
  Locale? locale;
  Map<String, dynamic>? sample;
  Map<String, dynamic> observation = {};

  void addQualifiedAmbient() {
    final now = DateTime.now();
    sources.add({
      'id': 'ambient',
      'role': 'ambient',
      'source_identity': 'ambient',
      'source_property': 'ambient-property',
    });
    inputs.add({
      'binding': 'ambient',
      'role': 'ambient',
      'source_property': 'ambient-property',
      'source_kind': 'physical',
      'status': 'fresh',
      'quality': 'good',
      'sampled_at': now.toIso8601String(),
      'expires_at': now.add(const Duration(minutes: 2)).toIso8601String(),
      'age_seconds': 0,
      'maximum_age_seconds': 120,
    });
  }

  MemberDetailFixture() {
    addQualifiedAmbient();
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
                        ...observation,
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
        locale: locale,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
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

void deadlineFenceTests() {
  final t = DateTime.utc(2026, 10, 16, 12);
  Map source(String role, String id, [String? identity = 'sensor']) => {
    'id': id,
    'role': role,
    if (identity != null) 'source_identity': identity,
    'source_property': 'property-$id',
    'physical_identity': 'physical-$id',
    'contract_fingerprint': 'contract',
  };
  Map input(
    String role,
    String id,
    DateTime stamp, {
    int maxAge = 2,
    DateTime? expiry,
    String quality = 'good',
  }) => {
    'binding': id,
    'role': role,
    'source_property': 'property-$id',
    'source_kind': 'physical',
    'status': 'fresh',
    'quality': quality,
    'sampled_at': stamp.toIso8601String(),
    'expires_at': (expiry ?? stamp.add(Duration(seconds: maxAge)))
        .toIso8601String(),
    'age_seconds': 0,
    'maximum_age_seconds': maxAge,
  };
  bool accept(
    VirtualThermostatEvidenceFence fence,
    List<Map> sources,
    List<Map> inputs,
    DateTime wall,
    Duration mono, {
    int? revision = 1,
    List<Map> claims = const [],
    List<Map> branches = const [],
  }) => fence.accept(
    {'revision': revision, 'sources': sources, 'actuators': claims},
    {
      'configuration_revision': revision,
      'inputs': inputs,
      'branches': branches,
    },
    wall,
    mono,
  );

  test(
    'empty declared sources and diagnostics cannot establish positive readiness',
    () {
      final fence = VirtualThermostatEvidenceFence();
      accept(fence, [], [], t, Duration.zero);
      expect(fence.sources.allCurrent(t, Duration.zero), isFalse);
      accept(
        fence,
        [source('ambient', 'a')],
        [input('ambient', 'a', t)],
        t,
        Duration.zero,
      );
      expect(fence.sources.allCurrent(t, Duration.zero), isTrue);
    },
  );

  for (final role in ['ambient', 'floor', 'contact']) {
    for (final gap in ['omitted', 'mismatched']) {
      test(
        '$role known runtime property $gap withdraws the sample until strictly newer evidence',
        () {
          final fence = VirtualThermostatEvidenceFence(),
              row = source(role, 'a');
          accept(fence, [row], [input(role, 'a', t)], t, Duration.zero);
          expect(fence.sources.roleCurrent(role, t, Duration.zero), isTrue);
          final broken = input(role, 'a', t);
          if (gap == 'omitted') {
            broken.remove('source_property');
          } else {
            broken['source_property'] = 'wrong-property';
          }
          accept(fence, [row], [broken], t, Duration.zero);
          expect(fence.sources.roleCurrent(role, t, Duration.zero), isFalse);
          accept(fence, [row], [input(role, 'a', t)], t, Duration.zero);
          expect(fence.sources.roleCurrent(role, t, Duration.zero), isFalse);
          final newer = t.add(const Duration(milliseconds: 1));
          accept(
            fence,
            [row],
            [
              input(
                role,
                'a',
                newer,
                expiry: t.add(const Duration(seconds: 2)),
              ),
            ],
            newer,
            const Duration(milliseconds: 1),
          );
          expect(
            fence.sources.roleCurrent(
              role,
              newer,
              const Duration(milliseconds: 1),
            ),
            isTrue,
          );
        },
      );
    }
  }

  for (final role in ['ambient', 'floor', 'contact']) {
    test(
      'original $role deadline survives cached refetch before an expired frame and literal wall rollback',
      () {
        final fence = VirtualThermostatEvidenceFence(), row = source(role, 'a');
        expect(
          accept(fence, [row], [input(role, 'a', t)], t, Duration.zero),
          isTrue,
        );
        // No query/build between first admission and cached HTTP at mono3.
        expect(
          accept(
            fence,
            [row],
            [input(role, 'a', t, expiry: t.add(const Duration(minutes: 1)))],
            t.add(const Duration(seconds: 1)),
            const Duration(seconds: 3),
          ),
          isTrue,
        );
        expect(
          fence.sources.roleCurrent(
            role,
            t.add(const Duration(seconds: 1)),
            const Duration(seconds: 3),
          ),
          isFalse,
        );
        expect(
          accept(
            fence,
            [row],
            [input(role, 'a', t.add(const Duration(seconds: 1)))],
            t.add(const Duration(seconds: 1)),
            const Duration(seconds: 3),
          ),
          isTrue,
        );
        expect(
          fence.sources.roleCurrent(
            role,
            t.add(const Duration(seconds: 1)),
            const Duration(seconds: 3),
          ),
          isTrue,
        );
      },
    );
  }
  test(
    'member first-HTTP deadline and qualified retirement floor block same-batch and later replacement claims',
    () {
      final fence = VirtualThermostatEvidenceFence();
      final old = claim('one', 'heating', 'reserved'),
          replacement = claim('two', 'heating', 'reserved');
      Map branch(String id, DateTime stamp) => {
        'claim': id,
        'protection': protection(stamp, 20),
      };
      accept(
        fence,
        [],
        [],
        t,
        Duration.zero,
        claims: [old],
        branches: [branch('one', t)],
      );
      accept(
        fence,
        [],
        [],
        t.add(const Duration(seconds: 1)),
        const Duration(seconds: 3),
        claims: [old],
        branches: [branch('one', t)],
      );
      expect(
        fence.members.expiredClaims(
          [VirtualThermostatMember(old, branch('one', t))],
          Duration.zero,
          t.add(const Duration(seconds: 1)),
          clock: const Duration(seconds: 3),
        ),
        contains('one'),
      );
      accept(
        fence,
        [],
        [],
        t.add(const Duration(seconds: 1)),
        const Duration(seconds: 3),
        revision: 2,
        claims: [replacement],
        branches: [branch('two', t)],
      );
      expect(
        fence.members.expiredClaims(
          [VirtualThermostatMember(replacement, branch('two', t))],
          Duration.zero,
          t.add(const Duration(seconds: 1)),
          clock: const Duration(seconds: 3),
        ),
        contains('two'),
      );
      accept(
        fence,
        [],
        [],
        t.add(const Duration(seconds: 1)),
        const Duration(seconds: 3),
        revision: 3,
      );
      accept(
        fence,
        [],
        [],
        t.add(const Duration(seconds: 1)),
        const Duration(seconds: 3),
        revision: 4,
        claims: [replacement],
        branches: [branch('two', t)],
      );
      expect(
        fence.members.expiredClaims(
          [VirtualThermostatMember(replacement, branch('two', t))],
          Duration.zero,
          t.add(const Duration(seconds: 1)),
          clock: const Duration(seconds: 3),
        ),
        contains('two'),
      );
      final newer = t.add(const Duration(seconds: 1));
      accept(
        fence,
        [],
        [],
        newer,
        const Duration(seconds: 3),
        revision: 4,
        claims: [replacement],
        branches: [branch('two', newer)],
      );
      expect(
        fence.members.expiredClaims(
          [VirtualThermostatMember(replacement, branch('two', newer))],
          Duration.zero,
          newer,
          clock: const Duration(seconds: 3),
        ),
        isEmpty,
      );
    },
  );
  test(
    'same-source binding replacement folds before admission and survives complete removal with global revision floor',
    () {
      final fence = VirtualThermostatEvidenceFence();
      accept(
        fence,
        [source('ambient', 'a')],
        [input('ambient', 'a', t)],
        t,
        Duration.zero,
      );
      accept(fence, [], [], t, Duration.zero, revision: 2);
      accept(
        fence,
        [source('ambient', 'b')],
        [input('ambient', 'b', t)],
        t,
        Duration.zero,
        revision: 3,
      );
      expect(fence.sources.roleCurrent('ambient', t, Duration.zero), isFalse);
      expect(
        accept(
          fence,
          [source('ambient', 'a')],
          [input('ambient', 'a', t.add(const Duration(seconds: 1)))],
          t.add(const Duration(seconds: 1)),
          Duration.zero,
          revision: 1,
        ),
        isFalse,
      );
      expect(accept(fence, [], [], t, Duration.zero, revision: null), isFalse);
      final newer = t.add(const Duration(seconds: 1));
      accept(
        fence,
        [source('ambient', 'b')],
        [input('ambient', 'b', newer)],
        newer,
        Duration.zero,
        revision: 3,
      );
      expect(
        fence.sources.roleCurrent('ambient', newer, Duration.zero),
        isTrue,
      );
    },
  );
  test(
    'known alias canonical to missing to restored retains expired budget, and X to Y retires X',
    () {
      final fence = VirtualThermostatEvidenceFence();
      accept(
        fence,
        [source('contact', 'a', 'x')],
        [input('contact', 'a', t)],
        t,
        Duration.zero,
      );
      accept(
        fence,
        [source('contact', 'a', null)],
        [input('contact', 'a', t)],
        t.add(const Duration(seconds: 1)),
        const Duration(seconds: 3),
      );
      expect(
        fence.sources.roleCurrent(
          'contact',
          t.add(const Duration(seconds: 1)),
          const Duration(seconds: 3),
        ),
        isFalse,
      );
      accept(
        fence,
        [source('contact', 'a', 'x')],
        [input('contact', 'a', t)],
        t.add(const Duration(seconds: 1)),
        const Duration(seconds: 3),
      );
      expect(
        fence.sources.roleCurrent(
          'contact',
          t.add(const Duration(seconds: 1)),
          const Duration(seconds: 3),
        ),
        isFalse,
      );
      accept(
        fence,
        [source('contact', 'a', 'y')],
        [input('contact', 'a', t)],
        t,
        const Duration(seconds: 3),
      );
      accept(
        fence,
        [source('contact', 'c', 'x')],
        [input('contact', 'c', t)],
        t,
        const Duration(seconds: 3),
      );
      expect(
        fence.sources.roleCurrent('contact', t, const Duration(seconds: 3)),
        isFalse,
      );
      expect(fence.sources.legacyFallbackClosed, isTrue);
      final newer = t.add(const Duration(seconds: 1));
      accept(
        fence,
        [source('contact', 'c', 'x')],
        [input('contact', 'c', newer)],
        newer,
        const Duration(seconds: 3),
      );
      expect(
        fence.sources.roleCurrent('contact', newer, const Duration(seconds: 3)),
        isTrue,
      );
    },
  );
  test(
    'never-seen legacy alias migrates both ways without fresh admission; aliases collide conservatively',
    () {
      final fence = VirtualThermostatEvidenceFence();
      accept(
        fence,
        [source('contact', 'a', null)],
        [input('contact', 'a', t)],
        t,
        Duration.zero,
      );
      accept(
        fence,
        [source('contact', 'a', 'x')],
        [input('contact', 'a', t)],
        t,
        Duration.zero,
      );
      expect(fence.sources.roleCurrent('contact', t, Duration.zero), isFalse);
      final newer = t.add(const Duration(seconds: 1));
      accept(
        fence,
        [
          source('ambient', 'ambient', 'ambient'),
          source('contact', 'a', 'x'),
          source('contact', 'b', 'y'),
        ],
        [
          input('ambient', 'ambient', newer),
          input('contact', 'a', newer),
          input('contact', 'b', newer),
        ],
        newer,
        Duration.zero,
      );
      expect(fence.sources.allCurrent(newer, Duration.zero), isTrue);
      accept(
        fence,
        [
          source('ambient', 'ambient', 'ambient'),
          source('contact', 'a', 'y'),
          source('contact', 'b', 'y'),
        ],
        [
          input('ambient', 'ambient', newer),
          input('contact', 'a', newer),
          input('contact', 'b', newer),
        ],
        newer,
        Duration.zero,
      );
      expect(fence.sources.allCurrent(newer, Duration.zero), isFalse);
    },
  );
  test(
    'same-timestamp age and expiry can only tighten; exact deadline is unavailable',
    () {
      final fence = VirtualThermostatEvidenceFence(),
          row = source('floor', 'a');
      accept(
        fence,
        [row],
        [input('floor', 'a', t, maxAge: 10)],
        t,
        Duration.zero,
      );
      accept(
        fence,
        [row],
        [input('floor', 'a', t, maxAge: 1)],
        t,
        Duration.zero,
      );
      accept(
        fence,
        [row],
        [input('floor', 'a', t, maxAge: 100)],
        t,
        Duration.zero,
      );
      expect(
        fence.sources.roleCurrent('floor', t, const Duration(seconds: 1)),
        isFalse,
      );
      accept(
        fence,
        [row],
        [input('floor', 'a', t, maxAge: 100)],
        t,
        Duration.zero,
      );
      expect(fence.sources.roleCurrent('floor', t, Duration.zero), isFalse);
    },
  );
  test(
    'unqualified future/identity-mismatch retirement cannot poison a later qualified admission floor',
    () {
      final fence = VirtualThermostatEvidenceFence();
      accept(
        fence,
        [source('ambient', 'bad')],
        [input('ambient', 'bad', t.add(const Duration(days: 1)))],
        t,
        Duration.zero,
      );
      accept(fence, [], [], t, Duration.zero, revision: 2);
      accept(
        fence,
        [source('ambient', 'good')],
        [input('ambient', 'good', t)],
        t,
        Duration.zero,
        revision: 3,
      );
      expect(fence.sources.roleCurrent('ambient', t, Duration.zero), isTrue);
      final mismatch = input(
        'ambient',
        'wrong',
        t.add(const Duration(seconds: 1)),
      )..['source_property'] = 'mismatched';
      accept(
        fence,
        [source('ambient', 'wrong')],
        [mismatch],
        t.add(const Duration(seconds: 1)),
        Duration.zero,
        revision: 4,
      );
      accept(
        fence,
        [],
        [],
        t.add(const Duration(seconds: 1)),
        Duration.zero,
        revision: 5,
      );
      accept(
        fence,
        [source('ambient', 'new')],
        [input('ambient', 'new', t.add(const Duration(milliseconds: 500)))],
        t.add(const Duration(seconds: 1)),
        Duration.zero,
        revision: 6,
      );
      expect(
        fence.sources.roleCurrent(
          'ambient',
          t.add(const Duration(seconds: 1)),
          Duration.zero,
        ),
        isTrue,
      );
    },
  );
  test(
    'each contact and positive role needs its own declared unambiguous runtime join',
    () {
      final fence = VirtualThermostatEvidenceFence();
      accept(
        fence,
        [source('contact', 'a'), source('contact', 'b', 'second')],
        [input('contact', 'a', t)],
        t,
        Duration.zero,
      );
      expect(fence.sources.allCurrent(t, Duration.zero), isFalse);
      expect(fence.sources.roleCurrent('ambient', t, Duration.zero), isFalse);
      expect(fence.sources.roleCurrent('floor', t, Duration.zero), isFalse);
      accept(
        fence,
        [
          source('ambient', 'ambient', 'ambient'),
          source('contact', 'a'),
          source('contact', 'b', 'second'),
        ],
        [
          input('ambient', 'ambient', t, maxAge: 60),
          input('contact', 'a', t.add(const Duration(seconds: 1))),
          input('contact', 'b', t.add(const Duration(seconds: 1))),
        ],
        t.add(const Duration(seconds: 1)),
        Duration.zero,
      );
      expect(
        fence.sources.allCurrent(
          t.add(const Duration(seconds: 1)),
          Duration.zero,
        ),
        isTrue,
      );
    },
  );
  test(
    'same-batch source key replacement folds first while a surviving contact keeps its own budget',
    () {
      final fence = VirtualThermostatEvidenceFence();
      final sibling = source('contact', 'sibling', 'sibling');
      accept(
        fence,
        [source('ambient', 'a', 'x'), sibling],
        [input('ambient', 'a', t), input('contact', 'sibling', t, maxAge: 60)],
        t,
        Duration.zero,
      );
      accept(
        fence,
        [source('ambient', 'b', 'y'), sibling],
        [input('ambient', 'b', t), input('contact', 'sibling', t, maxAge: 60)],
        t,
        Duration.zero,
        revision: 2,
      );
      expect(fence.sources.roleCurrent('ambient', t, Duration.zero), isFalse);
      expect(fence.sources.roleCurrent('contact', t, Duration.zero), isTrue);
      final newer = t.add(const Duration(seconds: 1));
      accept(
        fence,
        [source('ambient', 'b', 'y'), sibling],
        [
          input('ambient', 'b', newer),
          input('contact', 'sibling', t, maxAge: 60),
        ],
        newer,
        const Duration(seconds: 1),
        revision: 2,
      );
      expect(
        fence.sources.allCurrent(newer, const Duration(seconds: 1)),
        isTrue,
      );
      final records = fence.sources.recordCount,
          aliases = fence.sources.aliasCount;
      expect(
        accept(
          fence,
          [source('ambient', 'b', null)],
          [input('ambient', 'b', newer)],
          newer,
          const Duration(seconds: 1),
          revision: 1,
        ),
        isFalse,
      );
      expect(
        accept(
          fence,
          [],
          [],
          newer,
          const Duration(seconds: 1),
          revision: null,
        ),
        isFalse,
      );
      expect(fence.sources.recordCount, records);
      expect(fence.sources.aliasCount, aliases);
      expect(
        fence.sources.allCurrent(newer, const Duration(seconds: 1)),
        isTrue,
      );
    },
  );
  test(
    'invalid newer timestamp stays withdrawn in its record but never poisons retirement',
    () {
      final fence = VirtualThermostatEvidenceFence(),
          row = source('ambient', 'a');
      accept(fence, [row], [input('ambient', 'a', t)], t, Duration.zero);
      accept(
        fence,
        [row],
        [input('ambient', 'a', t.add(const Duration(days: 1)))],
        t,
        Duration.zero,
      );
      accept(fence, [row], [input('ambient', 'a', t)], t, Duration.zero);
      expect(fence.sources.roleCurrent('ambient', t, Duration.zero), isFalse);
      accept(fence, [], [], t, Duration.zero, revision: 2);
      final newer = t.add(const Duration(seconds: 1));
      accept(
        fence,
        [source('ambient', 'b')],
        [input('ambient', 'b', newer)],
        newer,
        Duration.zero,
        revision: 3,
      );
      expect(
        fence.sources.roleCurrent('ambient', newer, Duration.zero),
        isTrue,
      );
    },
  );
  test(
    'bounded source record/alias overflow withholds without eviction and closes unknown legacy admission',
    () {
      final fence = VirtualThermostatEvidenceFence();
      void partial(int start, int count, DateTime stamp) {
        final rows = [
          for (var n = start; n < start + count; n++)
            source('contact', 'id$n', 'sensor$n'),
        ];
        fence.accept(
          {
            'revision': 1,
            'sources': [...rows, 'incomplete'],
            'actuators': [],
          },
          {
            'configuration_revision': 1,
            'inputs': [
              for (var n = start; n < start + count; n++)
                input('contact', 'id$n', stamp),
            ],
            'branches': [],
          },
          stamp,
          Duration.zero,
        );
      }

      partial(0, 18, t);
      partial(18, 18, t);
      expect(fence.sources.recordCount, 36);
      expect(fence.sources.aliasCount, 36);
      final capacityStamp = t.add(const Duration(seconds: 1));
      partial(36, 1, capacityStamp);
      expect(fence.sources.overflow, isTrue);
      expect(fence.sources.allCurrent(capacityStamp, Duration.zero), isFalse);
      expect(fence.sources.recordCount, 36);
      expect(fence.sources.aliasCount, 36);
      expect(fence.sources.legacyFallbackClosed, isTrue);
      accept(fence, [], [], capacityStamp, Duration.zero, revision: 2);
      expect(fence.sources.recordCount, 0);
      accept(
        fence,
        [source('ambient', 'new', 'new')],
        [input('ambient', 'new', capacityStamp)],
        capacityStamp,
        Duration.zero,
        revision: 3,
      );
      expect(
        fence.sources.roleCurrent('ambient', capacityStamp, Duration.zero),
        isFalse,
      );
      final newer = capacityStamp.add(const Duration(seconds: 1));
      accept(
        fence,
        [source('ambient', 'new', 'new')],
        [input('ambient', 'new', newer)],
        newer,
        Duration.zero,
        revision: 3,
      );
      expect(
        fence.sources.roleCurrent('ambient', newer, Duration.zero),
        isTrue,
      );
      accept(
        fence,
        [source('contact', 'unknown', null)],
        [input('contact', 'unknown', newer)],
        newer,
        Duration.zero,
        revision: 4,
      );
      expect(
        fence.sources.roleCurrent('contact', newer, Duration.zero),
        isFalse,
      );
      expect(fence.sources.legacyFallbackClosed, isTrue);
    },
  );
  test(
    'opaque identities are unqualified rather than capacity; real member overflow stays withheld',
    () {
      final fence = VirtualThermostatEvidenceFence();
      accept(
        fence,
        [],
        [],
        t,
        Duration.zero,
        branches: [
          {'role': 'heating', 'activity': 'off'},
        ],
      );
      expect(fence.members.untracked, isTrue);
      expect(fence.members.overflow, isFalse);
      final claims = [
        for (var n = 0; n < 17; n++) claim('member$n', 'heating', 'reserved'),
      ];
      final branches = [
        for (var n = 0; n < 17; n++)
          {'claim': 'member$n', 'protection': protection(t, 20)},
      ];
      accept(
        fence,
        [],
        [],
        t,
        Duration.zero,
        revision: 2,
        claims: claims,
        branches: branches,
      );
      expect(fence.members.overflow, isTrue);
      expect(fence.sources.legacyFallbackClosed, isTrue);
      expect(
        fence.members.expiredClaims(
          [VirtualThermostatMember(claims.last, branches.last)],
          Duration.zero,
          t,
        ),
        contains('member16'),
      );
    },
  );
  test('render query cannot initialize a member or source deadline', () {
    final fence = VirtualThermostatEvidenceFence();
    final row = VirtualThermostatMember(claim('one', 'heating', 'reserved'), {
      'protection': protection(t, 20),
    });
    expect(
      fence.members.expiredClaims([row], Duration.zero, t),
      contains('one'),
    );
    expect(fence.sources.roleCurrent('ambient', t, Duration.zero), isFalse);
    expect(fence.sources.recordCount, 0);
  });
  test(
    'alias-only capacity rejects a future candidate without poisoning qualified retirement',
    () {
      final fence = VirtualThermostatEvidenceFence();
      for (var n = 0; n < 36; n++) {
        final stamp = t.add(Duration(milliseconds: n));
        fence.accept(
          {
            'revision': 1,
            'sources': [source('contact', 'a$n'), 'incomplete'],
            'actuators': [],
          },
          {
            'configuration_revision': 1,
            'inputs': [input('contact', 'a$n', stamp)],
            'branches': [],
          },
          stamp,
          Duration.zero,
        );
      }
      expect(fence.sources.recordCount, 1);
      expect(fence.sources.aliasCount, 36);
      final wall = t.add(const Duration(milliseconds: 36));
      fence.accept(
        {
          'revision': 1,
          'sources': [source('contact', 'overflow'), 'incomplete'],
          'actuators': [],
        },
        {
          'configuration_revision': 1,
          'inputs': [
            input('contact', 'overflow', t.add(const Duration(days: 1))),
          ],
          'branches': [],
        },
        wall,
        Duration.zero,
      );
      expect(fence.sources.overflow, isTrue);
      expect(fence.sources.aliasCount, 36);
      expect(fence.sources.recordCount, 1);
      expect(fence.sources.legacyFallbackClosed, isTrue);
      accept(fence, [], [], wall, Duration.zero, revision: 2);
      accept(
        fence,
        [source('ambient', 'new')],
        [input('ambient', 'new', wall)],
        wall,
        Duration.zero,
        revision: 3,
      );
      expect(fence.sources.roleCurrent('ambient', wall, Duration.zero), isTrue);
    },
  );
  test(
    'claim revision and binding gap cannot reuse a publication; malformed budgets never qualify',
    () {
      final fence = VirtualThermostatEvidenceFence();
      final first = claim('one', 'heating', 'reserved')..['revision'] = 1;
      Map branch(DateTime stamp) => {
        'claim': 'one',
        'protection': protection(stamp, 20),
      };
      accept(
        fence,
        [],
        [],
        t,
        Duration.zero,
        claims: [first],
        branches: [branch(t)],
      );
      final changed = {...first, 'revision': 2};
      accept(
        fence,
        [],
        [],
        t,
        Duration.zero,
        revision: 2,
        claims: [changed],
        branches: [branch(t)],
      );
      expect(
        fence.members.expiredClaims(
          [VirtualThermostatMember(changed, branch(t))],
          Duration.zero,
          t,
        ),
        contains('one'),
      );
      final newer = t.add(const Duration(seconds: 1));
      accept(
        fence,
        [],
        [],
        newer,
        Duration.zero,
        revision: 2,
        claims: [changed],
        branches: [branch(newer)],
      );
      expect(
        fence.members.expiredClaims(
          [VirtualThermostatMember(changed, branch(newer))],
          Duration.zero,
          newer,
        ),
        isEmpty,
      );
      final malformed = input('ambient', 'a', newer)
        ..['maximum_age_seconds'] = 1e308;
      accept(
        fence,
        [source('ambient', 'a')],
        [malformed],
        newer,
        Duration.zero,
        revision: 3,
      );
      expect(
        fence.sources.roleCurrent('ambient', newer, Duration.zero),
        isFalse,
      );
    },
  );
  test(
    'incomplete membership cannot prune original budgets or establish positive readiness',
    () {
      final fence = VirtualThermostatEvidenceFence();
      final member = claim('one', 'heating', 'reserved');
      final branch = {'claim': 'one', 'protection': protection(t, 20)};
      accept(
        fence,
        [source('ambient', 'a')],
        [input('ambient', 'a', t)],
        t,
        Duration.zero,
        claims: [member],
        branches: [branch],
      );
      fence.accept(
        {
          'revision': 2,
          'actuators': ['unknown'],
          'sources': [
            {'id': 'unknown', 'role': 'unknown'},
          ],
        },
        {'configuration_revision': 2, 'branches': [], 'inputs': []},
        t,
        Duration.zero,
      );
      expect(fence.members.untracked, isTrue);
      expect(fence.members.overflow, isFalse);
      expect(fence.members.recordCount, 1);
      expect(fence.sources.recordCount, 1);
      final rolledWall = t.add(const Duration(seconds: 1));
      accept(
        fence,
        [source('ambient', 'a')],
        [input('ambient', 'a', t)],
        rolledWall,
        const Duration(seconds: 3),
        revision: 3,
        claims: [member],
        branches: [branch],
      );
      expect(
        fence.members.expiredClaims(
          [VirtualThermostatMember(member, branch)],
          Duration.zero,
          rolledWall,
          clock: const Duration(seconds: 3),
        ),
        contains('one'),
      );
      expect(
        fence.sources.roleCurrent(
          'ambient',
          rolledWall,
          const Duration(seconds: 3),
        ),
        isFalse,
      );
    },
  );
}
