// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_refresh_token.dart';

part 'auth_req_refresh_token.freezed.dart';
part 'auth_req_refresh_token.g.dart';

/// Request schema for user access token refresh.
@Freezed()
class AuthReqRefreshToken with _$AuthReqRefreshToken {
  const factory AuthReqRefreshToken({
    required AuthRefreshToken data,
  }) = _AuthReqRefreshToken;
  
  factory AuthReqRefreshToken.fromJson(Map<String, Object?> json) => _$AuthReqRefreshTokenFromJson(json);
}
