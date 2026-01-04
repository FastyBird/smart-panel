import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

/// Interceptor that automatically converts objects with toJson() method
/// to Maps before sending requests.
///
/// This is needed because Dio's default transformer doesn't automatically
/// call toJson() on Freezed objects.
class JsonSerializerInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Convert body to JSON if it has a toJson method
    if (options.data != null) {
      final originalData = options.data;
      options.data = _convertToJson(options.data);

      if (kDebugMode) {
        debugPrint('[JSON INTERCEPTOR] ${options.method} ${options.path}');
        debugPrint('[JSON INTERCEPTOR] Original type: ${originalData.runtimeType}');
        debugPrint('[JSON INTERCEPTOR] Converted type: ${options.data.runtimeType}');
        if (options.data is Map) {
          debugPrint('[JSON INTERCEPTOR] Body: ${jsonEncode(options.data)}');
        }
      }
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    if (kDebugMode) {
      debugPrint('[JSON INTERCEPTOR] Response ${response.statusCode} for ${response.requestOptions.path}');
      debugPrint('[JSON INTERCEPTOR] Response type: ${response.data.runtimeType}');
      if (response.data != null) {
        debugPrint('[JSON INTERCEPTOR] Response data: ${response.data.toString().substring(0, response.data.toString().length > 200 ? 200 : response.data.toString().length)}...');
      }
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (kDebugMode) {
      debugPrint('[JSON INTERCEPTOR] Error for ${err.requestOptions.path}');
      debugPrint('[JSON INTERCEPTOR] Error type: ${err.type}');
      debugPrint('[JSON INTERCEPTOR] Error message: ${err.message}');
      debugPrint('[JSON INTERCEPTOR] Error response: ${err.response?.data}');
      debugPrint('[JSON INTERCEPTOR] Error error: ${err.error}');
    }
    handler.next(err);
  }

  dynamic _convertToJson(dynamic data) {
    if (data == null) {
      return null;
    }

    // If it's already a Map or List of primitives, return as-is
    if (data is Map<String, dynamic>) {
      return data;
    }

    if (data is List) {
      return data.map((e) => _convertToJson(e)).toList();
    }

    // Check if the object has a toJson method
    try {
      // ignore: avoid_dynamic_calls
      final json = data.toJson();
      if (json is Map<String, dynamic>) {
        return json;
      }
      return data;
    } catch (_) {
      // Object doesn't have toJson, return as-is
      return data;
    }
  }
}
