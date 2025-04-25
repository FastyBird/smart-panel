// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_module_token_pair.freezed.dart';
part 'auth_module_token_pair.g.dart';

/// Schema for access and refresh tokens for an authenticated session.
@Freezed()
class AuthModuleTokenPair with _$AuthModuleTokenPair {
  const factory AuthModuleTokenPair({
    /// The JWT access token for authenticated sessions.
    @JsonKey(name: 'access_token')
    required String accessToken,

    /// The JWT refresh token for authenticated sessions.
    @JsonKey(name: 'refresh_token')
    required String refreshToken,

    /// The JWT access token expiration date.
    required DateTime expiration,

    /// Token type
    @Default('Bearer')
    String type,
  }) = _AuthModuleTokenPair;
  
  factory AuthModuleTokenPair.fromJson(Map<String, Object?> json) => _$AuthModuleTokenPairFromJson(json);
}
