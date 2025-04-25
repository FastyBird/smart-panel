// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_module_register.dart';

part 'auth_module_req_register.freezed.dart';
part 'auth_module_req_register.g.dart';

/// Request schema for user registration.
@Freezed()
class AuthModuleReqRegister with _$AuthModuleReqRegister {
  const factory AuthModuleReqRegister({
    required AuthModuleRegister data,
  }) = _AuthModuleReqRegister;
  
  factory AuthModuleReqRegister.fromJson(Map<String, Object?> json) => _$AuthModuleReqRegisterFromJson(json);
}
