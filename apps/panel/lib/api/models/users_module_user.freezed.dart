// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'users_module_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

UsersModuleUser _$UsersModuleUserFromJson(Map<String, dynamic> json) {
  return _UsersModuleUser.fromJson(json);
}

/// @nodoc
mixin _$UsersModuleUser {
  /// Unique identifier for the user.
  String get id => throw _privateConstructorUsedError;

  /// Unique username of the user.
  String get username => throw _privateConstructorUsedError;

  /// First name of the user.
  @JsonKey(name: 'first_name')
  String? get firstName => throw _privateConstructorUsedError;

  /// Last name of the user.
  @JsonKey(name: 'last_name')
  String? get lastName => throw _privateConstructorUsedError;

  /// Email address of the user.
  String? get email => throw _privateConstructorUsedError;

  /// The timestamp when the user was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the user was updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Indicates whether the user is hidden from general visibility.
  @JsonKey(name: 'is_hidden')
  bool get isHidden => throw _privateConstructorUsedError;

  /// User role: 'owner' has full access, 'admin' can manage users, 'user' has limited access, 'display' is read-only.
  UsersModuleUserRole get role => throw _privateConstructorUsedError;

  /// Serializes this UsersModuleUser to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UsersModuleUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UsersModuleUserCopyWith<UsersModuleUser> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UsersModuleUserCopyWith<$Res> {
  factory $UsersModuleUserCopyWith(
          UsersModuleUser value, $Res Function(UsersModuleUser) then) =
      _$UsersModuleUserCopyWithImpl<$Res, UsersModuleUser>;
  @useResult
  $Res call(
      {String id,
      String username,
      @JsonKey(name: 'first_name') String? firstName,
      @JsonKey(name: 'last_name') String? lastName,
      String? email,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'is_hidden') bool isHidden,
      UsersModuleUserRole role});
}

/// @nodoc
class _$UsersModuleUserCopyWithImpl<$Res, $Val extends UsersModuleUser>
    implements $UsersModuleUserCopyWith<$Res> {
  _$UsersModuleUserCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UsersModuleUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? username = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? email = freezed,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? isHidden = null,
    Object? role = null,
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
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      isHidden: null == isHidden
          ? _value.isHidden
          : isHidden // ignore: cast_nullable_to_non_nullable
              as bool,
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as UsersModuleUserRole,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$UsersModuleUserImplCopyWith<$Res>
    implements $UsersModuleUserCopyWith<$Res> {
  factory _$$UsersModuleUserImplCopyWith(_$UsersModuleUserImpl value,
          $Res Function(_$UsersModuleUserImpl) then) =
      __$$UsersModuleUserImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String username,
      @JsonKey(name: 'first_name') String? firstName,
      @JsonKey(name: 'last_name') String? lastName,
      String? email,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'is_hidden') bool isHidden,
      UsersModuleUserRole role});
}

/// @nodoc
class __$$UsersModuleUserImplCopyWithImpl<$Res>
    extends _$UsersModuleUserCopyWithImpl<$Res, _$UsersModuleUserImpl>
    implements _$$UsersModuleUserImplCopyWith<$Res> {
  __$$UsersModuleUserImplCopyWithImpl(
      _$UsersModuleUserImpl _value, $Res Function(_$UsersModuleUserImpl) _then)
      : super(_value, _then);

  /// Create a copy of UsersModuleUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? username = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? email = freezed,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? isHidden = null,
    Object? role = null,
  }) {
    return _then(_$UsersModuleUserImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      username: null == username
          ? _value.username
          : username // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      isHidden: null == isHidden
          ? _value.isHidden
          : isHidden // ignore: cast_nullable_to_non_nullable
              as bool,
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as UsersModuleUserRole,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$UsersModuleUserImpl implements _UsersModuleUser {
  const _$UsersModuleUserImpl(
      {required this.id,
      required this.username,
      @JsonKey(name: 'first_name') required this.firstName,
      @JsonKey(name: 'last_name') required this.lastName,
      required this.email,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      @JsonKey(name: 'is_hidden') this.isHidden = false,
      this.role = UsersModuleUserRole.user});

  factory _$UsersModuleUserImpl.fromJson(Map<String, dynamic> json) =>
      _$$UsersModuleUserImplFromJson(json);

  /// Unique identifier for the user.
  @override
  final String id;

  /// Unique username of the user.
  @override
  final String username;

  /// First name of the user.
  @override
  @JsonKey(name: 'first_name')
  final String? firstName;

  /// Last name of the user.
  @override
  @JsonKey(name: 'last_name')
  final String? lastName;

  /// Email address of the user.
  @override
  final String? email;

  /// The timestamp when the user was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the user was updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// Indicates whether the user is hidden from general visibility.
  @override
  @JsonKey(name: 'is_hidden')
  final bool isHidden;

  /// User role: 'owner' has full access, 'admin' can manage users, 'user' has limited access, 'display' is read-only.
  @override
  @JsonKey()
  final UsersModuleUserRole role;

  @override
  String toString() {
    return 'UsersModuleUser(id: $id, username: $username, firstName: $firstName, lastName: $lastName, email: $email, createdAt: $createdAt, updatedAt: $updatedAt, isHidden: $isHidden, role: $role)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UsersModuleUserImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.username, username) ||
                other.username == username) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.isHidden, isHidden) ||
                other.isHidden == isHidden) &&
            (identical(other.role, role) || other.role == role));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, username, firstName,
      lastName, email, createdAt, updatedAt, isHidden, role);

  /// Create a copy of UsersModuleUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UsersModuleUserImplCopyWith<_$UsersModuleUserImpl> get copyWith =>
      __$$UsersModuleUserImplCopyWithImpl<_$UsersModuleUserImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UsersModuleUserImplToJson(
      this,
    );
  }
}

abstract class _UsersModuleUser implements UsersModuleUser {
  const factory _UsersModuleUser(
      {required final String id,
      required final String username,
      @JsonKey(name: 'first_name') required final String? firstName,
      @JsonKey(name: 'last_name') required final String? lastName,
      required final String? email,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      @JsonKey(name: 'is_hidden') final bool isHidden,
      final UsersModuleUserRole role}) = _$UsersModuleUserImpl;

  factory _UsersModuleUser.fromJson(Map<String, dynamic> json) =
      _$UsersModuleUserImpl.fromJson;

  /// Unique identifier for the user.
  @override
  String get id;

  /// Unique username of the user.
  @override
  String get username;

  /// First name of the user.
  @override
  @JsonKey(name: 'first_name')
  String? get firstName;

  /// Last name of the user.
  @override
  @JsonKey(name: 'last_name')
  String? get lastName;

  /// Email address of the user.
  @override
  String? get email;

  /// The timestamp when the user was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the user was updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Indicates whether the user is hidden from general visibility.
  @override
  @JsonKey(name: 'is_hidden')
  bool get isHidden;

  /// User role: 'owner' has full access, 'admin' can manage users, 'user' has limited access, 'display' is read-only.
  @override
  UsersModuleUserRole get role;

  /// Create a copy of UsersModuleUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UsersModuleUserImplCopyWith<_$UsersModuleUserImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
