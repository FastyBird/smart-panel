// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_storage_info.freezed.dart';
part 'system_storage_info.g.dart';

/// Schema for a details about system storage, including file system, usage, and available space.
@Freezed()
class SystemStorageInfo with _$SystemStorageInfo {
  const factory SystemStorageInfo({
    /// Filesystem type or mount point.
    required String fs,

    /// Used storage space in bytes.
    required int used,

    /// Total storage capacity in bytes.
    required int size,

    /// Available free storage space in bytes.
    required int available,
  }) = _SystemStorageInfo;
  
  factory SystemStorageInfo.fromJson(Map<String, Object?> json) => _$SystemStorageInfoFromJson(json);
}
