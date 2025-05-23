import 'package:fastybird_smart_panel/modules/dashboard/models/cards/card.dart';

class CardView {
  final CardModel _cardModel;

  CardView({
    required CardModel cardModel,
  }) : _cardModel = cardModel;

  String get id => _cardModel.id;

  CardModel get cardModel => _cardModel;
}
