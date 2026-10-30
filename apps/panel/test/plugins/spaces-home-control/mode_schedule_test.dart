import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/mode_schedule_section.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/mode_schedule.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> schedule(String id) => {
  'space_id': id,
  'enabled': true,
  'timezone': 'Europe/Prague',
  'status': 'running',
  'manual_override': true,
  'current': {
    'entry_id': 'entry',
    'mode': 'work',
    'time': '09:00',
    'local_date': '2026-11-02',
    'timezone': 'Europe/Prague',
    'occurs_at': '2026-11-02T08:00:00Z',
  },
  'next': {
    'entry_id': 'next',
    'mode': 'relax',
    'time': '18:00',
    'local_date': '2026-11-02',
    'timezone': 'Europe/Prague',
    'occurs_at': '2026-11-02T17:00:00Z',
  },
  'last_attempt': null,
  'last_attempt_status': null,
};

class ScheduleAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  Completer<void>? gate;
  bool wrongSpace = false;
  bool unknown = false;
  bool transitioned = false;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final data = schedule(wrongSpace ? 'wrong' : options.path.split('/')[4]);
    if (unknown) data['status'] = 'new_status';
    if (transitioned) {
      data['current'] = data['next'];
      data['next'] = null;
      data['manual_override'] = false;
    }
    final held = gate;
    gate = null;
    if (held != null) await held.future;
    return ResponseBody.fromString(
      jsonEncode({'data': data}),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
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
  late ScheduleAdapter adapter;
  late ModeScheduleRepository repository;
  setUp(() {
    adapter = ScheduleAdapter();
    dio = Dio()..httpClientAdapter = adapter;
    repository = ModeScheduleRepository(dio: dio);
  });
  tearDown(() {
    repository.dispose();
    dio.close();
  });
  test(
    'only reads state, rejects foreign or unsupported responses and invalidates on disconnect',
    () async {
      await repository.bind('space');
      expect(repository.fresh, isTrue);
      expect(repository.state!.manualOverride, isTrue);
      repository.markStale();
      expect(repository.fresh, isFalse);
      adapter.wrongSpace = true;
      await repository.refresh();
      expect(repository.unavailable, isTrue);
      expect(repository.fresh, isFalse);
      adapter.wrongSpace = false;
      adapter.unknown = true;
      await repository.refresh();
      expect(repository.fresh, isFalse);
      expect(
        adapter.requests.every(
          (request) =>
              request.method == 'GET' &&
              request.path.endsWith('/schedules/state'),
        ),
        isTrue,
      );
    },
  );
  test(
    'an old response cannot replace a new space binding or revive a disposed session',
    () async {
      final gate = Completer<void>();
      adapter.gate = gate;
      final first = repository.bind('first');
      await repository.bind('second');
      gate.complete();
      await first;
      expect(repository.spaceId, 'second');
      expect(repository.state!.spaceId, 'second');
      final lastGate = Completer<void>();
      adapter.gate = lastGate;
      final last = repository.refresh();
      repository.dispose();
      lastGate.complete();
      await last;
      expect(repository.fresh, isFalse);
    },
  );
  test(
    'registry refreshes only live page sessions and respects disconnection',
    () async {
      final registry = ModeScheduleRegistry(dio: dio);
      final first = registry.create(), second = registry.create();
      try {
        await first.bind('first');
        await second.bind('second');
        await registry.connectionChanged(false);
        await registry.refresh();
        expect(adapter.requests, hasLength(2));
        expect(first.fresh, isFalse);
        await registry.connectionChanged(true);
        expect(adapter.requests, hasLength(4));
        registry.release(first);
        await registry.refresh();
        expect(adapter.requests, hasLength(5));
        expect(adapter.requests.last.path, contains('/second/'));
        registry.release(second);
        await registry.refresh();
        expect(adapter.requests, hasLength(5));
      } finally {
        registry.dispose();
      }
    },
  );
  testWidgets('last page release cancels periodic polling', (tester) async {
    final registry = ModeScheduleRegistry(dio: dio);
    final session = registry.create();
    registry.release(session);
    await tester.pump(const Duration(minutes: 2));
    expect(adapter.requests, isEmpty);
    registry.dispose();
  });
  testWidgets(
    'shows authored local times, planned modes and manual precedence without any action',
    (tester) async {
      await tester.runAsync(() => repository.bind('space'));
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: ModeScheduleSection(spaceId: 'space', repository: repository),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('schedule-current')), findsOneWidget);
      expect(find.textContaining('09:00 (Europe/Prague)'), findsOneWidget);
      expect(find.textContaining('18:00 (Europe/Prague)'), findsOneWidget);
      expect(find.byKey(const ValueKey('schedule-manual')), findsOneWidget);
      expect(find.byType(FilterChip), findsNothing);
      repository.markStale();
      await tester.pump();
      expect(find.byKey(const ValueKey('schedule-current')), findsNothing);
      expect(find.byKey(const ValueKey('schedule-next')), findsNothing);
      expect(find.text('Schedule unavailable or stopped.'), findsOneWidget);
      adapter.transitioned = true;
      await tester.runAsync(repository.refresh);
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('schedule-manual')), findsNothing);
      expect(find.byKey(const ValueKey('schedule-next')), findsNothing);
      expect(find.textContaining('18:00 (Europe/Prague)'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
