// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_req_update_data_source_data_union.freezed.dart';
part 'dashboard_req_update_data_source_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardReqUpdateDataSourceDataUnion with _$DashboardReqUpdateDataSourceDataUnion {
  @FreezedUnionValue('device-channel')
  const factory DashboardReqUpdateDataSourceDataUnion.deviceChannel({
    /// The unique identifier of the associated tile.
    required String tile,

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
  }) = DashboardReqUpdateDataSourceDataUnionDeviceChannel;

  
  factory DashboardReqUpdateDataSourceDataUnion.fromJson(Map<String, Object?> json) => _$DashboardReqUpdateDataSourceDataUnionFromJson(json);
}
