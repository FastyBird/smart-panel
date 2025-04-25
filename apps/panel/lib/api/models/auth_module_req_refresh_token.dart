// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_module_refresh_token.dart';

part 'auth_module_req_refresh_token.freezed.dart';
part 'auth_module_req_refresh_token.g.dart';

/// Request schema for user access token refresh.
@Freezed()
class AuthModuleReqRefreshToken with _$AuthModuleReqRefreshToken {
  const factory AuthModuleReqRefreshToken({
    required AuthModuleRefreshToken data,
  }) = _AuthModuleReqRefreshToken;
  
  factory AuthModuleReqRefreshToken.fromJson(Map<String, Object?> json) => _$AuthModuleReqRefreshTokenFromJson(json);
}
