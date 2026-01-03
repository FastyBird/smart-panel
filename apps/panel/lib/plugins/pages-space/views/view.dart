import 'package:fastybird_smart_panel/plugins/pages-space/models/model.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class SpacePageView extends DashboardPageView {
  final String _spaceId;
  final SpaceViewMode _viewMode;
  final List<QuickActionType> _quickActions;

  SpacePageView({
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
    required String spaceId,
    SpaceViewMode viewMode = SpaceViewMode.simple,
    List<QuickActionType> quickActions = const [],
  })  : _spaceId = spaceId,
        _viewMode = viewMode,
        _quickActions = quickActions;

  String get spaceId => _spaceId;

  SpaceViewMode get viewMode => _viewMode;

  List<QuickActionType> get quickActions =>
      _quickActions.isEmpty ? defaultQuickActions : _quickActions;
}
