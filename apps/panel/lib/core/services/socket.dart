import 'package:collection/collection.dart';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class SocketEventMetadataModel {
  final DateTime _timestamp;

  SocketEventMetadataModel({
    required DateTime timestamp,
  }) : _timestamp = timestamp;

  DateTime get timestamp => _timestamp;

  factory SocketEventMetadataModel.fromJson(Map<String, dynamic> json) {
    return SocketEventMetadataModel(
      timestamp: DateTime.parse(json['timestamp']),
    );
  }
}

class SocketEventModel {
  final String _event;
  final Map<String, dynamic> _payload;
  final SocketEventMetadataModel _metadata;

  SocketEventModel({
    required String event,
    required Map<String, dynamic> payload,
    required SocketEventMetadataModel metadata,
  })  : _event = event,
        _payload = payload,
        _metadata = metadata;

  String get event => _event;

  Map<String, dynamic> get payload => _payload;

  SocketEventMetadataModel get metadata => _metadata;

  factory SocketEventModel.fromJson(Map<String, dynamic> json) {
    SocketEventMetadataModel metadata =
        SocketEventMetadataModel.fromJson(json['metadata']);

    return SocketEventModel(
      event: json['event'],
      payload: json['payload'],
      metadata: metadata,
    );
  }
}

class SocketCommandAckResultModel {
  final String _handler;
  final bool _success;
  final String? _reason;

  SocketCommandAckResultModel({
    required String handler,
    required bool success,
    required String? reason,
  })  : _handler = handler,
        _success = success,
        _reason = reason;

  String get handler => _handler;

  bool get success => _success;

  String? get reason => _reason;

  factory SocketCommandAckResultModel.fromJson(Map<String, dynamic> json) {
    return SocketCommandAckResultModel(
      handler: json['handler'],
      success: json['success'],
      reason: json['reason'],
    );
  }
}

class SocketCommandAckModel {
  final String _status;
  final String _message;
  final List<SocketCommandAckResultModel> _results;

  SocketCommandAckModel({
    required String status,
    required String message,
    required List<SocketCommandAckResultModel> results,
  })  : _status = status,
        _message = message,
        _results = results;

  String get status => _status;

  String get message => _message;

  List<SocketCommandAckResultModel> get results => _results;

  factory SocketCommandAckModel.fromJson(Map<String, dynamic> json) {
    List<SocketCommandAckResultModel> results = [];

    if (json['results'] is List) {
      for (var result in json['results']) {
        results.add(SocketCommandAckResultModel.fromJson(result));
      }
    }

    return SocketCommandAckModel(
      status: json['status'],
      message: json['message'],
      results: results,
    );
  }
}

class SocketCommandResponseModel {
  final bool _status;
  final String _message;

  SocketCommandResponseModel({
    required bool status,
    required String message,
  })  : _status = status,
        _message = message;

  bool get status => _status;

  String get message => _message;

  factory SocketCommandResponseModel.fromJson(Map<String, dynamic> json) {
    return SocketCommandResponseModel(
      status: json['status'],
      message: json['message'],
    );
  }
}

class SocketService {
  io.Socket? _socket;
  String? _currentApiSecret;
  String? _currentBackendUrl;

  final Map<String, List<void Function(String, Map<String, dynamic>)>>
      _eventCallbacks = {};

