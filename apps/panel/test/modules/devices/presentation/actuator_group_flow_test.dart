import 'dart:async';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/models/composite_command.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/actuator_group.dart';
import 'package:fastybird_smart_panel/modules/devices/services/actuator_group_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/covers_state/covers_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/intent_result/intent_result.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/domain_pages/grouped_covers_room_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/export.dart';
import 'package:fastybird_smart_panel/modules/devices/services/composite_command_service.dart';
import 'package:mocktail/mocktail.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class BatchDevicesRepo extends Mock implements DevicesRepository {}

class BatchDeviceControls extends Mock implements DeviceControlsRepository {}

class BatchChannels extends Mock implements ChannelsRepository {}

class BatchProperties extends Mock implements ChannelPropertiesRepository {}

class BatchChannelControls extends Mock implements ChannelControlsRepository {}

class BatchValidation extends Mock implements DeviceValidationRepository {}

class BatchComposite extends Mock implements CompositeCommandService {}

class GroupSocket extends SocketService {
  bool online = true;
  void Function(bool)? connection;
  void Function(String, Map<String, dynamic>)? handler;
  @override
  bool get isConnected => online;
  @override
  void addConnectionListener(void Function(bool) listener) =>
      connection = listener;
  @override
  void removeConnectionListener(void Function(bool) listener) =>
      connection = null;
  @override
  void registerEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) listener,
  ) => handler = listener;
  @override
  void unregisterEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) listener,
  ) => handler = null;
  void connect(bool value) {
    online = value;
    connection?.call(value);
  }
}

ActuatorGroupConfiguration config({
  String profile = 'cover',
  int revision = 1,
  bool expired = false,
}) {
  final cover = profile == 'cover';
  final fields = cover
      ? ['type', 'status', 'position', 'command']
      : ['on', 'speed', 'direction'];
  return ActuatorGroupConfiguration.fromJson({
    'group_channel': 'group-channel',
    'schema_version': 1,
    'profile': profile,
    'revision': revision,
    'graph_revision': revision,
    'runtime_readiness': 'ready',
    'common_capabilities': [
      for (final field in fields)
        {
          'category': field,
          'data_type': ['on'].contains(field)
              ? 'bool'
              : field == 'position'
              ? 'uchar'
              : 'enum',
          'access': ['type', 'status'].contains(field)
              ? 'ro'
              : field == 'command'
              ? 'wo'
              : 'rw',
          'unit': field == 'position' ? '%' : null,
          'step': field == 'position' ? 1 : null,
          'format': switch (field) {
            'type' => ['blind'],
            'position' => [0, 100],
            'command' => ['open', 'close', 'stop'],
            'speed' => ['low', 'high'],
            'direction' => ['clockwise', 'counter_clockwise'],
            _ => null,
          },
        },
    ],
    'members': [
      for (final member in ['a', 'b'])
        {
          'id': member,
          'source_channel': member == 'b' ? null : member,
          'source_identity': member,
          'bindings': [
            for (final field in fields)
              {
                'id': '$member-$field',
                'output_property': 'output-$field',
                'source_property': member == 'b' ? null : '$member-$field',
                'source_identity': '$member-$field',
                'quantity': field,
                'unit': null,
              },
          ],
        },
    ],
    'operations': cover
        ? [
            for (final operation in [
              'open',
              'close',
              'stop',
              'position',
              'tilt',
            ])
              {
                'operation': operation,
                'commandable': operation == 'open',
                'members': [
                  {
                    'source_identity': 'a',
                    'commandable': operation == 'open',
                    'reasons': operation == 'open'
                        ? <String>[]
                        : ['tag_unavailable'],
                  },
                ],
              },
          ]
        : null,
    'reported_state': {
      'on': false,
      'all_on': false,
      'mixed': true,
      'total': 2,
      'on_count': 0,
      'off_count': 1,
      'unknown_count': 1,
      'members': [
        {'source_identity': 'a', 'on': false, 'reasons': <String>[]},
        {
          'source_identity': 'b',
          'on': null,
          'reasons': ['missing_channel'],
        },
      ],
      'properties': [
        for (final field in fields.where((field) => field != 'command'))
          {
            'category': field,
            'value': field == 'on'
                ? false
                : field == 'type'
                ? 'blind'
                : null,
            'mixed': ['position', 'speed'].contains(field),
            'contributors': ['a'],
            'provenance': field == 'type' ? 'configured' : null,
            'sampled_at': field == 'type'
                ? null
                : DateTime.now()
                      .subtract(const Duration(seconds: 1))
                      .toIso8601String(),
            'expires_at': field == 'type'
                ? null
                : DateTime.now()
                      .add(Duration(seconds: expired ? -1 : 10))
                      .toIso8601String(),
          },
      ],
    },
  });
}

