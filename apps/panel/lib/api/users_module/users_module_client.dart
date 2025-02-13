// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/users_req_create_user.dart';
import '../models/users_req_update_user.dart';
import '../models/users_res_user.dart';
import '../models/users_res_users.dart';

part 'users_module_client.g.dart';

@RestApi()
abstract class UsersModuleClient {
  factory UsersModuleClient(Dio dio, {String? baseUrl}) = _UsersModuleClient;

  /// Retrieve a list of users.
  ///
  /// Fetch a paginated list of users, including details such as usernames, emails, and roles.
  @GET('/users-module/users')
  Future<HttpResponse<UsersResUsers>> getUsersModuleUsers();

  /// Create a new user.
  ///
  /// Register a new user by providing necessary details such as username, password, and optional profile information.
  @POST('/users-module/users')
  Future<HttpResponse<UsersResUser>> createUsersModuleUser({
    @Body() UsersReqCreateUser? body,
  });

  /// Retrieve details of a specific user.
  ///
  /// Fetch detailed information about a specific user, including their profile, role, and associated data.
  ///
  /// [id] - The ID of the resource to retrieve.
  @GET('/users-module/users/{id}')
  Future<HttpResponse<UsersResUser>> getUsersModuleUser({
    @Path('id') required String id,
  });

  /// Update an existing user.
  ///
  /// Modify user details such as email, role, or profile information. Partial updates are supported.
  ///
  /// [id] - The ID of the resource to retrieve.
  @PATCH('/users-module/users/{id}')
  Future<HttpResponse<UsersResUser>> updateUsersModuleUser({
    @Path('id') required String id,
    @Body() UsersReqUpdateUser? body,
  });

  /// Delete an existing user.
  ///
  /// Remove a user from the system. This action is irreversible.
  ///
  /// [id] - The ID of the resource to retrieve.
  @DELETE('/users-module/users/{id}')
  Future<HttpResponse<void>> deleteUsersModuleUser({
    @Path('id') required String id,
  });
}
