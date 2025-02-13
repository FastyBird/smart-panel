// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_check_email.freezed.dart';
part 'auth_check_email.g.dart';

/// Schema for checking email availability.
@Freezed()
class AuthCheckEmail with _$AuthCheckEmail {
  const factory AuthCheckEmail({
    /// The email address to check for availability.
    required String email,
  }) = _AuthCheckEmail;
  
  factory AuthCheckEmail.fromJson(Map<String, Object?> json) => _$AuthCheckEmailFromJson(json);
}
