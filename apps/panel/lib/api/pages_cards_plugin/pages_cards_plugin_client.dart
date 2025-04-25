// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/pages_cards_plugin_req_create_card.dart';
import '../models/pages_cards_plugin_req_update_card.dart';
import '../models/pages_cards_plugin_res_card.dart';
import '../models/pages_cards_plugin_res_cards.dart';

part 'pages_cards_plugin_client.g.dart';

@RestApi()
abstract class PagesCardsPluginClient {
  factory PagesCardsPluginClient(Dio dio, {String? baseUrl}) = _PagesCardsPluginClient;

  /// Retrieve a list of all available page cards.
  ///
  /// Fetches a list of cards associated with a specific page. Cards represent widgets that can be used for displaying data, such as device state, actual clock.
  ///
  /// [page] - Filter cards by the page resource ID.
  @GET('/pages-cards-plugin/cards')
  Future<HttpResponse<PagesCardsPluginResCards>> getPagesCardsPluginPageCards({
    @Query('page') String? page,
  });

  /// Create a new card for a page.
  ///
  /// Creates a new card associated with a specific page. Cards represent widgets that can display device state or actual clock.
  @POST('/pages-cards-plugin/cards')
  Future<HttpResponse<PagesCardsPluginResCard>> createPagesCardsPluginPageCard({
    @Body() PagesCardsPluginReqCreateCard? body,
  });

  /// Retrieve details of a specific card for a page.
  ///
  /// Fetches detailed information about a specific card associated with a page using its unique ID. The response includes metadata such as the card’s position, ID, associated page, and tiles.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/pages-cards-plugin/cards/{id}')
  Future<HttpResponse<PagesCardsPluginResCard>> getPagesCardsPluginPageCard({
    @Path('id') required String id,
  });

  /// Update an existing card for a page.
  ///
  /// Partially updates the attributes of a specific card associated with a page using its unique ID. The update can modify metadata, such as the card’s position or title, without requiring the full object.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/pages-cards-plugin/cards/{id}')
  Future<HttpResponse<PagesCardsPluginResCard>> updatePagesCardsPluginPageCard({
    @Path('id') required String id,
    @Body() PagesCardsPluginReqUpdateCard? body,
  });

  /// Delete a specific card for a page.
  ///
  /// Deletes a specific card associated with a page using its unique ID. This action is irreversible and will remove the card and its associated data from the system.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/pages-cards-plugin/cards/{id}')
  Future<HttpResponse<void>> deletePagesCardsPluginPageCard({
    @Path('id') required String id,
  });
}
