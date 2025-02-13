// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/dashboard_req_create_card_data_source.dart';
import '../models/dashboard_req_create_card_tile.dart';
import '../models/dashboard_req_create_page.dart';
import '../models/dashboard_req_create_page_card.dart';
import '../models/dashboard_req_create_page_data_source.dart';
import '../models/dashboard_req_create_page_tile.dart';
import '../models/dashboard_req_create_tile_data_source.dart';
import '../models/dashboard_req_update_card.dart';
import '../models/dashboard_req_update_data_source.dart';
import '../models/dashboard_req_update_page.dart';
import '../models/dashboard_req_update_tile.dart';
import '../models/dashboard_res_page.dart';
import '../models/dashboard_res_page_card.dart';
import '../models/dashboard_res_page_card_data_source.dart';
import '../models/dashboard_res_page_card_data_sources.dart';
import '../models/dashboard_res_page_card_tile.dart';
import '../models/dashboard_res_page_card_tile_data_source.dart';
import '../models/dashboard_res_page_card_tile_data_sources.dart';
import '../models/dashboard_res_page_card_tiles.dart';
import '../models/dashboard_res_page_cards.dart';
import '../models/dashboard_res_page_data_source.dart';
import '../models/dashboard_res_page_data_sources.dart';
import '../models/dashboard_res_page_tile.dart';
import '../models/dashboard_res_page_tile_data_source.dart';
import '../models/dashboard_res_page_tile_data_sources.dart';
import '../models/dashboard_res_page_tiles.dart';
import '../models/dashboard_res_pages.dart';

part 'dashboard_module_client.g.dart';

@RestApi()
abstract class DashboardModuleClient {
  factory DashboardModuleClient(Dio dio, {String? baseUrl}) = _DashboardModuleClient;

  /// Retrieve a list of available pages.
  ///
  /// Fetches a list of all pages currently registered in the system. Each pages includes its metadata (e.g., ID, title), along with associated tiles and data sources.
  @GET('/dashboard-module/pages')
  Future<HttpResponse<DashboardResPages>> getDashboardModulePages();

  /// Create a new page.
  ///
  /// Creates a new page resource in the system. The request requires page-specific attributes such as title. The response includes the full representation of the created page, including its associated tiles and data sources. Additionally, a Location header is provided with the URI of the newly created resource.
  @POST('/dashboard-module/pages')
  Future<HttpResponse<DashboardResPage>> createDashboardModulePage({
    @Body() DashboardReqCreatePage? body,
  });

  /// Retrieve details of a specific page.
  ///
  /// Fetches the details of a specific page using its unique ID. The response includes the page’s metadata (e.g., ID and title), associated tiles and data sources.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{id}')
  Future<HttpResponse<DashboardResPage>> getDashboardModulePage({
    @Path('id') required String id,
  });

  /// Update an existing page.
  ///
  /// Partially updates the attributes of an existing page identified by its unique ID. The update can modify metadata, such as the page’s title, without requiring the full object.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/pages/{id}')
  Future<HttpResponse<DashboardResPage>> updateDashboardModulePage({
    @Path('id') required String id,
    @Body() DashboardReqUpdatePage? body,
  });

  /// Delete an existing page.
  ///
  /// Deletes a specific page identified by its unique ID from the system. This action is irreversible and will remove the page and its associated data from the system.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/pages/{id}')
  Future<HttpResponse<void>> deleteDashboardModulePage({
    @Path('id') required String id,
  });

  /// Retrieve a list of all available data sources for a page.
  ///
  /// Fetches a list of data sources associated with a specific page. Data sources represent attributes or measurements related to the tile, such as device state, weather location, or timezone.
  ///
  /// [pageId] - The ID of the page to retrieve.
  @GET('/dashboard-module/pages/{pageId}/data-source')
  Future<HttpResponse<DashboardResPageDataSources>> getDashboardModulePageDataSources({
    @Path('pageId') required String pageId,
  });

  /// Create a new data source for a specific page.
  ///
  /// Creates a new data source for a specific page. The data source can include metadata such as associated device, timezone and weather location. The response contains the full representation of the created data source, including its unique identifier, associated tile, and metadata.
  ///
  /// [pageId] - The ID of the page to retrieve.
  @POST('/dashboard-module/pages/{pageId}/data-source')
  Future<HttpResponse<DashboardResPageDataSource>> createDashboardModulePageDataSource({
    @Path('pageId') required String pageId,
    @Body() DashboardReqCreatePageDataSource? body,
  });

