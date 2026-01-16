import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/core/services/metrics_service.dart';
import 'package:flutter/foundation.dart';

/// Configuration for retry behavior
class RetryConfig {
  /// Maximum number of retry attempts
  final int maxRetries;

  /// Initial delay before first retry (in milliseconds)
  final int initialDelayMs;

  /// Maximum delay between retries (in milliseconds)
  final int maxDelayMs;

  /// Exponential backoff multiplier
  final double backoffMultiplier;

  /// HTTP status codes that should trigger a retry
  final Set<int> retryStatusCodes;

  const RetryConfig({
    this.maxRetries = 3,
    this.initialDelayMs = 500,
    this.maxDelayMs = 10000,
    this.backoffMultiplier = 2.0,
    this.retryStatusCodes = const {
      408, // Request Timeout
      429, // Too Many Requests
      500, // Internal Server Error
      502, // Bad Gateway
      503, // Service Unavailable
      504, // Gateway Timeout
    },
  });

  /// Default configuration for production use
  static const RetryConfig defaultConfig = RetryConfig();

  /// Configuration for testing with shorter delays
  static const RetryConfig testConfig = RetryConfig(
    maxRetries: 2,
    initialDelayMs: 10,
    maxDelayMs: 100,
    backoffMultiplier: 2.0,
  );
}

/// Interceptor that automatically retries failed requests with exponential backoff.
///
/// This interceptor handles:
/// - Network errors (connection timeouts, socket exceptions)
/// - Server errors (5xx status codes)
/// - Rate limiting (429 Too Many Requests)
///
/// Requests are retried with exponential backoff to avoid overwhelming
/// the server during outages or high load periods.
class RetryInterceptor extends Interceptor {
  final Dio _dio;
  final RetryConfig _config;

  /// Optional callback for tracking retry attempts (useful for monitoring/analytics)
  final void Function(RequestOptions request, int attempt, DioException error)?
      onRetry;

  RetryInterceptor(
    this._dio, {
    RetryConfig? config,
    this.onRetry,
  }) : _config = config ?? RetryConfig.defaultConfig;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Check if we should retry this error
    if (!_shouldRetry(err)) {
      return handler.next(err);
    }

    // Get current retry count and start time from request extras
    final requestOptions = err.requestOptions;
    final retryCount = requestOptions.extra['retryCount'] as int? ?? 0;
    final startTime = requestOptions.extra['retryStartTime'] as DateTime? ?? DateTime.now();

    // Store start time on first retry attempt
    if (retryCount == 0) {
      requestOptions.extra['retryStartTime'] = startTime;
    }

    // Check if we've exceeded max retries
    if (retryCount >= _config.maxRetries) {
      if (kDebugMode) {
        debugPrint(
          '[RETRY INTERCEPTOR] Max retries ($retryCount) exceeded for ${requestOptions.path}',
        );
      }

      // Track retry failure (all retries exhausted)
      final totalDuration = DateTime.now().difference(startTime);
      MetricsService.instance.trackRetryFailure(
        requestOptions.path,
        retryCount,
        totalDuration,
        _getErrorDescription(err),
      );

      return handler.next(err);
    }

    // Calculate delay with exponential backoff and jitter
    final delay = _calculateDelay(retryCount);

    if (kDebugMode) {
      debugPrint(
        '[RETRY INTERCEPTOR] Retrying ${requestOptions.path} '
        '(attempt ${retryCount + 1}/${_config.maxRetries}) '
        'after ${delay}ms - Error: ${_getErrorDescription(err)}',
      );
    }

    // Track this retry attempt
    MetricsService.instance.trackRetry(
      requestOptions.path,
      retryCount + 1,
      _getErrorDescription(err),
      statusCode: err.response?.statusCode,
      delay: Duration(milliseconds: delay),
    );

    // Notify retry callback if provided
    onRetry?.call(requestOptions, retryCount + 1, err);

    // Wait before retrying
    await Future.delayed(Duration(milliseconds: delay));

    // Update retry count in request extras
    requestOptions.extra['retryCount'] = retryCount + 1;

    try {
      // Retry the request
      final response = await _dio.fetch(requestOptions);

      // Track successful retry recovery
      final totalDuration = DateTime.now().difference(startTime);
      MetricsService.instance.trackRetrySuccess(
        requestOptions.path,
        retryCount + 1,
        totalDuration,
      );

      return handler.resolve(response);
    } on DioException catch (e) {
      // Check if we should retry again
      if (_shouldRetry(e)) {
        return onError(e, handler);
      }
      return handler.next(e);
    } catch (e) {
      // Wrap non-DioException in a DioException to preserve the actual error
      final wrappedError = DioException(
        requestOptions: requestOptions,
        error: e,
        type: DioExceptionType.unknown,
        message: 'Non-Dio exception during retry: $e',
      );
      return handler.next(wrappedError);
    }
  }

  /// Determines if the error should trigger a retry
  bool _shouldRetry(DioException err) {
    // Don't retry cancelled requests
    if (err.type == DioExceptionType.cancel) {
      return false;
    }

    // Retry network-related errors
    if (_isNetworkError(err)) {
      return true;
    }

    // Retry specific status codes
    final statusCode = err.response?.statusCode;
    if (statusCode != null && _config.retryStatusCodes.contains(statusCode)) {
      return true;
    }

    return false;
  }

  /// Checks if the error is a network-related error
  bool _isNetworkError(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.connectionError:
        return true;
      case DioExceptionType.unknown:
        // Check for specific socket errors
        final error = err.error;
        if (error is SocketException) {
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  /// Calculates delay with exponential backoff and jitter
  int _calculateDelay(int retryCount) {
    // Exponential backoff: delay = initialDelay * (multiplier ^ retryCount)
    final exponentialDelay =
        _config.initialDelayMs * pow(_config.backoffMultiplier, retryCount);

    // Add jitter (random variation) to prevent thundering herd
    final random = Random();
    final jitter = random.nextDouble() * 0.3; // Up to 30% jitter
    final delayWithJitter = exponentialDelay * (1 + jitter);

    // Cap at max delay
    return min(delayWithJitter.toInt(), _config.maxDelayMs);
  }

  /// Gets a human-readable description of the error
  String _getErrorDescription(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
        return 'Connection timeout';
      case DioExceptionType.sendTimeout:
        return 'Send timeout';
      case DioExceptionType.receiveTimeout:
        return 'Receive timeout';
      case DioExceptionType.connectionError:
        return 'Connection error';
      case DioExceptionType.badResponse:
        return 'HTTP ${err.response?.statusCode}';
      case DioExceptionType.cancel:
        return 'Request cancelled';
      case DioExceptionType.unknown:
        if (err.error is SocketException) {
          return 'Socket exception';
        }
        return 'Unknown error';
      default:
        return err.message ?? 'Unknown';
    }
  }
}