Widget localized(Widget child) => MaterialApp(
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: child,
);
DeviceView groupDevice(String profile) => DeviceView(
  id: 'group',
  type: 'virtual',
  isCompositeGroup: true,
  name: 'Group',
  channels: [
    ChannelView(
      id: 'group-channel',
      type: 'virtual',
      device: 'group',
      category: profile == 'cover'
          ? DevicesModuleChannelCategory.windowCovering
          : DevicesModuleChannelCategory.fan,
      properties: [],
    ),
  ],
);
void main() {
  setUpAll(
    () => registerFallbackValue(const PropertyCommandContext(origin: 'test')),
  );
  test(
    'connection generation fences old HTTP and disposal; metadata drift requires explicit reload',
    () async {
      final socket = GroupSocket();
      final first = Completer<ActuatorGroupConfiguration>();
      var calls = 0;
      final state = ActuatorGroupState(
        channelId: 'group-channel',
        socket: socket,
        loader: () =>
            ++calls == 1 ? first.future : Future.value(config(revision: calls)),
      );
      final old = state.refresh();
      socket.connect(false);
      first.complete(config());
      await old;
      expect(state.configuration, isNull);
      expect(state.commandable, isFalse);
      socket.connect(true);
      await Future<void>.delayed(Duration.zero);
      expect(state.commandable, isTrue);
      await state.refresh();
      expect(state.needsReload, isTrue);
      expect(state.commandable, isFalse);
      await state.refresh(explicit: true);
      expect(state.commandable, isTrue);
      state.dispose();
      expect(socket.handler, isNull);
      expect(socket.connection, isNull);
    },
  );
  test(
    'actual DevicesService rejects mixed/multiple groups before dispatch and preserves valid batches',
    () async {
      final raw = BatchProperties(), commands = BatchComposite();
      final devices = DevicesService(
        devicesRepository: BatchDevicesRepo(),
        devicesControlsRepository: BatchDeviceControls(),
        channelsRepository: BatchChannels(),
        channelPropertiesRepository: raw,
        channelControlsRepository: BatchChannelControls(),
        validationRepository: BatchValidation(),
        compositeCommands: commands,
      );
      devices.devices.addAll({
        for (final id in ['a', 'b', 'raw'])
          id: DeviceView(
            id: id,
            type: 'virtual',
            name: id,
            channels: [],
            isCompositeGroup: id != 'raw',
          ),
      });
      when(
        () => commands.send(
          deviceId: any(named: 'deviceId'),
          properties: any(named: 'properties'),
          context: any(named: 'context'),
        ),
      ).thenAnswer(
        (_) async => const CompositeCommandOutcome(
          id: 'parent',
          requestId: 'request',
          status: 'confirmed',
          children: [],
        ),
      );
      when(
        () => raw.setMultipleValues(
          properties: any(named: 'properties'),
          context: any(named: 'context'),
          requireAtomicBatch: any(named: 'requireAtomicBatch'),
        ),
      ).thenAnswer((_) async => true);
      PropertyCommandItem target(String id) => PropertyCommandItem(
        deviceId: id,
        channelId: 'channel',
        propertyId: 'command',
        value: true,
      );
      expect(
        await devices.setMultiplePropertyValues(
          properties: [target('a'), target('b')],
        ),
        isFalse,
      );
      expect(
        await devices.setMultiplePropertyValues(
          properties: [target('a'), target('raw')],
        ),
        isFalse,
      );
      verifyNever(
        () => commands.send(
          deviceId: any(named: 'deviceId'),
          properties: any(named: 'properties'),
          context: any(named: 'context'),
        ),
      );
      verifyNever(
        () => raw.setMultipleValues(
          properties: any(named: 'properties'),
          context: any(named: 'context'),
          requireAtomicBatch: any(named: 'requireAtomicBatch'),
        ),
      );
      expect(
        await devices.setMultiplePropertyValues(
          properties: [target('a'), target('a')],
        ),
        isTrue,
      );
      verify(
        () => commands.send(
          deviceId: 'a',
          properties: any(named: 'properties'),
          context: any(named: 'context'),
        ),
      ).called(1);
      expect(
        await devices.setMultiplePropertyValues(properties: [target('raw')]),
        isTrue,
      );
      devices.dispose();
    },
  );
  testWidgets(
    'queues a fresh post-command room read behind an in-flight periodic read',
    (tester) async {
      CoversStateModel state(bool enabled) => CoversStateModel.fromJson({
        'has_covers': true,
        'group_operations': [
          {
            'operation': 'open',
            'commandable': enabled,
            'reasons': enabled
                ? <String>[]
                : ['position_unavailable_uncalibrated'],
          },
        ],
      }, spaceId: 'room');
      final periodic = Completer<CoversStateModel?>(),
          after = Completer<CoversStateModel?>(),
          command = Completer<CoversIntentResult?>();
      var reads = 0;
      await tester.pumpWidget(
        localized(
          Scaffold(
            body: GroupedCoversRoomControls(
              state: state(true),
              reload: () {
                reads++;
                return reads == 1
                    ? Future.value(state(true))
                    : reads == 2
                    ? periodic.future
                    : after.future;
              },
              send: (_) => command.future,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('room-cover-open')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 5));
      expect(reads, 2);
      command.complete(
        CoversIntentResult.fromJson({
          'success': true,
          'affected_devices': 1,
          'failed_devices': 0,
        }),
      );
      await tester.pump();
      expect(reads, 2);
      periodic.complete(state(true));
      await tester.pump();
      expect(reads, 3);
      after.complete(state(false));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('position_unavailable_uncalibrated'),
        findsOneWidget,
      );
      expect(
        tester
            .widget<FilledButton>(find.byKey(const ValueKey('room-cover-open')))
            .onPressed,
        isNull,
      );
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'cover operations use readiness, preserve actual mixed feedback and show partial children',
    (tester) async {
      final state = ActuatorGroupState(
        channelId: 'group-channel',
        loader: () async => config(),
      );
      final completion = Completer<CompositeCommandOutcome>();
      List<PropertyCommandItem>? sent;
      await tester.pumpWidget(
        localized(
          ActuatorGroupDeviceDetail(
            device: groupDevice('cover'),
            state: state,
            sender: (targets) {
              sent = targets;
              return completion.future;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Position: Mixed'), findsOneWidget);
      expect(find.text('blind'), findsNothing);
      expect(find.text('Type: blind'), findsOneWidget);
      expect(find.text('Configured metadata'), findsOneWidget);
      expect(find.byKey(const ValueKey('group-number-position')), findsNothing);
      expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const ValueKey('group-command-stop')),
            )
            .onPressed,
        isNull,
      );
      final open = find.byKey(const ValueKey('group-command-open'));
      await tester.ensureVisible(open);
      await tester.tap(open);
      await tester.pump();
      expect(sent!.single.propertyId, 'output-command');
      expect(sent!.single.value, 'open');
      expect(tester.widget<OutlinedButton>(open).onPressed, isNull);
      completion.complete(
        const CompositeCommandOutcome(
          id: 'parent',
          requestId: 'request',
          status: 'partial',
          children: [
            CompositeChildOutcome(memberId: 'a', status: 'confirmed'),
            CompositeChildOutcome(
              memberId: 'b',
              status: 'failed',
              reason: 'missing_channel',
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Group command: Partial'), findsOneWidget);
      expect(find.textContaining('missing_channel'), findsWidgets);
      expect(find.text('Position: Mixed'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      state.dispose();
    },
  );
  testWidgets(
    'fan keeps false distinct from unknown, expires mixed feedback and sends native enum',
    (tester) async {
      final socket = GroupSocket();
      var expired = false;
      final state = ActuatorGroupState(
        channelId: 'group-channel',
        socket: socket,
        loader: () async => config(profile: 'fan', expired: expired),
      );
      List<PropertyCommandItem>? sent;
      await tester.pumpWidget(
        localized(
          ActuatorGroupDeviceDetail(
            device: groupDevice('fan'),
            state: state,
            sender: (targets) async {
              sent = targets;
              return const CompositeCommandOutcome(
                id: 'x',
                requestId: '',
                status: 'confirmed',
                children: [],
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Power: Off'), findsOneWidget);
      expect(find.text('Speed: Mixed'), findsOneWidget);
      final speed = find.byKey(const ValueKey('group-enum-speed'));
      await tester.ensureVisible(speed);
      await tester.tap(speed);
      await tester.pumpAndSettle();
      await tester.tap(find.text('low').last);
      await tester.pumpAndSettle();
      expect(sent!.single.value, 'low');
      expired = true;
      await state.refresh();
      await tester.pump();
      expect(find.text('Power: Unknown'), findsOneWidget);
      expect(find.text('Speed: Unknown'), findsOneWidget);
      socket.connect(false);
      await tester.pump();
      expect(find.text('Unavailable'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      state.dispose();
    },
  );
  testWidgets(
    'room cover controls retain unknown actual position, per-operation refusal and member outcomes',
    (tester) async {
      final state = CoversStateModel.fromJson({
        'has_covers': true,
        'average_position': null,
        'all_closed': false,
        'group_operations': [
          {'operation': 'open', 'commandable': true, 'reasons': <String>[]},
          {
            'operation': 'stop',
            'commandable': false,
            'reasons': ['b: tag_unavailable'],
          },
        ],
      }, spaceId: 'room');
      final pending = Completer<CoversIntentResult?>();
      var sends = 0;
      await tester.pumpWidget(
        localized(
          Scaffold(
            body: GroupedCoversRoomControls(
              state: state,
              reload: () async => state,
              send: (operation) {
                sends++;
                expect(operation, 'open');
                return pending.future;
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Unknown'), findsOneWidget);
      expect(find.textContaining('tag_unavailable'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(find.byKey(const ValueKey('room-cover-stop')))
            .onPressed,
        isNull,
      );
      await tester.tap(find.byKey(const ValueKey('room-cover-open')));
      await tester.pump();
      expect(find.text('Pending'), findsOneWidget);
      pending.complete(
        CoversIntentResult.fromJson({
          'success': false,
          'affected_devices': 0,
          'failed_devices': 1,
          'new_position': null,
          'composites': [
            {
              'id': 'parent',
              'status': 'partial',
              'children': [
                {'member_id': 'a', 'status': 'confirmed'},
                {
                  'member_id': 'b',
                  'status': 'unavailable',
                  'reason': 'tag_unavailable',
                },
              ],
            },
          ],
        }),
      );
      await tester.pumpAndSettle();
      expect(sends, 1);
      expect(find.text('Unknown'), findsOneWidget);
      expect(find.textContaining('b: Unavailable'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
