import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';

/// Generic page model for unknown/unregistered page types.
/// Stores the raw configuration from the API for inspection.
class GenericPageModel extends PageModel {
  final Map<String, dynamic> _configuration;

  GenericPageModel({
    required super.id,
    required super.type,
    required super.title,
    super.icon,
    super.order,
    super.showTopBar,
    super.displays,
    Map<String, dynamic> configuration = const {},
    super.createdAt,
    super.updatedAt,
  }) : _configuration = configuration;

  Map<String, dynamic> get configuration => _configuration;

  factory GenericPageModel.fromJson(Map<String, dynamic> json) {
    return GenericPageModel(
      id: UuidUtils.validateUuid(json['id']),
      type: PageType.fromValue(json['type']) ?? PageType.tiles,
      title: json['title'] ?? 'Unknown',
      icon: null,
      order: json['order'] ?? 0,
      showTopBar: json['show_top_bar'] ?? true,
      displays: json['displays'] != null
          ? List<String>.from(json['displays'])
          : null,
      configuration: json['configuration'] is Map<String, dynamic>
          ? json['configuration']
          : {},
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
