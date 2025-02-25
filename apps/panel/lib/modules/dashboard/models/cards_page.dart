import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:material_symbols_icons/get.dart';

class CardsPageModel extends PageModel {
  final List<String> _cards;

  final List<String> _dataSource;

  CardsPageModel({
    List<String> cards = const [],
    List<String> dataSource = const [],
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.createdAt,
    super.updatedAt,
  })  : _cards = UuidUtils.validateUuidList(cards),
        _dataSource = UuidUtils.validateUuidList(dataSource),
        super(
          type: PageType.cards,
        );

  List<String> get cards => _cards;

  List<String> get dataSource => _dataSource;

  factory CardsPageModel.fromJson(Map<String, dynamic> json) {
    List<String> cards = [];

    if (json['cards'] is List) {
      for (var card in json['cards']) {
        if (card is String) {
          cards.add(card);
        } else if (card is Map<String, dynamic> && card.containsKey('id')) {
          cards.add(card['id']);
        }
      }
    }

    List<String> dataSources = [];

    if (json['data_source'] is List) {
      for (var dataSource in json['data_source']) {
        if (dataSource is String) {
          dataSources.add(dataSource);
        } else if (dataSource is Map<String, dynamic> &&
            dataSource.containsKey('id')) {
          dataSources.add(dataSource['id']);
        }
      }
    }

    return CardsPageModel(
      id: UuidUtils.validateUuid(json['id']),
      title: json['title'],
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      cards: UuidUtils.validateUuidList(cards),
      dataSource: UuidUtils.validateUuidList(dataSources),
      order: json['order'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