  /// Retrieve details of a specific data source for a page.
  ///
  /// Fetches detailed information about a specific data source associated with a page using its unique ID. The response includes metadata such as the data source’s associated device, channel, value, and associated tile.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{pageId}/data-source/{id}')
  Future<HttpResponse<DashboardResPageDataSource>> getDashboardModulePageDataSource({
    @Path('pageId') required String pageId,
    @Path('id') required String id,
  });

  /// Update and existing data source for a specific page.
  ///
  /// Partially updates the details of a specific data source associated with a page. This operation allows modifications to attributes such as the data source’s associated device, channel, value, or metadata, while preserving its unique identifier and association with the tile.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/pages/{pageId}/data-source/{id}')
  Future<HttpResponse<DashboardResPageDataSource>> updateDashboardModulePageDataSource({
    @Path('pageId') required String pageId,
    @Path('id') required String id,
    @Body() DashboardReqUpdateDataSource? body,
  });

  /// Delete a specific data source from a page.
  ///
  /// Deletes a specific data source associated with a page using its unique ID. This operation is irreversible and removes the property from the system.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/pages/{pageId}/data-source/{id}')
  Future<HttpResponse<void>> deleteDashboardModulePageDataSource({
    @Path('pageId') required String pageId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available page tiles.
  ///
  /// Fetches a list of tiles associated with a specific page. Tiles represent widgets that can be used for displaying data, such as device state, actual clock.
  ///
  /// [pageId] - The ID of the page to retrieve.
  @GET('/dashboard-module/pages/{pageId}/tiles')
  Future<HttpResponse<DashboardResPageTiles>> getDashboardModulePageTiles({
    @Path('pageId') required String pageId,
  });

  /// Create a new tile for a page.
  ///
  /// Creates a new tile associated with a specific page. Tiles represent widgets that can display device state or actual clock.
  ///
  /// [pageId] - The ID of the page to retrieve.
  @POST('/dashboard-module/pages/{pageId}/tiles')
  Future<HttpResponse<DashboardResPageTile>> createDashboardModulePageTile({
    @Path('pageId') required String pageId,
    @Body() DashboardReqCreatePageTile? body,
  });

  /// Retrieve details of a specific tile for a page.
  ///
  /// Fetches detailed information about a specific tile associated with a page using its unique ID. The response includes metadata such as the tiles’s position, ID, associated page, and timestamps.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{pageId}/tiles/{id}')
  Future<HttpResponse<DashboardResPageTile>> getDashboardModulePageTile({
    @Path('pageId') required String pageId,
    @Path('id') required String id,
  });

  /// Update an existing tile for a page.
  ///
  /// Partially updates the attributes of a specific tile associated with a page using its unique ID. The update can modify metadata, such as the tile’s position or size, without requiring the full object.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/pages/{pageId}/tiles/{id}')
  Future<HttpResponse<DashboardResPageTile>> updateDashboardModulePageTile({
    @Path('pageId') required String pageId,
    @Path('id') required String id,
    @Body() DashboardReqUpdateTile? body,
  });

  /// Delete a specific tile for a page.
  ///
  /// Deletes a specific tile associated with a page using its unique ID. This action is irreversible and will remove the tile and its associated data from the system.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/pages/{pageId}/tiles/{id}')
  Future<HttpResponse<void>> deleteDashboardModulePageTile({
    @Path('pageId') required String pageId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available data sources for a page’s tile.
  ///
  /// Fetches a list of data sources associated with a specific tile of a page. Data sources represent attributes or measurements related to the tile, such as device state, weather location, or timezone.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  @GET('/dashboard-module/pages/{pageId}/tiles/{tileId}/data-source')
  Future<HttpResponse<DashboardResPageTileDataSources>> getDashboardModulePageTileDataSources({
    @Path('pageId') required String pageId,
    @Path('tileId') required String tileId,
  });

  /// Create a new data source for a specific page’s tile.
  ///
  /// Creates a new data source for a specific page tile. The data source can include metadata such as associated device, timezone and weather location. The response contains the full representation of the created data source, including its unique identifier, associated tile, and metadata.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  @POST('/dashboard-module/pages/{pageId}/tiles/{tileId}/data-source')
  Future<HttpResponse<DashboardResPageTileDataSource>> createDashboardModulePageTileDataSource({
    @Path('pageId') required String pageId,
    @Path('tileId') required String tileId,
    @Body() DashboardReqCreateTileDataSource? body,
  });

  /// Retrieve details of a specific data source for a page’s tile.
  ///
  /// Fetches detailed information about a specific data source associated with a page tile using its unique ID. The response includes metadata such as the data source’s associated device, channel, value, and associated tile.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{pageId}/tiles/{tileId}/data-source/{id}')
  Future<HttpResponse<DashboardResPageTileDataSource>> getDashboardModulePageTileDataSource({
    @Path('pageId') required String pageId,
    @Path('tileId') required String tileId,
    @Path('id') required String id,
  });

  /// Update and existing data source for a specific page’s tile.
  ///
  /// Partially updates the details of a specific data source associated with a page tile. This operation allows modifications to attributes such as the data source’s associated device, channel, value, or metadata, while preserving its unique identifier and association with the tile.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/pages/{pageId}/tiles/{tileId}/data-source/{id}')
  Future<HttpResponse<DashboardResPageTileDataSource>> updateDashboardModulePageTileDataSource({
    @Path('pageId') required String pageId,
    @Path('tileId') required String tileId,
    @Path('id') required String id,
    @Body() DashboardReqUpdateDataSource? body,
  });

  /// Delete a specific data source from a page’s tile.
  ///
  /// Deletes a specific data source associated with a page tile using its unique ID. This operation is irreversible and removes the property from the system.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/pages/{pageId}/tiles/{tileId}/data-source/{id}')
  Future<HttpResponse<void>> deleteDashboardModulePageTileDataSource({
    @Path('pageId') required String pageId,
    @Path('tileId') required String tileId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available page cards.
  ///
  /// Fetches a list of cards associated with a specific page. Cards represent widgets that can be used for displaying data, such as device state, actual clock.
  ///
  /// [pageId] - The ID of the page to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards')
  Future<HttpResponse<DashboardResPageCards>> getDashboardModulePageCards({
    @Path('pageId') required String pageId,
  });

  /// Create a new card for a page.
  ///
  /// Creates a new card associated with a specific page. Cards represent widgets that can display device state or actual clock.
  ///
  /// [pageId] - The ID of the page to retrieve.
  @POST('/dashboard-module/pages/{pageId}/cards')
  Future<HttpResponse<DashboardResPageCard>> createDashboardModulePageCard({
    @Path('pageId') required String pageId,
    @Body() DashboardReqCreatePageCard? body,
  });

  /// Retrieve details of a specific card for a page.
  ///
  /// Fetches detailed information about a specific card associated with a page using its unique ID. The response includes metadata such as the card’s position, ID, associated page, and tiles.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards/{id}')
  Future<HttpResponse<DashboardResPageCard>> getDashboardModulePageCard({
    @Path('pageId') required String pageId,
    @Path('id') required String id,
  });

  /// Update an existing card for a page.
  ///
  /// Partially updates the attributes of a specific card associated with a page using its unique ID. The update can modify metadata, such as the card’s position or title, without requiring the full object.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/pages/{pageId}/cards/{id}')
  Future<HttpResponse<DashboardResPageCard>> updateDashboardModulePageCard({
    @Path('pageId') required String pageId,
    @Path('id') required String id,
    @Body() DashboardReqUpdateCard? body,
  });

  /// Delete a specific card for a page.
  ///
  /// Deletes a specific card associated with a page using its unique ID. This action is irreversible and will remove the card and its associated data from the system.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/pages/{pageId}/cards/{id}')
  Future<HttpResponse<void>> deleteDashboardModulePageCard({
    @Path('pageId') required String pageId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available card tiles.
  ///
  /// Fetches a list of tiles associated with a specific card. Tiles represent widgets that can be used for displaying data, such as device state, actual clock.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles')
  Future<HttpResponse<DashboardResPageCardTiles>> getDashboardModulePageCardTiles({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
  });

  /// Create a new tile for a card.
  ///
  /// Creates a new tile associated with a specific card. Tiles represent widgets that can display device state or actual clock.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  @POST('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles')
  Future<HttpResponse<DashboardResPageCardTile>> createDashboardModulePageCardTile({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Body() DashboardReqCreateCardTile? body,
  });

  /// Retrieve details of a specific tile for a card.
  ///
  /// Fetches detailed information about a specific tile associated with a card using its unique ID. The response includes metadata such as the tiles’s position, ID, associated page, and timestamps.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles/{id}')
  Future<HttpResponse<DashboardResPageCardTile>> getDashboardModulePageCardTile({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('id') required String id,
  });

  /// Update an existing tile for a card.
  ///
  /// Partially updates the attributes of a specific tile associated with a card using its unique ID. The update can modify metadata, such as the tile’s position or size, without requiring the full object.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles/{id}')
  Future<HttpResponse<DashboardResPageCardTile>> updateDashboardModulePageCardTile({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('id') required String id,
    @Body() DashboardReqUpdateTile? body,
  });

  /// Delete a specific tile for a card.
  ///
  /// Deletes a specific tile associated with a card using its unique ID. This action is irreversible and will remove the tile and its associated data from the system.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles/{id}')
  Future<HttpResponse<void>> deleteDashboardModulePageCardTile({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available data sources for a card’s tile.
  ///
  /// Fetches a list of data sources associated with a specific tile of a card. Data sources represent attributes or measurements related to the tile, such as device state, weather location, or timezone.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source')
  Future<HttpResponse<DashboardResPageCardTileDataSources>> getDashboardModulePageCarTileDataSources({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('tileId') required String tileId,
  });

  /// Create a new data source for a specific card’s tile.
  ///
  /// Creates a new data source for a specific card tile. The data source can include metadata such as associated device, timezone and weather location. The response contains the full representation of the created data source, including its unique identifier, associated tile, and metadata.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  @POST('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source')
  Future<HttpResponse<DashboardResPageCardTileDataSource>> createDashboardModulePageCardTileDataSource({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('tileId') required String tileId,
    @Body() DashboardReqCreateTileDataSource? body,
  });

  /// Retrieve details of a specific data source for a card’s tile.
  ///
  /// Fetches detailed information about a specific data source associated with a card tile using its unique ID. The response includes metadata such as the data source’s associated device, channel, value, and associated tile.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source/{id}')
  Future<HttpResponse<DashboardResPageCardTileDataSource>> getDashboardModulePageCardTileDataSource({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('tileId') required String tileId,
    @Path('id') required String id,
  });

  /// Update and existing data source for a specific card’s tile.
  ///
  /// Partially updates the details of a specific data source associated with a card tile. This operation allows modifications to attributes such as the data source’s associated device, channel, value, or metadata, while preserving its unique identifier and association with the tile.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source/{id}')
  Future<HttpResponse<DashboardResPageCardTileDataSource>> updateDashboardModulePageCardTileDataSource({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('tileId') required String tileId,
    @Path('id') required String id,
    @Body() DashboardReqUpdateDataSource? body,
  });

  /// Delete a specific data source from a card’s tile.
  ///
  /// Deletes a specific data source associated with a card tile using its unique ID. This operation is irreversible and removes the property from the system.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [tileId] - The ID of the tile to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/pages/{pageId}/cards/{cardId}/tiles/{tileId}/data-source/{id}')
  Future<HttpResponse<void>> deleteDashboardModulePageCardTileDataSource({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('tileId') required String tileId,
    @Path('id') required String id,
  });

  /// Retrieve a list of all available data sources for a card.
  ///
  /// Fetches a list of data sources associated with a specific card. Data sources represent attributes or measurements related to the card, such as device state, weather location, or timezone.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards/{cardId}/data-source')
  Future<HttpResponse<DashboardResPageCardDataSources>> getDashboardModulePageCarDataSources({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
  });

  /// Create a new data source for a specific card.
  ///
  /// Creates a new data source for a specific card. The data source can include metadata such as associated device, timezone and weather location. The response contains the full representation of the created data source, including its unique identifier, associated tile, and metadata.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  @POST('/dashboard-module/pages/{pageId}/cards/{cardId}/data-source')
  Future<HttpResponse<DashboardResPageCardDataSource>> createDashboardModulePageCardDataSource({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Body() DashboardReqCreateCardDataSource? body,
  });

  /// Retrieve details of a specific data source for a card.
  ///
  /// Fetches detailed information about a specific data source associated with a card using its unique ID. The response includes metadata such as the data source’s associated device, channel, value, and associated tile.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards/{cardId}/data-source/{id}')
  Future<HttpResponse<DashboardResPageCardDataSource>> getDashboardModulePageCardDataSource({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('id') required String id,
  });

  /// Update and existing data source for a specific card.
  ///
  /// Partially updates the details of a specific data source associated with a card. This operation allows modifications to attributes such as the data source’s associated device, channel, value, or metadata, while preserving its unique identifier and association with the tile.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/pages/{pageId}/cards/{cardId}/data-source/{id}')
  Future<HttpResponse<DashboardResPageCardDataSource>> updateDashboardModulePageCardDataSource({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('id') required String id,
    @Body() DashboardReqUpdateDataSource? body,
  });

  /// Delete a specific data source from a card.
  ///
  /// Deletes a specific data source associated with a card using its unique ID. This operation is irreversible and removes the property from the system.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [cardId] - The ID of the card to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/pages/{pageId}/cards/{cardId}/data-source/{id}')
  Future<HttpResponse<void>> deleteDashboardModulePageCardDataSource({
    @Path('pageId') required String pageId,
    @Path('cardId') required String cardId,
    @Path('id') required String id,
  });
}
