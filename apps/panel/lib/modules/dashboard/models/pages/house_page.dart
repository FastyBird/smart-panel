import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

enum HouseViewMode {
  simple('simple'),
  detailed('detailed');

  final String value;

  const HouseViewMode(this.value);

  static HouseViewMode fromValue(String? value) {
    return HouseViewMode.values.firstWhere(
      (e) => e.value == value,
      orElse: () => HouseViewMode.simple,
    );
  }
}

class HousePageModel extends PageModel {
  final HouseViewMode _viewMode;
  final bool _showWeather;

  HousePageModel({
    HouseViewMode viewMode = HouseViewMode.simple,
    bool showWeather = true,
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.showTopBar,
    super.displays,
    super.createdAt,
    super.updatedAt,
  })  : _viewMode = viewMode,
        _showWeather = showWeather,
        super(
          type: PageType.house,
        );

  HouseViewMode get viewMode => _viewMode;

  bool get showWeather => _showWeather;

  factory HousePageModel.fromJson(Map<String, dynamic> json) {
    return HousePageModel(
      viewMode: HouseViewMode.fromValue(json['view_mode']),
      showWeather: json['show_weather'] ?? true,
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
