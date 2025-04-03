// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_update_device_detail_page.freezed.dart';
part 'dashboard_update_device_detail_page.g.dart';

/// Schema for updating a device page in the dashboard.
@Freezed()
class DashboardUpdateDeviceDetailPage with _$DashboardUpdateDeviceDetailPage {
  const factory DashboardUpdateDeviceDetailPage({
    /// Discriminator for the page type
    required String type,

    /// The title of the page.
    required String title,

    /// The display order of the page.
    required int order,

    /// The unique identifier of the associated device.
    required String device,

    /// The icon associated with the page.
    String? icon,
  }) = _DashboardUpdateDeviceDetailPage;
  
  factory DashboardUpdateDeviceDetailPage.fromJson(Map<String, Object?> json) => _$DashboardUpdateDeviceDetailPageFromJson(json);
}
