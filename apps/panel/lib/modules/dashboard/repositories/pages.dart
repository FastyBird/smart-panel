import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/foundation.dart';

class PagesRepository extends Repository<PageModel> {
  final DisplayRepository _displayRepository = locator<DisplayRepository>();

  PagesRepository({required super.apiClient});

  void insert(List<Map<String, dynamic>> json) {
    final currentDisplayId = _displayRepository.display?.id;
    late Map<String, PageModel> insertData = {...data};

    // First, check existing pages in data - remove any that are no longer visible
    // (This handles the case where a page's display assignment changes via socket update)
    insertData.removeWhere((pageId, page) {
      final isVisible = page.displays == null ||
          page.displays!.isEmpty ||
          (currentDisplayId != null && page.displays!.contains(currentDisplayId));
      return !isVisible;
    });

    for (var row in json) {
      if (!row.containsKey('type')) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][PAGES] Missing required attribute: "type" for page: "${row['id']}"',
          );
        }

        continue;
      }

      final String pageType = row['type'];

      try {
        PageModel page = buildPageModel(pageType, row);

        // Page is visible if:
        // 1. displays is null or empty (visible to all displays), OR
        // 2. current display ID is in the displays array
        final isVisible = page.displays == null ||
            page.displays!.isEmpty ||
            (currentDisplayId != null && page.displays!.contains(currentDisplayId));

        if (isVisible) {
          insertData[page.id] = page;
        } else {
          // Page is no longer visible - remove it if it exists
          insertData.remove(page.id);
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
