// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_module_token_pair.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthModuleTokenPairImpl _$$AuthModuleTokenPairImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthModuleTokenPairImpl(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
      expiration: DateTime.parse(json['expiration'] as String),
      type: json['type'] as String? ?? 'Bearer',
    );

Map<String, dynamic> _$$AuthModuleTokenPairImplToJson(
        _$AuthModuleTokenPairImpl instance) =>
    <String, dynamic>{
      'access_token': instance.accessToken,
      'refresh_token': instance.refreshToken,
      'expiration': instance.expiration.toIso8601String(),
      'type': instance.type,
    };
