// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'users_update_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

UsersUpdateUser _$UsersUpdateUserFromJson(Map<String, dynamic> json) {
  return _UsersUpdateUser.fromJson(json);
}

/// @nodoc
mixin _$UsersUpdateUser {
  /// New password for the user.
  String get password => throw _privateConstructorUsedError;

  /// Updated role of the user.
  UsersUpdateUserRole get role => throw _privateConstructorUsedError;

  /// Updated email address of the user.
  String? get email => throw _privateConstructorUsedError;

  /// Updated first name of the user.
  @JsonKey(name: 'first_name')
  String? get firstName => throw _privateConstructorUsedError;

  /// Updated last name of the user.
  @JsonKey(name: 'last_name')
  String? get lastName => throw _privateConstructorUsedError;

  /// Serializes this UsersUpdateUser to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UsersUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UsersUpdateUserCopyWith<UsersUpdateUser> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UsersUpdateUserCopyWith<$Res> {
  factory $UsersUpdateUserCopyWith(
          UsersUpdateUser value, $Res Function(UsersUpdateUser) then) =
      _$UsersUpdateUserCopyWithImpl<$Res, UsersUpdateUser>;
  @useResult
  $Res call(
      {String password,
      UsersUpdateUserRole role,
      String? email,
      @JsonKey(name: 'first_name') String? firstName,
      @JsonKey(name: 'last_name') String? lastName});
}

/// @nodoc
class _$UsersUpdateUserCopyWithImpl<$Res, $Val extends UsersUpdateUser>
    implements $UsersUpdateUserCopyWith<$Res> {
  _$UsersUpdateUserCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UsersUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? password = null,
    Object? role = null,
    Object? email = freezed,
    Object? firstName = freezed,
    Object? lastName = freezed,
  }) {
    return _then(_value.copyWith(
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as UsersUpdateUserRole,
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
abstract class _$$UsersUpdateUserImplCopyWith<$Res>
    implements $UsersUpdateUserCopyWith<$Res> {
  factory _$$UsersUpdateUserImplCopyWith(_$UsersUpdateUserImpl value,
          $Res Function(_$UsersUpdateUserImpl) then) =
      __$$UsersUpdateUserImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String password,
      UsersUpdateUserRole role,
      String? email,
      @JsonKey(name: 'first_name') String? firstName,
      @JsonKey(name: 'last_name') String? lastName});
}

/// @nodoc
class __$$UsersUpdateUserImplCopyWithImpl<$Res>
    extends _$UsersUpdateUserCopyWithImpl<$Res, _$UsersUpdateUserImpl>
    implements _$$UsersUpdateUserImplCopyWith<$Res> {
  __$$UsersUpdateUserImplCopyWithImpl(
      _$UsersUpdateUserImpl _value, $Res Function(_$UsersUpdateUserImpl) _then)
      : super(_value, _then);

  /// Create a copy of UsersUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? password = null,
    Object? role = null,
    Object? email = freezed,
    Object? firstName = freezed,
    Object? lastName = freezed,
  }) {
    return _then(_$UsersUpdateUserImpl(
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      role: null == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as UsersUpdateUserRole,
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
class _$UsersUpdateUserImpl implements _UsersUpdateUser {
  const _$UsersUpdateUserImpl(
      {required this.password,
      required this.role,
      this.email,
      @JsonKey(name: 'first_name') this.firstName,
      @JsonKey(name: 'last_name') this.lastName});

  factory _$UsersUpdateUserImpl.fromJson(Map<String, dynamic> json) =>
      _$$UsersUpdateUserImplFromJson(json);

  /// New password for the user.
  @override
  final String password;

  /// Updated role of the user.
  @override
  final UsersUpdateUserRole role;

  /// Updated email address of the user.
  @override
  final String? email;

  /// Updated first name of the user.
  @override
  @JsonKey(name: 'first_name')
  final String? firstName;

  /// Updated last name of the user.
  @override
  @JsonKey(name: 'last_name')
  final String? lastName;

  @override
  String toString() {
    return 'UsersUpdateUser(password: $password, role: $role, email: $email, firstName: $firstName, lastName: $lastName)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UsersUpdateUserImpl &&
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
  int get hashCode =>
      Object.hash(runtimeType, password, role, email, firstName, lastName);

  /// Create a copy of UsersUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UsersUpdateUserImplCopyWith<_$UsersUpdateUserImpl> get copyWith =>
      __$$UsersUpdateUserImplCopyWithImpl<_$UsersUpdateUserImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UsersUpdateUserImplToJson(
      this,
    );
  }
}

abstract class _UsersUpdateUser implements UsersUpdateUser {
  const factory _UsersUpdateUser(
          {required final String password,
          required final UsersUpdateUserRole role,
          final String? email,
          @JsonKey(name: 'first_name') final String? firstName,
          @JsonKey(name: 'last_name') final String? lastName}) =
      _$UsersUpdateUserImpl;

  factory _UsersUpdateUser.fromJson(Map<String, dynamic> json) =
      _$UsersUpdateUserImpl.fromJson;

  /// New password for the user.
  @override
  String get password;

  /// Updated role of the user.
  @override
  UsersUpdateUserRole get role;

  /// Updated email address of the user.
  @override
  String? get email;

  /// Updated first name of the user.
  @override
  @JsonKey(name: 'first_name')
  String? get firstName;

  /// Updated last name of the user.
  @override
  @JsonKey(name: 'last_name')
  String? get lastName;

  /// Create a copy of UsersUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UsersUpdateUserImplCopyWith<_$UsersUpdateUserImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
