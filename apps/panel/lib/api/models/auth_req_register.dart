// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_register.dart';

part 'auth_req_register.freezed.dart';
part 'auth_req_register.g.dart';

/// Request schema for user registration.
@Freezed()
class AuthReqRegister with _$AuthReqRegister {
  const factory AuthReqRegister({
    required AuthRegister data,
  }) = _AuthReqRegister;
  
  factory AuthReqRegister.fromJson(Map<String, Object?> json) => _$AuthReqRegisterFromJson(json);
}
