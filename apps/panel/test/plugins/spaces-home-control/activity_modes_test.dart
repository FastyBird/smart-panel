import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/constants.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/module.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/light_targets.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/interceptors/retry_interceptor.dart';
import 'package:fastybird_smart_panel/core/interceptors/token_refresh_interceptor.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/activity_modes.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/activity_modes_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

const space = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6';
const activation = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c7';
Map<String, dynamic> config(String mode, int order, {bool enabled = true}) => {
  'id': activation,
  'space_id': space,
  'created_at': '2026-10-16T00:00:00Z',
  'type': 'activity_config',
  'activity_mode': mode,
  'activity_enabled': enabled,
  'activity_order': order,
  'activity_revision': 3,
  'activity_configuration': {
    'lighting': {'enabled': true, 'mode': 'work'},
    'climate': {'enabled': false},
    'covers': {'enabled': false, 'position': 0},
    'media': {'enabled': false, 'activity': 'off'},
    'security': {'enabled': false},
  },
};
Map<String, dynamic> active({
  String? mode = 'work',
  String status = 'partial',
}) => {
  'id': activation,
  'space_id': space,
  'created_at': '2026-10-16T00:00:00Z',
  'type': 'activity_state',
  'selected_activity_mode': mode,
  'activation_id': activation,
  'selected_activity_revision': 3,
  'activity_status': status,
  'activity_actor': 'display:test',
  'activity_results': [
    {'domain': 'lighting', 'status': 'succeeded', 'reason': 'completed'},
    {
      'domain': 'climate',
      'status': 'unsupported',
      'reason': 'adapter unavailable',
    },
  ],
};

class ActivityDisplay extends Mock implements DisplayRepository {}

class ActivitySocket extends Mock implements SocketService {}

class ActivityAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  int postStatus = 200;
  bool timeout = false;
  bool omitResult = false;
  bool omitActiveEnvelope = false;
  bool wrongMode = false;
  bool staleIdentity = false;
  dynamic state;
  final Map<String, dynamic> statesBySpace = {};
  Completer<void>? postGate;
  Completer<void>? readGate;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    dynamic result;
    if (options.method == 'POST') {
      if (postGate != null) await postGate!.future;
      if (timeout) {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.receiveTimeout,
        );
      }
      result = omitResult
          ? null
          : active(
              mode: options.path.endsWith('deactivate') ? null : 'work',
              status: options.path.endsWith('deactivate')
                  ? 'deactivated'
                  : 'partial',
            );
      if (options.path.endsWith('deactivate') && result != null) {
        result['activation_id'] = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c8';
      }
      if (wrongMode && result != null) {
        result['selected_activity_mode'] = 'relax';
      }
      if (staleIdentity && result != null) result['activation_id'] = activation;
      state = result;
    } else if (options.path.endsWith('/active')) {
      result = statesBySpace.containsKey(options.path.split('/')[4])
          ? statesBySpace[options.path.split('/')[4]]
          : state;
      if (readGate != null) await readGate!.future;
    } else {
      result =
          [
                config('relax', 2),
                config('work', 1),
                config('away', 0, enabled: false),
              ]
              .map(
                (value) => {...value, 'space_id': options.path.split('/')[4]},
              )
              .toList();
    }
    return ResponseBody.fromString(
      jsonEncode(
        omitActiveEnvelope &&
                options.method == 'GET' &&
                options.path.endsWith('/active')
            ? <String, dynamic>{}
            : {'data': result},
      ),
      options.method == 'POST' ? postStatus : 200,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    await locator.reset();
    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 1280, screenHeight: 800, pixelRatio: 1),
      dispose: (service) => service.dispose(),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 1),
    );
  });
  tearDownAll(() async {
    await locator.reset();
  });
  late Dio dio;
  late ActivityAdapter adapter;
  late ActivityModesRepository repository;
  late ActivityDisplay display;
  setUp(() {
    adapter = ActivityAdapter();
    dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'))
      ..httpClientAdapter = adapter;
    display = ActivityDisplay();
    dio.interceptors.addAll([
      RetryInterceptor(dio, config: RetryConfig.testConfig),
      TokenRefreshInterceptor(display),
    ]);
    repository = ActivityModesRepository(dio: dio);
  });
  tearDown(() {
    repository.dispose();
    dio.close();
  });

  test(
    'decodes generated configuration and null state, filters disabled and orders modes',
    () async {
      await repository.bind(space);
      expect(repository.fresh, isTrue);
      expect(repository.state, isNull);
      expect(repository.modes.map((m) => m.toJson()['activity_mode']), [
        'work',
        'relax',
      ]);
      expect(adapter.requests.every((r) => r.method == 'GET'), isTrue);
    },
  );

  test(
    'submits revision and preserves partial selection; deactivation sends exact server identity',
    () async {
      await repository.bind(space);
      await repository.activate(repository.modes.first);
      expect(repository.state?.toJson()['activity_status'], 'partial');
      expect(repository.state?.toJson()['selected_activity_mode'], 'work');
      expect(adapter.requests.last.data, {
        'data': {'expected_revision': 3},
      });
      await repository.deactivate();
      expect(adapter.requests.last.data, {
        'data': {'activation_id': activation},
      });
      expect(repository.state?.selectedActivityMode, isNull);
      expect(repository.state?.toJson()['activity_status'], 'deactivated');
    },
  );

  for (final failure in ['401', '500', 'timeout', 'missing', '409']) {
    test(
      '$failure submits once, never refreshes tokens or invents success',
      () async {
        await repository.bind(space);
        adapter.postStatus = int.tryParse(failure) ?? 200;
        adapter.timeout = failure == 'timeout';
        adapter.omitResult = failure == 'missing';
        await repository.activate(repository.modes.first);
        expect(adapter.requests.where((r) => r.method == 'POST').length, 1);
        final post = adapter.requests.firstWhere((r) => r.method == 'POST');
        expect(post.extra['noActuationReplay'], isTrue);
        expect(post.extra['retryExhausted'], isTrue);
        verifyNever(() => display.refreshToken());
        if (failure != '409') {
          expect(repository.issue, ActivityModeIssue.unconfirmed);
        } else {
          expect(repository.issue, ActivityModeIssue.conflict);
        }
      },
    );
  }

  test(
    'mismatched mode response is unconfirmed and reconciled read only',
    () async {
      await repository.bind(space);
      adapter.wrongMode = true;
      await repository.activate(repository.modes.first);
      expect(repository.issue, ActivityModeIssue.unconfirmed);
      expect(adapter.requests.where((r) => r.method == 'POST').length, 1);
    },
  );

  test(
    'activation retaining prior identity is unconfirmed even for matching mode and revision',
    () async {
      adapter.state = active();
      await repository.bind(space);
      await repository.activate(repository.modes.first);
      expect(repository.issue, ActivityModeIssue.unconfirmed);
      expect(adapter.requests.where((r) => r.method == 'POST').length, 1);
    },
  );

  test('deactivate response retaining old identity is unconfirmed', () async {
    adapter.state = active();
    await repository.bind(space);
    adapter.staleIdentity = true;
    await repository.deactivate();
    expect(repository.issue, ActivityModeIssue.unconfirmed);
  });

  test('late action from old space cannot replace newly bound state', () async {
    await repository.bind(space);
    adapter.postGate = Completer<void>();
    final request = repository.activate(repository.modes.first);
    await Future<void>.delayed(Duration.zero);
    await repository.bind('other-space');
    expect(repository.state, isNull);
    adapter.postGate!.complete();
    await request;
    expect(repository.spaceId, 'other-space');
    expect(repository.state, isNull);
  });

  test('late GET cannot overwrite a newer request or null result', () async {
    adapter.state = active();
    await repository.bind(space);
    adapter.readGate = Completer<void>();
    final old = repository.refresh();
    await Future<void>.delayed(Duration.zero);
    final gate = adapter.readGate!;
    adapter.readGate = null;
    adapter.state = null;
    await repository.refresh();
    gate.complete();
    await old;
    expect(repository.state, isNull);
  });

  test(
    'disconnect disables taps and reconnect refresh remains read only',
    () async {
      await repository.bind(space);
      repository.markStale();
      await repository.activate(repository.modes.first);
      expect(repository.canSubmit, isFalse);
      await repository.refresh();
      expect(repository.canSubmit, isTrue);
      expect(adapter.requests.every((r) => r.method == 'GET'), isTrue);
    },
  );

  test(
    'refresh hints while pending only refetch after one submission',
    () async {
      await repository.bind(space);
      adapter.postGate = Completer<void>();
      final action = repository.activate(repository.modes.first);
      await repository.refresh();
      await repository.refresh();
      adapter.postGate!.complete();
      await action;
      expect(adapter.requests.where((r) => r.method == 'POST').length, 1);
      expect(repository.fresh, isTrue);
    },
  );

  for (final failed in [false, true]) {
    test(
      'markStale during a held POST reconciles read-only after completion (failed: $failed)',
      () async {
        await repository.bind(space);
        adapter.postGate = Completer<void>();
        adapter.timeout = failed;
        final action = repository.activate(repository.modes.first);
        await pumpEventQueue();
        expect(repository.busy, isTrue);
        repository.markStale();
        expect(repository.canSubmit, isFalse);
        adapter.postGate!.complete();
        await action;
        expect(adapter.requests.where((r) => r.method == 'POST').length, 1);
        expect(adapter.requests.where((r) => r.method == 'GET').length, 4);
        expect(repository.fresh, isTrue);
        expect(repository.busy, isFalse);
        expect(repository.canSubmit, isTrue);
        expect(
          repository.issue,
          failed ? ActivityModeIssue.unconfirmed : isNull,
        );
        if (failed) expect(repository.state, isNull);
      },
    );
  }
  test(
    'a stale pending action cannot reconcile into a newly bound space',
    () async {
      const other = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c9';
      await repository.bind(space);
      adapter.postGate = Completer<void>();
      final action = repository.activate(repository.modes.first);
      await pumpEventQueue();
      repository.markStale();
      await repository.bind(other);
      final reads = adapter.requests.where((r) => r.method == 'GET').length;
      adapter.postGate!.complete();
      await action;
      expect(repository.spaceId, other);
      expect(repository.canSubmit, isTrue);
      expect(repository.state, isNull);
      expect(adapter.requests.where((r) => r.method == 'POST').length, 1);
      expect(adapter.requests.where((r) => r.method == 'GET').length, reads);
    },
  );

  testWidgets(
    'actual module device events scope independent activity sessions and conservatively refresh unknown membership',
    (tester) async {
      const other = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c9';
      const deviceId = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8d0';
      const channelId = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8d1';
      final intents = IntentsRepository();
      locator.registerSingleton<IntentsRepository>(intents);
      final module = SpacesHomeControlPluginService(
        apiClient: ApiClient(dio),
        socketService: ActivitySocket(),
        dio: dio,
      );
      final registry = locator<ActivityModesRegistry>();
      final first = registry.create(), second = registry.create();
      try {
        await tester.runAsync(() async {
          await first.bind(space);
          await second.bind(other);
        });
        await tester.pumpWidget(
          MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: Column(
                children: [
                  ActivityModesSection(spaceId: space, repository: first),
                  ActivityModesSection(spaceId: other, repository: second),
                ],
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        adapter.requests.clear();
        await tester.runAsync(() async {
          module.handleDeviceSocketEvent(
            DevicesModuleConstants.channelUpdatedEvent,
            {'id': channelId, 'room_id': space, 'zone_ids': <String>[]},
          );
          await pumpEventQueue();
        });
        await tester.pumpAndSettle();
        expect(adapter.requests.length, 2);
        expect(
          adapter.requests.every(
            (r) => r.method == 'GET' && r.path.contains('/$space/'),
          ),
          isTrue,
        );
        expect(first.canSubmit, isTrue);
        expect(second.canSubmit, isTrue);
        // A cached former membership must also refresh when the payload names the new room.
        locator<LightTargetsRepository>().insert(other, [
          {'device_id': deviceId, 'channel_id': channelId},
        ]);
        adapter.requests.clear();
        await tester.runAsync(() async {
          module.handleDeviceSocketEvent(
            DevicesModuleConstants.channelUpdatedEvent,
            {'id': channelId, 'room_id': space, 'zone_ids': <String>[]},
          );
          await pumpEventQueue();
        });
        await tester.pumpAndSettle();
        expect(adapter.requests.length, 4);
        expect(adapter.requests.every((r) => r.method == 'GET'), isTrue);
        adapter.requests.clear();
        await tester.runAsync(() async {
          module.handleDeviceSocketEvent(
            DevicesModuleConstants.deviceDeletedEvent,
            {'id': deviceId},
          );
          await pumpEventQueue();
        });
        await tester.pumpAndSettle();
        expect(adapter.requests.length, 4);
        expect(adapter.requests.every((r) => r.method == 'GET'), isTrue);
        adapter.requests.clear();
        await tester.runAsync(() async {
          module.handleDeviceSocketEvent(
            DevicesModuleConstants.deviceUpdatedEvent,
            {'room_id': space},
          );
          await pumpEventQueue();
        });
        await tester.pumpAndSettle();
        expect(adapter.requests, isEmpty);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        module.dispose();
        locator.unregister<IntentsRepository>();
        intents.dispose();
      }
    },
  );

  test('released sessions reject submissions and late reads', () async {
    await repository.bind(space);
    final mode = repository.modes.first;
    final before = adapter.requests.length;
    repository.dispose();
    await repository.activate(mode);
    await repository.refresh();
    await repository.bind('different-space');
    expect(repository.canSubmit, isFalse);
    expect(adapter.requests.length, before);
  });

  test(
    'unknown persisted status remains unavailable and cannot submit',
    () async {
      adapter.state = active(status: 'unknown-status');
      await repository.bind(space);
      expect(repository.fresh, isFalse);
      expect(repository.canSubmit, isFalse);
      expect(repository.issue, ActivityModeIssue.unavailable);
      expect(
        adapter.requests.every((request) => request.method == 'GET'),
        isTrue,
      );
    },
  );

  test(
    'missing active envelope is unavailable rather than a confirmed manual state',
    () async {
      adapter.omitActiveEnvelope = true;
      await repository.bind(space);
      expect(repository.fresh, isFalse);
      expect(repository.canSubmit, isFalse);
      expect(repository.issue, ActivityModeIssue.unavailable);
      expect(
        adapter.requests.every((request) => request.method == 'GET'),
        isTrue,
      );
    },
  );

  for (final scenario in <(String?, String)>[
    ('active', 'Selected · commands completed'),
    ('failed', 'Selected · commands failed'),
    ('interrupted', 'Selected · interrupted'),
    ('deactivated', 'Manual'),
    (null, 'Manual'),
  ]) {
    testWidgets(
      'actual section displays persisted ${scenario.$1 ?? 'null'} state',
      (tester) async {
        final status = scenario.$1;
        adapter.state = status == null
            ? null
            : active(
                mode: status == 'deactivated' ? null : 'work',
                status: status,
              );
        await tester.runAsync(() => repository.bind(space));
        await tester.pumpWidget(
          MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: ActivityModesSection(
                spaceId: space,
                repository: repository,
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text(scenario.$2), findsOneWidget);
        final work = tester.widget<FilterChip>(
          find.widgetWithText(FilterChip, 'Work'),
        );
        expect(work.selected, status != null && status != 'deactivated');
        expect(
          find.byIcon(Icons.warning_amber_rounded),
          status == 'failed' || status == 'interrupted'
              ? findsOneWidget
              : findsNothing,
        );
        expect(
          adapter.requests.every((request) => request.method == 'GET'),
          isTrue,
        );
      },
    );
  }

  testWidgets(
    'a retained selection stays named when its mode becomes disabled',
    (tester) async {
      adapter.state = active(mode: 'away', status: 'active');
      await tester.runAsync(() => repository.bind(space));
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ActivityModesSection(spaceId: space, repository: repository),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.widgetWithText(FilterChip, 'Away'), findsNothing);
      expect(find.text('Away · Selected · commands completed'), findsOneWidget);
      expect(find.widgetWithText(ActionChip, 'Manual'), findsOneWidget);
      expect(
        adapter.requests.every((request) => request.method == 'GET'),
        isTrue,
      );
    },
  );

  testWidgets(
    'actual activate tap shows pending only and blocks a second submission',
    (tester) async {
      await tester.runAsync(() => repository.bind(space));
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ActivityModesSection(spaceId: space, repository: repository),
          ),
        ),
      );
      await tester.pumpAndSettle();
      adapter.postGate = Completer<void>();
      await tester.tap(find.text('Work'));
      await tester.pump(const Duration(milliseconds: 1));
      expect(repository.busy, isTrue);
      expect(find.text('Sending request…'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      final work = tester.widget<FilterChip>(
        find.widgetWithText(FilterChip, 'Work'),
      );
      expect(work.selected, isFalse);
      expect(work.onSelected, isNull);
      await tester.tap(find.text('Relax'));
      await tester.pump(const Duration(milliseconds: 1));
      expect(
        adapter.requests.where((request) => request.method == 'POST').length,
        1,
      );
      adapter.postGate!.complete();
      await tester.pumpAndSettle();
      expect(repository.busy, isFalse);
      expect(find.text('Sending request…'), findsNothing);
      expect(
        tester
            .widget<FilterChip>(find.widgetWithText(FilterChip, 'Work'))
            .selected,
        isTrue,
      );
      expect(
        find.text('Selected · some commands could not complete'),
        findsOneWidget,
      );
      final post = adapter.requests.singleWhere(
        (request) => request.method == 'POST',
      );
      expect(post.path, endsWith('/work/activate'));
      expect(post.data, {
        'data': {'expected_revision': 3},
      });
    },
  );

  testWidgets('localized chips remain usable on a narrow panel', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 480);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.runAsync(() => repository.bind(space));
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('cs'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: ActivityModesSection(spaceId: space, repository: repository),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Práce'), findsOneWidget);
    expect(find.text('Odpočinek'), findsOneWidget);
    expect(tester.takeException(), isNull);
    expect(
      adapter.requests.every((request) => request.method == 'GET'),
      isTrue,
    );
  });

  testWidgets(
    'retained default sections keep independent space state after route pop',
    (tester) async {
      const secondSpace = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c9';
      adapter.statesBySpace[space] = active();
      adapter.statesBySpace[secondSpace] = {
        ...active(mode: 'relax', status: 'failed'),
        'space_id': secondSpace,
      };
      final registry = ActivityModesRegistry(dio: dio);
      locator.registerSingleton<ActivityModesRegistry>(registry);
      final navigator = GlobalKey<NavigatorState>();
      try {
        await tester.pumpWidget(
          MaterialApp(
            navigatorKey: navigator,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: Column(
                children: [
                  const ActivityModesSection(spaceId: space),
                  Builder(
                    builder: (context) => TextButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const Scaffold(
                            body: ActivityModesSection(spaceId: secondSpace),
                          ),
                        ),
                      ),
                      child: const Text('Open other room'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.text('Selected · some commands could not complete'),
          findsOneWidget,
        );
        expect(
          tester
              .widget<FilterChip>(find.widgetWithText(FilterChip, 'Work'))
              .selected,
          isTrue,
        );
        await tester.tap(find.text('Open other room'));
        await tester.pumpAndSettle();
        expect(find.text('Selected · commands failed'), findsOneWidget);
        expect(
          tester
              .widget<FilterChip>(find.widgetWithText(FilterChip, 'Relax'))
              .selected,
          isTrue,
        );
        expect(
          find.byType(ActivityModesSection, skipOffstage: false),
          findsNWidgets(2),
        );
        navigator.currentState!.pop();
        await tester.pumpAndSettle();
        expect(
          find.text('Selected · some commands could not complete'),
          findsOneWidget,
        );
        expect(
          tester
              .widget<FilterChip>(find.widgetWithText(FilterChip, 'Work'))
              .selected,
          isTrue,
        );
        expect(
          tester
              .widget<FilterChip>(find.widgetWithText(FilterChip, 'Relax'))
              .selected,
          isFalse,
        );
        expect(
          adapter.requests.every((request) => request.method == 'GET'),
          isTrue,
        );
        expect(tester.takeException(), isNull);
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        locator.unregister<ActivityModesRegistry>();
        registry.dispose();
      }
    },
  );

  testWidgets(
    'unconfirmed response stays visible while reconciliation finds an activation in progress',
    (tester) async {
      await tester.runAsync(() async {
        await repository.bind(space);
        adapter.state = active(status: 'activating');
        adapter.timeout = true;
        await repository.activate(repository.modes.first);
      });
      expect(repository.issue, ActivityModeIssue.unconfirmed);
      expect(repository.state?.activityStatus.json, 'activating');
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ActivityModesSection(spaceId: space, repository: repository),
          ),
        ),
      );
      await tester.pump();
      expect(
        find.text(
          'Request unconfirmed. Check the current selection before trying again.',
        ),
        findsOneWidget,
      );
      expect(find.text('Sending request…'), findsNothing);
      expect(
        adapter.requests.where((request) => request.method == 'POST').length,
        1,
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'generated HTTP unknown domain/status renders honest details without throwing',
    (tester) async {
      adapter.state = {
        ...active(),
        'activity_results': [
          {
            'domain': 'future-domain',
            'status': 'future-status',
            'reason': 'new server result',
          },
        ],
      };
      await tester.runAsync(() => repository.bind(space));
      final result = repository.state!.activityResults.single;
      expect(result.domain.json, isNull);
      expect(result.status.json, isNull);
      // The enum wire values are null, while generated model serialization
      // currently represents both unknown values with this sentinel.
      expect(result.toJson()['domain'], r'$unknown');
      expect(result.toJson()['status'], r'$unknown');
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ActivityModesSection(spaceId: space, repository: repository),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Mode details'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Unknown: Unknown'), findsOneWidget);
      expect(find.textContaining('Security:'), findsNothing);
      expect(find.textContaining('Commands sent'), findsNothing);
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'actual section renders localized ordered chips, partial details and manual clearing',
    (tester) async {
      adapter.state = active();
      // Dio schedules asynchronous decoding work on the real event loop.
      // Preload outside the widget test's fake clock before pumping the UI.
      await tester.runAsync(() => repository.bind(space));
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ActivityModesSection(spaceId: space, repository: repository),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Away'), findsNothing);
      expect(find.text('Work'), findsOneWidget);
      expect(
        tester.getTopLeft(find.text('Work')).dx,
        lessThan(tester.getTopLeft(find.text('Relax')).dx),
      );
      expect(
        find.text('Selected · some commands could not complete'),
        findsOneWidget,
      );
      await tester.tap(find.byTooltip('Mode details'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Not supported'), findsOneWidget);
      await tester.tap(find.text('Close'));
      await tester.pumpAndSettle();
      // Gesture callbacks run in the widget binding's fake zone. Pump its
      // scheduled Dio work instead of awaiting a real-zone completer.
      await tester.tap(find.text('Work'));
      await tester.pumpAndSettle();
      expect(repository.busy, isFalse);
      expect(adapter.requests.last.data, {
        'data': {'activation_id': activation},
      });
      expect(repository.state?.selectedActivityMode, isNull);
    },
  );
}
