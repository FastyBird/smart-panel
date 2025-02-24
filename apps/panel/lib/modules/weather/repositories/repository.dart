import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/weather_module/weather_module_client.dart';
import 'package:flutter/foundation.dart';

class Repository<TModel> extends ChangeNotifier {
  final WeatherModuleClient _apiClient;

  late TModel? data;

  Repository({
    required WeatherModuleClient apiClient,
  }) : _apiClient = apiClient {
    data = null;
  }

  WeatherModuleClient get apiClient => _apiClient;

  TModel? getItem() {
    return data;
  }

  Future<T> handleApiCall<T>(
    Future<T> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to call backend service');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
