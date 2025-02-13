// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_device_page.freezed.dart';
part 'dashboard_update_device_page.g.dart';

/// Schema for updating a device page in the dashboard.
@Freezed()
class DashboardUpdateDevicePage with _$DashboardUpdateDevicePage {
  const factory DashboardUpdateDevicePage({
    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The unique identifier of the associated device.
    required String device,

    /// Indicates that this is a tiles dashboard page.
    @Default('device')
    String type,

    /// The icon associated with the page.
    String? icon,
  }) = _DashboardUpdateDevicePage;
  
  factory DashboardUpdateDevicePage.fromJson(Map<String, Object?> json) => _$DashboardUpdateDevicePageFromJson(json);
}
