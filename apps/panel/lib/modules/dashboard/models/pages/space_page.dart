import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

enum SpaceViewMode {
  simple('simple'),
  advanced('advanced');

  final String value;

  const SpaceViewMode(this.value);

  static SpaceViewMode fromValue(String? value) {
    return SpaceViewMode.values.firstWhere(
      (e) => e.value == value,
      orElse: () => SpaceViewMode.simple,
    );
  }
}

class SpacePageModel extends PageModel {
  final String _spaceId;
  final SpaceViewMode _viewMode;

  SpacePageModel({
    required String spaceId,
    SpaceViewMode viewMode = SpaceViewMode.simple,
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.showTopBar,
    super.displays,
    super.createdAt,
    super.updatedAt,
  })  : _spaceId = UuidUtils.validateUuid(spaceId),
        _viewMode = viewMode,
        super(
          type: PageType.space,
        );

  String get spaceId => _spaceId;

  SpaceViewMode get viewMode => _viewMode;

  factory SpacePageModel.fromJson(Map<String, dynamic> json) {
    return SpacePageModel(
      spaceId: UuidUtils.validateUuid(json['space_id']),
      viewMode: SpaceViewMode.fromValue(json['view_mode']),
      id: UuidUtils.validateUuid(json['id']),
      title: json['title'],
      icon: json['icon'] != null && json['icon'] is String
          ? MdiIcons.fromString(json['icon'])
          : null,
      order: json['order'],
      showTopBar: json['show_top_bar'],
      displays: json['displays'] != null && json['displays'] is List
          ? (json['displays'] as List).map((e) => e.toString()).toList()
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
