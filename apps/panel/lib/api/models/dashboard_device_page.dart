// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_device_page.freezed.dart';
part 'dashboard_device_page.g.dart';

/// A dashboard page type associated with a specific device.
@Freezed()
class DashboardDevicePage with _$DashboardDevicePage {
  const factory DashboardDevicePage({
    /// A unique identifier for the dashboard page.
    required String id,

    /// The title of the dashboard page, displayed in the UI.
    required String title,

    /// The icon representing the dashboard page.
    required String? icon,

    /// The display order of the dashboard page in the navigation or list.
    required int order,

    /// The timestamp when the dashboard page was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard page was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The unique identifier of the associated device.
    required String device,

    /// Indicates that this is a device-specific dashboard page.
    @Default('device')
    String type,
  }) = _DashboardDevicePage;
  
  factory DashboardDevicePage.fromJson(Map<String, Object?> json) => _$DashboardDevicePageFromJson(json);
}
