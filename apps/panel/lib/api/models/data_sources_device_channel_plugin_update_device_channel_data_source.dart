// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'data_sources_device_channel_plugin_update_device_channel_data_source.freezed.dart';
part 'data_sources_device_channel_plugin_update_device_channel_data_source.g.dart';

/// Schema for updating a device channel data source in the dashboard.
@Freezed()
class DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSource with _$DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSource {
  const factory DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSource({
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
  }) = _DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSource;
  
  factory DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSource.fromJson(Map<String, Object?> json) => _$DataSourcesDeviceChannelPluginUpdateDeviceChannelDataSourceFromJson(json);
}
