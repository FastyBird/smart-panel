import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/pages_cards_plugin/pages_cards_plugin_client.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/card.dart';
import 'package:flutter/foundation.dart';

class CardsRepository extends ChangeNotifier {
  final PagesCardsPluginClient _apiClient;

  late Map<String, CardModel> data = {};

  CardsRepository({
    required PagesCardsPluginClient apiClient,
  }) : _apiClient = apiClient;

  PagesCardsPluginClient get apiClient => _apiClient;

  List<CardModel> getForParent(String parentId) {
    return data.entries
        .where((entry) => entry.value.page == parentId)
        .map((entry) => entry.value)
        .toList();
  }

  List<CardModel> getItems([List<String>? ids]) {
    if (ids != null) {
      return data.entries
          .where((entry) => ids.contains(entry.key))
          .map((entry) => entry.value)
          .toList();
    }

    return data.values.toList();
  }

  CardModel? getItem(String id) {
    if (!data.containsKey(id)) {
      return null;
    }

    return data[id];
  }

  bool replaceItem(CardModel item) {
    data[item.id] = item;

    return true;
  }

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
        final response = await apiClient.getPagesCardsPluginPageCard(
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
        final response = await apiClient.getPagesCardsPluginPageCards(
          page: pageId,
        );

        final raw = response.response.data['data'] as List;

        insertCards(raw.cast<Map<String, dynamic>>());
      },
      'fetch page cards',
    );
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
          '[DASHBOARD MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to $operation: ${e.response?.statusCode}');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DASHBOARD MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
