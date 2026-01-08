import 'package:fastybird_smart_panel/modules/dashboard/models/pages/generic_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

/// Generic page view for unknown/unregistered page types.
class GenericPageView extends DashboardPageView {
  GenericPageView({
    required GenericPageModel model,
    super.tiles,
    super.cards,
    super.dataSources,
  }) : super(model: model);

  GenericPageModel get _typedModel => model as GenericPageModel;

  Map<String, dynamic> get configuration => _typedModel.configuration;
}
