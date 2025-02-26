import 'dart:io';

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

class SocketService {
  late io.Socket socket;

  final Map<String, List<void Function(String, Map<String, dynamic>)>>
      _eventCallbacks = {};

  void initialize(String apiSecret) {
    socket = io.io(
      '${Platform.environment['APP_HOST'] ?? 'http://10.0.2.2'}:${Platform.environment['BACKEND_PORT'] ?? '3000'}',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setExtraHeaders({'Authorization': 'Bearer $apiSecret'})
          .disableAutoConnect()
          .disableReconnection()
          .build(),
    );

    socket.onConnect((_) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Connected to Socket.IO backend');
      }
    });

    socket.onDisconnect((_) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Disconnected from Socket.IO backend');
      }

      Future.delayed(const Duration(seconds: 2), () {
        if (kDebugMode) {
          debugPrint('[SOCKETS] Trying to reconnect to Socket.IO backend');
        }

        socket.connect();
      });
    });

    socket.on(
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

    // Connect manually
    socket.connect();
  }

  void sendEvent(String event, dynamic data) {
    socket.emit(event, data);
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
    socket.dispose();
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
}
