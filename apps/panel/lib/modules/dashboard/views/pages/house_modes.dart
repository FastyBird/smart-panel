import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class HouseModesPageView extends DashboardPageView {
  final bool _confirmOnAway;
  final bool _showLastChanged;

  HouseModesPageView({
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
    bool confirmOnAway = false,
    bool showLastChanged = true,
  })  : _confirmOnAway = confirmOnAway,
        _showLastChanged = showLastChanged;

  bool get confirmOnAway => _confirmOnAway;

  bool get showLastChanged => _showLastChanged;
}
