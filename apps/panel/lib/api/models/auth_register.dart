// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_register.freezed.dart';
part 'auth_register.g.dart';

/// Schema for user registration.
@Freezed()
class AuthRegister with _$AuthRegister {
  const factory AuthRegister({
    /// Unique identifier for the user.
    required String username,

    /// User's password. Must be at least 6 characters long.
    required String password,

    /// Optional user's email address.
    required String email,

    /// Optional user's first name.
    @JsonKey(name: 'first_name')
    required String firstName,

    /// Optional user's last name.
    @JsonKey(name: 'last_name')
    required String lastName,
  }) = _AuthRegister;
  
  factory AuthRegister.fromJson(Map<String, Object?> json) => _$AuthRegisterFromJson(json);
}
