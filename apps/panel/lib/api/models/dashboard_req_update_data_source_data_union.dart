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
    /// Specifies the type of data source.
    required String type,

    /// The unique identifier of the associated device.
    required String device,

    /// The unique identifier of the associated channel within the device.
    required String channel,

    /// The unique identifier of the associated property within the channel.
    required String property,

    /// The icon representing the data source.
    String? icon,
  }) = DashboardReqUpdateDataSourceDataUnionDeviceChannel;

  
  factory DashboardReqUpdateDataSourceDataUnion.fromJson(Map<String, Object?> json) => _$DashboardReqUpdateDataSourceDataUnionFromJson(json);
}
