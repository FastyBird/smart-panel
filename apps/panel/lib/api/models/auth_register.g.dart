// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_register.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthRegisterImpl _$$AuthRegisterImplFromJson(Map<String, dynamic> json) =>
    _$AuthRegisterImpl(
      username: json['username'] as String,
      password: json['password'] as String,
      email: json['email'] as String,
      firstName: json['first_name'] as String,
      lastName: json['last_name'] as String,
    );

Map<String, dynamic> _$$AuthRegisterImplToJson(_$AuthRegisterImpl instance) =>
    <String, dynamic>{
      'username': instance.username,
      'password': instance.password,
      'email': instance.email,
      'first_name': instance.firstName,
      'last_name': instance.lastName,
    };
