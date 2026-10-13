import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/devices/models/property_command.dart';
import 'package:fastybird_smart_panel/modules/devices/services/composite_command_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class RecordingSocket extends SocketService {
  bool connected = true;
  int sent = 0;
  Map<String, dynamic>? sentPayload;
  Function(SocketCommandResponseModel?)? ack;
  final Map<String, void Function(String, Map<String, dynamic>)> handlers = {};
  void Function(bool)? connection;

  @override
  bool get isConnected => connected;

  @override
  Future<void> sendCommand(
    String event,
    dynamic data,
    String handler, {
    Function(SocketCommandResponseModel?)? onAck,
  }) async {
    sent++;
    sentPayload = data as Map<String, dynamic>;
    ack = onAck;
  }

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
    handlers.remove(event);
  }

  @override
  void addConnectionListener(void Function(bool) listener) =>
      connection = listener;

  @override
  void removeConnectionListener(void Function(bool) listener) =>
      connection = null;

  void emit(String event, Map<String, dynamic> payload) =>
      handlers[event]?.call(event, payload);
}

class RecordingDio extends Mock implements Dio {
  int calls = 0;
  Map<String, dynamic>? sentRequest;
  Options? requestOptions;
  Map<String, dynamic> response = {};
  void Function(Map<String, dynamic>)? onRequest;

  @override
  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    calls++;
    sentRequest = data as Map<String, dynamic>;
    onRequest?.call(sentRequest!);
    requestOptions = options;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: response as T,
      statusCode: 200,
    );
  }
}

