import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/model.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/spaces/header_widget.dart';

class SpaceModel extends Model {
  final SpacesModuleDataSpaceType _type;
  final String _name;
  final String? _description;
  final SpacesModuleDataSpaceCategory? _category;
  final String? _parentId;
  final int _displayOrder;
  final bool _suggestionsEnabled;
  final String? _icon;
  final DateTime? _lastActivityAt;
  final List<String> _children;
  final List<HeaderWidget>? _headerWidgets;

  SpaceModel({
    required super.id,
    required SpacesModuleDataSpaceType type,
    required String name,
    String? description,
    SpacesModuleDataSpaceCategory? category,
    String? parentId,
    required int displayOrder,
    required bool suggestionsEnabled,
    String? icon,
    DateTime? lastActivityAt,
    List<String> children = const [],
    List<HeaderWidget>? headerWidgets,
    super.createdAt,
    super.updatedAt,
  })  : _type = type,
        _name = name,
        _description = description,
        _category = category,
        _parentId = parentId != null ? UuidUtils.validateUuid(parentId) : null,
        _displayOrder = displayOrder,
        _suggestionsEnabled = suggestionsEnabled,
        _icon = icon,
        _lastActivityAt = lastActivityAt,
        _children = UuidUtils.validateUuidList(children),
        _headerWidgets = headerWidgets;

  SpacesModuleDataSpaceType get type => _type;

  String get name => _name;

  String? get description => _description;

  SpacesModuleDataSpaceCategory? get category => _category;

  String? get parentId => _parentId;

  int get displayOrder => _displayOrder;

  bool get suggestionsEnabled => _suggestionsEnabled;

  String? get icon => _icon;

  DateTime? get lastActivityAt => _lastActivityAt;

  List<String> get children => _children;

  List<HeaderWidget>? get headerWidgets => _headerWidgets;

  bool get isRoom => _type == SpacesModuleDataSpaceType.room;

  bool get isZone => _type == SpacesModuleDataSpaceType.zone;

  factory SpaceModel.fromJson(Map<String, dynamic> json) {
    List<String> childIds = [];

    if (json['children'] is List) {
      for (var child in json['children']) {
        if (child is String) {
          childIds.add(child);
        } else if (child is Map<String, dynamic> && child.containsKey('id')) {
          childIds.add(child['id']);
        }
      }
    }

    List<HeaderWidget>? headerWidgets;

    if (json['header_widgets'] is List && (json['header_widgets'] as List).isNotEmpty) {
      headerWidgets = (json['header_widgets'] as List)
          .whereType<Map<String, dynamic>>()
          .map(HeaderWidget.fromJson)
          .toList();
    }

    return SpaceModel(
      id: UuidUtils.validateUuid(json['id']),
      type: SpacesModuleDataSpaceType.fromJson(json['type']),
      name: json['name'],
      description: json['description'],
      category: json['category'] != null
          ? SpacesModuleDataSpaceCategory.fromJson(json['category'])
          : null,
      parentId: json['parent_id'],
      displayOrder: json['display_order'] ?? 0,
      suggestionsEnabled: json['suggestions_enabled'] ?? false,
      icon: json['icon'],
      lastActivityAt: json['last_activity_at'] != null
          ? DateTime.parse(json['last_activity_at'])
          : null,
      children: childIds,
      headerWidgets: headerWidgets,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
