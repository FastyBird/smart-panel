// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_tile_base_data_source_union.freezed.dart';
part 'dashboard_tile_base_data_source_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardTileBaseDataSourceUnion with _$DashboardTileBaseDataSourceUnion {
  @FreezedUnionValue('device-channel')
  const factory DashboardTileBaseDataSourceUnion.deviceChannel({
    /// A unique identifier for the data source.
    required String id,

    /// Discriminator for the data source type
    required String type,

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

    /// The unique identifier of the associated tile.
    required String tile,
  }) = DashboardTileBaseDataSourceUnionDeviceChannel;

  
  factory DashboardTileBaseDataSourceUnion.fromJson(Map<String, Object?> json) => _$DashboardTileBaseDataSourceUnionFromJson(json);
}
