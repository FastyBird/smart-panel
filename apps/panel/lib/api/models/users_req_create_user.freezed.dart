// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'users_req_create_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

UsersReqCreateUser _$UsersReqCreateUserFromJson(Map<String, dynamic> json) {
  return _UsersReqCreateUser.fromJson(json);
}

/// @nodoc
mixin _$UsersReqCreateUser {
  UsersCreateUser get data => throw _privateConstructorUsedError;

  /// Serializes this UsersReqCreateUser to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UsersReqCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UsersReqCreateUserCopyWith<UsersReqCreateUser> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UsersReqCreateUserCopyWith<$Res> {
  factory $UsersReqCreateUserCopyWith(
          UsersReqCreateUser value, $Res Function(UsersReqCreateUser) then) =
      _$UsersReqCreateUserCopyWithImpl<$Res, UsersReqCreateUser>;
  @useResult
  $Res call({UsersCreateUser data});

  $UsersCreateUserCopyWith<$Res> get data;
}

/// @nodoc
class _$UsersReqCreateUserCopyWithImpl<$Res, $Val extends UsersReqCreateUser>
    implements $UsersReqCreateUserCopyWith<$Res> {
  _$UsersReqCreateUserCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UsersReqCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as UsersCreateUser,
    ) as $Val);
  }

  /// Create a copy of UsersReqCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $UsersCreateUserCopyWith<$Res> get data {
    return $UsersCreateUserCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$UsersReqCreateUserImplCopyWith<$Res>
    implements $UsersReqCreateUserCopyWith<$Res> {
  factory _$$UsersReqCreateUserImplCopyWith(_$UsersReqCreateUserImpl value,
          $Res Function(_$UsersReqCreateUserImpl) then) =
      __$$UsersReqCreateUserImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({UsersCreateUser data});

  @override
  $UsersCreateUserCopyWith<$Res> get data;
}

/// @nodoc
class __$$UsersReqCreateUserImplCopyWithImpl<$Res>
    extends _$UsersReqCreateUserCopyWithImpl<$Res, _$UsersReqCreateUserImpl>
    implements _$$UsersReqCreateUserImplCopyWith<$Res> {
  __$$UsersReqCreateUserImplCopyWithImpl(_$UsersReqCreateUserImpl _value,
      $Res Function(_$UsersReqCreateUserImpl) _then)
      : super(_value, _then);

  /// Create a copy of UsersReqCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$UsersReqCreateUserImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as UsersCreateUser,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$UsersReqCreateUserImpl implements _UsersReqCreateUser {
  const _$UsersReqCreateUserImpl({required this.data});

  factory _$UsersReqCreateUserImpl.fromJson(Map<String, dynamic> json) =>
      _$$UsersReqCreateUserImplFromJson(json);

  @override
  final UsersCreateUser data;

  @override
  String toString() {
    return 'UsersReqCreateUser(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UsersReqCreateUserImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of UsersReqCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UsersReqCreateUserImplCopyWith<_$UsersReqCreateUserImpl> get copyWith =>
      __$$UsersReqCreateUserImplCopyWithImpl<_$UsersReqCreateUserImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UsersReqCreateUserImplToJson(
      this,
    );
  }
}

abstract class _UsersReqCreateUser implements UsersReqCreateUser {
  const factory _UsersReqCreateUser({required final UsersCreateUser data}) =
      _$UsersReqCreateUserImpl;

  factory _UsersReqCreateUser.fromJson(Map<String, dynamic> json) =
      _$UsersReqCreateUserImpl.fromJson;

  @override
  UsersCreateUser get data;

  /// Create a copy of UsersReqCreateUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UsersReqCreateUserImplCopyWith<_$UsersReqCreateUserImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
