import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class HouseModesPageModel extends PageModel {
  final bool _confirmOnAway;
  final bool _showLastChanged;

  HouseModesPageModel({
    bool confirmOnAway = true,
    bool showLastChanged = true,
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.showTopBar,
    super.displays,
    super.createdAt,
    super.updatedAt,
  })  : _confirmOnAway = confirmOnAway,
        _showLastChanged = showLastChanged,
        super(
          type: PageType.houseModes,
        );

  bool get confirmOnAway => _confirmOnAway;

  bool get showLastChanged => _showLastChanged;

  factory HouseModesPageModel.fromJson(Map<String, dynamic> json) {
    return HouseModesPageModel(
      confirmOnAway: json['confirm_on_away'] ?? true,
      showLastChanged: json['show_last_changed'] ?? true,
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
