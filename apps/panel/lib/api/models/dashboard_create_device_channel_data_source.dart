// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_create_device_channel_data_source.freezed.dart';
part 'dashboard_create_device_channel_data_source.g.dart';

/// Schema for creating a data source linked to a device channel and property.
@Freezed()
class DashboardCreateDeviceChannelDataSource with _$DashboardCreateDeviceChannelDataSource {
  const factory DashboardCreateDeviceChannelDataSource({
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
  }) = _DashboardCreateDeviceChannelDataSource;
  
  factory DashboardCreateDeviceChannelDataSource.fromJson(Map<String, Object?> json) => _$DashboardCreateDeviceChannelDataSourceFromJson(json);
}
