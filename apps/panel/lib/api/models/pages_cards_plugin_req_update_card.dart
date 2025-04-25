// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'pages_cards_plugin_update_card.dart';

part 'pages_cards_plugin_req_update_card.freezed.dart';
part 'pages_cards_plugin_req_update_card.g.dart';

/// Request schema for updating an existing card.
@Freezed()
class PagesCardsPluginReqUpdateCard with _$PagesCardsPluginReqUpdateCard {
  const factory PagesCardsPluginReqUpdateCard({
    required PagesCardsPluginUpdateCard data,
  }) = _PagesCardsPluginReqUpdateCard;
  
  factory PagesCardsPluginReqUpdateCard.fromJson(Map<String, Object?> json) => _$PagesCardsPluginReqUpdateCardFromJson(json);
}
