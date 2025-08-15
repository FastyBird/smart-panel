import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/system/service.dart';
import 'package:flutter/foundation.dart';

class PagesRepository extends Repository<PageModel> {
  final SystemService _systemService = locator<SystemService>();

  PagesRepository({required super.apiClient});

  void insert(List<Map<String, dynamic>> json) {
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

        if (page.display == null ||
            page.display == _systemService.displayProfile?.id) {
          insertData[page.id] = page;
        }
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

  Future<void> fetchOne(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePage(id: id);

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insert([raw]);
      },
      'fetch page',
    );
  }

  Future<void> fetchAll() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePages();

        final raw = response.response.data['data'] as List;

        insert(raw.cast<Map<String, dynamic>>());
      },
      'fetch pages',
    );
  }
}
