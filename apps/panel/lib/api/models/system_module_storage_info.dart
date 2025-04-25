// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_module_storage_info.freezed.dart';
part 'system_module_storage_info.g.dart';

/// Schema for a details about system storage, including file system, usage, and available space.
@Freezed()
class SystemModuleStorageInfo with _$SystemModuleStorageInfo {
  const factory SystemModuleStorageInfo({
    /// Filesystem type or mount point.
    required String fs,

    /// Used storage space in bytes.
    required int used,

    /// Total storage capacity in bytes.
    required int size,

    /// Available free storage space in bytes.
    required int available,
  }) = _SystemModuleStorageInfo;
  
  factory SystemModuleStorageInfo.fromJson(Map<String, Object?> json) => _$SystemModuleStorageInfoFromJson(json);
}
