// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_module_check_email.freezed.dart';
part 'auth_module_check_email.g.dart';

/// Schema for checking email availability.
@Freezed()
class AuthModuleCheckEmail with _$AuthModuleCheckEmail {
  const factory AuthModuleCheckEmail({
    /// The email address to check for availability.
    required String email,
  }) = _AuthModuleCheckEmail;
  
  factory AuthModuleCheckEmail.fromJson(Map<String, Object?> json) => _$AuthModuleCheckEmailFromJson(json);
}
