// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/dashboard_req_create_card.dart';
import '../models/dashboard_req_create_data_source.dart';
import '../models/dashboard_req_create_data_source_with_parent.dart';
import '../models/dashboard_req_create_page.dart';
import '../models/dashboard_req_create_tile.dart';
import '../models/dashboard_req_create_tile_with_parent.dart';
import '../models/dashboard_req_update_card.dart';
import '../models/dashboard_req_update_data_source.dart';
import '../models/dashboard_req_update_page.dart';
import '../models/dashboard_req_update_tile.dart';
import '../models/dashboard_res_card.dart';
import '../models/dashboard_res_cards.dart';
import '../models/dashboard_res_data_source.dart';
import '../models/dashboard_res_data_sources.dart';
import '../models/dashboard_res_page.dart';
import '../models/dashboard_res_pages.dart';
import '../models/dashboard_res_tile.dart';
import '../models/dashboard_res_tiles.dart';

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

  /// Retrieve a list of all available tiles.
  ///
  /// Fetches a list of tiles. Tiles represent widgets that can be used for displaying data, such as device state, actual clock.
  @GET('/dashboard-module/tiles')
  Future<HttpResponse<DashboardResTiles>> getDashboardModuleTiles();

  /// Create a new tile.
  ///
  /// Creates a new tile. Tiles represent widgets that can display device state or actual clock.
  @POST('/dashboard-module/tiles')
  Future<HttpResponse<DashboardResTile>> createDashboardModuleTile({
    @Body() DashboardReqCreateTileWithParent? body,
  });

  /// Retrieve a list of all available tiles for given parent.
  ///
  /// Fetches a list of tiles for given parent. Tiles represent widgets that can be used for displaying data, such as device state, actual clock.
  ///
  /// [parent] - The ID of the type of the parent resource.
  ///
  /// [parentId] - The ID of the parent resource.
  @GET('/dashboard-module/{parent}/{parentId}/tiles')
  Future<HttpResponse<DashboardResTiles>> getDashboardModuleParentTiles({
    @Path('parent') required String parent,
    @Path('parentId') required String parentId,
  });

  /// Create a new tile for given parent.
  ///
  /// Creates a new tile for given parent. Tiles represent widgets that can display device state or actual clock.
  ///
  /// [parent] - The ID of the type of the parent resource.
  ///
  /// [parentId] - The ID of the parent resource.
  @POST('/dashboard-module/{parent}/{parentId}/tiles')
  Future<HttpResponse<DashboardResTile>> createDashboardModuleParentTile({
    @Path('parent') required String parent,
    @Path('parentId') required String parentId,
    @Body() DashboardReqCreateTile? body,
  });

  /// Retrieve details of a specific tile.
  ///
  /// Fetches detailed information about a specific tile using its unique ID. The response includes metadata such as the tiles’s position, ID, associated page, and timestamps.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/tiles/{id}')
  Future<HttpResponse<DashboardResTile>> getDashboardModuleTile({
    @Path('id') required String id,
  });

  /// Update an existing tile.
  ///
  /// Partially updates the attributes of a specific tile using its unique ID. The update can modify metadata, such as the tile’s position or size, without requiring the full object.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/tiles/{id}')
  Future<HttpResponse<DashboardResTile>> updateDashboardModuleTile({
    @Path('id') required String id,
    @Body() DashboardReqUpdateTile? body,
  });

  /// Delete a specific tile.
  ///
  /// Deletes a specific tile using its unique ID. This action is irreversible and will remove the tile and its associated data from the system.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/tiles/{id}')
  Future<HttpResponse<void>> deleteDashboardModuleTile({
    @Path('id') required String id,
  });

  /// Retrieve a list of all available data sources.
  ///
  /// Fetches a list of data sources. Data sources represent attributes or measurements related to the tile, such as device state, weather location, or timezone.
  @GET('/dashboard-module/data-source')
  Future<HttpResponse<DashboardResDataSources>> getDashboardModuleDataSources();

  /// Create a new data source.
  ///
  /// Creates a new data source. The data source can include metadata such as associated device, timezone and weather location. The response contains the full representation of the created data source, including its unique identifier, associated tile, and metadata.
  @POST('/dashboard-module/data-source')
  Future<HttpResponse<DashboardResDataSource>> createDashboardModuleDataSource({
    @Body() DashboardReqCreateDataSource? body,
  });

  /// Retrieve a list of all available data sources for given parent.
  ///
  /// Fetches a list of data sources for given parent. Data sources represent attributes or measurements related to the tile, such as device state, weather location, or timezone.
  ///
  /// [parent] - The ID of the type of the parent resource.
  ///
  /// [parentId] - The ID of the parent resource.
  @GET('/dashboard-module/{parent}/{parentId}/data-source')
  Future<HttpResponse<DashboardResDataSources>> getDashboardModuleParentDataSources({
    @Path('parent') required String parent,
    @Path('parentId') required String parentId,
  });

  /// Create a new data source for given parent.
  ///
  /// Creates a new data source. The data source can include metadata such as associated device, timezone and weather location. The response contains the full representation of the created data source, including its unique identifier, associated tile, and metadata.
  ///
  /// [parent] - The ID of the type of the parent resource.
  ///
  /// [parentId] - The ID of the parent resource.
  @POST('/dashboard-module/{parent}/{parentId}/data-source')
  Future<HttpResponse<DashboardResDataSource>> createDashboardModuleParentDataSource({
    @Path('parent') required String parent,
    @Path('parentId') required String parentId,
    @Body() DashboardReqCreateDataSourceWithParent? body,
  });

  /// Retrieve details of a specific data source.
  ///
  /// Fetches detailed information about a specific data source using its unique ID. The response includes metadata such as the data source’s associated device, channel, value, and associated tile.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/data-source/{id}')
  Future<HttpResponse<DashboardResDataSource>> getDashboardModuleDataSource({
    @Path('id') required String id,
  });

  /// Update and existing data source.
  ///
  /// Partially updates the details of a specific data source. This operation allows modifications to attributes such as the data source’s associated device, channel, value, or metadata, while preserving its unique identifier and association with the tile.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/data-source/{id}')
  Future<HttpResponse<DashboardResDataSource>> updateDashboardModuleDataSource({
    @Path('id') required String id,
    @Body() DashboardReqUpdateDataSource? body,
  });

  /// Delete a specific data source.
  ///
  /// Deletes a specific data source using its unique ID. This operation is irreversible and removes the property from the system.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/dashboard-module/data-source/{id}')
  Future<HttpResponse<void>> deleteDashboardModuleDataSource({
    @Path('id') required String id,
  });

  /// Retrieve a list of all available page cards.
  ///
  /// Fetches a list of cards associated with a specific page. Cards represent widgets that can be used for displaying data, such as device state, actual clock.
  ///
  /// [pageId] - The ID of the page to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards')
  Future<HttpResponse<DashboardResCards>> getDashboardModulePageCards({
    @Path('pageId') required String pageId,
  });

  /// Create a new card for a page.
  ///
  /// Creates a new card associated with a specific page. Cards represent widgets that can display device state or actual clock.
  ///
  /// [pageId] - The ID of the page to retrieve.
  @POST('/dashboard-module/pages/{pageId}/cards')
  Future<HttpResponse<DashboardResCard>> createDashboardModulePageCard({
    @Path('pageId') required String pageId,
    @Body() DashboardReqCreateCard? body,
  });

  /// Retrieve details of a specific card for a page.
  ///
  /// Fetches detailed information about a specific card associated with a page using its unique ID. The response includes metadata such as the card’s position, ID, associated page, and tiles.
  ///
  /// [pageId] - The ID of the page to retrieve.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{pageId}/cards/{id}')
  Future<HttpResponse<DashboardResCard>> getDashboardModulePageCard({
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
  Future<HttpResponse<DashboardResCard>> updateDashboardModulePageCard({
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
}
