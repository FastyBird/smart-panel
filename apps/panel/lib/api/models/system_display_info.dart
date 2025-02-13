// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'system_display_info.freezed.dart';
part 'system_display_info.g.dart';

/// Schema for a information about the display resolution and current screen resolution.
@Freezed()
class SystemDisplayInfo with _$SystemDisplayInfo {
  const factory SystemDisplayInfo({
    /// Native horizontal screen resolution.
    @JsonKey(name: 'resolution_x')
    required int resolutionX,

    /// Native vertical screen resolution.
    @JsonKey(name: 'resolution_y')
    required int resolutionY,

    /// Current horizontal screen resolution.
    @JsonKey(name: 'current_res_x')
    required int currentResX,

    /// Current vertical screen resolution.
    @JsonKey(name: 'current_res_y')
    required int currentResY,
  }) = _SystemDisplayInfo;
  
  factory SystemDisplayInfo.fromJson(Map<String, Object?> json) => _$SystemDisplayInfoFromJson(json);
}
