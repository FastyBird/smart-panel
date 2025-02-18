import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';

abstract class TimeTileModel extends TileModel {
  TimeTileModel({
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  }) : super(
          type: TileType.clock,
        );
}

class PageTimeTileModel extends TimeTileModel {
  PageTimeTileModel({
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  });

  factory PageTimeTileModel.fromJson(Map<String, dynamic> json) {
    return PageTimeTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      dataSource: UuidUtils.validateUuidList(
        List<String>.from(json['data_source'] ?? []),
      ),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

class CardTimeTileModel extends TimeTileModel {
  CardTimeTileModel({
    required super.id,
    required super.parent,
    super.dataSource,
    required super.row,
    required super.col,
    super.rowSpan,
    super.colSpan,
    super.createdAt,
    super.updatedAt,
  });

  factory CardTimeTileModel.fromJson(Map<String, dynamic> json) {
    return CardTimeTileModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      dataSource: UuidUtils.validateUuidList(
        List<String>.from(json['data_source'] ?? []),
      ),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
