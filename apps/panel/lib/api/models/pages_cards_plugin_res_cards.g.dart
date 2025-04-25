// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pages_cards_plugin_res_cards.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PagesCardsPluginResCardsImpl _$$PagesCardsPluginResCardsImplFromJson(
        Map<String, dynamic> json) =>
    _$PagesCardsPluginResCardsImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: PagesCardsPluginResCardsMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => PagesCardsPluginCard.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$PagesCardsPluginResCardsImplToJson(
        _$PagesCardsPluginResCardsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$PagesCardsPluginResCardsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$PagesCardsPluginResCardsMethodEnumMap = {
  PagesCardsPluginResCardsMethod.valueGet: 'GET',
  PagesCardsPluginResCardsMethod.post: 'POST',
  PagesCardsPluginResCardsMethod.patch: 'PATCH',
  PagesCardsPluginResCardsMethod.delete: 'DELETE',
  PagesCardsPluginResCardsMethod.$unknown: r'$unknown',
};
