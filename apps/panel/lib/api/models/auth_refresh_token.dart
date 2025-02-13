// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_refresh_token.freezed.dart';
part 'auth_refresh_token.g.dart';

/// Schema for refreshing user access token.
@Freezed()
class AuthRefreshToken with _$AuthRefreshToken {
  const factory AuthRefreshToken({
    /// JWT refresh access token
    required String token,
  }) = _AuthRefreshToken;
  
  factory AuthRefreshToken.fromJson(Map<String, Object?> json) => _$AuthRefreshTokenFromJson(json);
}
