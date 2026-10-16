import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/virtual_thermostat_members.dart';
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
  String claimId = 'one',
}) => {
  'claim': claimId,
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

Map<String, dynamic> coolingBinding({
  String dew = 'retained-dew',
  String surface = 'retained-surface',
  int revision = 1,
}) => {
  'schema_version': 1,
  'revision': revision,
  'purpose': 'cooled_surface',
  'dew_point_property': dew,
  'surface_property': surface,
  'dew_point_identity': dew,
  'surface_identity': surface,
  'maximum_age_seconds': 30,
};
Map<String, dynamic> coolingObservation(
  DateTime at, {
  String dew = 'retained-dew',
  String surface = 'retained-surface',
}) => {
  'claim': 'one',
  'dew_point_identity': dew,
  'surface_identity': surface,
  'dew_point': 9.25,
  'surface': 18.0,
  'threshold': 11.25,
  'latched': true,
  'ready': false,
  'expires_at': at.add(const Duration(seconds: 2)).toIso8601String(),
  'reasons': [
    'cooling_remote_profile_installation_unqualified',
    'cooling_pending_release',
  ],
};

void main() {
  coolingHttpAdmissionRegressions();
  deadlineFenceTests();
  membershipAndIdentityRegressions();
  activityHttpAdmissionRegressions();
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
      VirtualThermostatMember sample(DateTime time) =>
          VirtualThermostatMember(claim('one', 'heating', 'reserved'), {
            'physical_identity': 'canonical-one',
            'protection': protection(time, 0),
          });
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
                    'configuration_revision': 1,
                    'requested_mode': 'heat',
                    'heating_setpoint': 21,
                    'branches': [
                      {
                        'claim': 'one',
                        'physical_identity': 'canonical-one',
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
            'physical_identity': 'canonical-h1',
            'role': 'heating',
            ...activityObservation(
              now.subtract(Duration(seconds: 4 - rev)),
              rev == 1 ? 'off' : 'on',
            ),
            'pending_on': false,
            'release_pending': false,
            'release_attempts': 0,
            'release_proven': true,
            'protection': protection(now, 0, claimId: 'h1'),
          },
          {
            'claim': 'h2',
            'physical_identity': 'canonical-h2',
            'role': 'heating',
            'activity': 'unknown',
            'pending_on': true,
            'release_pending': true,
            'fault': 'actuator_missing',
            'protection': protection(now, 35, stale: true, claimId: 'h2'),
          },
          {
            'claim': 'c1',
            'physical_identity': 'canonical-c1',
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
            'protection': {
              ...sample(time, temperature, maximumAge: maximumAge),
              'claim': 'retained',
            },
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
            'physical_identity': 'canonical-one',
            ...observation,
          });
      final first = activityObservation(
        now,
        'on',
        lifetime: const Duration(seconds: 2),
      );
      fence.accept([member(first)], now, Duration.zero);
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
      fence.accept(
        [member(next)],
        now.add(const Duration(seconds: 1)),
        const Duration(seconds: 4),
      );
      expect(
        fence.unavailableClaims(
          [member(next)],
          now.add(const Duration(seconds: 1)),
          const Duration(seconds: 4),
        ),
        isEmpty,
      );
      fence.accept(
        [
          member({'activity': 'unknown'}),
        ],
        now,
        const Duration(seconds: 4),
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
      fence.accept([member(first)], now, Duration.zero);
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

  for (final omittedRole in ['ambient', 'floor']) {
    for (final shape in ['missing', 'null', 'non-list', 'opaque', 'orphan']) {
      testWidgets(
        'accepted configured $shape omitting $omittedRole cannot revive same S before original deadline',
        (tester) async {
          final externalClock = Stopwatch()..start();
          final fixture = MemberDetailFixture()
            ..hasMember = false
            ..ambientTemperature = 19.5
            ..floorTemperature = 22;
          fixture.inputs.single['maximum_age_seconds'] = 2;
          final ambient = fixture.sources.single,
              ambientInput = fixture.inputs.single;
          fixture.sources.add({
            ...ambient,
            'id': 'floor',
            'role': 'floor',
            'source_identity': 'floor',
            'source_property': 'floor-property',
          });
          fixture.inputs.add({
            ...ambientInput,
            'binding': 'floor',
            'role': 'floor',
            'source_property': 'floor-property',
          });
          final declared = fixture.sources.toList(),
              readings = fixture.inputs.toList();
          await fixture.mount(
            tester,
          ); // Accepted initial budget; display clock100ms.
          expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
          expect(find.text('Floor: 22.0 °C'), findsOneWidget);
          final partial = shape == 'opaque' || shape == 'orphan';
          final survivors = declared
              .where((row) => row['role'] != omittedRole)
              .toList();
          fixture.overrideSourceArrays = true;
          fixture.omitSources = shape == 'missing';
          fixture.configuredSources = shape == 'missing' || shape == 'null'
              ? null
              : shape == 'non-list'
              ? {'opaque': true}
              : [
                  ...survivors,
                  shape == 'opaque'
                      ? 'opaque'
                      : {
                          'id': 'orphan',
                          'role': 'contact',
                          'source_identity': 'orphan',
                        },
                ];
          fixture.runtimeInputs = partial
              ? readings.where((row) => row['role'] != omittedRole).toList()
              : readings;
          await fixture.acceptBeforeFrame(
            tester,
          ); // Gap at100ms, before any frame.
          await tester.pump(const Duration(milliseconds: 100));
          expect(find.text('Controller readiness: ready'), findsNothing);
          if (partial) {
            expect(
              find.text(
                omittedRole == 'ambient'
                    ? 'Floor: 22.0 °C'
                    : 'Ambient: 19.5 °C',
              ),
              findsOneWidget,
            );
          }
          fixture.overrideSourceArrays = false;
          fixture.omitSources = false;
          await fixture.acceptBeforeFrame(
            tester,
          ); // Cached same S at200ms, not expired.
          await tester.pump();
          expect(
            find.text(
              omittedRole == 'ambient' ? 'Ambient: 19.5 °C' : 'Floor: 22.0 °C',
            ),
            findsNothing,
          );
          expect(find.text('Controller readiness: ready'), findsNothing);
          if (partial) {
            expect(
              find.text(
                omittedRole == 'ambient'
                    ? 'Floor: 22.0 °C'
                    : 'Ambient: 19.5 °C',
              ),
              findsOneWidget,
            );
          }
          final newer = DateTime.now().toIso8601String();
          fixture.inputs = [
            for (final row in readings)
              if (!partial || row['role'] == omittedRole)
                {...row, 'sampled_at': newer}
              else
                row,
          ];
          await fixture.acceptBeforeFrame(tester);
          await tester.pump();
          expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
          expect(find.text('Floor: 22.0 °C'), findsOneWidget);
          expect(find.text('Controller readiness: ready'), findsOneWidget);
          final externalElapsed = externalClock.elapsed;
          externalClock.stop();
          const knownFakeElapsed = Duration(milliseconds: 200);
          final admissionUpperBound = externalElapsed > knownFakeElapsed
              ? externalElapsed
              : knownFakeElapsed;
          final advance = admissionUpperBound + const Duration(seconds: 3);
          final readsBeforeAdvance = fixture.runtimeReads;
          debugPrint(
            'MEASURED_EXPIRY role=$omittedRole shape=$shape external_us=${externalElapsed.inMicroseconds} fake_us=${knownFakeElapsed.inMicroseconds} upper_us=${admissionUpperBound.inMicroseconds} advance_us=${advance.inMicroseconds} runtime_before_advance=$readsBeforeAdvance',
          );
          await tester.pump(advance);
          final runtimeBeforeFresh = fixture.runtimeReads;
          final modeBeforeFresh = fixture.modeReads;
          await fixture.acceptBeforeFrame(tester);
          await tester.pump();
          debugPrint(
            'MEASURED_EXPIRY_GET role=$omittedRole shape=$shape runtime_before=$runtimeBeforeFresh runtime_after=${fixture.runtimeReads} mode_before=$modeBeforeFresh mode_after=${fixture.modeReads}',
          );
          expect(fixture.runtimeReads, runtimeBeforeFresh + 1);
          expect(fixture.modeReads, modeBeforeFresh + 1);
          expect(find.text('Ambient: 19.5 °C'), findsNothing);
          expect(find.text('Floor: 22.0 °C'), findsNothing);
          await fixture.dispose(tester);
        },
      );
    }
  }

  for (final known in [true, false]) {
    for (final malformed in <String, Object?>{
      'null': null,
      'empty': '',
      'non-string': 7,
    }.entries) {
      testWidgets(
        'legacy known=$known explicit identity ${malformed.key} refuses evidence with documented first-admission distinction',
        (tester) async {
          final fixture = MemberDetailFixture()
            ..hasMember = false
            ..ambientTemperature = 19.5;
          fixture.sources.single.remove('source_identity');
          fixture.inputs.single['maximum_age_seconds'] = 2;
          final declaration = fixture.sources.single,
              original = fixture.inputs.single;
          if (!known) {
            fixture.sources = [];
            fixture.inputs = [];
          }
          await fixture.mount(tester);
          expect(
            find.text('Ambient: 19.5 °C'),
            known ? findsOneWidget : findsNothing,
          );
          final invalidS = DateTime.now();
          expect(
            invalidS.isAfter(DateTime.parse(original['sampled_at'])),
            isTrue,
          );
          fixture.sources = [
            {...declaration, 'source_identity': malformed.value},
          ];
          fixture.inputs = [
            {...original, 'sampled_at': invalidS.toIso8601String()},
          ];
          await fixture.acceptBeforeFrame(tester);
          await tester.pump();
          expect(find.text('Ambient: 19.5 °C'), findsNothing);
          expect(find.text('Controller readiness: ready'), findsNothing);
          fixture.sources = [declaration];
          await fixture.acceptBeforeFrame(tester);
          await tester.pump();
          // Never-seen invalid candidates store no history. This is first admission;
          // the known record instead retains invalidS and cannot revive same S.
          expect(
            find.text('Ambient: 19.5 °C'),
            known ? findsNothing : findsOneWidget,
          );
          if (known) {
            final newer = DateTime.now();
            expect(newer.isAfter(invalidS), isTrue);
            fixture.inputs = [
              {...original, 'sampled_at': newer.toIso8601String()},
            ];
            await fixture.acceptBeforeFrame(tester);
            await tester.pump();
            expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
            expect(find.text('Controller readiness: ready'), findsOneWidget);
          }
          await fixture.dispose(tester);
        },
      );
    }
  }

  for (final field in ['configuration', 'runtime']) {
    for (final invalid in <String, Object?>{
      'missing': null,
      'null': null,
      'string': '100',
      'nan': double.nan,
      'infinite': double.infinity,
      'negative': -1,
      'fractional': 100.5,
    }.entries) {
      testWidgets(
        '$field revision ${invalid.key} refuses detail envelope without retry or renewal',
        (tester) async {
          final fixture = MemberDetailFixture()..hasMember = false;
          fixture.inputs.single['maximum_age_seconds'] = 2;
          final originalInputs = fixture.inputs.toList();
          await fixture.mount(tester);
          expect(find.text('Controller readiness: ready'), findsOneWidget);
          fixture.overrideRevisionEnvelope = true;
          fixture.envelopeConfigRevision = field == 'configuration'
              ? invalid.value
              : 100;
          fixture.envelopeRuntimeRevision = field == 'runtime'
              ? invalid.value
              : 100;
          fixture.omitConfigRevision =
              field == 'configuration' && invalid.key == 'missing';
          fixture.omitRuntimeRevision =
              field == 'runtime' && invalid.key == 'missing';
          fixture.overrideSourceArrays = true;
          fixture.configuredSources = [];
          fixture.runtimeInputs = [];
          await fixture.acceptBeforeFrame(tester);
          await tester.pump();
          expect(
            find.text('Controller readiness: Unavailable'),
            findsOneWidget,
          );
          final reads = fixture.runtimeReads;
          await tester.pump(const Duration(milliseconds: 200));
          expect(fixture.runtimeReads, reads);
          fixture.overrideRevisionEnvelope = false;
          fixture.omitConfigRevision = false;
          fixture.omitRuntimeRevision = false;
          fixture.overrideSourceArrays = false;
          // A rejected higher envelope cannot poison coherent revision 1.
          await fixture.acceptBeforeFrame(tester);
          await tester.pump();
          expect(find.text('Controller readiness: ready'), findsOneWidget);
          // Receipt of the same publication cannot extend its original 2s budget.
          await tester.pump(const Duration(seconds: 3));
          await fixture.acceptBeforeFrame(tester);
          await tester.pump();
          expect(
            find.text('Controller readiness: Unavailable'),
            findsOneWidget,
          );
          fixture.inputs = [
            {
              ...originalInputs.single,
              'sampled_at': DateTime.now().toIso8601String(),
            },
          ];
          await fixture.acceptBeforeFrame(tester);
          await tester.pump();
          expect(find.text('Controller readiness: ready'), findsOneWidget);
          await fixture.dispose(tester);
        },
      );
    }
  }

  testWidgets(
    'numeric revision mismatch including zero retries once and lower revision cannot replace known evidence',
    (tester) async {
      final fixture = MemberDetailFixture()..hasMember = false;
      await fixture.mount(tester);
      fixture.overrideRevisionEnvelope = true;
      fixture.envelopeConfigRevision = 1;
      fixture.envelopeRuntimeRevision = 0;
      await fixture.refetch(tester);
      final reads = fixture.runtimeReads;
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump();
      expect(fixture.runtimeReads, reads + 1);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 200));
      expect(fixture.runtimeReads, reads + 1);
      fixture.envelopeConfigRevision = 0;
      await fixture.acceptBeforeFrame(tester);
      await tester.pump();
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      fixture.overrideRevisionEnvelope = false;
      await fixture.acceptBeforeFrame(tester);
      await tester.pump();
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );

  testWidgets(
    'rejected revision envelope cannot withdraw accepted relay activity',
    (tester) async {
      final now = DateTime.now().subtract(const Duration(seconds: 1));
      final original = activityObservation(now, 'off');
      final fixture = MemberDetailFixture()
        ..declaresMemberProtection = false
        ..observation = original;
      await fixture.mount(tester);
      expect(find.text('Reported observation: off'), findsOneWidget);
      fixture.overrideRevisionEnvelope = true;
      fixture.envelopeConfigRevision = 100;
      fixture.envelopeRuntimeRevision = null;
      fixture.observation = activityObservation(DateTime.now(), 'invalid');
      await fixture.acceptBeforeFrame(tester);
      await tester.pump();
      expect(find.text('Reported observation: off'), findsNothing);
      fixture.overrideRevisionEnvelope = false;
      fixture.observation = original;
      await fixture.acceptBeforeFrame(tester);
      await tester.pump();
      expect(find.text('Reported observation: off'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );

  for (final rejection in ['envelope', 'http-failure']) {
    testWidgets(
      'null runtime after $rejection preserves original member and relay budgets',
      (tester) async {
        final original = DateTime.now().subtract(
          const Duration(milliseconds: 10),
        );
        final fixture = MemberDetailFixture()
          ..displayFloorClaim = 'one'
          ..sample = protection(original, 20)
          ..observation = activityObservation(
            original,
            'off',
            lifetime: const Duration(seconds: 2),
          );
        await fixture.mount(tester);
        void expectPositive() {
          expect(find.text('Live protection reading: 20.0 °C'), findsOneWidget);
          expect(
            find.text(
              'Selected member floor (not an average): canonical-one: 20.0 °C',
            ),
            findsOneWidget,
          );
          expect(find.text('Reported observation: off'), findsOneWidget);
          expect(
            find.text('Server guard/target check (snapshot): true'),
            findsOneWidget,
          );
          expect(find.text('Controller readiness: ready'), findsOneWidget);
        }

        expectPositive();
        fixture.overrideRevisionEnvelope = rejection == 'envelope';
        fixture.envelopeConfigRevision = 100;
        fixture.envelopeRuntimeRevision = null;
        fixture.failRuntimeReads = rejection == 'http-failure';
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(find.text('Live protection reading: 20.0 °C'), findsNothing);
        expect(
          find.text(
            'Selected member floor (not an average): canonical-one: 20.0 °C',
          ),
          findsNothing,
        );
        expect(find.text('Reported observation: off'), findsNothing);
        expect(
          find.text('Server guard/target check (snapshot): true'),
          findsNothing,
        );
        expect(find.text('Controller readiness: ready'), findsNothing);
        fixture.overrideRevisionEnvelope = false;
        fixture.failRuntimeReads = false;
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expectPositive();
        // The same sample cannot acquire a new budget after null runtime/recovery.
        await tester.pump(const Duration(seconds: 3));
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(
          find.text('Live protection reading: Unavailable'),
          findsOneWidget,
        );
        expect(
          find.text(
            'Selected member floor (not an average): canonical-one: 20.0 °C',
          ),
          findsNothing,
        );
        expect(find.text('Reported observation: Unavailable'), findsOneWidget);
        expect(find.text('Controller readiness: ready'), findsNothing);
        await fixture.dispose(tester);
      },
    );
  }

  for (final omission in ['missing-branch', 'invalid-fields']) {
    testWidgets(
      'coherent $omission still withdraws member and relay before rendering',
      (tester) async {
        final original = DateTime.now().subtract(
          const Duration(milliseconds: 10),
        );
        final sample = protection(original, 20);
        final branch = <String, dynamic>{
          'claim': 'one',
          'role': 'heating',
          'physical_identity': 'canonical-one',
          ...activityObservation(original, 'off'),
          'protection': sample,
        };
        final fixture = MemberDetailFixture()..overrideMembership = true;
        fixture.configuredMembership = [claim('one', 'heating', 'reserved')];
        fixture.runtimeMembership = [branch];
        await fixture.mount(tester);
        expect(find.text('Live protection reading: 20.0 °C'), findsOneWidget);
        expect(find.text('Reported observation: off'), findsOneWidget);
        final invalid = {...branch}..remove('activity_expires_at');
        invalid['protection'] = {...sample}..remove('expires_at');
        fixture.runtimeMembership = omission == 'missing-branch'
            ? []
            : [invalid];
        await fixture.acceptBeforeFrame(tester);
        fixture.runtimeMembership = [branch];
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(
          find.text('Live protection reading: Unavailable'),
          findsOneWidget,
        );
        expect(find.text('Reported observation: Unavailable'), findsOneWidget);
        final newer = DateTime.now();
        expect(newer.isAfter(original), isTrue);
        fixture.runtimeMembership = [
          {
            ...branch,
            ...activityObservation(newer, 'off'),
            'protection': {...sample, 'sampled_at': newer.toIso8601String()},
          },
        ];
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(find.text('Live protection reading: 20.0 °C'), findsOneWidget);
        expect(find.text('Reported observation: off'), findsOneWidget);
        await fixture.dispose(tester);
      },
    );
  }

  for (final array in ['sources', 'inputs']) {
    for (final shape in [
      'missing',
      'null',
      'non-list',
      'opaque',
      'duplicate',
      'orphan',
    ]) {
      testWidgets('raw $array $shape cannot certify detail readiness', (
        tester,
      ) async {
        final fixture = MemberDetailFixture()
          ..hasMember = false
          ..ambientTemperature = 19.5
          ..floorTemperature = 22;
        final ambient = fixture.sources.single;
        final ambientInput = fixture.inputs.single;
        fixture.sources.add({
          ...ambient,
          'id': 'floor',
          'role': 'floor',
          'source_identity': 'floor',
          'source_property': 'floor-property',
        });
        fixture.inputs.add({
          ...ambientInput,
          'binding': 'floor',
          'role': 'floor',
          'source_property': 'floor-property',
        });
        final goodSources = fixture.sources.toList();
        final goodInputs = fixture.inputs.toList();
        await fixture.mount(tester);
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        Object? malformed(List<Map<String, dynamic>> rows) => switch (shape) {
          'missing' || 'null' => null,
          'non-list' => {'opaque': true},
          'opaque' => [...rows, 'opaque'],
          'duplicate' => [...rows, rows.first],
          _ => [
            ...rows,
            array == 'sources'
                ? {
                    'id': 'orphan',
                    'role': 'contact',
                    'source_identity': 'orphan',
                  }
                : {'binding': 'orphan', 'role': 'contact'},
          ],
        };
        fixture.overrideSourceArrays = true;
        fixture.configuredSources = array == 'sources'
            ? malformed(goodSources)
            : goodSources;
        fixture.runtimeInputs = array == 'inputs'
            ? malformed(goodInputs)
            : goodInputs;
        fixture.omitSources = array == 'sources' && shape == 'missing';
        fixture.omitInputs = array == 'inputs' && shape == 'missing';
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(find.text('Controller readiness: ready'), findsNothing);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        // Unrelated opaque/orphan rows cannot invalidate independently joined readings.
        if (shape == 'opaque' || shape == 'orphan') {
          expect(find.text('Ambient: 19.5 °C'), findsOneWidget);
          expect(find.text('Floor: 22.0 °C'), findsOneWidget);
        }
        fixture.overrideSourceArrays = false;
        fixture.omitSources = false;
        fixture.omitInputs = false;
        // Duplicate/missing diagnostics withdraw affected records. Recovery is a
        // genuinely newer qualified publication, never a new receipt identity.
        final recovered = DateTime.now().toIso8601String();
        fixture.inputs = [
          for (final row in goodInputs) {...row, 'sampled_at': recovered},
        ];
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        await fixture.dispose(tester);
      });
    }
  }

  testWidgets(
    'legitimate empty runtime inputs with declared ambient withhold detail readiness',
    (tester) async {
      final fixture = MemberDetailFixture()..hasMember = false;
      final reading = fixture.inputs.single;
      await fixture.mount(tester);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      fixture.inputs = [];
      await fixture.acceptBeforeFrame(tester);
      await tester.pump();
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      fixture.inputs = [reading];
      await fixture.acceptBeforeFrame(tester);
      await tester.pump();
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      fixture.inputs = [
        {...reading, 'sampled_at': DateTime.now().toIso8601String()},
      ];
      await fixture.acceptBeforeFrame(tester);
      await tester.pump();
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );

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
  testWidgets(
    'cooling blockers and retained dependencies remain separate from requested mode and actual activity, and values expire inline',
    (tester) async {
      final now = DateTime.utc(2026, 10, 16, 10);
      final config = {
        'requested_mode': 'cool',
        'actuators': [
          {
            ...claim('cooling', 'cooling', 'reserved'),
            'revision': 1,
            'cooling_protection': coolingBinding(),
          },
        ],
      };
      final runtime = {
        'requested_mode': 'cool',
        'branches': [
          {
            'claim': 'cooling',
            'physical_identity': 'canonical-cooling',
            'role': 'cooling',
            'claim_state': 'reserved',
            ...activityObservation(now, 'off', qualification: false),
            'cooling_protection': {
              'claim': 'cooling',
              'dew_point_identity': 'retained-dew',
              'surface_identity': 'retained-surface',
              'dew_point': 9.25,
              'surface': 18.0,
              'threshold': 11.25,
              'latched': true,
              'ready': false,
              'expires_at': now
                  .add(const Duration(seconds: 2))
                  .toIso8601String(),
              'reasons': [
                'cooling_remote_profile_installation_unqualified',
                'cooling_pending_release',
              ],
            },
          },
        ],
      };
      final fence = VirtualThermostatCoolingFence();
      var displayClock = Duration.zero;
      Future<void> display(DateTime at, {bool current = true}) =>
          tester.pumpWidget(
            MaterialApp(
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              home: Scaffold(
                body: SingleChildScrollView(
                  child: VirtualThermostatMembers(
                    configuration: config,
                    runtime: runtime,
                    elapsed: displayClock,
                    now: at,
                    current: current,
                    freshCoolingClaims: fence.freshClaims(
                      VirtualThermostatMember.read(config, runtime),
                      at,
                      displayClock,
                    ),
                  ),
                ),
              ),
            ),
          );
      fence.accept(config, runtime, now, Duration.zero);
      await display(now);
      await tester.pump();
      expect(find.textContaining('retained-dew'), findsOneWidget);
      expect(find.textContaining('retained-surface'), findsOneWidget);
      expect(
        find.textContaining('cooling_remote_profile_installation_unqualified'),
        findsOneWidget,
      );
      expect(find.textContaining('cooling_pending_release'), findsOneWidget);
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      expect(
        find.textContaining('Cooled-surface temperature (°C): 18.0'),
        findsOneWidget,
      );
      expect(find.text('Controller requested mode: cool'), findsOneWidget);
      expect(find.text('Reported observation: off'), findsOneWidget);
      expect(find.text('Server protection readiness: false'), findsOneWidget);
      displayClock = const Duration(seconds: 2);
      await display(now.add(const Duration(seconds: 2)));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      expect(find.textContaining('retained-dew'), findsOneWidget);
      displayClock = const Duration(seconds: 3);
      await display(
        now,
      ); // Wall-clock rollback cannot revive the expired display budget.
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      await display(now, current: false);
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'actual detail shows cooling without a floor probe, fences identical cached refetch and recovers only a new original expiry',
    (tester) async {
      final now = DateTime.now();
      final f = MemberDetailFixture();
      f.role = 'cooling';
      f.configurationRevision = 1;
      f.cooling = coolingObservation(now);
      f.observation = activityObservation(now, 'off', qualification: false);
      f.sample = null;
      await f.mount(tester);
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      expect(find.text('Controller requested mode: cool'), findsOneWidget);
      expect(find.text('Reported observation: off'), findsOneWidget);
      expect(
        find.textContaining('cooling_remote_profile_installation_unqualified'),
        findsOneWidget,
      );
      await tester.pump(const Duration(seconds: 3));
      expect(find.text('Dew point: 9.25'), findsNothing);
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(
        find.text('Dew point: 9.25'),
        findsNothing,
      ); // Fetch time does not renew the identical original expiry.
      f.cooling = coolingObservation(now.add(const Duration(seconds: 5)));
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      f.cooling = coolingObservation(
        now.add(const Duration(seconds: 1)),
      ); // Older original evidence in a newer HTTP response.
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      f.cooling = coolingObservation(now.add(const Duration(seconds: 6)));
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      // Both sources are mandatory, even when the other original reading is still present.
      f.cooling = {
        ...f.cooling!,
        'surface': null,
        'expires_at': null,
        'reasons': ['cooling_lineage_quality_or_age'],
      };
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      expect(
        find.textContaining('cooling_lineage_quality_or_age'),
        findsOneWidget,
      );
      await f.dispose(tester);
    },
  );
  testWidgets(
    'actual detail withdraws cooling on source rebind, missing dependency, removal and stale configuration response',
    (tester) async {
      final now = DateTime.now();
      final f = MemberDetailFixture();
      f.role = 'cooling';
      f.configurationRevision = 1;
      f.cooling = coolingObservation(now);
      await f.mount(tester);
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      f.configurationRevision = 2;
      f.cooling = {...f.cooling!, 'dew_point_identity': 'rebound-dew'};
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      expect(find.textContaining('rebound-dew'), findsOneWidget);
      f.cooling = coolingObservation(
        now.add(const Duration(seconds: 5)),
        dew: 'rebound-dew',
      );
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      f.missingCoolingSurface = true;
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      f.missingCoolingSurface = false;
      f.cooling = coolingObservation(
        now.add(const Duration(seconds: 6)),
        dew: 'rebound-dew',
      );
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      f.runtimeConfigurationRevision = 1;
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      f.runtimeConfigurationRevision = null;
      f.cooling = coolingObservation(
        now.add(const Duration(seconds: 7)),
        dew: 'rebound-dew',
      );
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      f.claimId = 'replacement-claim';
      f.configurationRevision = 3;
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      f.cooling = {
        ...coolingObservation(
          now.add(const Duration(seconds: 8)),
          dew: 'rebound-dew',
        ),
        'claim': 'replacement-claim',
      };
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      f.hasMember = false;
      f.configurationRevision = 4;
      f.revision++;
      f.socket.hint(f.revision);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      await f.dispose(tester);
    },
  );
  test(
    'cooling fence binds original expiry, accepted source/claim revisions and monotonic budget across cached responses and clock rollback',
    () {
      final now = DateTime.utc(2026, 10, 16, 10);
      final fence = VirtualThermostatCoolingFence();
      Map<String, dynamic> c = {
        ...claim('one', 'cooling', 'reserved'),
        'revision': 1,
        'cooling_protection': coolingBinding(),
      };
      Map<String, dynamic> d = {
        'claim': 'one',
        'physical_identity': 'canonical-one',
        'role': 'cooling',
        'cooling_protection': coolingObservation(now),
      };
      List<VirtualThermostatMember> members() => [
        VirtualThermostatMember(c, d),
      ];
      Set<String> acceptedClaims(
        List<VirtualThermostatMember> rows,
        DateTime at,
        Duration clock,
      ) {
        fence.accept({'actuators': [c]}, {'branches': [d]}, at, clock);
        return fence.freshClaims(rows, at, clock);
      }
      expect(acceptedClaims(members(), now, Duration.zero), {'one'});
      expect(
        acceptedClaims(
          members(),
          now.subtract(const Duration(seconds: 10)),
          const Duration(seconds: 3),
        ),
        isEmpty,
      );
      expect(
        acceptedClaims(members(), now, const Duration(seconds: 3)),
        isEmpty,
      ); // Identical fetch cannot revive.
      d = {
        ...d,
        'cooling_protection': coolingObservation(
          now.add(const Duration(seconds: 5)),
        ),
      };
      expect(acceptedClaims(members(), now, const Duration(seconds: 3)), {
        'one',
      });
      c = {...c, 'revision': 2};
      expect(
        acceptedClaims(members(), now, const Duration(seconds: 3)),
        isEmpty,
      );
      d = {
        ...d,
        'cooling_protection': coolingObservation(
          now.add(const Duration(seconds: 6)),
        ),
      };
      expect(acceptedClaims(members(), now, const Duration(seconds: 3)), {
        'one',
      });
      final binding = c['cooling_protection'] as Map;
      c = {
        ...c,
        'cooling_protection': {...binding, 'surface_property': null},
      };
      expect(
        acceptedClaims(members(), now, const Duration(seconds: 3)),
        isEmpty,
      );
      c = {...c, 'cooling_protection': binding};
      expect(
        acceptedClaims(members(), now, const Duration(seconds: 3)),
        isEmpty,
      );
      d = {
        ...d,
        'cooling_protection': coolingObservation(
          now.add(const Duration(seconds: 7)),
        ),
      };
      expect(acceptedClaims(members(), now, const Duration(seconds: 3)), {
        'one',
      });
      d = {
        ...d,
        'cooling_protection': coolingObservation(
          now.add(const Duration(seconds: 4)),
        ),
      };
      expect(
        acceptedClaims(members(), now, const Duration(seconds: 3)),
        isEmpty,
      );
    },
  );
  for (final source in ['dew_point', 'surface']) {
    testWidgets(
      'actual cooling detail refuses missing mandatory $source and does not revive a cached report after its gap',
      (tester) async {
        final now = DateTime.now();
        final f = MemberDetailFixture();
        f.role = 'cooling';
        f.configurationRevision = 1;
        f.cooling = {...coolingObservation(now), source: null};
        await f.mount(tester);
        expect(find.text('Dew point: 9.25'), findsNothing);
        f.cooling = coolingObservation(now.add(const Duration(seconds: 5)));
        f.revision++;
        f.socket.hint(f.revision);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pump();
        expect(find.text('Dew point: 9.25'), findsOneWidget);
        f.cooling = {...f.cooling!, source: null};
        f.revision++;
        f.socket.hint(f.revision);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pump();
        expect(find.text('Dew point: 9.25'), findsNothing);
        f.cooling = coolingObservation(now.add(const Duration(seconds: 5)));
        f.revision++;
        f.socket.hint(f.revision);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pump();
        expect(find.text('Dew point: 9.25'), findsNothing);
        f.cooling = coolingObservation(now.add(const Duration(seconds: 6)));
        f.revision++;
        f.socket.hint(f.revision);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 250));
        await tester.pump();
        expect(find.text('Dew point: 9.25'), findsOneWidget);
        await f.dispose(tester);
      },
    );
  }
}

/// HTTP and socket fixture for the real detail lifecycle, including held reads.
class MemberDetailFixture {
  final socket = MemberSocket();
  final dio = Dio(BaseOptions(baseUrl: 'http://localhost'));
  final held = <void Function()>[];
  int revision = 1;
  int modeReads = 0, runtimeReads = 0;
  int? configurationRevision;
  int? runtimeConfigurationRevision;
  bool missingCoolingSurface = false;
  String claimId = 'one';
  bool overrideRevisionEnvelope = false,
      omitConfigRevision = false,
      omitRuntimeRevision = false;
  Object? envelopeConfigRevision, envelopeRuntimeRevision;
  bool hold = false, hasMember = true, declaresMemberProtection = true;
  bool failRuntimeReads = false;
  bool overrideMembership = false;
  Object? configuredMembership, runtimeMembership;
  bool overrideSourceArrays = false, omitSources = false, omitInputs = false;
  Object? configuredSources, runtimeInputs;
  double? ambientTemperature, floorTemperature;
  List<Map<String, dynamic>> sources = [], inputs = [], extraBranches = [];
  String? displayFloorClaim;
  String role = 'heating';
  Map<String, dynamic>? cooling;
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
          if (options.path.endsWith('/runtime')) {
            runtimeReads++;
          } else if (!options.path.endsWith('/comfort')) {
            modeReads++;
          }
          if (failRuntimeReads && !options.path.endsWith('/comfort')) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
                message: 'deliberate read failure',
              ),
            );
            return;
          }
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
                  if (!omitRuntimeRevision)
                    'configuration_revision': overrideRevisionEnvelope
                        ? envelopeRuntimeRevision
                        : runtimeConfigurationRevision ??
                              configurationRevision ??
                              revision,
                  'requested_mode': role == 'cooling' ? 'cool' : 'heat',
                  'readiness': cooling != null ? 'unavailable' : 'ready',
                  'reasons': <String>[],
                  if (!omitInputs)
                    'inputs': overrideSourceArrays ? runtimeInputs : inputs,
                  if (ambientTemperature != null)
                    'current_temperature': ambientTemperature,
                  if (floorTemperature != null)
                    'floor_temperature': floorTemperature,
                  'branches': overrideMembership
                      ? runtimeMembership
                      : [
                          ...extraBranches,
                          if (hasMember)
                            {
                              'claim': claimId,
                              'physical_identity': 'canonical-$claimId',
                              'role': role,
                              'activity': 'off',
                              ...observation,
                              'protection': sample,
                              'cooling_protection': cooling,
                            },
                        ],
                }
              : {
                  if (!omitConfigRevision)
                    'revision': overrideRevisionEnvelope
                        ? envelopeConfigRevision
                        : configurationRevision ?? revision,
                  'locked': false,
                  'policy': {
                    'heatingSetpoint': role == 'heating' ? 21 : null,
                    'coolingSetpoint': role == 'cooling' ? 25 : null,
                  },
                  'settings': <Map>[],
                  if (!omitSources)
                    'sources': overrideSourceArrays
                        ? configuredSources
                        : sources,
                  'display_floor_claim': displayFloorClaim,
                  'actuators': overrideMembership
                      ? configuredMembership
                      : [
                          if (hasMember)
                            {
                              ...claim(claimId, role, 'reserved'),
                              'revision': configurationRevision ?? revision,
                              if (role == 'cooling')
                                'cooling_protection': {
                                  ...coolingBinding(
                                    dew:
                                        cooling?['dew_point_identity'] as String? ??
                                        'retained-dew',
                                    surface:
                                        cooling?['surface_identity'] as String? ??
                                        'retained-surface',
                                    revision: configurationRevision ?? revision,
                                  ),
                                  if (missingCoolingSurface) 'surface_property': null,
                                },
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

  Future<void> acceptBeforeFrame(WidgetTester tester) async {
    await tester.runAsync(
      () => tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh(),
    );
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

  for (final omittedRole in ['ambient', 'floor']) {
    for (final shape in ['missing', 'null', 'non-list', 'opaque', 'orphan']) {
      test(
        'accepted configured $shape omitting $omittedRole withdraws original S at100ms not merely expiry',
        () {
          final fence = VirtualThermostatEvidenceFence();
          final declared = [
            source('ambient', 'a', 'ambient'),
            source('floor', 'f', 'floor'),
          ];
          final readings = [input('ambient', 'a', t), input('floor', 'f', t)];
          accept(fence, declared, readings, t, Duration.zero);
          final partial = shape == 'opaque' || shape == 'orphan';
          final surviving = declared
              .where((row) => row['role'] != omittedRole)
              .toList();
          final config = <String, dynamic>{
            'revision': 1,
            'actuators': [],
            if (shape != 'missing')
              'sources': shape == 'null'
                  ? null
                  : shape == 'non-list'
                  ? 'opaque'
                  : [
                      ...surviving,
                      shape == 'opaque'
                          ? 'opaque'
                          : source('contact', 'orphan', 'orphan'),
                    ],
          };
          fence.accept(
            config,
            {
              'configuration_revision': 1,
              'branches': [],
              'inputs': partial
                  ? readings.where((row) => row['role'] != omittedRole).toList()
                  : readings,
            },
            t.add(const Duration(milliseconds: 100)),
            const Duration(milliseconds: 100),
          );
          expect(fence.sources.recordCount, 2);
          expect(fence.sources.aliasCount, 2);
          expect(fence.sources.legacyFallbackClosed, isFalse);
          final survivorRole = omittedRole == 'ambient' ? 'floor' : 'ambient';
          if (partial) {
            expect(
              fence.sources.roleCurrent(
                survivorRole,
                t.add(const Duration(milliseconds: 100)),
                const Duration(milliseconds: 100),
              ),
              isTrue,
            );
          }
          final restoredAt = t.add(const Duration(milliseconds: 200));
          accept(
            fence,
            declared,
            readings,
            restoredAt,
            const Duration(milliseconds: 200),
          );
          expect(
            fence.sources.roleCurrent(
              omittedRole,
              restoredAt,
              const Duration(milliseconds: 200),
            ),
            isFalse,
          );
          expect(
            fence.sources.allCurrent(
              restoredAt,
              const Duration(milliseconds: 200),
            ),
            isFalse,
          );
          if (partial) {
            expect(
              fence.sources.roleCurrent(
                survivorRole,
                restoredAt,
                const Duration(milliseconds: 200),
              ),
              isTrue,
            );
          }
          final newer = t.add(const Duration(milliseconds: 201));
          final recovered = [
            for (final row in readings)
              if (!partial || row['role'] == omittedRole)
                {...row, 'sampled_at': newer.toIso8601String()}
              else
                row,
          ];
          accept(
            fence,
            declared,
            recovered,
            newer,
            const Duration(milliseconds: 201),
          );
          expect(
            fence.sources.allCurrent(newer, const Duration(milliseconds: 201)),
            isTrue,
          );
          expect(
            fence.sources.allCurrent(
              t.add(const Duration(seconds: 2)),
              const Duration(seconds: 2),
            ),
            isFalse,
          );
        },
      );
    }
  }

  for (final reverse in [false, true]) {
    for (final extra in ['opaque', 'orphan']) {
      test(
        'shared canonical aliases preserve represented record reverse=$reverse extra=$extra but cannot borrow context',
        () {
          final fence = VirtualThermostatEvidenceFence();
          final a = source('contact', 'a', 'shared'),
              b = source('contact', 'b', 'shared');
          accept(fence, [a], [input('contact', 'a', t)], t, Duration.zero);
          final newerB = t.add(const Duration(milliseconds: 10));
          void incomplete(Map row, DateTime stamp, int milliseconds) {
            final Object opaque = extra == 'opaque'
                ? 'opaque'
                : source('ambient', 'orphan', 'orphan');
            fence.accept(
              {
                'revision': 1,
                'actuators': [],
                'sources': reverse ? [opaque, row] : [row, opaque],
              },
              {
                'configuration_revision': 1,
                'branches': [],
                'inputs': [input('contact', row['id'], stamp)],
              },
              t.add(Duration(milliseconds: milliseconds)),
              Duration(milliseconds: milliseconds),
            );
          }

          incomplete(b, newerB, 10);
          expect(fence.sources.aliasCount, 2);
          expect(fence.sources.recordCount, 1);
          incomplete(b, newerB, 100);
          expect(
            fence.sources.roleCurrent(
              'contact',
              t.add(const Duration(milliseconds: 100)),
              const Duration(milliseconds: 100),
            ),
            isTrue,
          );
          incomplete(a, newerB, 200);
          expect(
            fence.sources.roleCurrent(
              'contact',
              t.add(const Duration(milliseconds: 200)),
              const Duration(milliseconds: 200),
            ),
            isFalse,
          );
          final recovered = t.add(const Duration(milliseconds: 300));
          incomplete(a, recovered, 300);
          expect(
            fence.sources.roleCurrent(
              'contact',
              recovered,
              const Duration(milliseconds: 300),
            ),
            isTrue,
          );
          final invalidS = t.add(const Duration(milliseconds: 400));
          final duplicateRows = reverse ? [b, a] : [a, b];
          accept(
            fence,
            duplicateRows,
            [
              for (final row in duplicateRows)
                input('contact', row['id'], invalidS),
            ],
            invalidS,
            const Duration(milliseconds: 400),
          );
          expect(
            fence.sources.roleCurrent(
              'contact',
              invalidS,
              const Duration(milliseconds: 400),
            ),
            isFalse,
          );
          incomplete(a, invalidS, 400);
          expect(
            fence.sources.roleCurrent(
              'contact',
              invalidS,
              const Duration(milliseconds: 400),
            ),
            isFalse,
          );
          final finalS = t.add(const Duration(milliseconds: 500));
          incomplete(a, finalS, 500);
          expect(
            fence.sources.roleCurrent(
              'contact',
              finalS,
              const Duration(milliseconds: 500),
            ),
            isTrue,
          );
          expect(
            fence.sources.roleCurrent(
              'contact',
              finalS,
              const Duration(milliseconds: 2500),
            ),
            isFalse,
          );
        },
      );
    }
  }

  for (final known in [true, false]) {
    for (final malformed in <String, Object?>{
      'null': null,
      'empty': '',
      'non-string': 7,
    }.entries) {
      test(
        'legacy known=$known explicit identity ${malformed.key} preserves existing no-allocation versus sticky-record policy',
        () {
          final fence = VirtualThermostatEvidenceFence();
          final declaration = source('ambient', 'legacy', null);
          if (known) {
            accept(
              fence,
              [declaration],
              [input('ambient', 'legacy', t)],
              t,
              Duration.zero,
            );
            expect(
              fence.sources.roleCurrent('ambient', t, Duration.zero),
              isTrue,
            );
          }
          final invalidS = t.add(const Duration(milliseconds: 100));
          accept(
            fence,
            [
              {...declaration, 'source_identity': malformed.value},
            ],
            [input('ambient', 'legacy', invalidS)],
            invalidS,
            const Duration(milliseconds: 100),
          );
          expect(
            fence.sources.roleCurrent(
              'ambient',
              invalidS,
              const Duration(milliseconds: 100),
            ),
            isFalse,
          );
          expect(fence.sources.recordCount, known ? 1 : 0);
          expect(fence.sources.aliasCount, known ? 1 : 0);
          expect(fence.sources.legacyFallbackClosed, isFalse);
          accept(
            fence,
            [declaration],
            [input('ambient', 'legacy', invalidS)],
            invalidS,
            const Duration(milliseconds: 200),
          );
          expect(
            fence.sources.roleCurrent(
              'ambient',
              invalidS,
              const Duration(milliseconds: 200),
            ),
            known ? isFalse : isTrue,
          );
          if (known) {
            final newer = t.add(const Duration(milliseconds: 201));
            accept(
              fence,
              [declaration],
              [input('ambient', 'legacy', newer)],
              newer,
              const Duration(milliseconds: 201),
            );
            expect(
              fence.sources.roleCurrent(
                'ambient',
                newer,
                const Duration(milliseconds: 201),
              ),
              isTrue,
            );
          }
        },
      );
    }
  }

  for (final known in [true, false]) {
    for (final malformed in <String, Object?>{
      'null': null,
      'empty': '',
      'non-string': 7,
    }.entries) {
      test(
        'malformed legacy known=$known ${malformed.key} future does not poison qualified retirement floor',
        () {
          final fence = VirtualThermostatEvidenceFence();
          final declaration = source('ambient', 'legacy', null);
          if (known) {
            accept(
              fence,
              [declaration],
              [input('ambient', 'legacy', t)],
              t,
              Duration.zero,
            );
          }
          final future = t.add(const Duration(days: 1));
          accept(
            fence,
            [
              {...declaration, 'source_identity': malformed.value},
            ],
            [input('ambient', 'legacy', future)],
            t,
            const Duration(milliseconds: 100),
          );
          expect(fence.sources.recordCount, known ? 1 : 0);
          expect(fence.sources.aliasCount, known ? 1 : 0);
          accept(
            fence,
            [],
            [],
            t,
            const Duration(milliseconds: 200),
            revision: 2,
          );
          expect(fence.sources.recordCount, 0);
          final qualified = t.add(const Duration(milliseconds: 300));
          accept(
            fence,
            [source('ambient', 'replacement', 'replacement')],
            [input('ambient', 'replacement', qualified)],
            qualified,
            const Duration(milliseconds: 300),
            revision: 3,
          );
          expect(
            fence.sources.roleCurrent(
              'ambient',
              qualified,
              const Duration(milliseconds: 300),
            ),
            isTrue,
          );
        },
      );
    }
  }

  for (final reverse in [false, true]) {
    for (final extra in ['opaque', 'orphan']) {
      test(
        'shared represented B keeps original deadline reverse=$reverse extra=$extra',
        () {
          final fence = VirtualThermostatEvidenceFence();
          final a = source('contact', 'a', 'shared'),
              b = source('contact', 'b', 'shared');
          accept(fence, [a], [input('contact', 'a', t)], t, Duration.zero);
          final originalB = t.add(const Duration(milliseconds: 10));
          final Object opaque = extra == 'opaque'
              ? 'opaque'
              : source('ambient', 'orphan', 'orphan');
          final config = {
            'revision': 1,
            'actuators': [],
            'sources': reverse ? [opaque, b] : [b, opaque],
          };
          final runtime = {
            'configuration_revision': 1,
            'branches': [],
            'inputs': [input('contact', 'b', originalB)],
          };
          fence.accept(
            config,
            runtime,
            originalB,
            const Duration(milliseconds: 10),
          );
          fence.accept(
            config,
            runtime,
            t.add(const Duration(milliseconds: 100)),
            const Duration(milliseconds: 100),
          );
          expect(
            fence.sources.roleCurrent(
              'contact',
              t.add(const Duration(milliseconds: 2009)),
              const Duration(milliseconds: 2009),
            ),
            isTrue,
          );
          expect(
            fence.sources.roleCurrent(
              'contact',
              t.add(const Duration(milliseconds: 2010)),
              const Duration(milliseconds: 2010),
            ),
            isFalse,
          );
        },
      );
    }
  }

  test(
    'capacity-refused alias cannot exempt omitted shared record from sticky withdrawal',
    () {
      final fence = VirtualThermostatEvidenceFence();
      for (var n = 0; n < 36; n++) {
        final stamp = t.add(Duration(milliseconds: n));
        fence.accept(
          {
            'revision': 1,
            'actuators': [],
            'sources': [source('contact', 'alias$n', 'shared'), 'opaque'],
          },
          {
            'configuration_revision': 1,
            'branches': [],
            'inputs': [input('contact', 'alias$n', stamp)],
          },
          stamp,
          Duration(milliseconds: n),
        );
      }
      expect(fence.sources.aliasCount, 36);
      expect(fence.sources.recordCount, 1);
      final original = t.add(const Duration(milliseconds: 35));
      fence.accept(
        {
          'revision': 1,
          'actuators': [],
          'sources': [source('contact', 'overflow', 'shared'), 'opaque'],
        },
        {
          'configuration_revision': 1,
          'branches': [],
          'inputs': [input('contact', 'overflow', original)],
        },
        t.add(const Duration(milliseconds: 100)),
        const Duration(milliseconds: 100),
      );
      expect(fence.sources.overflow, isTrue);
      expect(fence.sources.aliasCount, 36);
      accept(
        fence,
        [source('contact', 'alias35', 'shared')],
        [input('contact', 'alias35', original)],
        t.add(const Duration(milliseconds: 200)),
        const Duration(milliseconds: 200),
      );
      expect(
        fence.sources.roleCurrent(
          'contact',
          t.add(const Duration(milliseconds: 200)),
          const Duration(milliseconds: 200),
        ),
        isFalse,
      );
      final newer = t.add(const Duration(milliseconds: 201));
      accept(
        fence,
        [source('contact', 'alias35', 'shared')],
        [input('contact', 'alias35', newer)],
        newer,
        const Duration(milliseconds: 201),
      );
      expect(
        fence.sources.roleCurrent(
          'contact',
          newer,
          const Duration(milliseconds: 201),
        ),
        isTrue,
      );
    },
  );

  for (final field in ['configuration', 'runtime']) {
    for (final invalid in <String, Object?>{
      'missing': null,
      'null': null,
      'string': '100',
      'nan': double.nan,
      'infinite': double.infinity,
      'negative': -1,
      'fractional': 100.5,
      'zero mismatch': 0,
    }.entries) {
      test(
        '$field revision ${invalid.key} refuses before history or watermark mutation',
        () {
          final fence = VirtualThermostatEvidenceFence();
          final declared = [
            source('ambient', 'a', 'ambient'),
            source('floor', 'f', 'floor'),
          ];
          final readings = [input('ambient', 'a', t), input('floor', 'f', t)];
          final member = claim('one', 'heating', 'reserved');
          final branch = {
            'claim': 'one',
            'physical_identity': 'canonical-one',
            'protection': protection(t, 20),
          };
          accept(
            fence,
            declared,
            readings,
            t,
            Duration.zero,
            revision: 4,
            claims: [member],
            branches: [branch],
          );
          final config = <String, dynamic>{
            'revision': field == 'configuration' ? invalid.value : 100,
            'sources': [],
            'actuators': [],
          };
          final runtime = <String, dynamic>{
            'configuration_revision': field == 'runtime' ? invalid.value : 100,
            'inputs': [],
            'branches': [],
          };
          if (invalid.key == 'missing') {
            if (field == 'configuration') {
              config.remove('revision');
            } else {
              runtime.remove('configuration_revision');
            }
          }
          expect(
            fence.accept(config, runtime, t, const Duration(seconds: 1)),
            isFalse,
          );
          expect(fence.sources.recordCount, 2);
          expect(fence.sources.aliasCount, 2);
          expect(fence.sources.legacyFallbackClosed, isFalse);
          expect(
            fence.members.expiredClaims(
              [VirtualThermostatMember(member, branch)],
              Duration.zero,
              t,
            ),
            isEmpty,
          );
          expect(
            accept(
              fence,
              declared,
              readings,
              t,
              const Duration(seconds: 1),
              revision: 4,
              claims: [member],
              branches: [branch],
            ),
            isTrue,
          );
          expect(
            fence.sources.allCurrent(t, const Duration(seconds: 1)),
            isTrue,
          );
          expect(accept(fence, [], [], t, Duration.zero, revision: 3), isFalse);
          expect(fence.sources.recordCount, 2);
          accept(
            fence,
            declared,
            readings,
            t,
            const Duration(seconds: 3),
            revision: 4,
            claims: [member],
            branches: [branch],
          );
          expect(
            fence.sources.allCurrent(t, const Duration(seconds: 3)),
            isFalse,
          );
          expect(
            fence.members.expiredClaims(
              [VirtualThermostatMember(member, branch)],
              Duration.zero,
              t,
              clock: const Duration(seconds: 3),
            ),
            contains('one'),
          );
        },
      );
    }
  }

  test(
    'coherent zero revision is admitted initially and never bypasses a known positive revision',
    () {
      final fence = VirtualThermostatEvidenceFence();
      final declared = [source('ambient', 'a')],
          readings = [input('ambient', 'a', t)];
      expect(
        accept(fence, declared, readings, t, Duration.zero, revision: 0),
        isTrue,
      );
      expect(fence.sources.allCurrent(t, Duration.zero), isTrue);
      expect(
        accept(fence, declared, readings, t, Duration.zero, revision: 1),
        isTrue,
      );
      expect(accept(fence, [], [], t, Duration.zero, revision: 0), isFalse);
      expect(fence.sources.recordCount, 1);
    },
  );

  for (final array in ['sources', 'inputs']) {
    for (final shape in [
      'missing',
      'null',
      'non-list',
      'opaque',
      'duplicate',
      'orphan',
    ]) {
      test(
        'raw $array $shape withholds whole readiness and cannot prune source history',
        () {
          final fence = VirtualThermostatEvidenceFence();
          final declared = [
            source('ambient', 'a', 'ambient'),
            source('floor', 'f', 'floor'),
          ];
          final readings = [input('ambient', 'a', t), input('floor', 'f', t)];
          accept(fence, declared, readings, t, Duration.zero);
          expect(fence.sources.allCurrent(t, Duration.zero), isTrue);
          Object? malformed(List<Map> rows) => switch (shape) {
            'missing' || 'null' => null,
            'non-list' => {'opaque': true},
            'opaque' => [...rows, 'opaque'],
            'duplicate' => [...rows, rows.first],
            _ => [
              ...rows,
              array == 'sources'
                  ? source('contact', 'orphan', 'orphan')
                  : input('contact', 'orphan', t.add(const Duration(days: 1))),
            ],
          };
          final config = <String, dynamic>{
            'revision': 1,
            'actuators': [],
            'sources': array == 'sources'
                ? malformed([declared.first])
                : [declared.first],
          };
          final runtime = <String, dynamic>{
            'configuration_revision': 1,
            'branches': [],
            'inputs': array == 'inputs'
                ? malformed([readings.first])
                : [readings.first],
          };
          if (shape == 'missing') {
            (array == 'sources' ? config : runtime).remove(array);
          }
          fence.accept(config, runtime, t, Duration.zero);
          expect(fence.sources.allCurrent(t, Duration.zero), isFalse);
          expect(fence.sources.recordCount, greaterThanOrEqualTo(2));
          expect(fence.sources.aliasCount, greaterThanOrEqualTo(2));
          expect(fence.sources.legacyFallbackClosed, isFalse);
          if (shape == 'opaque' || shape == 'orphan') {
            expect(
              fence.sources.roleCurrent('ambient', t, Duration.zero),
              isTrue,
            );
          }
          // Returning an omitted binding is not first admission: its original
          // deadline survives the malformed batch and cannot be renewed by cache.
          accept(fence, declared, readings, t, const Duration(seconds: 3));
          expect(
            fence.sources.roleCurrent('floor', t, const Duration(seconds: 3)),
            isFalse,
          );
          final newer = t.add(const Duration(milliseconds: 1));
          accept(
            fence,
            declared,
            [input('ambient', 'a', newer), input('floor', 'f', newer)],
            newer,
            const Duration(seconds: 3),
          );
          expect(
            fence.sources.allCurrent(newer, const Duration(seconds: 3)),
            isTrue,
          );
        },
      );
    }
  }

  test(
    'unrelated opaque rows preserve individual ambient and floor budgets but not whole readiness',
    () {
      final fence = VirtualThermostatEvidenceFence();
      final declared = [
        source('ambient', 'a', 'ambient'),
        source('floor', 'f', 'floor'),
      ];
      final readings = [input('ambient', 'a', t), input('floor', 'f', t)];
      fence.accept(
        {
          'revision': 1,
          'actuators': [],
          'sources': [...declared, 'opaque'],
        },
        {
          'configuration_revision': 1,
          'branches': [],
          'inputs': [...readings, 'opaque'],
        },
        t,
        Duration.zero,
      );
      expect(fence.sources.allCurrent(t, Duration.zero), isFalse);
      expect(fence.sources.roleCurrent('ambient', t, Duration.zero), isTrue);
      expect(fence.sources.roleCurrent('floor', t, Duration.zero), isTrue);
      accept(fence, declared, readings, t, Duration.zero);
      expect(fence.sources.allCurrent(t, Duration.zero), isTrue);
      accept(fence, declared, readings, t, const Duration(seconds: 2));
      expect(fence.sources.allCurrent(t, const Duration(seconds: 2)), isFalse);
    },
  );

  test(
    'legitimate empty runtime array lacks required ambient and does not prune retained bindings',
    () {
      final fence = VirtualThermostatEvidenceFence();
      final declared = [source('ambient', 'a')];
      accept(fence, declared, [input('ambient', 'a', t)], t, Duration.zero);
      accept(fence, declared, [], t, Duration.zero);
      expect(fence.sources.allCurrent(t, Duration.zero), isFalse);
      expect(fence.sources.recordCount, 1);
      expect(fence.sources.aliasCount, 1);
      accept(fence, declared, [input('ambient', 'a', t)], t, Duration.zero);
      expect(fence.sources.allCurrent(t, Duration.zero), isFalse);
      final newer = t.add(const Duration(milliseconds: 1));
      accept(
        fence,
        declared,
        [input('ambient', 'a', newer)],
        newer,
        Duration.zero,
      );
      expect(fence.sources.allCurrent(newer, Duration.zero), isTrue);
    },
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
        'physical_identity': 'canonical-$id',
        'protection': protection(stamp, 20, claimId: id),
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
          {
            'claim': 'member$n',
            'physical_identity': 'canonical-member$n',
            'protection': protection(t, 20, claimId: 'member$n'),
          },
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
        'physical_identity': 'canonical-one',
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
      final branch = {
        'claim': 'one',
        'physical_identity': 'canonical-one',
        'protection': protection(t, 20),
      };
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

void membershipAndIdentityRegressions() {
  final t = DateTime.utc(2026, 10, 16, 12);
  Map<String, dynamic> configured() => {
    ...claim('one', 'heating', 'reserved'),
    'protection': {
      'source_identity': 'protective-source',
      'source_property': 'protective-property',
      'physical_property': 'physical-leaf',
    },
  };
  Map<String, dynamic> diagnostic(DateTime stamp, DateTime expiry) => {
    'claim': 'one',
    'role': 'heating',
    'physical_identity': 'canonical-one',
    ...activityObservation(stamp, 'off', lifetime: expiry.difference(stamp)),
    'protection': {
      ...protection(stamp, 20),
      'source_property': 'protective-property',
      'physical_property': 'physical-leaf',
      'expires_at': expiry.toIso8601String(),
      'maximum_age_seconds': 60,
    },
  };
  const scenarios = [
    'duplicate-runtime',
    'reversed-duplicate-runtime',
    'duplicate-configured',
    'malformed-configured',
    'malformed-runtime',
  ];
  for (final scenario in scenarios) {
    test(
      '$scenario cannot select positive evidence or prune member and activity records',
      () {
        final fence = VirtualThermostatEvidenceFence(),
            activity = VirtualThermostatActivityFence();
        final member = configured(),
            good = diagnostic(t, t.add(const Duration(minutes: 1)));
        final config = {
          'revision': 1,
          'actuators': [member],
          'sources': [],
        };
        final runtime = {
          'configuration_revision': 1,
          'branches': [good],
          'inputs': [],
        };
        fence.accept(config, runtime, t, Duration.zero);
        final original = VirtualThermostatMember.read(config, runtime);
        expect(
          fence.members.expiredClaims(original, Duration.zero, t),
          isEmpty,
        );
        activity.accept(original, t, Duration.zero);
        expect(activity.unavailableClaims(original, t, Duration.zero), isEmpty);
        final ambiguousStamp = t.add(const Duration(milliseconds: 1));
        final ambiguousGood = diagnostic(
          ambiguousStamp,
          t.add(const Duration(minutes: 1)),
        );
        final bad = {
          ...ambiguousGood,
          'protection': {
            ...(ambiguousGood['protection'] as Map),
            'temperature': 99,
          },
        };
        final brokenConfig = {
          ...config,
          'actuators': scenario == 'malformed-configured'
              ? ['malformed']
              : scenario == 'duplicate-configured'
              ? [member, member]
              : [member],
        };
        final brokenRuntime = {
          ...runtime,
          'branches': scenario == 'malformed-runtime'
              ? ['malformed']
              : scenario == 'malformed-configured'
              ? []
              : scenario == 'reversed-duplicate-runtime'
              ? [bad, ambiguousGood]
              : scenario == 'duplicate-runtime'
              ? [ambiguousGood, bad]
              : [ambiguousGood],
        };
        expect(
          VirtualThermostatMember.membershipComplete(
            brokenConfig,
            brokenRuntime,
          ),
          isFalse,
        );
        fence.accept(
          brokenConfig,
          brokenRuntime,
          ambiguousStamp,
          const Duration(milliseconds: 1),
        );
        final ambiguous = VirtualThermostatMember.read(
          brokenConfig,
          brokenRuntime,
        );
        activity.accept(
          ambiguous,
          ambiguousStamp,
          const Duration(milliseconds: 1),
        );
        expect(fence.members.recordCount, 1);
        expect(fence.members.untracked, isTrue);
        expect(fence.members.overflow, isFalse);
        for (final row in ambiguous) {
          expect(row.liveTemperature(Duration.zero, t, true), isNull);
          expect(row.observed(true, t), isNull);
          expect(row.qualification(true), isNull);
        }
        final cachedRuntime = {
          ...runtime,
          'branches': [scenario.startsWith('malformed') ? good : ambiguousGood],
        };
        final cached = VirtualThermostatMember.read(config, cachedRuntime);
        fence.accept(
          config,
          cachedRuntime,
          ambiguousStamp,
          const Duration(milliseconds: 1),
        );
        expect(
          fence.members.expiredClaims(cached, Duration.zero, ambiguousStamp),
          contains('one'),
        );
        expect(
          activity.unavailableClaims(
            cached,
            ambiguousStamp,
            const Duration(milliseconds: 1),
          ),
          contains('one'),
        );
        final newer = t.add(const Duration(milliseconds: 2));
        final recoveredRuntime = {
          ...runtime,
          'branches': [diagnostic(newer, t.add(const Duration(minutes: 1)))],
        };
        fence.accept(
          config,
          recoveredRuntime,
          newer,
          const Duration(milliseconds: 1),
        );
        final recovered = VirtualThermostatMember.read(
          config,
          recoveredRuntime,
        );
        expect(
          fence.members.expiredClaims(
            recovered,
            Duration.zero,
            newer,
            clock: const Duration(milliseconds: 1),
          ),
          isEmpty,
        );
        activity.accept(recovered, newer, const Duration(milliseconds: 1));
        expect(
          activity.unavailableClaims(
            recovered,
            newer,
            const Duration(milliseconds: 1),
          ),
          isEmpty,
        );
      },
    );

    testWidgets(
      '$scenario actual detail withholds member selected floor readiness and observed activity through cached restoration',
      (tester) async {
        final fixture = MemberDetailFixture()
          ..overrideMembership = true
          ..displayFloorClaim = 'one';
        final initial = DateTime.now().subtract(
          const Duration(milliseconds: 10),
        );
        final member = configured();
        final expiry = initial.add(const Duration(minutes: 1));
        final good = diagnostic(initial, expiry);
        fixture.configuredMembership = [member];
        fixture.runtimeMembership = [good];
        await fixture.mount(tester);
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        expect(find.text('Live protection reading: 20.0 °C'), findsOneWidget);
        expect(find.text('Reported observation: off'), findsOneWidget);
        expect(
          find.text(
            'Selected member floor (not an average): canonical-one: 20.0 °C',
          ),
          findsOneWidget,
        );
        final ambiguousStamp = DateTime.now();
        expect(ambiguousStamp.isAfter(initial), isTrue);
        final ambiguousGood = diagnostic(ambiguousStamp, expiry);
        final bad = {
          ...ambiguousGood,
          'protection': {
            ...(ambiguousGood['protection'] as Map),
            'temperature': 99,
          },
        };
        fixture.configuredMembership = scenario == 'malformed-configured'
            ? ['malformed']
            : scenario == 'duplicate-configured'
            ? [member, member]
            : [member];
        fixture.runtimeMembership = scenario == 'malformed-runtime'
            ? ['malformed']
            : scenario == 'malformed-configured'
            ? []
            : scenario == 'reversed-duplicate-runtime'
            ? [bad, ambiguousGood]
            : scenario == 'duplicate-runtime'
            ? [ambiguousGood, bad]
            : [ambiguousGood];
        await fixture.refetch(tester);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        expect(find.text('Live protection reading: 20.0 °C'), findsNothing);
        expect(find.textContaining(': 99.0 °C'), findsNothing);
        expect(
          find.text(
            'Selected member floor (not an average): canonical-one: 20.0 °C',
          ),
          findsNothing,
        );
        expect(find.text('Reported observation: off'), findsNothing);
        fixture.configuredMembership = [member];
        fixture.runtimeMembership = [
          scenario.startsWith('malformed') ? good : ambiguousGood,
        ];
        await fixture.refetch(tester);
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        expect(
          find.text('Live protection reading: Unavailable'),
          findsOneWidget,
        );
        expect(find.text('Reported observation: off'), findsNothing);
        final newer = DateTime.now();
        expect(newer.isAfter(ambiguousStamp), isTrue);
        fixture.runtimeMembership = [diagnostic(newer, expiry)];
        await fixture.refetch(tester);
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        expect(find.text('Live protection reading: 20.0 °C'), findsOneWidget);
        expect(
          find.text(
            'Selected member floor (not an average): canonical-one: 20.0 °C',
          ),
          findsOneWidget,
        );
        expect(find.text('Reported observation: off'), findsOneWidget);
        await fixture.dispose(tester);
      },
    );
  }

  for (final scenario in [
    ...scenarios,
    'runtime-only-duplicate',
    'runtime-only-reversed',
  ]) {
    testWidgets(
      '$scenario HTTP acceptance before render rejects a corrected cached sample and activity',
      (tester) async {
        final fixture = MemberDetailFixture()
          ..overrideMembership = true
          ..displayFloorClaim = 'one';
        final initial = DateTime.now().subtract(
          const Duration(milliseconds: 10),
        );
        final expiry = initial.add(const Duration(minutes: 1));
        final member = configured(), original = diagnostic(initial, expiry);
        final runtimeOnly = scenario.startsWith('runtime-only');
        fixture.configuredMembership = runtimeOnly ? [] : [member];
        fixture.runtimeMembership = [original];
        await fixture.mount(tester);
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        expect(find.text('Reported observation: off'), findsOneWidget);
        final baselineModeReads = fixture.modeReads,
            baselineRuntimeReads = fixture.runtimeReads;
        final ambiguousStamp = DateTime.now();
        expect(ambiguousStamp.isAfter(initial), isTrue);
        final newer = diagnostic(ambiguousStamp, expiry);
        final conflicting = {
          ...newer,
          'protection': {...(newer['protection'] as Map), 'temperature': 99},
        };
        fixture.configuredMembership = scenario == 'malformed-configured'
            ? ['malformed']
            : scenario == 'duplicate-configured'
            ? [member, member]
            : runtimeOnly
            ? []
            : [member];
        fixture.runtimeMembership = scenario == 'malformed-runtime'
            ? ['malformed']
            : scenario == 'malformed-configured'
            ? []
            : scenario == 'duplicate-configured'
            ? [newer]
            : scenario.contains('reversed')
            ? [conflicting, newer]
            : [newer, conflicting];
        await fixture.acceptBeforeFrame(tester);
        expect(fixture.modeReads, baselineModeReads + 1);
        expect(fixture.runtimeReads, baselineRuntimeReads + 1);
        // No frame has consumed the ambiguous/missing response: the old tree is still displayed.
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        fixture.configuredMembership = runtimeOnly ? [] : [member];
        fixture.runtimeMembership = [
          scenario.startsWith('malformed') ? original : newer,
        ];
        await fixture.acceptBeforeFrame(tester);
        expect(fixture.modeReads, baselineModeReads + 2);
        expect(fixture.runtimeReads, baselineRuntimeReads + 2);
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        await tester.pump();
        expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
        expect(
          find.text('Live protection reading: Unavailable'),
          findsOneWidget,
        );
        expect(find.text('Reported observation: off'), findsNothing);
        expect(find.text('Live protection reading: 20.0 °C'), findsNothing);
        expect(
          find.text(
            'Selected member floor (not an average): canonical-one: 20.0 °C',
          ),
          findsNothing,
        );
        expect(find.text('Historical reading only: 20.0 °C'), findsOneWidget);
        final recovery = DateTime.now();
        expect(recovery.isAfter(ambiguousStamp), isTrue);
        fixture.runtimeMembership = [diagnostic(recovery, expiry)];
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(find.text('Controller readiness: ready'), findsOneWidget);
        expect(find.text('Live protection reading: 20.0 °C'), findsOneWidget);
        expect(find.text('Reported observation: off'), findsOneWidget);
        await fixture.dispose(tester);
      },
    );
  }

  test(
    'runtime-only duplicate claims never select first observed or protective evidence in either order',
    () {
      final good = diagnostic(t, t.add(const Duration(minutes: 1)));
      final bad = {
        ...good,
        'protection': {...(good['protection'] as Map), 'temperature': 99},
      };
      for (final rows in [
        [good, bad],
        [bad, good],
      ]) {
        final config = {'actuators': []}, runtime = {'branches': rows};
        expect(
          VirtualThermostatMember.membershipComplete(config, runtime),
          isFalse,
        );
        final members = VirtualThermostatMember.read(config, runtime);
        expect(members, hasLength(1));
        expect(members.single.claim, 'one');
        expect(members.single.ambiguous, isTrue);
        expect(members.single.liveTemperature(Duration.zero, t, true), isNull);
        expect(members.single.observed(true, t), isNull);
        expect(members.single.qualification(true), isNull);
      }
    },
  );

  for (final atCapacity in [false, true]) {
    test(
      'ambiguous future timestamp cannot poison qualified retirement at capacity=$atCapacity',
      () {
        final fence = VirtualThermostatReadingFence();
        VirtualThermostatMember qualified(String id, DateTime stamp) {
          final config = {
            ...configured(),
            'id': id,
            'physical_identity': 'canonical-$id',
          };
          final row = diagnostic(stamp, t.add(const Duration(minutes: 1)));
          row['claim'] = id;
          row['physical_identity'] = 'canonical-$id';
          row['protection'] = {...(row['protection'] as Map), 'claim': id};
          return VirtualThermostatMember(config, row);
        }

        final count = atCapacity ? 16 : 1;
        fence.accept(
          [for (var i = 0; i < count; i++) qualified('member$i', t)],
          t,
          Duration.zero,
        );
        final invalid = VirtualThermostatMember(
          {...configured(), 'id': atCapacity ? 'overflow' : 'member0'},
          {
            'claim': atCapacity ? 'overflow' : 'member0',
            'protection': {
              'sampled_at': t.add(const Duration(days: 1)).toIso8601String(),
            },
          },
          ambiguous: true,
        );
        fence.accept([invalid], t, Duration.zero, complete: false);
        expect(fence.recordCount, count);
        expect(fence.overflow, atCapacity);
        fence.retainClaims([]);
        final newer = t.add(const Duration(milliseconds: 1));
        final replacement = qualified('replacement', newer);
        fence.accept([replacement], newer, const Duration(milliseconds: 1));
        expect(
          fence.expiredClaims(
            [replacement],
            Duration.zero,
            newer,
            clock: const Duration(milliseconds: 1),
          ),
          isEmpty,
        );
      },
    );
  }

  for (final field in [
    'source_identity',
    'source_property',
    'physical_property',
    'physical_identity',
    'claim',
  ]) {
    for (final gap in ['omitted', 'mismatched']) {
      Map<String, dynamic> broken(Map<String, dynamic> original) {
        final result = {
          ...original,
          'protection': {...(original['protection'] as Map)},
        };
        final target = field == 'physical_identity'
            ? result
            : result['protection'] as Map;
        if (gap == 'omitted') {
          target.remove(field);
        } else {
          target[field] = 'wrong-identity';
        }
        return result;
      }

      test(
        'member $field $gap at same or newer S cannot qualify or revive on same-S restoration',
        () {
          for (final newerGap in [false, true]) {
            final fence = VirtualThermostatReadingFence(),
                member = configured();
            final expiry = t.add(const Duration(minutes: 1));
            final original = VirtualThermostatMember(
              member,
              diagnostic(t, expiry),
            );
            fence.accept([original], t, Duration.zero);
            expect(fence.expiredClaims([original], Duration.zero, t), isEmpty);
            final s = newerGap ? t.add(const Duration(milliseconds: 1)) : t;
            final invalid = VirtualThermostatMember(
              member,
              broken(diagnostic(s, expiry)),
            );
            fence.accept([invalid], s, const Duration(milliseconds: 1));
            expect(
              fence.expiredClaims([invalid], Duration.zero, s),
              contains('one'),
            );
            final restored = VirtualThermostatMember(
              member,
              diagnostic(s, expiry),
            );
            fence.accept([restored], s, const Duration(milliseconds: 1));
            expect(
              fence.expiredClaims([restored], Duration.zero, s),
              contains('one'),
            );
            final next = s.add(const Duration(milliseconds: 1));
            final recovered = VirtualThermostatMember(
              member,
              diagnostic(next, expiry),
            );
            fence.accept([recovered], next, const Duration(milliseconds: 2));
            expect(
              fence.expiredClaims(
                [recovered],
                Duration.zero,
                next,
                clock: const Duration(milliseconds: 2),
              ),
              isEmpty,
            );
          }
        },
      );
      testWidgets(
        'member $field $gap actual detail rejects newer omission and same-S restoration until newer qualification',
        (tester) async {
          final fixture = MemberDetailFixture()
            ..overrideMembership = true
            ..displayFloorClaim = 'one';
          final initial = DateTime.now().subtract(
            const Duration(milliseconds: 10),
          );
          final expiry = initial.add(const Duration(minutes: 1));
          fixture.configuredMembership = [configured()];
          fixture.runtimeMembership = [diagnostic(initial, expiry)];
          await fixture.mount(tester);
          expect(find.text('Controller readiness: ready'), findsOneWidget);
          final newer = DateTime.now();
          expect(newer.isAfter(initial), isTrue);
          fixture.runtimeMembership = [broken(diagnostic(newer, expiry))];
          await fixture.refetch(tester);
          expect(
            find.text('Controller readiness: Unavailable'),
            findsOneWidget,
          );
          expect(find.text('Live protection reading: 20.0 °C'), findsNothing);
          expect(
            find.text(
              'Selected member floor (not an average): canonical-one: 20.0 °C',
            ),
            findsNothing,
          );
          fixture.runtimeMembership = [diagnostic(newer, expiry)];
          await fixture.refetch(tester);
          expect(
            find.text('Controller readiness: Unavailable'),
            findsOneWidget,
          );
          expect(
            find.text('Live protection reading: Unavailable'),
            findsOneWidget,
          );
          final newest = DateTime.now();
          expect(newest.isAfter(newer), isTrue);
          fixture.runtimeMembership = [diagnostic(newest, expiry)];
          await fixture.refetch(tester);
          expect(find.text('Controller readiness: ready'), findsOneWidget);
          expect(find.text('Live protection reading: 20.0 °C'), findsOneWidget);
          expect(
            find.text(
              'Selected member floor (not an average): canonical-one: 20.0 °C',
            ),
            findsOneWidget,
          );
          await fixture.dispose(tester);
        },
      );
    }
  }
}

void activityHttpAdmissionRegressions() {
  final t = DateTime.utc(2026, 10, 16, 12);
  Map<String, dynamic> configured() => {
    ...claim('one', 'heating', 'reserved'),
    'protection': null,
  };
  Map<String, dynamic> relay(DateTime stamp, DateTime expiry) => {
    'claim': 'one',
    'role': 'heating',
    'physical_identity': 'canonical-one',
    ...activityObservation(stamp, 'off', lifetime: expiry.difference(stamp)),
    'protection': null,
  };
  const cases = [
    'missing-branch',
    'missing-sample',
    'invalid-sample',
    'missing-expiry',
    'invalid-expiry',
    'expiry-before-sample',
    'missing-activity',
    'invalid-activity',
    'future-sample',
  ];
  List<Map<String, dynamic>> broken(String scenario, Map<String, dynamic> row) {
    final result = {...row};
    switch (scenario) {
      case 'missing-branch':
        return [];
      case 'missing-sample':
        result.remove('activity_sampled_at');
        break;
      case 'invalid-sample':
        result['activity_sampled_at'] = 'not-a-time';
        break;
      case 'missing-expiry':
        result.remove('activity_expires_at');
        break;
      case 'invalid-expiry':
        result['activity_expires_at'] = 'not-a-time';
        break;
      case 'expiry-before-sample':
        result['activity_expires_at'] = result['activity_sampled_at'];
        break;
      case 'missing-activity':
        result.remove('activity');
        break;
      case 'invalid-activity':
        result['activity'] = 'unknown';
        break;
      case 'future-sample':
        break; // The row's original timestamp is actually future at admission.
    }
    return [result];
  }

  bool usesOriginal(String scenario) =>
      ['missing-branch', 'missing-sample', 'invalid-sample'].contains(scenario);
  for (final scenario in cases) {
    test(
      'complete $scenario HTTP activity admission refuses cached correction before query and requires newer qualification',
      () {
        final fence = VirtualThermostatActivityFence();
        final config = {
          'actuators': [configured()],
        };
        List<VirtualThermostatMember> rows(
          List<Map<String, dynamic>> branches,
        ) => VirtualThermostatMember.read(config, {'branches': branches});
        final expiry = t.add(const Duration(minutes: 1)),
            original = relay(t, t.add(const Duration(minutes: 1)));
        fence.accept(rows([original]), t, Duration.zero);
        final s = usesOriginal(scenario)
            ? t
            : t.add(const Duration(seconds: 1));
        final correction = relay(s, expiry);
        final bad = broken(scenario, correction);
        expect(
          VirtualThermostatMember.membershipComplete(config, {'branches': bad}),
          isTrue,
        );
        // Future S is invalid at wall t; other newer S is otherwise already qualified.
        final firstWall = scenario == 'future-sample' ? t : s;
        fence.accept(rows(bad), firstWall, Duration.zero);
        // No query/render between invalid admission and correction. Literal wall matures future S.
        fence.accept(rows([correction]), s, const Duration(seconds: 1));
        expect(
          fence.unavailableClaims(
            rows([correction]),
            s,
            const Duration(seconds: 1),
          ),
          contains('one'),
        );
        final newer = s.add(const Duration(milliseconds: 1));
        final recovered = rows([relay(newer, expiry)]);
        fence.accept(recovered, newer, const Duration(milliseconds: 1001));
        expect(
          fence.unavailableClaims(
            recovered,
            newer,
            const Duration(milliseconds: 1001),
          ),
          isEmpty,
        );
      },
    );

    testWidgets(
      'complete $scenario HTTP before frame cannot restore relay activity from cached correction',
      (tester) async {
        final fixture = MemberDetailFixture()..overrideMembership = true;
        final initial = DateTime.now().subtract(
          const Duration(milliseconds: 10),
        );
        final expiry = initial.add(const Duration(minutes: 2));
        final original = relay(initial, expiry);
        fixture.configuredMembership = [configured()];
        fixture.runtimeMembership = [original];
        await fixture.mount(tester);
        expect(find.text('Reported observation: off'), findsOneWidget);
        final reads = fixture.runtimeReads;
        final s = usesOriginal(scenario)
            ? initial
            : scenario == 'future-sample'
            ? DateTime.now().add(const Duration(minutes: 1))
            : DateTime.now();
        final correction = relay(s, expiry);
        fixture.runtimeMembership = broken(scenario, correction);
        await fixture.acceptBeforeFrame(tester);
        expect(fixture.runtimeReads, reads + 1);
        expect(
          find.text('Reported observation: off'),
          findsOneWidget,
        ); // Original tree, no frame yet.
        fixture.runtimeMembership = [correction];
        await fixture.acceptBeforeFrame(tester);
        expect(fixture.runtimeReads, reads + 2);
        expect(find.text('Reported observation: off'), findsOneWidget);
        await tester.pump();
        expect(find.text('Reported observation: Unavailable'), findsOneWidget);
        if (scenario != 'future-sample') {
          final newer = DateTime.now();
          expect(newer.isAfter(s), isTrue);
          fixture.runtimeMembership = [relay(newer, expiry)];
          await fixture.acceptBeforeFrame(tester);
          await tester.pump();
          expect(find.text('Reported observation: off'), findsOneWidget);
        }
        // Future wall maturity/recovery is proven by the literal-time direct test, not a wall wait here.
        await fixture.dispose(tester);
      },
    );
  }

  test(
    'activity query cannot initialize or admit a publication and cannot extend an original deadline',
    () {
      final fence = VirtualThermostatActivityFence();
      final row = VirtualThermostatMember(
        configured(),
        relay(t, t.add(const Duration(seconds: 2))),
      );
      expect(fence.unavailableClaims([row], t, Duration.zero), contains('one'));
      expect(fence.recordCount, 0);
      fence.accept([row], t, Duration.zero);
      expect(fence.unavailableClaims([row], t, Duration.zero), isEmpty);
      final newer = VirtualThermostatMember(
        configured(),
        relay(
          t.add(const Duration(seconds: 1)),
          t.add(const Duration(seconds: 3)),
        ),
      );
      expect(
        fence.unavailableClaims(
          [newer],
          t.add(const Duration(seconds: 1)),
          const Duration(seconds: 1),
        ),
        contains('one'),
      );
      expect(fence.recordCount, 1);
      fence.accept(
        [newer],
        t.add(const Duration(seconds: 1)),
        const Duration(seconds: 1),
      );
      expect(
        fence.unavailableClaims(
          [newer],
          t.add(const Duration(seconds: 1)),
          const Duration(seconds: 1),
        ),
        isEmpty,
      );
      expect(
        fence.unavailableClaims(
          [newer],
          t.add(const Duration(seconds: 1)),
          const Duration(seconds: 3),
        ),
        contains('one'),
      );
      final extended = VirtualThermostatMember(
        configured(),
        relay(
          t.add(const Duration(seconds: 1)),
          t.add(const Duration(minutes: 1)),
        ),
      );
      fence.accept(
        [extended],
        t.add(const Duration(seconds: 1)),
        const Duration(seconds: 3),
      );
      expect(
        fence.unavailableClaims(
          [extended],
          t.add(const Duration(seconds: 1)),
          const Duration(seconds: 3),
        ),
        contains('one'),
      );
    },
  );

  for (final field in ['physical_identity', 'claim']) {
    for (final mode in ['omitted', 'mismatched']) {
      test(
        'relay $field $mode invalidates activity S but qualification remains only a joined current snapshot',
        () {
          final fence = VirtualThermostatActivityFence(), config = configured();
          VirtualThermostatMember member(Map row) =>
              VirtualThermostatMember(config, row);
          final expiry = t.add(const Duration(minutes: 1));
          fence.accept([member(relay(t, expiry))], t, Duration.zero);
          final s = t.add(const Duration(milliseconds: 1)),
              invalid = relay(t.add(const Duration(milliseconds: 1)), expiry);
          if (mode == 'omitted') {
            invalid.remove(field);
          } else {
            invalid[field] = 'other';
          }
          expect(member(invalid).observed(true, s), isNull);
          expect(member(invalid).qualification(true), isNull);
          fence.accept([member(invalid)], s, const Duration(milliseconds: 1));
          final restored = member(relay(s, expiry));
          fence.accept([restored], s, const Duration(milliseconds: 1));
          expect(
            fence.unavailableClaims(
              [restored],
              s,
              const Duration(milliseconds: 1),
            ),
            contains('one'),
          );
          expect(
            restored.qualification(true),
            isTrue,
          ); // Current server snapshot has no invented sample clock.
          final next = s.add(const Duration(milliseconds: 1)),
              recovered = member(
                relay(s.add(const Duration(milliseconds: 1)), expiry),
              );
          fence.accept([recovered], next, const Duration(milliseconds: 2));
          expect(
            fence.unavailableClaims(
              [recovered],
              next,
              const Duration(milliseconds: 2),
            ),
            isEmpty,
          );
        },
      );
    }
  }
  for (final mode in ['omitted', 'mismatched']) {
    testWidgets(
      'known relay physical identity $mode is captured before frame and restored S cannot revive observation',
      (tester) async {
        final fixture = MemberDetailFixture()..overrideMembership = true;
        final initial = DateTime.now().subtract(
          const Duration(milliseconds: 10),
        );
        final expiry = initial.add(const Duration(minutes: 1));
        fixture.configuredMembership = [configured()];
        fixture.runtimeMembership = [relay(initial, expiry)];
        await fixture.mount(tester);
        expect(find.text('Reported observation: off'), findsOneWidget);
        expect(
          find.text('Server guard/target check (snapshot): true'),
          findsOneWidget,
        );
        final s = DateTime.now();
        expect(s.isAfter(initial), isTrue);
        final invalid = relay(s, expiry);
        if (mode == 'omitted') {
          invalid.remove('physical_identity');
        } else {
          invalid['physical_identity'] = 'other';
        }
        final reads = fixture.runtimeReads;
        fixture.runtimeMembership = [invalid];
        await fixture.acceptBeforeFrame(tester);
        expect(fixture.runtimeReads, reads + 1);
        expect(
          find.text('Reported observation: off'),
          findsOneWidget,
        ); // No invalidating render.
        fixture.runtimeMembership = [relay(s, expiry)];
        await fixture.acceptBeforeFrame(tester);
        expect(fixture.runtimeReads, reads + 2);
        await tester.pump();
        expect(find.text('Reported observation: Unavailable'), findsOneWidget);
        expect(
          find.text('Server guard/target check (snapshot): true'),
          findsOneWidget,
        );
        // Separately expose an invalid joined snapshot, then restore it at that same S.
        final secondS = DateTime.now();
        expect(secondS.isAfter(s), isTrue);
        final secondInvalid = relay(secondS, expiry);
        if (mode == 'omitted') {
          secondInvalid.remove('physical_identity');
        } else {
          secondInvalid['physical_identity'] = 'other';
        }
        fixture.runtimeMembership = [secondInvalid];
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(find.text('Reported observation: Unavailable'), findsOneWidget);
        expect(
          find.text('Server guard/target check (snapshot): Unavailable'),
          findsOneWidget,
        );
        fixture.runtimeMembership = [relay(secondS, expiry)];
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(find.text('Reported observation: Unavailable'), findsOneWidget);
        expect(
          find.text('Server guard/target check (snapshot): true'),
          findsOneWidget,
        );
        final newer = DateTime.now();
        expect(newer.isAfter(secondS), isTrue);
        fixture.runtimeMembership = [relay(newer, expiry)];
        await fixture.acceptBeforeFrame(tester);
        await tester.pump();
        expect(find.text('Reported observation: off'), findsOneWidget);
        await fixture.dispose(tester);
      },
    );
  }

  test(
    'relay evidence and qualification never depend on protective-floor validity',
    () {
      final config = claim('one', 'heating', 'reserved');
      final row = {
        ...relay(t, t.add(const Duration(minutes: 1))),
        'protection': {'status': 'missing', 'source_identity': 'wrong-floor'},
      };
      final member = VirtualThermostatMember(config, row),
          fence = VirtualThermostatActivityFence();
      expect(member.qualification(true), isTrue);
      expect(member.observed(true, t), 'off');
      expect(member.liveTemperature(Duration.zero, t, true), isNull);
      fence.accept([member], t, Duration.zero);
      expect(fence.unavailableClaims([member], t, Duration.zero), isEmpty);
    },
  );
  testWidgets(
    'actual relay OFF and current qualification survive a protective-floor fault',
    (tester) async {
      final fixture = MemberDetailFixture()..overrideMembership = true;
      final now = DateTime.now().subtract(const Duration(milliseconds: 10));
      fixture.configuredMembership = [claim('one', 'heating', 'reserved')];
      fixture.runtimeMembership = [
        {
          ...relay(now, now.add(const Duration(minutes: 1))),
          'protection': {
            'claim': 'one',
            'status': 'missing',
            'source_identity': 'wrong-floor',
          },
        },
      ];
      await fixture.mount(tester);
      expect(find.text('Reported observation: off'), findsOneWidget);
      expect(
        find.text('Server guard/target check (snapshot): true'),
        findsOneWidget,
      );
      expect(find.text('Live protection reading: Unavailable'), findsOneWidget);
      expect(find.text('Controller readiness: Unavailable'), findsOneWidget);
      await fixture.dispose(tester);
    },
  );

  test(
    'invalid activity high-water never poisons qualified member retirement floor',
    () {
      final evidence = VirtualThermostatEvidenceFence(),
          activity = VirtualThermostatActivityFence();
      Map branch(String id, DateTime stamp) => {
        'claim': id,
        'physical_identity': 'canonical-$id',
        'role': 'heating',
        ...activityObservation(stamp, 'off'),
        'protection': protection(stamp, 20, claimId: id),
      };
      final config = {
        'revision': 1,
        'actuators': [claim('one', 'heating', 'reserved')],
        'sources': [],
      };
      final initial = branch('one', t);
      final runtime = {
        'configuration_revision': 1,
        'branches': [initial],
        'inputs': [],
      };
      evidence.accept(config, runtime, t, Duration.zero);
      activity.accept(
        VirtualThermostatMember.read(config, runtime),
        t,
        Duration.zero,
      );
      final invalid = {
        ...initial,
        'activity_sampled_at': t.add(const Duration(days: 1)).toIso8601String(),
      };
      final invalidRuntime = {
        ...runtime,
        'branches': [invalid],
      };
      evidence.accept(config, invalidRuntime, t, Duration.zero);
      activity.accept(
        VirtualThermostatMember.read(config, invalidRuntime),
        t,
        Duration.zero,
      );
      evidence.accept(
        {'revision': 2, 'actuators': [], 'sources': []},
        {'configuration_revision': 2, 'branches': [], 'inputs': []},
        t,
        Duration.zero,
      );
      activity.retainClaims(
        [],
      ); // Existing authoritative-removal semantics, no new activity floor.
      final newer = t.add(const Duration(milliseconds: 1)),
          next = branch('two', t.add(const Duration(milliseconds: 1)));
      final nextConfig = {
        'revision': 3,
        'actuators': [claim('two', 'heating', 'reserved')],
        'sources': [],
      };
      final nextRuntime = {
        'configuration_revision': 3,
        'branches': [next],
        'inputs': [],
      };
      evidence.accept(
        nextConfig,
        nextRuntime,
        newer,
        const Duration(milliseconds: 1),
      );
      expect(
        evidence.members.expiredClaims(
          VirtualThermostatMember.read(nextConfig, nextRuntime),
          Duration.zero,
          newer,
          clock: const Duration(milliseconds: 1),
        ),
        isEmpty,
      );
    },
  );
}

void coolingHttpAdmissionRegressions() {
  final t = DateTime.utc(2026, 10, 16, 12);
  Map configured([String id = 'one']) => {
    ...claim(id, 'cooling', 'reserved'),
    'revision': 1,
    'cooling_protection': coolingBinding(),
  };
  Map diagnostic(DateTime expiry, [String id = 'one']) => {
    'claim': id,
    'physical_identity': 'canonical-$id',
    'role': 'cooling',
    'cooling_protection': {
      ...coolingObservation(t),
      'claim': id,
      'expires_at': expiry.toIso8601String(),
    },
  };
  List<VirtualThermostatMember> rows(List<Map> c, List<Map> d) =>
      VirtualThermostatMember.read({'actuators': c}, {'branches': d});
  void accept(
    VirtualThermostatCoolingFence fence,
    List<Map> c,
    List<Map> d, {
    DateTime? at,
    Duration clock = Duration.zero,
  }) => fence.accept({'actuators': c}, {'branches': d}, at ?? t, clock);
  final e = t.add(const Duration(seconds: 2));

  test('cooling queries never mint or replace HTTP publications or budgets', () {
    final fence = VirtualThermostatCoolingFence();
    final c = [configured()], d = [diagnostic(e)];
    expect(fence.freshClaims(rows(c, d), t, Duration.zero), isEmpty);
    expect(fence.recordCount, 0);
    accept(fence, c, d);
    expect(fence.freshClaims(rows(c, d), t, Duration.zero), {'one'});
    final newer = [diagnostic(e.add(const Duration(seconds: 1)))];
    expect(fence.freshClaims(rows(c, newer), t, Duration.zero), isEmpty);
    expect(fence.freshClaims(rows(c, d), t, Duration.zero), isEmpty);
    accept(fence, c, newer);
    expect(fence.freshClaims(rows(c, newer), t, Duration.zero), {'one'});
    expect(fence.recordCount, 1);
  });

  test('cooling first HTTP deadline survives delayed rendering and wall rollback', () {
    final fence = VirtualThermostatCoolingFence();
    final c = [configured()], d = [diagnostic(e)];
    accept(fence, c, d);
    accept(fence, c, d,
        at: t.subtract(const Duration(seconds: 10)),
        clock: const Duration(seconds: 1));
    expect(fence.freshClaims(rows(c, d), t.subtract(const Duration(seconds: 10)),
        const Duration(seconds: 2)), isEmpty);
    accept(fence, c, d, at: t, clock: const Duration(seconds: 3));
    expect(fence.freshClaims(rows(c, d), t, const Duration(seconds: 3)), isEmpty);
  });

  test('equal cooling expiry can only tighten the original HTTP deadline', () {
    final fence = VirtualThermostatCoolingFence();
    final c = [configured()], d = [diagnostic(e)];
    accept(fence, c, d);
    accept(fence, c, d, at: t.add(const Duration(seconds: 1)));
    expect(fence.freshClaims(rows(c, d), t, const Duration(seconds: 1)), isEmpty);
  });

  test('query identity mismatch cannot repair itself or create a newer publication', () {
    final fence = VirtualThermostatCoolingFence();
    final c = [configured()], d = [diagnostic(e)];
    accept(fence, c, d);
    final mismatch = [{...diagnostic(e), 'physical_identity': 'wrong'}];
    expect(fence.freshClaims(rows(c, mismatch), t, Duration.zero), isEmpty);
    expect(fence.freshClaims(rows(c, d), t, Duration.zero), isEmpty);
    accept(fence, c, d);
    expect(fence.freshClaims(rows(c, d), t, Duration.zero), isEmpty);
  });

  for (final field in ['surface', 'dew_point', 'expires_at', 'ready', 'latched']) {
    test('accepted cooling $field gap before query fences corrected cached expiry', () {
      final fence = VirtualThermostatCoolingFence();
      final c = [configured()], good = diagnostic(e);
      accept(fence, c, [good]);
      final invalid = {...good, 'cooling_protection': {
        ...(good['cooling_protection'] as Map), field: null,
      }};
      accept(fence, c, [invalid]);
      accept(fence, c, [good]);
      expect(fence.freshClaims(rows(c, [good]), t, Duration.zero), isEmpty);
      final newer = diagnostic(e.add(const Duration(seconds: 1)));
      accept(fence, c, [newer]);
      expect(fence.freshClaims(rows(c, [newer]), t, Duration.zero), {'one'});
    });
  }

  for (final reverse in [false, true]) {
    test('raw duplicate cooling expiry high-water is order independent $reverse', () {
      final fence = VirtualThermostatCoolingFence();
      final c = [configured()];
      final newerExpiry = e.add(const Duration(seconds: 1));
      final duplicate = [diagnostic(e), diagnostic(newerExpiry)];
      accept(fence, c, reverse ? duplicate.reversed.toList() : duplicate);
      accept(fence, c, [diagnostic(newerExpiry)]);
      expect(fence.freshClaims(rows(c, [diagnostic(newerExpiry)]), t, Duration.zero), isEmpty);
      final renewal = [diagnostic(newerExpiry.add(const Duration(seconds: 1)))];
      accept(fence, c, renewal);
      expect(fence.freshClaims(rows(c, renewal), t, Duration.zero), {'one'});
    });
  }

  test('unknown invalid first expiry quarantines first parseable baseline only', () {
    final fence = VirtualThermostatCoolingFence();
    final c = [configured()];
    accept(fence, c, [{'claim': 'one', 'role': 'cooling'}]);
    expect(fence.recordCount, 1);
    accept(fence, c, [diagnostic(e)]);
    expect(fence.freshClaims(rows(c, [diagnostic(e)]), t, Duration.zero), isEmpty);
    accept(fence, c, [diagnostic(e)]);
    expect(fence.freshClaims(rows(c, [diagnostic(e)]), t, Duration.zero), isEmpty);
    final newer = [diagnostic(e.add(const Duration(seconds: 1)))];
    accept(fence, c, newer);
    expect(fence.freshClaims(rows(c, newer), t, Duration.zero), {'one'});
  });

  test('invalid first parseable baseline remains invalid even when still malformed', () {
    final fence = VirtualThermostatCoolingFence();
    final c = [configured()];
    accept(fence, c, [{'claim': 'one', 'role': 'cooling'}]);
    accept(fence, c, [{...diagnostic(e), 'physical_identity': 'wrong'}]);
    final newer = [diagnostic(e.add(const Duration(seconds: 1)))];
    accept(fence, c, newer);
    expect(fence.freshClaims(rows(c, newer), t, Duration.zero), {'one'});
  });

  for (final identity in [null, '', 'wrong', 7]) {
    test('raw runtime physical identity $identity cannot admit or query cooling', () {
      final fence = VirtualThermostatCoolingFence();
      final c = [configured()];
      final bad = [{...diagnostic(e), 'physical_identity': identity}];
      accept(fence, c, bad);
      expect(fence.freshClaims(rows(c, bad), t, Duration.zero), isEmpty);
      accept(fence, c, [diagnostic(e)]);
      expect(fence.freshClaims(rows(c, [diagnostic(e)]), t, Duration.zero), isEmpty);
      final newer = [diagnostic(e.add(const Duration(seconds: 1)))];
      accept(fence, c, newer);
      expect(fence.freshClaims(rows(c, newer), t, Duration.zero), {'one'});
    });
  }

  test('duplicate configured claims and missing bindings never admit cooling', () {
    final fence = VirtualThermostatCoolingFence();
    final c = configured(), d = diagnostic(e);
    accept(fence, [c, c], [d]);
    accept(fence, [c], [d]);
    expect(fence.freshClaims(rows([c], [d]), t, Duration.zero), isEmpty);
    final newer = diagnostic(e.add(const Duration(seconds: 1)));
    accept(fence, [{...c, 'cooling_protection': null}], [newer]);
    accept(fence, [c], [newer]);
    expect(fence.freshClaims(rows([c], [newer]), t, Duration.zero), isEmpty);
    final renewal = diagnostic(e.add(const Duration(seconds: 2)));
    accept(fence, [c], [renewal]);
    expect(fence.freshClaims(rows([c], [renewal]), t, Duration.zero), {'one'});
  });

  test('runtime-only cooling cannot promote same expiry after configuration appears', () {
    final fence = VirtualThermostatCoolingFence();
    final d = [diagnostic(e)], c = [configured()];
    accept(fence, [], d);
    expect(fence.freshClaims(rows([], d), t, Duration.zero), isEmpty);
    accept(fence, c, d);
    expect(fence.freshClaims(rows(c, d), t, Duration.zero), isEmpty);
    final newer = [diagnostic(e.add(const Duration(seconds: 1)))];
    accept(fence, c, newer);
    expect(fence.freshClaims(rows(c, newer), t, Duration.zero), {'one'});
  });

  test('missing branches and authoritative retirement keep per-claim tombstones', () {
    final fence = VirtualThermostatCoolingFence();
    final c = [configured()], d = [diagnostic(e)];
    accept(fence, c, d);
    fence.accept({'actuators': c}, {'branches': null}, t, Duration.zero);
    accept(fence, c, d);
    expect(fence.freshClaims(rows(c, d), t, Duration.zero), isEmpty);
    final newer = [diagnostic(e.add(const Duration(seconds: 1)))];
    accept(fence, c, newer);
    expect(fence.freshClaims(rows(c, newer), t, Duration.zero), {'one'});
    accept(fence, [], []);
    expect(fence.recordCount, 1);
    accept(fence, c, newer);
    expect(fence.freshClaims(rows(c, newer), t, Duration.zero), isEmpty);
    final renewed = [diagnostic(e.add(const Duration(seconds: 2)))];
    accept(fence, c, renewed);
    expect(fence.freshClaims(rows(c, renewed), t, Duration.zero), {'one'});
  });

  test('invalid future expiry pins only its claim and cap128 never evicts tombstones', () {
    final fence = VirtualThermostatCoolingFence();
    final future = t.add(const Duration(days: 365));
    accept(fence, [configured()], [{...diagnostic(future), 'physical_identity': 'wrong'}]);
    accept(fence, [configured()], [diagnostic(e)]);
    expect(fence.freshClaims(rows([configured()], [diagnostic(e)]), t, Duration.zero), isEmpty);
    final c = [configured('other')], d = [diagnostic(e, 'other')];
    accept(fence, c, d);
    expect(fence.freshClaims(rows(c, d), t, Duration.zero), {'other'});
    for (var index = 2; index < 128; index++) {
      accept(fence, [configured('claim$index')], []);
    }
    expect(fence.recordCount, 128);
    accept(fence, [], []);
    final refusedC = [configured('refused')], refusedD = [diagnostic(e, 'refused')];
    accept(fence, refusedC, refusedD);
    expect(fence.recordCount, 128);
    expect(fence.freshClaims(rows(refusedC, refusedD), t, Duration.zero), isEmpty);
    final renewed = [diagnostic(e.add(const Duration(seconds: 1)), 'other')];
    accept(fence, c, renewed);
    expect(fence.freshClaims(rows(c, renewed), t, Duration.zero), {'other'});
  });

  testWidgets('actual HTTP cooling gap and corrected cache before frame cannot hide gap', (tester) async {
    final f = MemberDetailFixture();
    final now = DateTime.now();
    f.role = 'cooling';
    f.configurationRevision = 1;
    f.cooling = coolingObservation(now);
    await f.mount(tester);
    expect(find.text('Dew point: 9.25'), findsOneWidget);
    final reads = f.runtimeReads;
    final good = f.cooling!;
    await f.acceptBeforeFrame(tester);
    f.cooling = {...good, 'surface': null};
    await f.acceptBeforeFrame(tester);
    f.cooling = good;
    await f.acceptBeforeFrame(tester);
    expect(f.runtimeReads, reads + 3);
    await tester.pump();
    expect(find.text('Dew point: 9.25'), findsNothing);
    f.cooling = coolingObservation(now.add(const Duration(seconds: 1)));
    await f.acceptBeforeFrame(tester);
    await tester.pump();
    expect(find.text('Dew point: 9.25'), findsOneWidget);
    await f.dispose(tester);
  });

  for (final mode in ['both absent', 'both malformed', 'runtime cooling', 'config cooling', 'runtime only', 'physical mismatch', 'duplicate forward', 'duplicate reverse', 'missing branch', 'missing physical', 'nonnumeric surface']) {
    testWidgets('actual detail cooling READY barrier includes $mode', (tester) async {
      final f = MemberDetailFixture();
      final now = DateTime.now();
      final c = configured();
      final d = diagnostic(now.add(const Duration(minutes: 1)));
      if (mode == 'both absent' || mode == 'both malformed') {
        c['cooling_protection'] = mode == 'both absent' ? null : 7;
        d['cooling_protection'] = mode == 'both absent' ? null : 7;
      }
      if (mode == 'runtime cooling') {
        c['role'] = 'heating';
        c.remove('cooling_protection');
        d.remove('cooling_protection');
      }
      if (mode == 'config cooling') {
        d['role'] = 'heating';
        c.remove('cooling_protection');
        d.remove('cooling_protection');
      }
      if (mode == 'physical mismatch') d['physical_identity'] = 'wrong';
      if (mode == 'missing physical') d.remove('physical_identity');
      if (mode == 'nonnumeric surface') {
        (d['cooling_protection'] as Map)['surface'] = '18';
      }
      f.overrideMembership = true;
      f.configuredMembership = mode == 'runtime only' ? <Map>[] : [c];
      final duplicate = [d, {...d, 'cooling_protection': null}];
      f.runtimeMembership = mode == 'missing branch' ? <Map>[]
          : mode == 'duplicate forward' ? duplicate
          : mode == 'duplicate reverse' ? duplicate.reversed.toList() : [d];
      await f.mount(tester);
      // Fixture deliberately reports server ready: client cooling barrier must withhold it.
      expect(find.text('Controller readiness: ready'), findsNothing);
      expect(find.text('Dew point: 9.25'), findsNothing);
      await f.dispose(tester);
    });
  }

  for (final reverse in [false, true]) {
    testWidgets('actual duplicate HTTP cooling gap before frame stays fenced $reverse', (tester) async {
      final f = MemberDetailFixture();
      final now = DateTime.now();
      final expiry = now.add(const Duration(minutes: 1));
      final c = configured(), good = diagnostic(expiry);
      f.overrideMembership = true;
      f.configuredMembership = [c];
      f.runtimeMembership = [good];
      await f.mount(tester);
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      final reads = f.runtimeReads;
      final duplicates = [good, {...good, 'physical_identity': 'wrong'}];
      f.runtimeMembership = reverse ? duplicates.reversed.toList() : duplicates;
      await f.acceptBeforeFrame(tester);
      f.runtimeMembership = [good];
      await f.acceptBeforeFrame(tester);
      expect(f.runtimeReads, reads + 2);
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsNothing);
      expect(find.text('Controller readiness: ready'), findsNothing);
      f.runtimeMembership = [diagnostic(expiry.add(const Duration(seconds: 1)))];
      await f.acceptBeforeFrame(tester);
      await tester.pump();
      expect(find.text('Dew point: 9.25'), findsOneWidget);
      expect(find.text('Controller readiness: ready'), findsOneWidget);
      await f.dispose(tester);
    });
  }

  testWidgets('rejected revision and runtime-null refresh do not invalidate admitted cooling', (tester) async {
    final f = MemberDetailFixture();
    final now = DateTime.now();
    f.role = 'cooling';
    f.configurationRevision = 1;
    f.cooling = coolingObservation(now);
    await f.mount(tester);
    final good = f.cooling!;
    f.runtimeConfigurationRevision = 2;
    f.cooling = {...good, 'surface': null};
    await f.acceptBeforeFrame(tester);
    await tester.pump();
    expect(find.text('Dew point: 9.25'), findsNothing);
    f.runtimeConfigurationRevision = null;
    f.cooling = good;
    await f.acceptBeforeFrame(tester);
    await tester.pump();
    expect(find.text('Dew point: 9.25'), findsOneWidget);
    f.failRuntimeReads = true;
    await f.acceptBeforeFrame(tester);
    await tester.pump();
    expect(find.text('Dew point: 9.25'), findsNothing);
    f.failRuntimeReads = false;
    await f.acceptBeforeFrame(tester);
    await tester.pump();
    expect(find.text('Dew point: 9.25'), findsOneWidget);
    await f.dispose(tester);
  });

  testWidgets('heating-only member keeps independent floor and relay diagnostics', (tester) async {
    final f = MemberDetailFixture();
    final now = DateTime.now();
    f.sample = protection(now, 20);
    f.observation = activityObservation(now, 'on');
    await f.mount(tester);
    expect(find.text('Controller readiness: ready'), findsOneWidget);
    expect(find.text('Live protection reading: 20.0 °C'), findsOneWidget);
    expect(find.text('Reported observation: on'), findsOneWidget);
    expect(find.text('Dew point: 9.25'), findsNothing);
    await f.dispose(tester);
  });
}
