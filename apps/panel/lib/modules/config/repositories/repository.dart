import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/configuration_module/configuration_module_client.dart';
import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:flutter/foundation.dart';

class Repository<TModel extends Model> extends ChangeNotifier {
  final ConfigurationModuleClient _apiClient;

  late TModel data;

  Repository({
    required ConfigurationModuleClient apiClient,
  }) : _apiClient = apiClient;

  ConfigurationModuleClient get apiClient => _apiClient;

  TModel getItem() {
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
          '[CONFIG MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to call backend service');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CONFIG MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
