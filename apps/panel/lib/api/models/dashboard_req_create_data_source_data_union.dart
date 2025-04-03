// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_req_create_data_source_data_union.freezed.dart';
part 'dashboard_req_create_data_source_data_union.g.dart';

@Freezed(unionKey: 'type')
sealed class DashboardReqCreateDataSourceDataUnion with _$DashboardReqCreateDataSourceDataUnion {
  @FreezedUnionValue('device-channel')
  const factory DashboardReqCreateDataSourceDataUnion.deviceChannel({
    /// Unique identifier for the data source (optional during creation).
    required String id,

    /// Discriminator for the data source type
    required String type,

    /// The unique identifier of the associated device.
    required String device,

    /// The unique identifier of the associated channel within the device.
    required String channel,

    /// The unique identifier of the associated property within the channel.
    required String property,

    /// The icon representing the data source.
    String? icon,
  }) = DashboardReqCreateDataSourceDataUnionDeviceChannel;

  
  factory DashboardReqCreateDataSourceDataUnion.fromJson(Map<String, Object?> json) => _$DashboardReqCreateDataSourceDataUnionFromJson(json);
}
