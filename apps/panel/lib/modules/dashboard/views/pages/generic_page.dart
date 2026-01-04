import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';

/// Generic page view for unknown/unregistered page types.
class GenericPageView extends DashboardPageView {
  final Map<String, dynamic> _configuration;

  GenericPageView({
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
    Map<String, dynamic> configuration = const {},
  }) : _configuration = configuration;

  Map<String, dynamic> get configuration => _configuration;
}
