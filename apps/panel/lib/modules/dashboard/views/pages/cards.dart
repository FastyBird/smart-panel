import 'package:fastybird_smart_panel/modules/dashboard/models/pages/cards_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class CardsPageView extends DashboardPageView<CardsPageModel> {
  final List<CardView> _cards;

  final List<DataSourceView> _dataSources;

  CardsPageView({
    required List<CardView> cards,
    required List<DataSourceView> dataSources,
    required super.pageModel,
  })  : _cards = cards,
        _dataSources = dataSources;

  List<CardView> get cards => _cards;

  List<DataSourceView> get dataSources => _dataSources;
}
