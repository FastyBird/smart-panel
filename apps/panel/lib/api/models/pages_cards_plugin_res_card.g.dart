// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pages_cards_plugin_res_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PagesCardsPluginResCardImpl _$$PagesCardsPluginResCardImplFromJson(
        Map<String, dynamic> json) =>
    _$PagesCardsPluginResCardImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: PagesCardsPluginResCardMethod.fromJson(json['method'] as String),
      data: PagesCardsPluginCard.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$PagesCardsPluginResCardImplToJson(
        _$PagesCardsPluginResCardImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$PagesCardsPluginResCardMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$PagesCardsPluginResCardMethodEnumMap = {
  PagesCardsPluginResCardMethod.valueGet: 'GET',
  PagesCardsPluginResCardMethod.post: 'POST',
  PagesCardsPluginResCardMethod.patch: 'PATCH',
  PagesCardsPluginResCardMethod.delete: 'DELETE',
  PagesCardsPluginResCardMethod.$unknown: r'$unknown',
};
