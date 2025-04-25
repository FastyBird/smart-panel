// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_module_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardModuleDataSourceImpl _$$DashboardModuleDataSourceImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardModuleDataSourceImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      parent: Parent2.fromJson(json['parent'] as Map<String, dynamic>),
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$$DashboardModuleDataSourceImplToJson(
        _$DashboardModuleDataSourceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'parent': instance.parent,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
    };
