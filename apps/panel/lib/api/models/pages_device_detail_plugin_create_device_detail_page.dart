// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_create_data_source.dart';

part 'pages_device_detail_plugin_create_device_detail_page.freezed.dart';
part 'pages_device_detail_plugin_create_device_detail_page.g.dart';

/// The schema for creating a device dashboard page.
@Freezed()
class PagesDeviceDetailPluginCreateDeviceDetailPage with _$PagesDeviceDetailPluginCreateDeviceDetailPage {
  const factory PagesDeviceDetailPluginCreateDeviceDetailPage({
    /// The unique identifier for the dashboard page (optional during creation).
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page.
    required String title,

    /// A list of data sources used by the page, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardModuleCreateDataSource> dataSource,

    /// The unique identifier of the associated device.
    required String device,

    /// The position of the page in the dashboard’s list.
    @Default(0)
    int order,

    /// The icon associated with the dashboard page.
    String? icon,
  }) = _PagesDeviceDetailPluginCreateDeviceDetailPage;
  
  factory PagesDeviceDetailPluginCreateDeviceDetailPage.fromJson(Map<String, Object?> json) => _$PagesDeviceDetailPluginCreateDeviceDetailPageFromJson(json);
}
