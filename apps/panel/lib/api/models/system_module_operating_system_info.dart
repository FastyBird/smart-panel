// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_module_operating_system_info.freezed.dart';
part 'system_module_operating_system_info.g.dart';

/// Schema for a information about the operating system, including distribution, version, and uptime.
@Freezed()
class SystemModuleOperatingSystemInfo with _$SystemModuleOperatingSystemInfo {
  const factory SystemModuleOperatingSystemInfo({
    /// Operating system platform.
    required String platform,

    /// Operating system distribution.
    required String distro,

    /// Operating system release version.
    required String release,

    /// System uptime in seconds.
    required int uptime,
  }) = _SystemModuleOperatingSystemInfo;
  
  factory SystemModuleOperatingSystemInfo.fromJson(Map<String, Object?> json) => _$SystemModuleOperatingSystemInfoFromJson(json);
}
