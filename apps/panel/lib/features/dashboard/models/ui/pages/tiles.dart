import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

class TilesPageModel extends PageModel {
  final List<String> _tiles;

  TilesPageModel({
    required List<String> tiles,
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.createdAt,
    super.updatedAt,
  })  : _tiles = UuidUtils.validateUuidList(tiles),
        super(
          type: PageType.tiles,
        );

  List<String> get tiles => _tiles;

  factory TilesPageModel.fromJson(Map<String, dynamic> json) {
    return TilesPageModel(
      tiles: UuidUtils.validateUuidList(List<String>.from(json['tiles'] ?? [])),
      id: UuidUtils.validateUuid(json['id']),
      title: json['title'],
      icon: json['icon'] != null
          ? IconData(json['icon'], fontFamily: 'MaterialIcons')
          : null,
      order: json['order'],
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }
}
