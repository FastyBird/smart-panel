import 'package:dio/dio.dart';

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
      options.data = _convertToJson(options.data);
    }
    handler.next(options);
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
