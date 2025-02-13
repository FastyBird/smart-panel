// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_create_device_page.freezed.dart';
part 'dashboard_create_device_page.g.dart';

/// The schema for creating a device dashboard page.
@Freezed()
class DashboardCreateDevicePage with _$DashboardCreateDevicePage {
  const factory DashboardCreateDevicePage({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// The title of the dashboard page.
    required String title,

    /// The position of the page in the dashboard’s list.
    required int order,

    /// The unique identifier of the associated device.
    required String device,

    /// Indicates that this is a device-specific dashboard page.
    @Default('device')
    String type,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = _DashboardCreateDevicePage;
  
  factory DashboardCreateDevicePage.fromJson(Map<String, Object?> json) => _$DashboardCreateDevicePageFromJson(json);
}
