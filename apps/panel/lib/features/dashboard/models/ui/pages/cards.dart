import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
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
    return CardsPageModel(
      id: UuidUtils.validateUuid(json['id']),
      title: json['title'],
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      cards: UuidUtils.validateUuidList(List<String>.from(json['cards'] ?? [])),
      dataSource: UuidUtils.validateUuidList(
          List<String>.from(json['data_source'] ?? [])),
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
