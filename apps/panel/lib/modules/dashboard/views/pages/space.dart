import 'package:fastybird_smart_panel/modules/dashboard/models/pages/space_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

class SpacePageView extends DashboardPageView<SpacePageModel> {
  SpacePageView({
    required super.pageModel,
  });

  String get spaceId => pageModel.spaceId;

  SpaceViewMode get viewMode => pageModel.viewMode;

  List<QuickActionType> get quickActions => pageModel.quickActions;
}
