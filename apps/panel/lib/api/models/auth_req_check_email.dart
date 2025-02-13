// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_check_email.dart';

part 'auth_req_check_email.freezed.dart';
part 'auth_req_check_email.g.dart';

/// Request schema for email validation.
@Freezed()
class AuthReqCheckEmail with _$AuthReqCheckEmail {
  const factory AuthReqCheckEmail({
    required AuthCheckEmail data,
  }) = _AuthReqCheckEmail;
  
  factory AuthReqCheckEmail.fromJson(Map<String, Object?> json) => _$AuthReqCheckEmailFromJson(json);
}
