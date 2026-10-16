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
        'role': 'cooling',
        'cooling_protection': coolingObservation(now),
      };
      List<VirtualThermostatMember> members() => [
        VirtualThermostatMember(c, d),
      ];
      expect(fence.freshClaims(members(), now, Duration.zero), {'one'});
      expect(
        fence.freshClaims(
          members(),
          now.subtract(const Duration(seconds: 10)),
          const Duration(seconds: 3),
        ),
        isEmpty,
      );
      expect(
        fence.freshClaims(members(), now, const Duration(seconds: 3)),
        isEmpty,
      ); // Identical fetch cannot revive.
      d = {
        ...d,
        'cooling_protection': coolingObservation(
          now.add(const Duration(seconds: 5)),
        ),
      };
      expect(fence.freshClaims(members(), now, const Duration(seconds: 3)), {
        'one',
      });
      c = {...c, 'revision': 2};
      expect(
        fence.freshClaims(members(), now, const Duration(seconds: 3)),
        isEmpty,
      );
      d = {
        ...d,
        'cooling_protection': coolingObservation(
          now.add(const Duration(seconds: 6)),
        ),
      };
      expect(fence.freshClaims(members(), now, const Duration(seconds: 3)), {
        'one',
      });
      final binding = c['cooling_protection'] as Map;
      c = {
        ...c,
        'cooling_protection': {...binding, 'surface_property': null},
      };
      expect(
        fence.freshClaims(members(), now, const Duration(seconds: 3)),
        isEmpty,
      );
      c = {...c, 'cooling_protection': binding};
      expect(
        fence.freshClaims(members(), now, const Duration(seconds: 3)),
        isEmpty,
      );
      d = {
        ...d,
        'cooling_protection': coolingObservation(
          now.add(const Duration(seconds: 7)),
        ),
      };
      expect(fence.freshClaims(members(), now, const Duration(seconds: 3)), {
        'one',
      });
      d = {
        ...d,
        'cooling_protection': coolingObservation(
          now.add(const Duration(seconds: 4)),
        ),
      };
      expect(
        fence.freshClaims(members(), now, const Duration(seconds: 3)),
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
  int? configurationRevision;
  int? runtimeConfigurationRevision;
  bool missingCoolingSurface = false;
  String claimId = 'one';
  bool hold = false, hasMember = true, declaresMemberProtection = true;
  List<Map<String, dynamic>> sources = [], inputs = [], extraBranches = [];
  String? displayFloorClaim;
  String role = 'heating';
  Map<String, dynamic>? cooling;
  Locale? locale;
  Map<String, dynamic>? sample;
  Map<String, dynamic> observation = {};

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
                  'configuration_revision':
                      runtimeConfigurationRevision ??
                      configurationRevision ??
                      revision,
                  'requested_mode': role == 'cooling' ? 'cool' : 'heat',
                  'readiness': cooling != null ? 'unavailable' : 'ready',
                  'reasons': <String>[],
                  'inputs': inputs,
                  'branches': [
                    ...extraBranches,
                    if (hasMember)
                      {
                        'claim': claimId,
                        'role': role,
                        'activity': 'off',
                        ...observation,
                        'protection': sample,
                        'cooling_protection': cooling,
                      },
                  ],
                }
              : {
                  'revision': configurationRevision ?? revision,
                  'locked': false,
                  'policy': {
                    'heatingSetpoint': role == 'heating' ? 21 : null,
                    'coolingSetpoint': role == 'cooling' ? 25 : null,
                  },
                  'settings': <Map>[],
                  'sources': sources,
                  'display_floor_claim': displayFloorClaim,
                  'actuators': [
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

  Future<void> dispose(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await flush(tester);
    expect(tester.takeException(), isNull);
  }
}