  void initialize(String apiSecret, String backendUrl) {
    // If already initialized with the same token and URL, skip reinitialization
    if (_socket != null &&
        _currentApiSecret == apiSecret &&
        _currentBackendUrl == backendUrl &&
        _socket!.connected) {
      if (kDebugMode) {
        debugPrint(
          '[SOCKETS] Socket already initialized and connected with same credentials, skipping',
        );
      }
      return;
    }

    // Disconnect existing socket if it exists
    if (_socket != null) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Disconnecting existing socket before reinitializing');
      }
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }

    // Store current credentials
    _currentApiSecret = apiSecret;
    _currentBackendUrl = backendUrl;

    // Parse the backend URL to extract host and port
    // backendUrl format: http://host:port/api/v1 or https://host:port/api/v1
    final uri = Uri.parse(backendUrl);
    final String host = uri.scheme == 'https' ? 'https://${uri.host}' : 'http://${uri.host}';
    // Use explicit port if provided, otherwise use default (80 for http, 443 for https)
    final int port = uri.hasPort
        ? uri.port
        : (uri.scheme == 'https' ? 443 : 80);

    final String socketUrl = uri.hasPort ? '$host:$port' : host;

    _socket = io.io(
      socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': apiSecret})
          .disableAutoConnect()
          .disableReconnection()
          .build(),
    );

    _socket!.onConnect((_) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Connected to Socket.IO backend');
      }
    });

    _socket!.onDisconnect((_) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Disconnected from Socket.IO backend');
      }

      _attemptReconnect();
    });

    _socket!.on(
      'event',
      (data) {
        try {
          SocketEventModel event = SocketEventModel.fromJson(data);

          if (kDebugMode) {
            debugPrint(
              '[SOCKETS] Received event: ${event.event}',
            );
          }

          /// Handle received event by module consumers
          _dispatchEvent(event);
        } catch (e) {
          if (kDebugMode) {
            debugPrint(
              '[SOCKETS] Received event payload is not valid: ${e.toString()}',
            );
          }

          return;
        }
      },
    );

    _socket!.connect();
  }

  Future<void> sendCommand(String event, dynamic data, String handler,
      {Function(SocketCommandResponseModel?)? onAck}) async {
    if (_socket == null || !_socket!.connected) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Cannot send command: socket not connected');
      }
      if (onAck != null) {
        onAck(
          SocketCommandResponseModel(
            status: false,
            message: 'Socket not connected',
          ),
        );
      }
      return;
    }

    Map<String, dynamic> payload = {
      'event': event,
      'payload': data,
    };

    await _socket!.emitWithAckAsync(
      'command',
      payload,
      ack: (dynamic response) {
        if (onAck != null) {
          try {
            SocketCommandAckModel res = SocketCommandAckModel.fromJson(
              response,
            );

            if (kDebugMode) {
              debugPrint('[SOCKETS] Received command acknowledge');
            }

            if (res.status != 'ok') {
              onAck(
                SocketCommandResponseModel.fromJson({
                  "status": false,
                  "message": res.message,
                }),
              );

              return;
            }

            // Search for the relevant handler result
            final SocketCommandAckResultModel? result =
                res.results.firstWhereOrNull(
              (r) => r.handler == handler,
            );

            if (result == null || result.success != true) {
              onAck(
                SocketCommandResponseModel.fromJson({
                  "status": false,
                  "message": result?.reason ?? 'Unknown error',
                }),
              );
            }

            onAck(
              SocketCommandResponseModel.fromJson({
                "status": true,
                "message": result?.reason ?? 'ok',
              }),
            );
          } catch (e) {
            if (kDebugMode) {
              debugPrint(
                '[SOCKETS] Received acknowledge payload is not valid: ${e.toString()}',
              );
            }

            onAck(null);
          }
        }
      },
    );
  }

  void registerEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) callback,
  ) {
    if (!_eventCallbacks.containsKey(event)) {
      _eventCallbacks[event] = [];
    }

    _eventCallbacks[event]!.add(callback);
  }

  void unregisterEventHandler(
    String event,
    void Function(String, Map<String, dynamic>) callback,
  ) {
    _eventCallbacks[event]?.remove(callback);

    if (_eventCallbacks[event]?.isEmpty ?? false) {
      _eventCallbacks.remove(event);
    }
  }

  void dispose() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _currentApiSecret = null;
    _currentBackendUrl = null;
  }

  void _dispatchEvent(SocketEventModel event) {
    // Direct match: check if the exact event exists
    if (_eventCallbacks.containsKey(event.event)) {
      for (var callback in _eventCallbacks[event.event]!) {
        callback(event.event, event.payload);
      }
    }

    // Wildcard match: check registered events with '*'
    for (var registeredEvent in _eventCallbacks.keys) {
      if (_matchesWildcard(registeredEvent, event.event)) {
        for (var callback in _eventCallbacks[registeredEvent]!) {
          callback(event.event, event.payload);
        }
      }
    }
  }

  bool _matchesWildcard(String registeredEvent, String receivedEvent) {
    // Convert wildcard into regex pattern
    final pattern =
        '^${RegExp.escape(registeredEvent).replaceAll(r'\*', '.*')}\$';
    RegExp regex = RegExp(pattern);

    return regex.hasMatch(receivedEvent);
  }

  void _attemptReconnect({int delayInSeconds = 2, int? maxAttempts}) {
    if (_socket == null || _currentApiSecret == null || _currentBackendUrl == null) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Cannot reconnect: socket not initialized');
      }
      return;
    }

    int attempt = 0;

    void reconnect() {
      if (_socket == null) {
        return;
      }

      if (_socket!.connected) {
        if (kDebugMode) {
          debugPrint('[SOCKETS] Successfully reconnected to Socket.IO backend');
        }

        return;
      }

      if (maxAttempts != null && attempt >= maxAttempts) {
        if (kDebugMode) {
          debugPrint('[SOCKETS] Max reconnection attempts reached, stopping.');
        }

        return;
      }

      attempt++;

      Future.delayed(Duration(seconds: delayInSeconds), () {
        if (_socket == null) {
          return;
        }

        if (kDebugMode) {
          debugPrint(
            '[SOCKETS] Reconnection attempt $attempt/${maxAttempts ?? '-'} to Socket.IO backend...',
          );
        }

        _socket!.connect();

        if (!_socket!.connected) {
          reconnect();
        }
      });
    }

    reconnect();
  }
}
