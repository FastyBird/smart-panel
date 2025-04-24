import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/foundation.dart';

class DataSourcesRepository extends Repository<DataSourceModel> {
  DataSourcesRepository({required super.apiClient});

  List<DataSourceModel> getForParent(String parentId, String parentType) {
    return data.entries
        .where((entry) =>
            entry.value.parentId == parentId &&
            entry.value.parentType == parentType)
        .map((entry) => entry.value)
        .toList();
  }

  void insertDataSources(List<Map<String, dynamic>> json) {
    late Map<String, DataSourceModel> insertData = {...data};

    for (var row in json) {
      if (!row.containsKey('type')) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][DATA SOURCE] Missing required attribute: "type" for data source: "${row['id']}"',
          );
        }

        continue;
      }

      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(row['type']);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][DATA SOURCE] Unknown data source type: "${row['type']}" for data source: "${row['id']}"',
          );
        }

        continue;
      }

      try {
        DataSourceModel dataSource = buildDataSourceModel(dataSourceType, row);

        insertData[dataSource.id] = dataSource;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][DATA SOURCE] Failed to create data source model: ${e.toString()}',
          );
        }

        /// Failed to create new model
      }
    }

    if (!mapEquals(data, insertData)) {
      data = insertData;

      notifyListeners();
    }
  }

  void delete(String id) {
    if (data.containsKey(id) && data.remove(id) != null) {
      if (kDebugMode) {
        debugPrint(
          '[DASHBOARD MODULE][DATA SOURCE] Removed data source: $id',
        );
      }

      notifyListeners();
    }
  }

  Future<void> fetchDataSource(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModuleDataSource(id: id);

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insertDataSources([raw]);
      },
      'fetch data source',
    );
  }

  Future<void> fetchDataSourceForParent(
    String parentType,
    String parentId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModuleParentDataSources(
          parent: parentType,
          parentId: parentId,
        );

        final raw = response.response.data['data'] as List;

        insertDataSources(raw.cast<Map<String, dynamic>>());
      },
      'fetch data sources',
    );
  }
}
