import 'dart:async';

import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:flutter/foundation.dart';

/// Result of a command dispatch operation
class CommandDispatchResult {
  final bool success;
  final String? reason;
  final Map<String, dynamic>? data;
  final CommandDispatchChannel channel;

  CommandDispatchResult({
    required this.success,
    this.reason,
    this.data,
    required this.channel,
  });
}

/// Channel used for command dispatch
enum CommandDispatchChannel {
  websocket,
  api,
}

/// Callback type for API fallback execution
typedef ApiFallbackCallback<T> = Future<T?> Function();

/// Service for dispatching commands with WebSocket primary and API fallback.
///
/// This service provides a unified interface for sending commands to the backend,
/// automatically routing through WebSocket when available and falling back to
/// REST API when WebSocket is disconnected.
///
/// Usage example:
/// ```dart
/// final result = await commandDispatch.dispatch(
///   event: 'SpacesModule.LightingIntent',
///   handler: 'SpacesModule.LightingIntentHandler',
///   payload: {'spaceId': 'abc', 'intent': {...}},
///   apiFallback: () => apiClient.executeLightingIntent(...),
/// );
/// ```
class CommandDispatchService {
  final SocketService _socketService;

  CommandDispatchService({
    required SocketService socketService,
  }) : _socketService = socketService;

  /// Check if WebSocket is currently connected
  bool get isWebSocketConnected => _socketService.isConnected;

  /// Dispatch a command through WebSocket if connected, otherwise use API fallback.
  ///
  /// [event] - The WebSocket event name to emit
  /// [handler] - The expected handler name for acknowledgment validation
  /// [payload] - The command payload data
  /// [apiFallback] - Function to call for API fallback when WebSocket is unavailable
  ///
  /// Returns [CommandDispatchResult] with success status and response data.
  Future<CommandDispatchResult> dispatch<T>({
    required String event,
    required String handler,
    required Map<String, dynamic> payload,
    required ApiFallbackCallback<T> apiFallback,
    T Function(Map<String, dynamic>)? parseResponse,
  }) async {
    // Try WebSocket first if connected
    if (_socketService.isConnected) {
      try {
        final result = await _dispatchViaWebSocket(
          event: event,
          handler: handler,
          payload: payload,
        );

        if (result.success) {
          return result;
        }

        // If WebSocket command failed, try API fallback
        if (kDebugMode) {
          debugPrint(
            '[COMMAND DISPATCH] WebSocket command failed (${result.reason}), trying API fallback',
          );
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[COMMAND DISPATCH] WebSocket error: $e, trying API fallback',
          );
        }
      }
    } else {
      if (kDebugMode) {
        debugPrint(
          '[COMMAND DISPATCH] WebSocket not connected, using API fallback',
        );
      }
    }

    // Fall back to API
    return _dispatchViaApi(apiFallback);
  }

  /// Dispatch command via WebSocket with acknowledgment
  Future<CommandDispatchResult> _dispatchViaWebSocket({
    required String event,
    required String handler,
    required Map<String, dynamic> payload,
  }) async {
    final completer = Completer<CommandDispatchResult>();

    await _socketService.sendCommand(
      event,
      payload,
      handler,
      onAck: (SocketCommandResponseModel? response) {
        if (response == null) {
          completer.complete(CommandDispatchResult(
            success: false,
            reason: 'No response received',
            channel: CommandDispatchChannel.websocket,
          ));
        } else if (response.status == false) {
          completer.complete(CommandDispatchResult(
            success: false,
            reason: response.message,
            channel: CommandDispatchChannel.websocket,
          ));
        } else {
          completer.complete(CommandDispatchResult(
            success: true,
            reason: response.message,
            channel: CommandDispatchChannel.websocket,
          ));
        }
      },
    );

    // Add timeout for WebSocket response
    return completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () {
        if (kDebugMode) {
          debugPrint('[COMMAND DISPATCH] WebSocket command timed out');
        }
        return CommandDispatchResult(
          success: false,
          reason: 'WebSocket command timed out',
          channel: CommandDispatchChannel.websocket,
        );
      },
    );
  }

  /// Dispatch command via API fallback
  Future<CommandDispatchResult> _dispatchViaApi<T>(
    ApiFallbackCallback<T> apiFallback,
  ) async {
    try {
      final result = await apiFallback();

      if (result != null) {
        return CommandDispatchResult(
          success: true,
          data: result is Map<String, dynamic> ? result : null,
          channel: CommandDispatchChannel.api,
        );
      } else {
        return CommandDispatchResult(
          success: false,
          reason: 'API call returned null',
          channel: CommandDispatchChannel.api,
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[COMMAND DISPATCH] API fallback error: $e');
      }
      return CommandDispatchResult(
        success: false,
        reason: e.toString(),
        channel: CommandDispatchChannel.api,
      );
    }
  }

  /// Dispatch a command exclusively via WebSocket (no API fallback).
  ///
  /// Use this when you only want to use WebSocket and don't have an API fallback.
  /// Returns null if WebSocket is not connected.
  Future<CommandDispatchResult?> dispatchWebSocketOnly({
    required String event,
    required String handler,
    required Map<String, dynamic> payload,
  }) async {
    if (!_socketService.isConnected) {
      if (kDebugMode) {
        debugPrint(
          '[COMMAND DISPATCH] WebSocket not connected, command not sent',
        );
      }
      return null;
    }

    return _dispatchViaWebSocket(
      event: event,
      handler: handler,
      payload: payload,
    );
  }
}
