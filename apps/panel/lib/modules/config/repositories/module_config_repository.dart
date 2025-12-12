import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:flutter/foundation.dart';

class ModuleConfigRepository<T extends Model> extends ChangeNotifier {
  final String _moduleName;
  final ApiClient _apiClient;
  final T Function(Map<String, dynamic>) _fromJson;
  final Future<bool> Function(String name, Map<String, dynamic> data)? _updateHandler;

  T? _data;

  ModuleConfigRepository({
    required String moduleName,
    required ApiClient apiClient,
    required T Function(Map<String, dynamic>) fromJson,
    Future<bool> Function(String name, Map<String, dynamic> data)? updateHandler,
  })  : _moduleName = moduleName,
        _apiClient = apiClient,
        _fromJson = fromJson,
        _updateHandler = updateHandler;

  T? get data => _data;

  T? getItem() => _data;

  Future<void> fetchConfiguration() async {
    return _handleApiCall(() async {
      final response = await _apiClient.configurationModule.getConfigModuleConfigModule(
        module: _moduleName,
      );

      // Extract the actual config data from the response
      final rawResponse = response.response.data;
      if (rawResponse is Map<String, dynamic> &&
          rawResponse['data'] is Map<String, dynamic>) {
        final configData = rawResponse['data'] as Map<String, dynamic>;
        insertConfiguration(configData);
      }
    }, 'fetch configuration');
  }

  void insertConfiguration(Map<String, dynamic> json) {
    try {
      final newData = _fromJson(json);

      if (_data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[CONFIG MODULE] Configuration for $_moduleName was successfully updated',
          );
        }

        _data = newData;
        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CONFIG MODULE] Configuration model for $_moduleName could not be created: ${e.toString()}',
        );
      }

      rethrow;
    }
  }

  Future<bool> updateConfiguration(Map<String, dynamic> data) async {
    if (_updateHandler != null) {
      return await _updateHandler(_moduleName, data);
    }

    // Default update logic using API
    return await _updateConfigurationRaw(data);
  }

  Future<bool> _updateConfigurationRaw(Map<String, dynamic> requestBody) async {
    return await _handleApiCall(() async {
      // Get the Dio instance from ApiClient
      final dio = (_apiClient as dynamic)._dio as Dio;
      final baseUrl = (_apiClient as dynamic)._baseUrl as String?;

      // Build the full URL
      final url = baseUrl != null
          ? '$baseUrl/config-module/config/module/$_moduleName'
          : '/config-module/config/module/$_moduleName';

      // Create request body with data field if not already wrapped
      final body = requestBody.containsKey('data')
          ? requestBody
          : <String, dynamic>{'data': requestBody};

      // Make the request
      final response = await dio.patch<Map<String, dynamic>>(
        url,
        data: body,
      );

      // Extract the actual config data from the response
      final rawResponse = response.data;
      if (rawResponse is Map<String, dynamic> &&
          rawResponse['data'] is Map<String, dynamic>) {
        final configData = rawResponse['data'] as Map<String, dynamic>;
        insertConfiguration(configData);
      }

      return true;
    }, 'update configuration');
  }

  Future<TResult> _handleApiCall<TResult>(
    Future<TResult> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CONFIG MODULE][${operation.toUpperCase()}] API error for $_moduleName: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to call backend service');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CONFIG MODULE][${operation.toUpperCase()}] Unexpected error for $_moduleName: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
