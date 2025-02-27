// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_page_device_channel_data_source.freezed.dart';
part 'dashboard_page_device_channel_data_source.g.dart';

/// A data source linked to a specific device channel and property.
@Freezed()
class DashboardPageDeviceChannelDataSource with _$DashboardPageDeviceChannelDataSource {
  const factory DashboardPageDeviceChannelDataSource({
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

    /// The unique identifier of the associated page.
    required String page,

    /// Indicates that this data source is linked to a device channel.
    @Default('device-channel')
    String type,
  }) = _DashboardPageDeviceChannelDataSource;
  
  factory DashboardPageDeviceChannelDataSource.fromJson(Map<String, Object?> json) => _$DashboardPageDeviceChannelDataSourceFromJson(json);
}
