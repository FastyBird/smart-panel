import 'dart:io';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/core/interceptors/retry_interceptor.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

// Mock classes
class MockDio extends Mock implements Dio {}

class MockErrorInterceptorHandler extends Mock
    implements ErrorInterceptorHandler {}

void main() {
  late MockDio mockDio;
  late RetryInterceptor interceptor;
  late MockErrorInterceptorHandler mockHandler;

  RequestOptions createRequestOptions({
    String path = '/test',
    String method = 'GET',
    Map<String, dynamic>? extra,
  }) {
    return RequestOptions(
      path: path,
      method: method,
      extra: extra ?? {},
    );
  }

  setUpAll(() {
    registerFallbackValue(createRequestOptions());
    registerFallbackValue(Response(requestOptions: createRequestOptions()));
  });

  setUp(() {
    mockDio = MockDio();
    mockHandler = MockErrorInterceptorHandler();

    // Use test config with short delays for faster tests
    interceptor = RetryInterceptor(
      mockDio,
      config: RetryConfig.testConfig,
    );
  });

  group('RetryInterceptor', () {
    group('_shouldRetry', () {
      test('should not retry cancelled requests', () {
        final requestOptions = createRequestOptions();
        final error = DioException(
          type: DioExceptionType.cancel,
          requestOptions: requestOptions,
        );

        interceptor.onError(error, mockHandler);

        verify(() => mockHandler.next(error)).called(1);
        verifyNever(() => mockDio.fetch(any()));
      });

      test('should retry on connection timeout', () async {
        final requestOptions = createRequestOptions();
        final error = DioException(
          type: DioExceptionType.connectionTimeout,
          requestOptions: requestOptions,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        // Wait for async retry logic to complete
        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on send timeout', () async {
        final requestOptions = createRequestOptions();
        final error = DioException(
          type: DioExceptionType.sendTimeout,
          requestOptions: requestOptions,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on receive timeout', () async {
        final requestOptions = createRequestOptions();
        final error = DioException(
          type: DioExceptionType.receiveTimeout,
          requestOptions: requestOptions,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on connection error', () async {
        final requestOptions = createRequestOptions();
        final error = DioException(
          type: DioExceptionType.connectionError,
          requestOptions: requestOptions,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on socket exception', () async {
        final requestOptions = createRequestOptions();
        final error = DioException(
          type: DioExceptionType.unknown,
          requestOptions: requestOptions,
          error: const SocketException('Connection refused'),
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on 500 Internal Server Error', () async {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 500,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on 502 Bad Gateway', () async {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 502,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on 503 Service Unavailable', () async {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 503,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on 504 Gateway Timeout', () async {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 504,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on 429 Too Many Requests', () async {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 429,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should retry on 408 Request Timeout', () async {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 408,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockDio.fetch(any())).called(1);
      });

      test('should not retry on 400 Bad Request', () {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 400,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );

        interceptor.onError(error, mockHandler);

        verify(() => mockHandler.next(error)).called(1);
        verifyNever(() => mockDio.fetch(any()));
      });

      test('should not retry on 401 Unauthorized', () {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 401,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );

        interceptor.onError(error, mockHandler);

        verify(() => mockHandler.next(error)).called(1);
        verifyNever(() => mockDio.fetch(any()));
      });

      test('should not retry on 403 Forbidden', () {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 403,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );

        interceptor.onError(error, mockHandler);

        verify(() => mockHandler.next(error)).called(1);
        verifyNever(() => mockDio.fetch(any()));
      });

      test('should not retry on 404 Not Found', () {
        final requestOptions = createRequestOptions();
        final errorResponse = Response(
          requestOptions: requestOptions,
          statusCode: 404,
        );
        final error = DioException(
          type: DioExceptionType.badResponse,
          requestOptions: requestOptions,
          response: errorResponse,
        );

        interceptor.onError(error, mockHandler);

        verify(() => mockHandler.next(error)).called(1);
        verifyNever(() => mockDio.fetch(any()));
      });
    });

    group('max retries', () {
      test('should stop retrying after max retries', () async {
        final requestOptions = createRequestOptions(extra: {'retryCount': 2});
        final error = DioException(
          type: DioExceptionType.connectionTimeout,
          requestOptions: requestOptions,
        );

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockHandler.next(error)).called(1);
        verifyNever(() => mockDio.fetch(any()));
      });

      test('should increment retry count on each retry', () async {
        final requestOptions = createRequestOptions();
        final error = DioException(
          type: DioExceptionType.connectionTimeout,
          requestOptions: requestOptions,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        expect(requestOptions.extra['retryCount'], equals(1));
      });
    });

    group('retry callback', () {
      test('should call onRetry callback on each retry attempt', () async {
        var callbackCalled = false;
        var callbackAttempt = 0;

        final interceptorWithCallback = RetryInterceptor(
          mockDio,
          config: RetryConfig.testConfig,
          onRetry: (request, attempt, error) {
            callbackCalled = true;
            callbackAttempt = attempt;
          },
        );

        final requestOptions = createRequestOptions();
        final error = DioException(
          type: DioExceptionType.connectionTimeout,
          requestOptions: requestOptions,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);

        interceptorWithCallback.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        expect(callbackCalled, isTrue);
        expect(callbackAttempt, equals(1));
      });
    });

    group('successful retry', () {
      test('should resolve with response on successful retry', () async {
        final requestOptions = createRequestOptions();
        final error = DioException(
          type: DioExceptionType.connectionTimeout,
          requestOptions: requestOptions,
        );
        final successResponse = Response(
          requestOptions: requestOptions,
          statusCode: 200,
          data: {'success': true},
        );

        when(() => mockDio.fetch(any())).thenAnswer((_) async => successResponse);
        when(() => mockHandler.resolve(any())).thenReturn(null);

        interceptor.onError(error, mockHandler);

        await Future.delayed(const Duration(milliseconds: 50));

        verify(() => mockHandler.resolve(any())).called(1);
      });
    });

    group('RetryConfig', () {
      test('default config has sensible values', () {
        const config = RetryConfig.defaultConfig;

        expect(config.maxRetries, equals(3));
        expect(config.initialDelayMs, equals(500));
        expect(config.maxDelayMs, equals(10000));
        expect(config.backoffMultiplier, equals(2.0));
        expect(config.retryStatusCodes.contains(500), isTrue);
        expect(config.retryStatusCodes.contains(502), isTrue);
        expect(config.retryStatusCodes.contains(503), isTrue);
        expect(config.retryStatusCodes.contains(504), isTrue);
        expect(config.retryStatusCodes.contains(429), isTrue);
        expect(config.retryStatusCodes.contains(408), isTrue);
      });

      test('test config has shorter delays', () {
        const config = RetryConfig.testConfig;

        expect(config.maxRetries, equals(2));
        expect(config.initialDelayMs, equals(10));
        expect(config.maxDelayMs, equals(100));
      });

      test('custom config can be created', () {
        const config = RetryConfig(
          maxRetries: 5,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
          backoffMultiplier: 3.0,
          retryStatusCodes: {500, 502},
        );

        expect(config.maxRetries, equals(5));
        expect(config.initialDelayMs, equals(1000));
        expect(config.maxDelayMs, equals(30000));
        expect(config.backoffMultiplier, equals(3.0));
        expect(config.retryStatusCodes, equals({500, 502}));
      });
    });
  });
}
