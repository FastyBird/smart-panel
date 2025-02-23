import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/system_module/system_module_client.dart';
import 'package:fastybird_smart_panel/modules/system/models/model.dart';
import 'package:flutter/foundation.dart';

class Repository<TModel extends Model> extends ChangeNotifier {
  final SystemModuleClient _apiClient;

  late TModel? data;

  Repository({
    required SystemModuleClient apiClient,
  }) : _apiClient = apiClient {
    data = null;
  }

  SystemModuleClient get apiClient => _apiClient;

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
          '[SYSTEM MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to call backend service');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SYSTEM MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
