import 'package:fastybird_smart_panel/api/models/dashboard_res_pages_data_union.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/foundation.dart';

class PagesRepository extends Repository<PageModel> {
  PagesRepository({required super.apiClient});

  void insertPages(
    List<DashboardResPagesDataUnion> apiPages,
  ) {
    for (var apiPage in apiPages) {
      final PageType? pageType = PageType.fromValue(apiPage.type);

      if (pageType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][PAGES] Unknown page type: "${apiPage.type}" for page: "${apiPage.id}"',
          );
        }

        continue;
      }

      if (apiPage is DashboardResPagesDataUnionCards) {
        data[apiPage.id] = buildPageModel(pageType, {
          'id': apiPage.id,
          'type': apiPage.type,
          'title': apiPage.title,
          'icon': apiPage.icon,
          'order': apiPage.order,
          'created_at': apiPage.createdAt.toIso8601String(),
          'updated_at': apiPage.updatedAt?.toIso8601String(),
          'cards': apiPage.cards.map((card) => card.id).toList(),
          'data_source': apiPage.dataSource
              .map(
                (dataSource) => dataSource.id,
              )
              .toList(),
        });
      } else if (apiPage is DashboardResPagesDataUnionTiles) {
        data[apiPage.id] = buildPageModel(pageType, {
          'id': apiPage.id,
          'type': apiPage.type,
          'title': apiPage.title,
          'icon': apiPage.icon,
          'order': apiPage.order,
          'created_at': apiPage.createdAt.toIso8601String(),
          'updated_at': apiPage.updatedAt?.toIso8601String(),
          'tiles': apiPage.tiles.map((tile) => tile.id).toList(),
          'data_source': apiPage.dataSource
              .map(
                (dataSource) => dataSource.id,
              )
              .toList(),
        });
      } else if (apiPage is DashboardResPagesDataUnionDevice) {
        data[apiPage.id] = buildPageModel(pageType, {
          'id': apiPage.id,
          'type': apiPage.type,
          'title': apiPage.title,
          'icon': apiPage.icon,
          'order': apiPage.order,
          'created_at': apiPage.createdAt.toIso8601String(),
          'updated_at': apiPage.updatedAt?.toIso8601String(),
          'device': apiPage.device,
        });
      }
    }
  }

  Future<void> fetchPages(
    String pageId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePages();

        insertPages(response.data.data);
      },
      'fetch pages',
    );
  }
}
