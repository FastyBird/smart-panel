// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'users_create_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

UsersCreateUser _$UsersCreateUserFromJson(Map<String, dynamic> json) {
  return _UsersCreateUser.fromJson(json);
}

/// @nodoc
mixin _$UsersCreateUser {
  /// Unique identifier for the user.
  String get id => throw _privateConstructorUsedError;

  /// Unique username for the new user.
  String get username => throw _privateConstructorUsedError;

  /// Password for the new user. Must be at least 6 characters long.
  String get password => throw _privateConstructorUsedError;

  /// Role of the user. Defaults to 'user' if not provided.
  UsersCreateUserRole get role => throw _privateConstructorUsedError;

  /// Optional email address for the user.
  String? get email => throw _privateConstructorUsedError;

  /// Optional first name of the user.
  @JsonKey(name: 'first_name')
  String? get firstName => throw _privateConstructorUsedError;

  /// Optional last name of the user.
  @JsonKey(name: 'last_name')
  String? get lastName => throw _privateConstructorUsedError;

  /// Serializes this UsersCreateUser to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UsersCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UsersCreateUserCopyWith<UsersCreateUser> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UsersCreateUserCopyWith<$Res> {
  factory $UsersCreateUserCopyWith(
          UsersCreateUser value, $Res Function(UsersCreateUser) then) =
      _$UsersCreateUserCopyWithImpl<$Res, UsersCreateUser>;
  @useResult
  $Res call(
      {String id,
      String username,
      String password,
      UsersCreateUserRole role,
      String? email,
      @JsonKey(name: 'first_name') String? firstName,
      @JsonKey(name: 'last_name') String? lastName});
}

/// @nodoc
class _$UsersCreateUserCopyWithImpl<$Res, $Val extends UsersCreateUser>
    implements $UsersCreateUserCopyWith<$Res> {
  _$UsersCreateUserCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UsersCreateUser
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
              as UsersCreateUserRole,
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
abstract class _$$UsersCreateUserImplCopyWith<$Res>
    implements $UsersCreateUserCopyWith<$Res> {
  factory _$$UsersCreateUserImplCopyWith(_$UsersCreateUserImpl value,
          $Res Function(_$UsersCreateUserImpl) then) =
      __$$UsersCreateUserImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String username,
      String password,
      UsersCreateUserRole role,
      String? email,
      @JsonKey(name: 'first_name') String? firstName,
      @JsonKey(name: 'last_name') String? lastName});
}

/// @nodoc
class __$$UsersCreateUserImplCopyWithImpl<$Res>
    extends _$UsersCreateUserCopyWithImpl<$Res, _$UsersCreateUserImpl>
    implements _$$UsersCreateUserImplCopyWith<$Res> {
  __$$UsersCreateUserImplCopyWithImpl(
      _$UsersCreateUserImpl _value, $Res Function(_$UsersCreateUserImpl) _then)
      : super(_value, _then);

  /// Create a copy of UsersCreateUser
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
    return _then(_$UsersCreateUserImpl(
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
              as UsersCreateUserRole,
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
class _$UsersCreateUserImpl implements _UsersCreateUser {
  const _$UsersCreateUserImpl(
      {required this.id,
      required this.username,
      required this.password,
      this.role = UsersCreateUserRole.user,
      this.email,
      @JsonKey(name: 'first_name') this.firstName,
      @JsonKey(name: 'last_name') this.lastName});

  factory _$UsersCreateUserImpl.fromJson(Map<String, dynamic> json) =>
      _$$UsersCreateUserImplFromJson(json);

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
  final UsersCreateUserRole role;

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
    return 'UsersCreateUser(id: $id, username: $username, password: $password, role: $role, email: $email, firstName: $firstName, lastName: $lastName)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UsersCreateUserImpl &&
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

  /// Create a copy of UsersCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UsersCreateUserImplCopyWith<_$UsersCreateUserImpl> get copyWith =>
      __$$UsersCreateUserImplCopyWithImpl<_$UsersCreateUserImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UsersCreateUserImplToJson(
      this,
    );
  }
}

abstract class _UsersCreateUser implements UsersCreateUser {
  const factory _UsersCreateUser(
          {required final String id,
          required final String username,
          required final String password,
          final UsersCreateUserRole role,
          final String? email,
          @JsonKey(name: 'first_name') final String? firstName,
          @JsonKey(name: 'last_name') final String? lastName}) =
      _$UsersCreateUserImpl;

  factory _UsersCreateUser.fromJson(Map<String, dynamic> json) =
      _$UsersCreateUserImpl.fromJson;

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
  UsersCreateUserRole get role;

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

  /// Create a copy of UsersCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UsersCreateUserImplCopyWith<_$UsersCreateUserImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
