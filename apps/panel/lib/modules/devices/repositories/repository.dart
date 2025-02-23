import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/devices_module/devices_module_client.dart';
import 'package:fastybird_smart_panel/modules/devices/models/model.dart';
import 'package:flutter/foundation.dart';

abstract class Repository<TModel extends Model> extends ChangeNotifier {
  final DevicesModuleClient _apiClient;

  late Map<String, TModel> data = {};

  Repository({
    required DevicesModuleClient apiClient,
  }) : _apiClient = apiClient;

  DevicesModuleClient get apiClient => _apiClient;

  List<TModel> getItems([List<String>? ids]) {
    if (ids != null) {
      return data.entries
          .where((entry) => ids.contains(entry.key))
          .map((entry) => entry.value)
          .toList();
    }

    return data.values.toList();
  }

  TModel? getItem(String id) {
    if (!data.containsKey(id)) {
      return null;
    }

    return data[id];
  }

  bool replaceItem(TModel item) {
    data[item.id] = item;

    return true;
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
          '[DEVICES MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to $operation: ${e.response?.statusCode}');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
