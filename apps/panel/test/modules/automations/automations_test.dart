import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/automations/export.dart';
import 'package:flutter_test/flutter_test.dart';

const _listPath = '/modules/automations/automations';

Map<String, dynamic> _automation(
  String id, {
  String name = 'Motion light',
  bool enabled = false,
  String? spaceId = 'room',
  String status = 'ok',
  String? lastRunStatus,
  int revision = 1,
}) => {
  'id': id,
  'name': name,
  'description': null,
  'icon': null,
  'enabled': enabled,
  'space_id': spaceId,
  'mode': 'restart',
  'revision': revision,
  'status': status,
  'last_triggered_at': null,
  'last_run_status': lastRunStatus,
  'created_at': '2026-11-01T00:00:00Z',
  'updated_at': null,
};

Map<String, dynamic> _envelope(String path, String method, Object data) => {
  'status': 'success',
  'timestamp': '2026-11-14T00:00:00Z',
  'request_id': 'automations-test',
  'path': path,
  'method': method.toLowerCase(),
  'data': data,
  'metadata': {
    'request_duration_ms': 1,
    'server_time': '2026-11-14T00:00:00Z',
    'cpu_usage': 0,
  },
};

/// Serves the list and the enabled route like the backend does.
class AutomationsAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  final stored = <String, Map<String, dynamic>>{};
  int listStatus = 200;
  int? enabledStatus;
  Completer<void>? gate;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);

    if (options.path == _listPath && options.method == 'GET') {
      return _json(
        _envelope(options.path, 'GET', stored.values.toList()),
        listStatus,
      );
    }

    final match = RegExp(
      r'^/modules/automations/automations/([^/]+)/enabled$',
    ).firstMatch(options.path);

    if (match != null && options.method == 'PATCH') {
      final held = gate;
      gate = null;
      if (held != null) await held.future;

      final status = enabledStatus;
      if (status != null) return _json({'error': 'refused'}, status);

      final id = match.group(1)!;
      // The body is encoded the way Dio sends it
      final body = jsonDecode(jsonEncode(options.data)) as Map<String, dynamic>;
      final enabled = (body['data'] as Map)['enabled'] as bool;
      final current = stored[id];

      if (current == null) return _json({'error': 'not found'}, 404);

      final next = {
        ...current,
        'enabled': enabled,
        'revision': (current['revision'] as int) + 1,
      };
      stored[id] = next;

      return _json(_envelope(options.path, 'PATCH', next), 200);
    }

    return _json({'error': 'unexpected'}, 500);
  }

  ResponseBody _json(Object body, int status) => ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: {
      Headers.contentTypeHeader: ['application/json'],
    },
  );

  @override
  void close({bool force = false}) {}
}

class AutomationsSocket extends SocketService {
  final handlers = <String, void Function(String, Map<String, dynamic>)>{};

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

  void emit(String event, Map<String, dynamic> payload) {
    handlers[AutomationsModuleConstants.moduleWildcardEvent]!(event, payload);
  }
}

