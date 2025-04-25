// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'users_module_create_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

UsersModuleCreateUser _$UsersModuleCreateUserFromJson(
    Map<String, dynamic> json) {
  return _UsersModuleCreateUser.fromJson(json);
}

/// @nodoc
mixin _$UsersModuleCreateUser {
  /// Unique identifier for the user.
  String get id => throw _privateConstructorUsedError;

  /// Unique username for the new user.
  String get username => throw _privateConstructorUsedError;

  /// Password for the new user. Must be at least 6 characters long.
  String get password => throw _privateConstructorUsedError;

  /// Role of the user. Defaults to 'user' if not provided.
  UsersModuleCreateUserRole get role => throw _privateConstructorUsedError;

  /// Optional email address for the user.
  String? get email => throw _privateConstructorUsedError;

  /// Optional first name of the user.
  @JsonKey(name: 'first_name')
  String? get firstName => throw _privateConstructorUsedError;

  /// Optional last name of the user.
  @JsonKey(name: 'last_name')
  String? get lastName => throw _privateConstructorUsedError;

  /// Serializes this UsersModuleCreateUser to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UsersModuleCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UsersModuleCreateUserCopyWith<UsersModuleCreateUser> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UsersModuleCreateUserCopyWith<$Res> {
  factory $UsersModuleCreateUserCopyWith(UsersModuleCreateUser value,
          $Res Function(UsersModuleCreateUser) then) =
      _$UsersModuleCreateUserCopyWithImpl<$Res, UsersModuleCreateUser>;
  @useResult
  $Res call(
      {String id,
      String username,
      String password,
      UsersModuleCreateUserRole role,
      String? email,
      @JsonKey(name: 'first_name') String? firstName,
      @JsonKey(name: 'last_name') String? lastName});
}

/// @nodoc
class _$UsersModuleCreateUserCopyWithImpl<$Res,
        $Val extends UsersModuleCreateUser>
    implements $UsersModuleCreateUserCopyWith<$Res> {
  _$UsersModuleCreateUserCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UsersModuleCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? username = null,
    Object? password = null,
    Object? role = null,
    Object? email = freezed,
    Object? firstName = freezed,
    Object? lastName = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      username: null == username
          ? _value.username
          : username // ignore: cast_nullable_to_non_nullable
              as String,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as UsersModuleCreateUserRole,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$UsersModuleCreateUserImplCopyWith<$Res>
    implements $UsersModuleCreateUserCopyWith<$Res> {
  factory _$$UsersModuleCreateUserImplCopyWith(
          _$UsersModuleCreateUserImpl value,
          $Res Function(_$UsersModuleCreateUserImpl) then) =
      __$$UsersModuleCreateUserImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String username,
      String password,
      UsersModuleCreateUserRole role,
      String? email,
      @JsonKey(name: 'first_name') String? firstName,
      @JsonKey(name: 'last_name') String? lastName});
}

/// @nodoc
class __$$UsersModuleCreateUserImplCopyWithImpl<$Res>
    extends _$UsersModuleCreateUserCopyWithImpl<$Res,
        _$UsersModuleCreateUserImpl>
    implements _$$UsersModuleCreateUserImplCopyWith<$Res> {
  __$$UsersModuleCreateUserImplCopyWithImpl(_$UsersModuleCreateUserImpl _value,
      $Res Function(_$UsersModuleCreateUserImpl) _then)
      : super(_value, _then);

  /// Create a copy of UsersModuleCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? username = null,
    Object? password = null,
    Object? role = null,
    Object? email = freezed,
    Object? firstName = freezed,
    Object? lastName = freezed,
  }) {
    return _then(_$UsersModuleCreateUserImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      username: null == username
          ? _value.username
          : username // ignore: cast_nullable_to_non_nullable
              as String,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as UsersModuleCreateUserRole,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$UsersModuleCreateUserImpl implements _UsersModuleCreateUser {
  const _$UsersModuleCreateUserImpl(
      {required this.id,
      required this.username,
      required this.password,
      this.role = UsersModuleCreateUserRole.user,
      this.email,
      @JsonKey(name: 'first_name') this.firstName,
      @JsonKey(name: 'last_name') this.lastName});

  factory _$UsersModuleCreateUserImpl.fromJson(Map<String, dynamic> json) =>
      _$$UsersModuleCreateUserImplFromJson(json);

  /// Unique identifier for the user.
  @override
  final String id;

  /// Unique username for the new user.
  @override
  final String username;

  /// Password for the new user. Must be at least 6 characters long.
  @override
  final String password;

  /// Role of the user. Defaults to 'user' if not provided.
  @override
  @JsonKey()
  final UsersModuleCreateUserRole role;

  /// Optional email address for the user.
  @override
  final String? email;

  /// Optional first name of the user.
  @override
  @JsonKey(name: 'first_name')
  final String? firstName;

  /// Optional last name of the user.
  @override
  @JsonKey(name: 'last_name')
  final String? lastName;

  @override
  String toString() {
    return 'UsersModuleCreateUser(id: $id, username: $username, password: $password, role: $role, email: $email, firstName: $firstName, lastName: $lastName)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UsersModuleCreateUserImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.username, username) ||
                other.username == username) &&
            (identical(other.password, password) ||
                other.password == password) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, username, password, role, email, firstName, lastName);

  /// Create a copy of UsersModuleCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UsersModuleCreateUserImplCopyWith<_$UsersModuleCreateUserImpl>
      get copyWith => __$$UsersModuleCreateUserImplCopyWithImpl<
          _$UsersModuleCreateUserImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UsersModuleCreateUserImplToJson(
      this,
    );
  }
}

abstract class _UsersModuleCreateUser implements UsersModuleCreateUser {
  const factory _UsersModuleCreateUser(
          {required final String id,
          required final String username,
          required final String password,
          final UsersModuleCreateUserRole role,
          final String? email,
          @JsonKey(name: 'first_name') final String? firstName,
          @JsonKey(name: 'last_name') final String? lastName}) =
      _$UsersModuleCreateUserImpl;

  factory _UsersModuleCreateUser.fromJson(Map<String, dynamic> json) =
      _$UsersModuleCreateUserImpl.fromJson;

  /// Unique identifier for the user.
  @override
  String get id;

  /// Unique username for the new user.
  @override
  String get username;

  /// Password for the new user. Must be at least 6 characters long.
  @override
  String get password;

  /// Role of the user. Defaults to 'user' if not provided.
  @override
  UsersModuleCreateUserRole get role;

  /// Optional email address for the user.
  @override
  String? get email;

  /// Optional first name of the user.
  @override
  @JsonKey(name: 'first_name')
  String? get firstName;

  /// Optional last name of the user.
  @override
  @JsonKey(name: 'last_name')
  String? get lastName;

  /// Create a copy of UsersModuleCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UsersModuleCreateUserImplCopyWith<_$UsersModuleCreateUserImpl>
      get copyWith => throw _privateConstructorUsedError;
}
