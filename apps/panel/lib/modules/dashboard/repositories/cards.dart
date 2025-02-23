import 'package:fastybird_smart_panel/api/models/dashboard_card.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/card.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';

class CardsRepository extends Repository<CardModel> {
  CardsRepository({
    required super.apiClient,
  });

  void insertCards(
    String pageId,
    List<DashboardCard> apiCards,
  ) {
    for (var apiCard in apiCards) {
      data[apiCard.id] = CardModel.fromJson({
        'id': apiCard.id,
        'page': pageId,
        'title': apiCard.title,
        'icon': apiCard.icon,
        'order': apiCard.order,
        'created_at': apiCard.createdAt.toIso8601String(),
        'updated_at': apiCard.updatedAt?.toIso8601String(),
        'tiles': apiCard.tiles.map((tile) => tile.id).toList(),
        'data_source': apiCard.dataSource
            .map(
              (dataSource) => dataSource.id,
            )
            .toList(),
      });
    }
  }

  Future<void> fetchCards(
    String pageId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageCards(
          pageId: pageId,
        );

        insertCards(pageId, response.data.data);
      },
      'fetch page cards',
    );
  }
}
