import 'dart:async';

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
  final Map<String, dynamic>? _data;

  SocketCommandAckResultModel({
    required String handler,
    required bool success,
    required String? reason,
    Map<String, dynamic>? data,
  })  : _handler = handler,
        _success = success,
        _reason = reason,
        _data = data;

  String get handler => _handler;

  bool get success => _success;

  String? get reason => _reason;

  Map<String, dynamic>? get data => _data;

  factory SocketCommandAckResultModel.fromJson(Map<String, dynamic> json) {
    return SocketCommandAckResultModel(
      handler: json['handler'],
      success: json['success'],
      reason: json['reason'],
      data: json['data'] is Map<String, dynamic> ? json['data'] : null,
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
  final Map<String, dynamic>? _data;

  SocketCommandResponseModel({
    required bool status,
    required String message,
    Map<String, dynamic>? data,
  })  : _status = status,
        _message = message,
        _data = data;

  bool get status => _status;

  String get message => _message;

  Map<String, dynamic>? get data => _data;

  factory SocketCommandResponseModel.fromJson(Map<String, dynamic> json) {
    return SocketCommandResponseModel(
      status: json['status'],
      message: json['message'],
      data: json['data'] is Map<String, dynamic> ? json['data'] : null,
    );
  }
}

class SocketService {
  io.Socket? _socket;
  String? _currentApiSecret;
  String? _currentBackendUrl;
  bool _shouldReconnect = true;

  // Retry state for backend down scenarios
  int _retryAttempt = 0;
  bool _reconnectInProgress = false;
  static const int _maxRetryIntervalSeconds = 300; // 5 minutes max
  static const int _initialRetryIntervalSeconds = 2;
  static const int _retryBackoffMultiplier = 2;

  // Timers for reconnection - tracked for proper cleanup on dispose
  Timer? _reconnectTimer;
  Timer? _reconnectCheckTimer;

  // Callback for token invalidation
  void Function()? _onTokenInvalid;

  final Map<String, List<void Function(String, Map<String, dynamic>)>>
      _eventCallbacks = {};

  // Connection state listeners
  final List<void Function(bool)> _connectionListeners = [];

  void initialize(
    String apiSecret,
    String backendUrl, {
    void Function()? onTokenInvalid,
  }) {
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

    // Cancel any pending reconnection timers from previous connection
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectCheckTimer?.cancel();
    _reconnectCheckTimer = null;

    // Enable reconnection for new initialization
    _shouldReconnect = true;

    // Reset retry state on new initialization
    _retryAttempt = 0;
    _reconnectInProgress = false;

    // Store callback for token invalidation
    _onTokenInvalid = onTokenInvalid;

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
      // Reset retry state on successful connection
      _retryAttempt = 0;
      _reconnectInProgress = false;
      // Notify connection listeners
      _notifyConnectionListeners(true);
    });

    _socket!.onDisconnect((_) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Disconnected from Socket.IO backend');
      }
      // Notify connection listeners
      _notifyConnectionListeners(false);

      // Only attempt reconnection if reconnection is enabled
      // This prevents reconnection attempts when display is deleted
      if (_shouldReconnect) {
        // Use exponential backoff for disconnects (backend might be down)
        _attemptReconnectWithBackoff();
      } else {
        if (kDebugMode) {
          debugPrint('[SOCKETS] Reconnection disabled, not attempting to reconnect');
        }
      }
    });

    _socket!.on(
      'event',
      (data) {
        try {
          SocketEventModel event = SocketEventModel.fromJson(data);

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

    // Handle connection errors (authentication failures, etc.)
    _socket!.onConnectError((data) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Connection error: $data');
      }
      _handleConnectionError(data);
    });

    // Handle general errors
    _socket!.onError((data) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Socket error: $data');
      }
      _handleConnectionError(data);
    });

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
                  "data": result?.data,
                }),
              );

              return;
            }

            onAck(
              SocketCommandResponseModel.fromJson({
                "status": true,
                "message": result.reason ?? 'ok',
                "data": result.data,
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

  /// Add a listener for connection state changes
  void addConnectionListener(void Function(bool isConnected) listener) {
    _connectionListeners.add(listener);
  }

  /// Remove a connection state listener
  void removeConnectionListener(void Function(bool isConnected) listener) {
    _connectionListeners.remove(listener);
  }

  /// Check if socket is currently connected
  bool get isConnected => _socket?.connected ?? false;

  /// Manually trigger a reconnection attempt
  /// Resets the backoff counter and attempts to connect immediately
  void reconnect() {
    if (_socket == null || _currentApiSecret == null || _currentBackendUrl == null) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Cannot reconnect: socket not initialized');
      }
      return;
    }

    if (_socket!.connected) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Already connected, skipping manual reconnection');
      }
      return;
    }

    if (kDebugMode) {
      debugPrint('[SOCKETS] Manual reconnection triggered');
    }

    // Cancel any pending reconnection timers
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectCheckTimer?.cancel();
    _reconnectCheckTimer = null;

    // Reset retry state for immediate attempt
    _retryAttempt = 0;
    _reconnectInProgress = false;

    // Enable reconnection if it was disabled
    _shouldReconnect = true;

    // Attempt to connect immediately
    _socket!.connect();

    // Schedule backoff retry if this immediate attempt fails
    _reconnectCheckTimer = Timer(const Duration(seconds: 2), () {
      if (_socket != null && !_socket!.connected && _shouldReconnect) {
        _attemptReconnectWithBackoff();
      }
    });
  }

  /// Notify all connection listeners of state change
  void _notifyConnectionListeners(bool isConnected) {
    for (final listener in _connectionListeners) {
      try {
        listener(isConnected);
      } catch (e) {
        if (kDebugMode) {
          debugPrint('[SOCKETS] Connection listener threw exception: $e');
        }
        // Continue notifying other listeners even if one fails
      }
    }
  }

  void dispose() {
    // Disable reconnection before disposing to prevent reconnection attempts
    _shouldReconnect = false;

    // Cancel any pending reconnection timers
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectCheckTimer?.cancel();
    _reconnectCheckTimer = null;

    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _currentApiSecret = null;
    _currentBackendUrl = null;
    _onTokenInvalid = null;
    _retryAttempt = 0;
    _reconnectInProgress = false;
    _connectionListeners.clear();
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

  void _handleConnectionError(dynamic error) {
    if (_socket == null || _currentApiSecret == null || _currentBackendUrl == null) {
      return;
    }

    // Check if this is an authentication error
    final errorString = error.toString().toLowerCase();
    final errorData = error is Map ? error : null;
    final errorMessage = errorData?['message']?.toString().toLowerCase() ?? '';
    final errorType = errorData?['type']?.toString().toLowerCase() ?? '';

    // Detect authentication errors (401, 403, unauthorized, forbidden, etc.)
    final isAuthError = errorString.contains('unauthorized') ||
        errorString.contains('forbidden') ||
        errorString.contains('401') ||
        errorString.contains('403') ||
        errorMessage.contains('unauthorized') ||
        errorMessage.contains('forbidden') ||
        errorMessage.contains('authentication') ||
        errorMessage.contains('token') ||
        errorType.contains('unauthorized') ||
        errorType.contains('forbidden');

    if (isAuthError) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Authentication error detected, token invalid. Triggering re-registration.');
      }

      // Disable reconnection attempts
      _shouldReconnect = false;

      // Trigger re-registration via callback
      if (_onTokenInvalid != null) {
        _onTokenInvalid!();
      }

      return;
    }

    // For non-auth errors (backend down), use dynamic retry with exponential backoff
    if (_shouldReconnect) {
      _attemptReconnectWithBackoff();
    }
  }

  void _attemptReconnectWithBackoff() {
    if (_socket == null || _currentApiSecret == null || _currentBackendUrl == null) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Cannot reconnect: socket not initialized');
      }
      return;
    }

    if (_socket!.connected) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Already connected, skipping reconnection');
      }
      _reconnectInProgress = false;
      return;
    }

    // Prevent multiple concurrent reconnection attempts
    if (_reconnectInProgress) {
      if (kDebugMode) {
        debugPrint('[SOCKETS] Reconnection already in progress, skipping');
      }
      return;
    }

    _reconnectInProgress = true;

    // Calculate dynamic retry interval with exponential backoff
    final baseInterval = _initialRetryIntervalSeconds;
    final backoffInterval = baseInterval * (_retryBackoffMultiplier * _retryAttempt);
    final retryInterval = backoffInterval > _maxRetryIntervalSeconds
        ? _maxRetryIntervalSeconds
        : backoffInterval;

    _retryAttempt++;

    if (kDebugMode) {
      debugPrint(
        '[SOCKETS] Backend appears to be down. Retry attempt $_retryAttempt with ${retryInterval}s delay (max: ${_maxRetryIntervalSeconds}s)...',
      );
    }

    // Cancel any existing timers before creating new ones
    _reconnectTimer?.cancel();
    _reconnectCheckTimer?.cancel();

    _reconnectTimer = Timer(Duration(seconds: retryInterval), () {
      if (_socket == null || !_shouldReconnect) {
        _reconnectInProgress = false;
        return;
      }

      if (_socket!.connected) {
        if (kDebugMode) {
          debugPrint('[SOCKETS] Successfully reconnected to Socket.IO backend');
        }
        // Reset retry state on successful connection
        _retryAttempt = 0;
        _reconnectInProgress = false;
        return;
      }

      // Attempt to reconnect
      _socket!.connect();

      // Allow next reconnection attempt after connect() is called
      _reconnectInProgress = false;

      // Schedule next retry if still not connected after a short delay
      _reconnectCheckTimer = Timer(Duration(seconds: 2), () {
        if (_socket != null && !_socket!.connected && _shouldReconnect) {
          _attemptReconnectWithBackoff();
        }
      });
    });
  }
}
