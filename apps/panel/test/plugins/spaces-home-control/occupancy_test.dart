import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/occupancy_section.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/occupancy.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class OccupancyAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  String status = 'occupied';
  bool manual = true;
  bool enabled = true;
  bool wrongSpace = false;
  Completer<void>? gate;
  Completer<void>? entered;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    entered?.complete();
    entered = null;
    final data = <String, dynamic>{
      'space_id': wrongSpace ? 'wrong' : options.path.split('/')[4],
      'status': status,
      'enabled': enabled,
      'running': true,
      'manual_override': manual,
      'vacancy_remaining_seconds': null,
      'last_attempt_status': null,
    };
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
  late OccupancyAdapter adapter;
  late OccupancyRepository repository;
  setUp(() {
    adapter = OccupancyAdapter();
    dio = Dio()..httpClientAdapter = adapter;
    repository = OccupancyRepository(dio: dio);
  });
  tearDown(() {
    repository.dispose();
    dio.close();
  });

  test(
    'reads only observed state and refuses foreign or unsupported responses',
    () async {
      await repository.bind('room');
      expect(repository.fresh, isTrue);
      expect(repository.state!.manualOverride, isTrue);
      expect(adapter.requests.single.method, 'GET');
      expect(
        adapter.requests.single.path,
        '/modules/spaces/spaces/room/occupancy/state',
      );
      adapter.wrongSpace = true;
      await repository.refresh();
      expect(repository.fresh, isFalse);
      adapter.wrongSpace = false;
      adapter.status = 'future_status';
      await repository.refresh();
      expect(repository.fresh, isFalse);
    },
  );
  test(
    'a response retained for a previous space cannot replace a newer binding',
    () async {
      final gate = Completer<void>();
      adapter.gate = gate;
      final entered = Completer<void>();
      adapter.entered = entered;
      final first = repository.bind('first');
      await entered.future;
      await repository.bind('second');
      gate.complete();
      await first;
      expect(repository.spaceId, 'second');
      expect(repository.state!.spaceId, 'second');
    },
  );
  test(
    'disconnect invalidates live state and stops new polling reads',
    () async {
      final registry = OccupancyRegistry(dio: dio);
      final session = registry.create();
      await session.bind('room');
      await registry.connectionChanged(false);
      final count = adapter.requests.length;
      await session.refresh();
      expect(session.fresh, isFalse);
      expect(adapter.requests.length, count);
      await registry.connectionChanged(true);
      expect(session.fresh, isTrue);
      registry.release(session);
      registry.dispose();
    },
  );
  test('the total deadline cancels a stuck request and releases loading', () {
    fakeAsync((async) {
      adapter.gate = Completer<void>();
      final gate = adapter.gate!;
      repository.bind('room');
      async.flushMicrotasks();
      async.elapse(const Duration(seconds: 10));
      async.flushMicrotasks();
      expect(repository.loading, isFalse);
      expect(repository.fresh, isFalse);
      expect(adapter.requests.single.cancelToken!.isCancelled, isTrue);
      gate.complete();
      async.flushMicrotasks();
    });
  });
  test(
    'disabled sessions skip periodic reads but events and reconnect discover re-enablement',
    () {
      fakeAsync((async) {
        void settle() {
          async.flushMicrotasks();
          async.elapse(Duration.zero);
          async.flushMicrotasks();
        }

        adapter.enabled = false;
        final registry = OccupancyRegistry(dio: dio);
        final session = registry.create();
        session.bind('room');
        settle();
        expect(adapter.requests.length, 1);
        async.elapse(const Duration(minutes: 1));
        settle();
        expect(adapter.requests.length, 1);
        adapter.enabled = true;
        // The production occupancy-change event explicitly refreshes the affected room.
        registry.refresh('room');
        settle();
        expect(session.state!.enabled, isTrue);
        expect(adapter.requests.length, 2);
        async.elapse(const Duration(seconds: 15));
        settle();
        expect(adapter.requests.length, 3);
        adapter.enabled = false;
        registry.refresh('room');
        settle();
        registry.connectionChanged(false);
        settle();
        adapter.enabled = true;
        registry.connectionChanged(true);
        settle();
        expect(session.state!.enabled, isTrue);
        expect(adapter.requests.length, 5);
        registry.release(session);
        registry.dispose();
      });
    },
  );
  test('releasing the final page session stops its periodic reads', () {
    fakeAsync((async) {
      final registry = OccupancyRegistry(dio: dio);
      final session = registry.create();
      session.bind('room');
      async.flushMicrotasks();
      async.elapse(const Duration(seconds: 15));
      async.flushMicrotasks();
      expect(adapter.requests.length, 2);
      registry.release(session);
      async.elapse(const Duration(minutes: 1));
      async.flushMicrotasks();
      expect(adapter.requests.length, 2);
      registry.dispose();
    });
  });
  testWidgets(
    'renders manual presence and real vacant/unknown transitions without control buttons',
    (tester) async {
      await tester.runAsync(() => repository.bind('room'));
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: OccupancySection(spaceId: 'room', repository: repository),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Occupied'), findsOneWidget);
      expect(find.byKey(const ValueKey('occupancy-manual')), findsOneWidget);
      expect(find.byType(ElevatedButton), findsNothing);
      adapter.status = 'vacant';
      adapter.manual = false;
      await tester.runAsync(repository.refresh);
      await tester.pumpAndSettle();
      expect(find.text('Vacant'), findsOneWidget);
      expect(find.byKey(const ValueKey('occupancy-automatic')), findsOneWidget);
      repository.markStale();
      await tester.pump();
      expect(find.text('Occupancy unknown or unavailable'), findsOneWidget);
      expect(find.text('Vacant'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'a widget-owned page binds its session and hides disabled occupancy',
    (tester) async {
      adapter.enabled = false;
      final registry = OccupancyRegistry(dio: dio);
      locator.registerSingleton(registry);
      try {
        await tester.pumpWidget(
          MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const Scaffold(body: OccupancySection(spaceId: 'room')),
          ),
        );
        await tester.runAsync(() => Future<void>.delayed(Duration.zero));
        await tester.pumpAndSettle();
        expect(
          adapter.requests.single.path,
          '/modules/spaces/spaces/room/occupancy/state',
        );
        expect(find.byKey(const ValueKey('occupancy-status')), findsNothing);
        await tester.pumpWidget(const SizedBox());
        final count = adapter.requests.length;
        await tester.pump(const Duration(seconds: 30));
        expect(adapter.requests.length, count);
      } finally {
        registry.dispose();
        locator.unregister<OccupancyRegistry>();
      }
    },
  );
}
