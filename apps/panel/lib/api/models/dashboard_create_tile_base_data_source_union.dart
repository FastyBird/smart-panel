// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_create_tile_base_data_source_union.freezed.dart';
part 'dashboard_create_tile_base_data_source_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardCreateTileBaseDataSourceUnion with _$DashboardCreateTileBaseDataSourceUnion {
  @FreezedUnionValue('device-channel')
  const factory DashboardCreateTileBaseDataSourceUnion.deviceChannel({
    /// Unique identifier for the data source (optional during creation).
    required String id,

    /// The unique identifier of the associated device.
    required String device,

    /// The unique identifier of the associated channel within the device.
    required String channel,

    /// The unique identifier of the associated property within the channel.
    required String property,

    /// The icon representing the data source.
    String? icon,

    /// Specifies the type of data source as linked to a device channel.
    @Default('device-channel')
    String type,
  }) = DashboardCreateTileBaseDataSourceUnionDeviceChannel;

  
  factory DashboardCreateTileBaseDataSourceUnion.fromJson(Map<String, Object?> json) => _$DashboardCreateTileBaseDataSourceUnionFromJson(json);
}
