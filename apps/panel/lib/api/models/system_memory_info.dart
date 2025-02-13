// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_memory_info.freezed.dart';
part 'system_memory_info.g.dart';

/// Schema for a details about total, used, and free memory on the system.
@Freezed()
class SystemMemoryInfo with _$SystemMemoryInfo {
  const factory SystemMemoryInfo({
    /// Total available system memory in bytes.
    required int total,

    /// Used memory in bytes.
    required int used,

    /// Free memory in bytes.
    required int free,
  }) = _SystemMemoryInfo;
  
  factory SystemMemoryInfo.fromJson(Map<String, Object?> json) => _$SystemMemoryInfoFromJson(json);
}
