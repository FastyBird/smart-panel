import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/mapper.dart';
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

/// Quick action types that can be pinned to a space page.
enum QuickActionType {
  lightingOff('lighting_off'),
  lightingWork('lighting_work'),
  lightingRelax('lighting_relax'),
  lightingNight('lighting_night'),
  brightnessUp('brightness_up'),
  brightnessDown('brightness_down'),
  climateUp('climate_up'),
  climateDown('climate_down');

  final String value;

  const QuickActionType(this.value);

  static QuickActionType? fromValue(String? value) {
    if (value == null) return null;
    for (final type in QuickActionType.values) {
      if (type.value == value) return type;
    }
    return null; // Unknown value, skip it
  }

  static List<QuickActionType> fromList(List<dynamic>? list) {
    if (list == null) return [];
    return list
        .map((e) => fromValue(e?.toString()))
        .whereType<QuickActionType>()
        .toList();
  }
}

/// Default quick actions shown when none are configured.
const List<QuickActionType> defaultQuickActions = [
  QuickActionType.lightingOff,
  QuickActionType.lightingWork,
  QuickActionType.lightingRelax,
  QuickActionType.lightingNight,
];

class SpacePageModel extends PageModel {
  final String _spaceId;
  final SpaceViewMode _viewMode;
  final List<QuickActionType> _quickActions;

  SpacePageModel({
    required String spaceId,
    SpaceViewMode viewMode = SpaceViewMode.simple,
    List<QuickActionType>? quickActions,
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
        _quickActions = quickActions ?? defaultQuickActions,
        super(
          type: pagesSpaceType,
        );

  String get spaceId => _spaceId;

  SpaceViewMode get viewMode => _viewMode;

  /// Returns the configured quick actions, or defaults if none are configured.
  List<QuickActionType> get quickActions =>
      _quickActions.isEmpty ? defaultQuickActions : _quickActions;

  factory SpacePageModel.fromJson(Map<String, dynamic> json) {
    return SpacePageModel(
      spaceId: UuidUtils.validateUuid(json['space_id']),
      viewMode: SpaceViewMode.fromValue(json['view_mode']),
      quickActions: QuickActionType.fromList(json['quick_actions']),
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
