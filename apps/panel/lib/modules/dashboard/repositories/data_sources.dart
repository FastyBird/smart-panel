import 'dart:convert';

import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/foundation.dart';

class DataSourcesRepository extends Repository<DataSourceModel> {
  DataSourcesRepository({required super.apiClient});

  void insertPageDataSources(List<Map<String, dynamic>> json) {
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
            '[DASHBOARD MODULE][DATA SOURCE] Unknown cards page data source type: "${row['type']}" for data source: "${row['id']}"',
          );
        }

        continue;
      }

      try {
        DataSourceModel dataSource =
            buildPageDataSourceModel(dataSourceType, row);

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

  void insertCardDataSources(List<Map<String, dynamic>> json) {
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
            '[DASHBOARD MODULE][DATA SOURCE] Unknown cards page data source type: "${row['type']}" for data source: "${row['id']}"',
          );
        }

        continue;
      }

      try {
        DataSourceModel dataSource =
            buildCardDataSourceModel(dataSourceType, row);

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

  void insertTileDataSources(List<Map<String, dynamic>> json) {
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
            '[DASHBOARD MODULE][DATA SOURCE] Unknown cards page data source type: "${row['type']}" for data source: "${row['id']}"',
          );
        }

        continue;
      }

      try {
        DataSourceModel dataSource =
            buildTileDataSourceModel(dataSourceType, row);

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

  Future<void> fetchPageDataSource(
    String pageId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageDataSources(
          pageId: pageId,
        );

        List<Map<String, dynamic>> dataSources = [];

        for (var dataSource in response.data.data) {
          dataSources.add(jsonDecode(jsonEncode(dataSource)));
        }

        insertPageDataSources(dataSources);
      },
      'fetch page data sources',
    );
  }

  Future<void> fetchPageCardDataSource(
    String pageId,
    String cardId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageCardDataSources(
          pageId: pageId,
          cardId: cardId,
        );

        List<Map<String, dynamic>> dataSources = [];

        for (var dataSource in response.data.data) {
          dataSources.add(jsonDecode(jsonEncode(dataSource)));
        }

        insertCardDataSources(dataSources);
      },
      'fetch page card data sources',
    );
  }

  Future<void> fetchPageTileDataSource(
    String pageId,
    String tileId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageTileDataSources(
          pageId: pageId,
          tileId: tileId,
        );

        List<Map<String, dynamic>> dataSources = [];

        for (var dataSource in response.data.data) {
          dataSources.add(jsonDecode(jsonEncode(dataSource)));
        }

        insertTileDataSources(dataSources);
      },
      'fetch page tile data sources',
    );
  }

  Future<void> fetchCardTileDataSource(
    String pageId,
    String cardId,
    String tileId,
  ) async {
    return handleApiCall(
      () async {
        final response =
            await apiClient.getDashboardModulePageCardTileDataSources(
          pageId: pageId,
          cardId: cardId,
          tileId: tileId,
        );

        List<Map<String, dynamic>> dataSources = [];

        for (var dataSource in response.data.data) {
          dataSources.add(jsonDecode(jsonEncode(dataSource)));
        }

        insertTileDataSources(dataSources);
      },
      'fetch card tile data sources',
    );
  }
}
