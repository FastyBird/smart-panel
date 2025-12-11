import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/foundation.dart';

/// Interceptor that automatically refreshes tokens on 401 errors
/// and retries the original request with the new token
class TokenRefreshInterceptor extends Interceptor {
  final DisplayRepository _displayRepository;
  bool _isRefreshing = false;
  final List<_PendingRequest> _pendingRequests = [];

  TokenRefreshInterceptor(this._displayRepository);

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Only handle 401 Unauthorized errors
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    // If we're already refreshing, queue this request
    if (_isRefreshing) {
      if (kDebugMode) {
        debugPrint(
          '[TOKEN REFRESH INTERCEPTOR] Token refresh in progress, queuing request',
        );
      }

      final completer = Completer<Response>();
      _pendingRequests.add(_PendingRequest(
        requestOptions: err.requestOptions,
        completer: completer,
      ));

      try {
        final response = await completer.future;
        return handler.resolve(response);
      } catch (e) {
        return handler.reject(err);
      }
    }

    // Attempt to refresh the token
    _isRefreshing = true;

    if (kDebugMode) {
      debugPrint(
        '[TOKEN REFRESH INTERCEPTOR] Token expired, attempting refresh...',
      );
    }

    try {
      final refreshResult = await _displayRepository.refreshToken();

      if (refreshResult == TokenRefreshResult.success) {
        if (kDebugMode) {
          debugPrint(
            '[TOKEN REFRESH INTERCEPTOR] Token refreshed successfully, retrying request',
          );
        }

        // Retry the original request with the new token
        final opts = err.requestOptions;
        final currentToken = _displayRepository.getCurrentToken();
        if (currentToken != null) {
          opts.headers['Authorization'] = 'Bearer $currentToken';
        }

        final response = await _displayRepository.dio.fetch(opts);

        // Process any pending requests
        _processPendingRequests(response);

        return handler.resolve(response);
      } else {
        if (kDebugMode) {
          debugPrint(
            '[TOKEN REFRESH INTERCEPTOR] Token refresh failed, rejecting request',
          );
        }

        // Token refresh failed - reject all pending requests
        _rejectPendingRequests(err);

        return handler.reject(err);
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[TOKEN REFRESH INTERCEPTOR] Token refresh error: $e',
        );
      }

      // Token refresh failed - reject all pending requests
      _rejectPendingRequests(err);

      return handler.reject(err);
    } finally {
      _isRefreshing = false;
    }
  }

  void _processPendingRequests(Response response) {
    final currentToken = _displayRepository.getCurrentToken();

    for (final pending in _pendingRequests) {
      // Update the authorization header for pending requests
      if (currentToken != null) {
        pending.requestOptions.headers['Authorization'] = 'Bearer $currentToken';
      }

      // Retry the pending request
      _displayRepository.dio
          .fetch(pending.requestOptions)
          .then((response) => pending.completer.complete(response))
          .catchError((error) => pending.completer.completeError(error));
    }

    _pendingRequests.clear();
  }

  void _rejectPendingRequests(DioException error) {
    for (final pending in _pendingRequests) {
      pending.completer.completeError(error);
    }

    _pendingRequests.clear();
  }
}

class _PendingRequest {
  final RequestOptions requestOptions;
  final Completer<Response> completer;

  _PendingRequest({
    required this.requestOptions,
    required this.completer,
  });
}
