// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_data_source_base.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardDataSourceBaseImpl _$$DashboardDataSourceBaseImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardDataSourceBaseImpl(
      id: json['id'] as String,
      type: json['type'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
    );

Map<String, dynamic> _$$DashboardDataSourceBaseImplToJson(
        _$DashboardDataSourceBaseImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'type': instance.type,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
    };
