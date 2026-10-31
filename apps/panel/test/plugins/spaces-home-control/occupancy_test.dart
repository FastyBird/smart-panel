import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/constants.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/module.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/occupancy_section.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/occupancy.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Deliver events to the handlers registered by the real plugin module.
class OccupancySocket extends SocketService {
  final handlers = <String, void Function(String, Map<String, dynamic>)>{};
  final connections = <void Function(bool)>[];
  bool connected = true;

  @override
  bool get isConnected => connected;
  @override
  void registerEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) callback,
  ) {
    handlers[event] = callback;
  }

  @override
  void unregisterEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) callback,
  ) {
    if (handlers[event] == callback) handlers.remove(event);
  }

  @override
  void addConnectionListener(void Function(bool) listener) =>
      connections.add(listener);
  @override
  void removeConnectionListener(void Function(bool) listener) =>
      connections.remove(listener);

  void emit(String event, Map<String, dynamic> payload) {
    handlers[SpacesModuleConstants.moduleWildcardEvent]!(event, payload);
  }

  void connectionChanged(bool value) {
    connected = value;
    for (final listener in connections.toList()) {
      listener(value);
    }
  }
}

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
    if (options.path == '/modules/spaces/spaces') {
      return ResponseBody.fromString(
        jsonEncode({
          'data': <Map<String, dynamic>>[],
          'status': 'success',
          'timestamp': '2026-10-31T00:00:00Z',
          'request_id': 'occupancy-spaces',
          'path': options.path,
          'method': options.method,
          'metadata': {
            'request_duration_ms': 1,
            'server_time': '2026-10-31T00:00:00Z',
            'cpu_usage': 0,
          },
        }),
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json'],
        },
      );
    }
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
    'disabled sessions skip periodic reads but production events and reconnect discover re-enablement',
    () {
      fakeAsync((async) {
        void settle() {
          async.flushMicrotasks();
          async.elapse(Duration.zero);
          async.flushMicrotasks();
        }

        adapter.enabled = false;
        final socket = OccupancySocket();
        final intents = IntentsRepository();
        locator.registerSingleton<IntentsRepository>(intents);
        final module = SpacesHomeControlPluginService(
          apiClient: ApiClient(dio),
          socketService: socket,
          dio: dio,
        );
        var initialized = false;
        module.initialize().then((_) => initialized = true);
        settle();
        expect(initialized, isTrue);
        adapter.requests.clear();
        final registry = locator<OccupancyRegistry>();
        final session = registry.create(), other = registry.create();
        List<RequestOptions> reads(String id) => adapter.requests
            .where(
              (request) =>
                  request.path == '/modules/spaces/spaces/$id/occupancy/state',
            )
            .toList();
        try {
          session.bind('room');
          other.bind('other');
          settle();
          expect(session.fresh, isTrue);
          expect(session.state!.enabled, isFalse);
          expect(reads('room').length, 1);
          async.elapse(const Duration(minutes: 1));
          settle();
          expect(reads('room').length, 1);
          expect(other.fresh, isTrue);
          expect(other.state!.enabled, isFalse);
          expect(reads('other').length, 1);
          adapter.enabled = true;
          socket.emit('SpacesModule.Occupancy.Changed', {'space_id': 'room'});
          settle();
          expect(session.state!.enabled, isTrue);
          expect(reads('room').length, 2);
          expect(reads('other').length, 1);
          expect(other.state!.enabled, isFalse);
          expect(
            adapter.requests.last.path,
            '/modules/spaces/spaces/room/occupancy/state',
          );
          async.elapse(const Duration(seconds: 15));
          settle();
          expect(reads('room').length, 3);
          adapter.enabled = false;
          socket.emit('SpacesModule.Occupancy.Changed', {'space_id': 'room'});
          settle();
          expect(reads('other').length, 1);
          socket.connectionChanged(false);
          settle();
          expect(session.fresh, isFalse);
          expect(other.fresh, isFalse);
          adapter.enabled = true;
          socket.connectionChanged(true);
          settle();
          expect(session.state!.enabled, isTrue);
          expect(reads('room').length, 5);
          expect(reads('other').length, 2);
          expect(other.fresh, isTrue);
          expect(other.state!.enabled, isTrue);
          expect(adapter.requests.length, 7);
          expect(
            adapter.requests.every(
              (request) =>
                  request.method == 'GET' &&
                  {
                    '/modules/spaces/spaces/room/occupancy/state',
                    '/modules/spaces/spaces/other/occupancy/state',
                  }.contains(request.path),
            ),
            isTrue,
          );
        } finally {
          registry.release(session);
          registry.release(other);
          module.dispose();
          locator.unregister<IntentsRepository>();
          intents.dispose();
        }
        expect(socket.handlers, isEmpty);
        expect(socket.connections, isEmpty);
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
