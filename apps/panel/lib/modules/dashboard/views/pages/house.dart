import 'package:fastybird_smart_panel/modules/dashboard/models/pages/house_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class HousePageView extends DashboardPageView {
  final HouseViewMode _viewMode;
  final bool _showWeather;

  HousePageView({
    required super.id,
    required super.type,
    required super.title,
    super.icon,
    super.order,
    super.showTopBar,
    super.displays,
    super.tiles,
    super.cards,
    super.dataSources,
    HouseViewMode viewMode = HouseViewMode.simple,
    bool showWeather = true,
  })  : _viewMode = viewMode,
        _showWeather = showWeather;

  HouseViewMode get viewMode => _viewMode;

  bool get showWeather => _showWeather;
}
