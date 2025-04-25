// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_module_validation.freezed.dart';
part 'auth_module_validation.g.dart';

/// Schema for validation result.
@Freezed()
class AuthModuleValidation with _$AuthModuleValidation {
  const factory AuthModuleValidation({
    /// Indicates whether the provided validation field is valid.
    required bool valid,
  }) = _AuthModuleValidation;
  
  factory AuthModuleValidation.fromJson(Map<String, Object?> json) => _$AuthModuleValidationFromJson(json);
}
