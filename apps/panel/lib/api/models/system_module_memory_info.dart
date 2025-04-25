// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_module_memory_info.freezed.dart';
part 'system_module_memory_info.g.dart';

/// Schema for a details about total, used, and free memory on the system.
@Freezed()
class SystemModuleMemoryInfo with _$SystemModuleMemoryInfo {
  const factory SystemModuleMemoryInfo({
    /// Total available system memory in bytes.
    required int total,

    /// Used memory in bytes.
    required int used,

    /// Free memory in bytes.
    required int free,
  }) = _SystemModuleMemoryInfo;
  
  factory SystemModuleMemoryInfo.fromJson(Map<String, Object?> json) => _$SystemModuleMemoryInfoFromJson(json);
}
