// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_res_page_card_tile_data_source_data_union.freezed.dart';
part 'dashboard_res_page_card_tile_data_source_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardResPageCardTileDataSourceDataUnion with _$DashboardResPageCardTileDataSourceDataUnion {
  @FreezedUnionValue('device-channel')
  const factory DashboardResPageCardTileDataSourceDataUnion.deviceChannel({
    /// A unique identifier for the data source.
    required String id,

    /// The timestamp when the data source was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the data source was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The unique identifier of the associated device.
    required String device,

    /// The unique identifier of the associated channel.
    required String channel,

    /// The unique identifier of the associated channel property.
    required String property,

    /// The icon representing the data source.
    required String? icon,

    /// Indicates that this data source is linked to a device channel.
    @Default('device-channel')
    String type,
  }) = DashboardDeviceChannelDataSource;

  
  factory DashboardResPageCardTileDataSourceDataUnion.fromJson(Map<String, Object?> json) => _$DashboardResPageCardTileDataSourceDataUnionFromJson(json);
}
