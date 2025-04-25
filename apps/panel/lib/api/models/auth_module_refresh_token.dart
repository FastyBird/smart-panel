// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_module_refresh_token.freezed.dart';
part 'auth_module_refresh_token.g.dart';

/// Schema for refreshing user access token.
@Freezed()
class AuthModuleRefreshToken with _$AuthModuleRefreshToken {
  const factory AuthModuleRefreshToken({
    /// JWT refresh access token
    required String token,
  }) = _AuthModuleRefreshToken;
  
  factory AuthModuleRefreshToken.fromJson(Map<String, Object?> json) => _$AuthModuleRefreshTokenFromJson(json);
}
