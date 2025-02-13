// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_device_channel_data_source.freezed.dart';
part 'dashboard_update_device_channel_data_source.g.dart';

/// Schema for updating a device channel data source in the dashboard.
@Freezed()
class DashboardUpdateDeviceChannelDataSource with _$DashboardUpdateDeviceChannelDataSource {
  const factory DashboardUpdateDeviceChannelDataSource({
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
  }) = _DashboardUpdateDeviceChannelDataSource;
  
  factory DashboardUpdateDeviceChannelDataSource.fromJson(Map<String, Object?> json) => _$DashboardUpdateDeviceChannelDataSourceFromJson(json);
}
