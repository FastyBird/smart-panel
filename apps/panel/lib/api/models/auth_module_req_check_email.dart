// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_module_check_email.dart';

part 'auth_module_req_check_email.freezed.dart';
part 'auth_module_req_check_email.g.dart';

/// Request schema for email validation.
@Freezed()
class AuthModuleReqCheckEmail with _$AuthModuleReqCheckEmail {
  const factory AuthModuleReqCheckEmail({
    required AuthModuleCheckEmail data,
  }) = _AuthModuleReqCheckEmail;
  
  factory AuthModuleReqCheckEmail.fromJson(Map<String, Object?> json) => _$AuthModuleReqCheckEmailFromJson(json);
}
