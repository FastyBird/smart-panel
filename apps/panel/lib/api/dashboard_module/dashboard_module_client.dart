// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/dashboard_module_req_create_data_source.dart';
import '../models/dashboard_module_req_create_page.dart';
import '../models/dashboard_module_req_create_tile_with_parent.dart';
import '../models/dashboard_module_req_update_data_source.dart';
import '../models/dashboard_module_req_update_page.dart';
import '../models/dashboard_module_req_update_tile.dart';
import '../models/dashboard_module_res_data_source.dart';
import '../models/dashboard_module_res_data_sources.dart';
import '../models/dashboard_module_res_page.dart';
import '../models/dashboard_module_res_pages.dart';
import '../models/dashboard_module_res_tile.dart';
import '../models/dashboard_module_res_tiles.dart';

part 'dashboard_module_client.g.dart';

@RestApi()
abstract class DashboardModuleClient {
  factory DashboardModuleClient(Dio dio, {String? baseUrl}) = _DashboardModuleClient;

  /// Retrieve a list of available pages.
  ///
  /// Fetches a list of all pages currently registered in the system. Each pages includes its metadata (e.g., ID, title), along with associated tiles and data sources.
  @GET('/dashboard-module/pages')
  Future<HttpResponse<DashboardModuleResPages>> getDashboardModulePages();

  /// Create a new page.
  ///
  /// Creates a new page resource in the system. The request requires page-specific attributes such as title. The response includes the full representation of the created page, including its associated tiles and data sources. Additionally, a Location header is provided with the URI of the newly created resource.
  @POST('/dashboard-module/pages')
  Future<HttpResponse<DashboardModuleResPage>> createDashboardModulePage({
    @Body() DashboardModuleReqCreatePage? body,
  });

  /// Retrieve details of a specific page.
  ///
  /// Fetches the details of a specific page using its unique ID. The response includes the page’s metadata (e.g., ID and title), associated tiles and data sources.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/pages/{id}')
  Future<HttpResponse<DashboardModuleResPage>> getDashboardModulePage({
    @Path('id') required String id,
  });

  /// Update an existing page.
  ///
  /// Partially updates the attributes of an existing page identified by its unique ID. The update can modify metadata, such as the page’s title, without requiring the full object.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/pages/{id}')
  Future<HttpResponse<DashboardModuleResPage>> updateDashboardModulePage({
    @Path('id') required String id,
    @Body() DashboardModuleReqUpdatePage? body,
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
  ///
  /// [parentType] - Filter tiles by the parent resource type (e.g., 'page', 'card').
  ///
  /// [parentId] - Filter tiles by the parent resource ID.
  @GET('/dashboard-module/tiles')
  Future<HttpResponse<DashboardModuleResTiles>> getDashboardModuleTiles({
    @Query('parent_type') String? parentType,
    @Query('parent_id') String? parentId,
  });

  /// Create a new tile.
  ///
  /// Creates a new tile. Tiles represent widgets that can display device state or actual clock.
  @POST('/dashboard-module/tiles')
  Future<HttpResponse<DashboardModuleResTile>> createDashboardModuleTile({
    @Body() DashboardModuleReqCreateTileWithParent? body,
  });

  /// Retrieve details of a specific tile.
  ///
  /// Fetches detailed information about a specific tile using its unique ID. The response includes metadata such as the tiles’s position, ID, associated page, and timestamps.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/tiles/{id}')
  Future<HttpResponse<DashboardModuleResTile>> getDashboardModuleTile({
    @Path('id') required String id,
  });

  /// Update an existing tile.
  ///
  /// Partially updates the attributes of a specific tile using its unique ID. The update can modify metadata, such as the tile’s position or size, without requiring the full object.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/tiles/{id}')
  Future<HttpResponse<DashboardModuleResTile>> updateDashboardModuleTile({
    @Path('id') required String id,
    @Body() DashboardModuleReqUpdateTile? body,
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
  ///
  /// [parentType] - Filter data sources by the parent resource type (e.g., 'page', 'card').
  ///
  /// [parentId] - Filter data sources by the parent resource ID.
  @GET('/dashboard-module/data-source')
  Future<HttpResponse<DashboardModuleResDataSources>> getDashboardModuleDataSources({
    @Query('parent_type') String? parentType,
    @Query('parent_id') String? parentId,
  });

  /// Create a new data source.
  ///
  /// Creates a new data source. The data source can include metadata such as associated device, timezone and weather location. The response contains the full representation of the created data source, including its unique identifier, associated tile, and metadata.
  @POST('/dashboard-module/data-source')
  Future<HttpResponse<DashboardModuleResDataSource>> createDashboardModuleDataSource({
    @Body() DashboardModuleReqCreateDataSource? body,
  });

  /// Retrieve details of a specific data source.
  ///
  /// Fetches detailed information about a specific data source using its unique ID. The response includes metadata such as the data source’s associated device, channel, value, and associated tile.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/dashboard-module/data-source/{id}')
  Future<HttpResponse<DashboardModuleResDataSource>> getDashboardModuleDataSource({
    @Path('id') required String id,
  });

  /// Update and existing data source.
  ///
  /// Partially updates the details of a specific data source. This operation allows modifications to attributes such as the data source’s associated device, channel, value, or metadata, while preserving its unique identifier and association with the tile.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/dashboard-module/data-source/{id}')
  Future<HttpResponse<DashboardModuleResDataSource>> updateDashboardModuleDataSource({
    @Path('id') required String id,
    @Body() DashboardModuleReqUpdateDataSource? body,
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
}
