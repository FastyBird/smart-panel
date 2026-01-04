import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/cards.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/pages.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/tiles.dart';
import 'package:flutter/foundation.dart';

class DataSourcesRepository extends Repository<DataSourceModel> {
  DataSourcesRepository({required super.apiClient});

  void insert(List<Map<String, dynamic>> json) {
    final PagesRepository pagesRepository = locator<PagesRepository>();
    final CardsRepository cardsRepository = locator<CardsRepository>();
    final TilesRepository tilesRepository = locator<TilesRepository>();

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

      final String dataSourceType = row['type'];

      try {
        DataSourceModel dataSource = buildDataSourceModel(dataSourceType, row);

        if (dataSource.parentType == 'page' &&
            pagesRepository.getItem(dataSource.parentId) == null) {
          continue;
        }

        if (dataSource.parentType == 'card' &&
            cardsRepository.getItem(dataSource.parentId) == null) {
          continue;
        }

        if (dataSource.parentType == 'tile' &&
            tilesRepository.getItem(dataSource.parentId) == null) {
          continue;
        }

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

  Future<void> fetchOne(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModuleDataSource(id: id);

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insert([raw]);
      },
      'fetch data source',
    );
  }

  Future<void> fetchAll(
    String parentType,
    String parentId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModuleDataSources(
          parentType: parentType,
          parentId: parentId,
        );

        final raw = response.response.data['data'] as List;

        insert(raw.cast<Map<String, dynamic>>());
      },
      'fetch $parentType data sources',
    );
  }
}
