// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_module_login.freezed.dart';
part 'auth_module_login.g.dart';

/// Schema for user authentication.
@Freezed()
class AuthModuleLogin with _$AuthModuleLogin {
  const factory AuthModuleLogin({
    /// The username of the user.
    required String username,

    /// The user's password.
    required String password,
  }) = _AuthModuleLogin;
  
  factory AuthModuleLogin.fromJson(Map<String, Object?> json) => _$AuthModuleLoginFromJson(json);
}
