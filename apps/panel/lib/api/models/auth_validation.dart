// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_validation.freezed.dart';
part 'auth_validation.g.dart';

/// Schema for validation result.
@Freezed()
class AuthValidation with _$AuthValidation {
  const factory AuthValidation({
    /// Indicates whether the provided validation field is valid.
    required bool valid,
  }) = _AuthValidation;
  
  factory AuthValidation.fromJson(Map<String, Object?> json) => _$AuthValidationFromJson(json);
}