void main() {
  late Dio dio;
  late AutomationsAdapter adapter;
  late AutomationsRepository repository;
  late AutomationsService service;

  setUp(() {
    adapter = AutomationsAdapter();
    dio = Dio()..httpClientAdapter = adapter;
    repository = AutomationsRepository(
      apiClient: ApiClient(dio).automationsModule,
    );
    service = AutomationsService(repository: repository);
  });

  tearDown(() {
    service.dispose();
    repository.dispose();
    dio.close();
  });

  group('AutomationModel', () {
    test('reads the summary the backend sends and ignores unknown values', () {
      final model = AutomationModel.fromJson({
        ..._automation('a', status: 'suspended', lastRunStatus: 'failed'),
        'last_triggered_at': '2026-11-13T10:00:00Z',
      });

      expect(model.status, AutomationStatus.suspended);
      expect(model.lastRunStatus, AutomationRunStatus.failed);
      expect(model.lastTriggeredAt, DateTime.utc(2026, 11, 13, 10));
      expect(
        AutomationModel.fromJson(_automation('b', status: 'future')).status,
        AutomationStatus.unknown,
      );
      expect(
        () => AutomationModel.fromJson({'id': 'c'}),
        throwsFormatException,
      );
    });
  });

  group('AutomationsService', () {
    test('lists the automations of a space by name', () async {
      adapter.stored['b'] = _automation('b', name: 'Night light');
      adapter.stored['a'] = _automation('a', name: 'Blinds at dawn');
      adapter.stored['c'] = _automation('c', spaceId: 'kitchen');
      adapter.stored['d'] = _automation('d', spaceId: null);

      await service.initialize();

      expect(
        service.automationsForSpace('room').map((view) => view.name).toList(),
        ['Blinds at dawn', 'Night light'],
      );
      expect(service.automationsForSpace('kitchen').single.id, 'c');
      expect(adapter.requests.single.method, 'GET');
      expect(adapter.requests.single.path, _listPath);
    });

    test(
      'a refused list keeps the panel starting with nothing listed',
      () async {
        adapter.stored['a'] = _automation('a');
        adapter.listStatus = 403;

        await service.initialize();

        expect(service.automationsForSpace('room'), isEmpty);
      },
    );

    test(
      'shows the requested value while pending and the stored one after',
      () async {
        adapter.stored['a'] = _automation('a');
        await service.initialize();

        final gate = Completer<void>();
        adapter.gate = gate;
        final result = service.setEnabled('a', true);

        expect(service.getAutomation('a')!.enabled, isTrue);
        expect(service.getAutomation('a')!.pending, isTrue);
        expect(
          await service.setEnabled('a', false),
          AutomationToggleResult.ignored,
        );

        gate.complete();

        expect(await result, AutomationToggleResult.success);
        expect(service.getAutomation('a')!.pending, isFalse);
        expect(service.getAutomation('a')!.enabled, isTrue);
        expect(repository.getAutomation('a')!.revision, 2);

        final patch = adapter.requests.last;

        expect(patch.method, 'PATCH');
        expect(patch.path, '/modules/automations/automations/a/enabled');
        expect(jsonDecode(jsonEncode(patch.data)), {
          'data': {'enabled': true},
        });
      },
    );

    test('rolls back when the backend refuses', () async {
      adapter.stored['a'] = _automation('a');
      await service.initialize();

      adapter.enabledStatus = 422;
      expect(
        await service.setEnabled('a', true),
        AutomationToggleResult.incomplete,
      );
      expect(service.getAutomation('a')!.enabled, isFalse);
      expect(service.getAutomation('a')!.pending, isFalse);

      adapter.enabledStatus = 500;
      expect(
        await service.setEnabled('a', true),
        AutomationToggleResult.failed,
      );
      expect(service.getAutomation('a')!.enabled, isFalse);

      adapter.enabledStatus = 404;
      expect(
        await service.setEnabled('a', true),
        AutomationToggleResult.notFound,
      );
      expect(service.getAutomation('a'), isNull);
    });
  });

  group('AutomationsModuleService', () {
    test('keeps the list current from the websocket', () async {
      adapter.stored['a'] = _automation('a');
      final socket = AutomationsSocket();
      final module = AutomationsModuleService(
        apiClient: ApiClient(dio),
        socketService: socket,
      );

      try {
        await module.initialize();

        final moduleService = locator<AutomationsService>();

        expect(
          moduleService.automationsForSpace('room').single.enabled,
          isFalse,
        );

        socket.emit(
          AutomationsModuleConstants.automationUpdatedEvent,
          _automation('a', enabled: true, revision: 2),
        );
        socket.emit(
          AutomationsModuleConstants.automationCreatedEvent,
          _automation('b', name: 'Zz', status: 'invalid'),
        );

        final views = moduleService.automationsForSpace('room');

        expect(views.map((view) => view.enabled).toList(), [true, false]);
        expect(views.last.status, AutomationStatus.invalid);

        socket.emit(AutomationsModuleConstants.automationDeletedEvent, {
          'id': 'a',
        });
        expect(moduleService.automationsForSpace('room').single.id, 'b');

        socket.emit(AutomationsModuleConstants.moduleResetEvent, {});
        expect(moduleService.automationsForSpace('room'), isEmpty);
      } finally {
        module.dispose();
      }

      expect(socket.handlers, isEmpty);
      expect(locator.isRegistered<AutomationsService>(), isFalse);
      expect(locator.isRegistered<AutomationsRepository>(), isFalse);
    });
  });
}
