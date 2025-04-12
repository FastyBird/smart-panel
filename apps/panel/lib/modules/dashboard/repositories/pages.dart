import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/foundation.dart';

class PagesRepository extends Repository<PageModel> {
  PagesRepository({required super.apiClient});

  void insertPages(List<Map<String, dynamic>> json) {
    late Map<String, PageModel> insertData = {...data};

    for (var row in json) {
      if (!row.containsKey('type')) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][PAGES] Missing required attribute: "type" for page: "${row['id']}"',
          );
        }

        continue;
      }

      final PageType? pageType = PageType.fromValue(row['type']);

      if (pageType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][PAGES] Unknown page type: "${row['type']}" for page: "${row['id']}"',
          );
        }

        continue;
      }

      try {
        PageModel page = buildPageModel(pageType, row);

        insertData[page.id] = page;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][PAGES] Failed to create page model: ${e.toString()}',
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
          '[DASHBOARD MODULE][PAGES] Removed page: $id',
        );
      }

      notifyListeners();
    }
  }

  Future<void> fetchPage(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePage(id: id);

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insertPages([raw]);
      },
      'fetch page',
    );
  }

  Future<void> fetchPages() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePages();

        final raw = response.response.data['data'] as List;

        insertPages(raw.cast<Map<String, dynamic>>());
      },
      'fetch pages',
    );
  }
}
