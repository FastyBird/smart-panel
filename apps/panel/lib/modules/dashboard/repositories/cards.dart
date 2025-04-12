import 'package:fastybird_smart_panel/modules/dashboard/models/card.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class CardsRepository extends Repository<CardModel> {
  CardsRepository({
    required super.apiClient,
  });

  void insertCards(List<Map<String, dynamic>> json) {
    late Map<String, CardModel> insertData = {...data};

    for (var row in json) {
      try {
        CardModel card = CardModel.fromJson(row);

        insertData[card.id] = card;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][CARDS] Failed to create card model: ${e.toString()}',
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
          '[DASHBOARD MODULE][CARDS] Removed card: $id',
        );
      }

      notifyListeners();
    }
  }

  Future<void> fetchCard(
    String pageId,
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageCard(
          pageId: pageId,
          id: id,
        );

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insertCards([raw]);
      },
      'fetch page card',
    );
  }

  Future<void> fetchCards(
    String pageId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageCards(
          pageId: pageId,
        );

        final raw = response.response.data['data'] as List;

        insertCards(raw.cast<Map<String, dynamic>>());
      },
      'fetch page cards',
    );
  }
}
