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
  Completer<void>? listGate;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);

    if (options.path == _listPath && options.method == 'GET') {
      // Read when the request arrives, answered when the gate opens
      final response = _json(
        _envelope(options.path, 'GET', stored.values.toList()),
        listStatus,
      );
      final held = listGate;
      listGate = null;
      if (held != null) await held.future;

      return response;
    }

    final match = RegExp(
      r'^/modules/automations/automations/([^/]+)/enabled$',
    ).firstMatch(options.path);

    if (match != null && options.method == 'PATCH') {
      final response = _patch(match.group(1)!, options);
      final held = gate;
      gate = null;
      if (held != null) await held.future;

      return response;
    }

    return _json({'error': 'unexpected'}, 500);
  }

  /// Applied when the request arrives, as the backend would
  ResponseBody _patch(String id, RequestOptions options) {
    final status = enabledStatus;
    if (status != null) return _json({'error': 'refused'}, status);

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

  group('AutomationsRepository races', () {
    Map<String, dynamic> live(
      String id, {
      bool enabled = false,
      int revision = 1,
      String name = 'Motion light',
    }) => _automation(id, enabled: enabled, revision: revision, name: name);

    test(
      'a list read before a live update does not restore the older revision',
      () async {
        adapter.stored['a'] = _automation('a');
        await repository.fetchAll();

        final gate = Completer<void>();
        adapter.listGate = gate;
        final fetch = repository.fetchAll();
        await pumpEventQueue();

        repository.insert([live('a', enabled: true, revision: 2)]);
        gate.complete();
        await fetch;

        expect(repository.getAutomation('a')!.revision, 2);
        expect(repository.getAutomation('a')!.enabled, isTrue);
      },
    );

    test(
      'a list read before a deletion does not bring the automation back',
      () async {
        adapter.stored['a'] = _automation('a');
        await repository.fetchAll();

        final gate = Completer<void>();
        adapter.listGate = gate;
        final fetch = repository.fetchAll();
        await pumpEventQueue();

        repository.delete('a');
        gate.complete();
        await fetch;

        expect(repository.getAutomation('a'), isNull);
      },
    );

    test(
      'a list read before a reset is dropped; one read after it decides',
      () async {
        adapter.stored['a'] = _automation('a');
        await repository.fetchAll();

        final gate = Completer<void>();
        adapter.listGate = gate;
        final fetch = repository.fetchAll();
        await pumpEventQueue();

        repository.clear();
        gate.complete();
        await fetch;

        expect(repository.automations, isEmpty);

        adapter.stored['b'] = _automation('b');
        await repository.fetchAll();

        expect(repository.automations.map((a) => a.id), ['a', 'b']);
      },
    );

    test(
      'a list keeps what was created after it was asked for and drops what is gone',
      () async {
        adapter.stored['a'] = _automation('a');
        adapter.stored['b'] = _automation('b');
        await repository.fetchAll();
        adapter.stored.remove('b');

        final gate = Completer<void>();
        adapter.listGate = gate;
        final fetch = repository.fetchAll();
        await pumpEventQueue();

        repository.insert([live('c')]);
        gate.complete();
        await fetch;

        expect(repository.automations.map((a) => a.id).toList()..sort(), [
          'a',
          'c',
        ]);
      },
    );

    test(
      'a delayed switch answer does not overwrite a newer live update',
      () async {
        adapter.stored['a'] = _automation('a');
        await service.initialize();

        final gate = Completer<void>();
        adapter.gate = gate;
        final result = service.setEnabled('a', true);
        await pumpEventQueue();

        // Switched on (revision 2), then renamed and switched off in the admin
        repository.insert([
          live('a', enabled: false, revision: 3, name: 'Renamed'),
        ]);
        gate.complete();

        expect(await result, AutomationToggleResult.success);
        expect(repository.getAutomation('a')!.revision, 3);
        expect(service.getAutomation('a')!.enabled, isFalse);
        expect(service.getAutomation('a')!.name, 'Renamed');
      },
    );

    test(
      'a delayed switch answer does not bring a deleted automation back',
      () async {
        adapter.stored['a'] = _automation('a');
        await service.initialize();

        final gate = Completer<void>();
        adapter.gate = gate;
        final result = service.setEnabled('a', true);
        await pumpEventQueue();

        repository.delete('a');
        gate.complete();
        await result;

        expect(service.getAutomation('a'), isNull);
        expect(service.automationsForSpace('room'), isEmpty);
      },
    );
  });

  group('AutomationsRepository overlapping requests', () {
    Future<void> arrived() => pumpEventQueue();

    List<String> ids() =>
        repository.automations.map((a) => a.id).toList()..sort();

    test(
      'an older list finishing after a newer one does not bring back what it left out',
      () async {
        adapter.stored['a'] = _automation('a');
        adapter.stored['b'] = _automation('b');
        await repository.fetchAll();

        final older = Completer<void>();
        adapter.listGate = older;
        final first = repository.fetchAll();
        await arrived();

        // Deleted on the server, and the event was missed
        adapter.stored.remove('b');
        await repository.fetchAll();

        expect(ids(), ['a']);

        older.complete();
        await first;

        expect(ids(), ['a']);
      },
    );

    test(
      'an older list finishing after a newer one does not remove what the newer one added',
      () async {
        adapter.stored['a'] = _automation('a');
        await repository.fetchAll();

        final older = Completer<void>();
        adapter.listGate = older;
        final first = repository.fetchAll();
        await arrived();

        // Created on the server, and the event was missed
        adapter.stored['c'] = _automation('c');
        await repository.fetchAll();

        expect(ids(), ['a', 'c']);

        older.complete();
        await first;

        expect(ids(), ['a', 'c']);
      },
    );

    test(
      'a pending switch does not bring back an automation a newer list left out',
      () async {
        adapter.stored['a'] = _automation('a');
        await service.initialize();

        final gate = Completer<void>();
        adapter.gate = gate;
        final result = service.setEnabled('a', true);
        await arrived();

        adapter.stored.remove('a');
        await repository.fetchAll();

        expect(repository.getAutomation('a'), isNull);

        gate.complete();
        await result;

        expect(repository.getAutomation('a'), isNull);
        expect(service.automationsForSpace('room'), isEmpty);
      },
    );

    test(
      'an automation deleted and created again keeps the new one over an older answer',
      () async {
        adapter.stored['a'] = _automation('a', name: 'Old');
        await service.initialize();

        final gate = Completer<void>();
        adapter.gate = gate;
        final result = service.setEnabled('a', true);
        await arrived();

        repository.delete('a');
        repository.insert([_automation('a', name: 'New')]);
        gate.complete();
        await result;

        expect(repository.getAutomation('a')!.name, 'New');
        expect(repository.getAutomation('a')!.enabled, isFalse);
      },
    );

    test(
      'pruned deletions do not stop the same id from coming back later',
      () async {
        adapter.stored['a'] = _automation('a');
        await repository.fetchAll();

        repository.delete('a');
        expect(repository.getAutomation('a'), isNull);

        repository.insert([_automation('a', name: 'Again')]);
        expect(repository.getAutomation('a')!.name, 'Again');

        adapter.stored['a'] = _automation('a', name: 'Again');
        await repository.fetchAll();

        expect(repository.getAutomation('a')!.name, 'Again');

        // And after a list left it out, a later list or event can add it again
        adapter.stored.remove('a');
        await repository.fetchAll();
        expect(repository.getAutomation('a'), isNull);

        adapter.stored['a'] = _automation('a', name: 'Third');
        await repository.fetchAll();
        expect(repository.getAutomation('a')!.name, 'Third');
      },
    );
  });

  group('AutomationsRepository request-relative answers', () {
    Future<void> arrived() => pumpEventQueue();

    test('two lists started back to back keep their order', () async {
      // From an empty repository, the first list still holds A
      adapter.stored['a'] = _automation('a');
      final older = Completer<void>();
      adapter.listGate = older;
      final first = repository.fetchAll();
      await arrived();

      // A is deleted on the server and the event is missed
      adapter.stored.remove('a');
      await repository.fetchAll();

      older.complete();
      await first;

      expect(repository.automations, isEmpty);
    });

    test(
      'a later list supersedes an earlier one that came back first',
      () async {
        adapter.stored['a'] = _automation('a');
        adapter.stored['x'] = _automation('x');
        await repository.fetchAll();

        adapter.stored['a'] = _automation('a', revision: 2);
        final earlierGate = Completer<void>();
        adapter.listGate = earlierGate;
        final earlier = repository.fetchAll();
        await arrived();

        // Changed on the server again, events missed
        adapter.stored['a'] = _automation('a', enabled: true, revision: 3);
        adapter.stored.remove('x');
        final laterGate = Completer<void>();
        adapter.listGate = laterGate;
        final later = repository.fetchAll();
        await arrived();

        earlierGate.complete();
        await earlier;

        expect(repository.getAutomation('a')!.revision, 2);
        expect(repository.getAutomation('x'), isNotNull);

        laterGate.complete();
        await later;

        expect(repository.getAutomation('a')!.revision, 3);
        expect(repository.getAutomation('a')!.enabled, isTrue);
        expect(repository.getAutomation('x'), isNull);
      },
    );

    test(
      'a switch answer started after a list that came back first still applies',
      () async {
        adapter.stored['a'] = _automation('a');
        await service.initialize();

        // Renamed on the server, event missed; the list reads it
        adapter.stored['a'] = _automation('a', name: 'Renamed', revision: 2);
        final listGate = Completer<void>();
        adapter.listGate = listGate;
        final list = repository.fetchAll();
        await arrived();

        final gate = Completer<void>();
        adapter.gate = gate;
        final result = service.setEnabled('a', true);
        await arrived();

        listGate.complete();
        await list;
        gate.complete();

        expect(await result, AutomationToggleResult.success);
        expect(repository.getAutomation('a')!.revision, 3);
        expect(repository.getAutomation('a')!.enabled, isTrue);
        expect(repository.getAutomation('a')!.name, 'Renamed');
      },
    );

    test(
      'a delayed 404 does not remove an automation restored meanwhile',
      () async {
        adapter.stored['a'] = _automation('a', name: 'Old');
        await service.initialize();

        adapter.enabledStatus = 404;
        final gate = Completer<void>();
        adapter.gate = gate;
        final result = service.setEnabled('a', true);
        await arrived();

        repository.delete('a');
        repository.insert([_automation('a', name: 'Restored')]);
        gate.complete();

        expect(await result, AutomationToggleResult.notFound);
        expect(repository.getAutomation('a')!.name, 'Restored');
        expect(service.automationsForSpace('room').single.name, 'Restored');
      },
    );

    test(
      'a delayed 404 does not remove what a reset and a fresh list brought back',
      () async {
        adapter.stored['a'] = _automation('a');
        await service.initialize();

        adapter.enabledStatus = 404;
        final gate = Completer<void>();
        adapter.gate = gate;
        final result = service.setEnabled('a', true);
        await arrived();

        repository.clear();
        await repository.fetchAll();
        expect(repository.getAutomation('a'), isNotNull);

        gate.complete();

        expect(await result, AutomationToggleResult.notFound);
        expect(repository.getAutomation('a'), isNotNull);
      },
    );

    test('a 404 with nothing newer removes the automation', () async {
      adapter.stored['a'] = _automation('a');
      await service.initialize();

      adapter.enabledStatus = 404;

      expect(
        await service.setEnabled('a', true),
        AutomationToggleResult.notFound,
      );
      expect(repository.getAutomation('a'), isNull);
    });
  });

  group('disposal', () {
    test(
      'a switch on its way when the module is torn down completes quietly',
      () async {
        adapter.stored['a'] = _automation('a');
        final socket = AutomationsSocket();
        final module = AutomationsModuleService(
          apiClient: ApiClient(dio),
          socketService: socket,
        );
        await module.initialize();

        final gate = Completer<void>();
        adapter.gate = gate;
        final result = module.service.setEnabled('a', true);
        await pumpEventQueue();

        module.dispose();
        gate.complete();

        expect(await result, AutomationToggleResult.success);
        expect(
          await module.service.setEnabled('a', false),
          AutomationToggleResult.failed,
        );
      },
    );

    test(
      'a refused switch after disposal does not touch the repository',
      () async {
        adapter.stored['a'] = _automation('a');
        final socket = AutomationsSocket();
        final module = AutomationsModuleService(
          apiClient: ApiClient(dio),
          socketService: socket,
        );
        await module.initialize();

        adapter.enabledStatus = 404;
        final gate = Completer<void>();
        adapter.gate = gate;
        final result = module.service.setEnabled('a', true);
        await pumpEventQueue();

        module.dispose();
        gate.complete();

        expect(await result, AutomationToggleResult.notFound);
      },
    );
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