void main() {
  const targets = [
    PropertyCommandItem(
      deviceId: 'group',
      channelId: 'light',
      propertyId: 'on',
      value: true,
    ),
  ];

  test('accepts only matching parent, epoch and increasing sequence', () async {
    final socket = RecordingSocket();
    final dio = RecordingDio();
    final service = CompositeCommandService(
      socketService: socket,
      dispatch: CommandDispatchService(socketService: socket),
      dio: dio,
    );
    final resultFuture = service.send(deviceId: 'group', properties: targets);
    await Future<void>.delayed(Duration.zero);
    final requestId = socket.sentPayload!['request_id'] as String;
    final event = {
      'id': 'parent',
      'requestId': requestId,
      'epoch': 'server-1',
      'sequence': 1,
      'targets': [
        {'deviceId': 'group', 'channelId': 'light', 'propertyId': 'on'},
      ],
      'children': [
        {
          'memberId': 'member',
          'memberIdentity': 'Kitchen',
          'propertyId': 'physical-on',
          'status': 'accepted',
        },
      ],
    };
    socket.emit('DevicesModule.CompositeCommand.Progress', event);
    expect(service.latestFor('group')?.children.single.status, 'accepted');
    socket.emit('DevicesModule.CompositeCommand.Completed', {
      ...event,
      'sequence': 1,
      'status': 'confirmed',
    });
    expect(service.latestFor('group')?.terminal, false);
    socket.emit('DevicesModule.CompositeCommand.Completed', {
      ...event,
      'epoch': 'server-2',
      'sequence': 2,
      'status': 'confirmed',
    });
    expect(service.latestFor('group')?.terminal, false);
    socket.emit('DevicesModule.CompositeCommand.Completed', {
      ...event,
      'sequence': 2,
      'status': 'partial',
      'children': [
        {
          'memberId': 'member',
          'memberIdentity': 'Kitchen',
          'status': 'confirmed',
        },
        {
          'memberId': 'offline',
          'memberIdentity': 'Hall',
          'status': 'unavailable',
          'reason': 'Offline',
        },
      ],
    });
    socket.ack!(SocketCommandResponseModel(status: false, message: 'Partial'));
    final outcome = await resultFuture;
    expect(outcome.status, 'partial');
    expect(outcome.children.last.reason, 'Offline');
    expect(socket.sent, 1);
    expect(
      dio.calls,
      0,
    ); // No replay after an unsuccessful WebSocket acknowledgment.
    service.dispose();
  });

  test(
    'disposal detaches handlers and fences an acknowledgment already in flight',
    () async {
      final socket = RecordingSocket();
      final service = CompositeCommandService(
        socketService: socket,
        dispatch: CommandDispatchService(socketService: socket),
      );
      final result = service.send(deviceId: 'group', properties: targets);
      await Future<void>.delayed(Duration.zero);
      service.dispose();
      expect(socket.handlers, isEmpty);
      expect(socket.connection, isNull);
      socket.ack!(
        SocketCommandResponseModel(status: true, message: 'Accepted'),
      );
      expect((await result).status, 'unknown');
      expect(socket.sent, 1);
    },
  );

  test(
    'uses one bounded REST batch only when socket is disconnected',
    () async {
      final socket = RecordingSocket()..connected = false;
      final dio = RecordingDio();
      final service = CompositeCommandService(
        socketService: socket,
        dispatch: CommandDispatchService(socketService: socket),
        dio: dio,
      );
      dio.response = {
        'data': {
          'request_id': '',
          'composites': [
            {
              'id': 'parent',
              'status': 'partial',
              'children': [
                {'memberId': 'member', 'status': 'timed_out'},
              ],
            },
          ],
        },
      };
      // Match the generated request identifier without retrying the request.
      dio.onRequest = (request) =>
          (dio.response['data'] as Map<String, dynamic>)['request_id'] =
              request['request_id'];
      final outcome = await service.send(
        deviceId: 'group',
        properties: targets,
      );
      expect(outcome.status, 'partial');
      expect(dio.calls, 1);
      expect(socket.sent, 0);
      expect(dio.requestOptions?.receiveTimeout, const Duration(seconds: 35));
      expect(dio.requestOptions?.extra?['retryExhausted'], true);
      service.dispose();
    },
  );

  test(
    'reconnect fences an in-flight parent and its late acknowledgement',
    () async {
      final socket = RecordingSocket();
      final service = CompositeCommandService(
        socketService: socket,
        dispatch: CommandDispatchService(socketService: socket),
      );
      final resultFuture = service.send(deviceId: 'group', properties: targets);
      await Future<void>.delayed(Duration.zero);
      final requestId = socket.sentPayload!['request_id'] as String;
      final acknowledge = socket.ack!;
      socket.connection?.call(false);
      socket.emit('DevicesModule.CompositeCommand.Completed', {
        'id': 'old-parent',
        'requestId': requestId,
        'epoch': 'old-server',
        'sequence': 1,
        'status': 'confirmed',
        'targets': [
          {'deviceId': 'group', 'channelId': 'light', 'propertyId': 'on'},
        ],
      });
      acknowledge(
        SocketCommandResponseModel(
          status: true,
          message: 'OK',
          data: {
            'request_id': requestId,
            'composites': [
              {'id': 'old-parent', 'status': 'confirmed', 'children': []},
            ],
          },
        ),
      );
      final outcome = await resultFuture;
      expect(outcome.status, 'unknown');
      expect(service.latestFor('group')?.status, 'unknown');
      service.dispose();
    },
  );

  test(
    'an older parent cannot replace the latest command for a group',
    () async {
      final socket = RecordingSocket();
      final service = CompositeCommandService(
        socketService: socket,
        dispatch: CommandDispatchService(socketService: socket),
      );
      final first = service.send(deviceId: 'group', properties: targets);
      await Future<void>.delayed(Duration.zero);
      final firstRequest = socket.sentPayload!['request_id'] as String;
      final firstAck = socket.ack!;
      final second = service.send(deviceId: 'group', properties: targets);
      await Future<void>.delayed(Duration.zero);
      final secondRequest = socket.sentPayload!['request_id'] as String;
      final secondAck = socket.ack!;
      firstAck(
        SocketCommandResponseModel(
          status: true,
          message: 'OK',
          data: {
            'request_id': firstRequest,
            'composites': [
              {'id': 'first-parent', 'status': 'confirmed', 'children': []},
            ],
          },
        ),
      );
      await first;
      expect(service.latestFor('group')?.requestId, secondRequest);
      secondAck(
        SocketCommandResponseModel(
          status: true,
          message: 'OK',
          data: {
            'request_id': secondRequest,
            'composites': [
              {'id': 'second-parent', 'status': 'partial', 'children': []},
            ],
          },
        ),
      );
      await second;
      expect(service.latestFor('group')?.status, 'partial');
      service.dispose();
    },
  );
}
