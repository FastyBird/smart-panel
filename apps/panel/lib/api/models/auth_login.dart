// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_login.freezed.dart';
part 'auth_login.g.dart';

/// Schema for user authentication.
@Freezed()
class AuthLogin with _$AuthLogin {
  const factory AuthLogin({
    /// The username of the user.
    required String username,

    /// The user's password.
    required String password,
  }) = _AuthLogin;
  
  factory AuthLogin.fromJson(Map<String, Object?> json) => _$AuthLoginFromJson(json);
}
