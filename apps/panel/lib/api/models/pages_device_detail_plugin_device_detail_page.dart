// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'dashboard_module_data_source.dart';

part 'pages_device_detail_plugin_device_detail_page.freezed.dart';
part 'pages_device_detail_plugin_device_detail_page.g.dart';

/// A dashboard page type associated with a specific device.
@Freezed()
class PagesDeviceDetailPluginDeviceDetailPage with _$PagesDeviceDetailPluginDeviceDetailPage {
  const factory PagesDeviceDetailPluginDeviceDetailPage({
    /// A unique identifier for the dashboard page.
    required String id,

    /// Discriminator for the page type
    required String type,

    /// The title of the dashboard page, displayed in the UI.
    required String title,

    /// The icon representing the dashboard page.
    required String? icon,

    /// A list of data sources used by the page, typically for real-time updates.
    @JsonKey(name: 'data_source')
    required List<DashboardModuleDataSource> dataSource,

    /// The timestamp when the dashboard page was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the dashboard page was last updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// The unique identifier of the associated device.
    required String device,

    /// The display order of the dashboard page in the navigation or list.
    @Default(0)
    int order,
  }) = _PagesDeviceDetailPluginDeviceDetailPage;
  
  factory PagesDeviceDetailPluginDeviceDetailPage.fromJson(Map<String, Object?> json) => _$PagesDeviceDetailPluginDeviceDetailPageFromJson(json);
}
