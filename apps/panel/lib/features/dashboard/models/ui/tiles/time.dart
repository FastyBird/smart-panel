import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';

class TimeTileModel extends TileModel {
  TimeTileModel({
    required super.id,
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

  factory TimeTileModel.fromJson(Map<String, dynamic> json) {
    return TimeTileModel(
      id: UuidUtils.validateUuid(json['id']),
      dataSource: UuidUtils.validateUuidList(
          List<String>.from(json['data_source'] ?? [])),
      row: json['row'],
      col: json['col'],
      rowSpan: json['row_span'],
      colSpan: json['col_span'],
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }
}
