// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'users_req_update_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

UsersReqUpdateUser _$UsersReqUpdateUserFromJson(Map<String, dynamic> json) {
  return _UsersReqUpdateUser.fromJson(json);
}

/// @nodoc
mixin _$UsersReqUpdateUser {
  UsersUpdateUser get data => throw _privateConstructorUsedError;

  /// Serializes this UsersReqUpdateUser to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UsersReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UsersReqUpdateUserCopyWith<UsersReqUpdateUser> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UsersReqUpdateUserCopyWith<$Res> {
  factory $UsersReqUpdateUserCopyWith(
          UsersReqUpdateUser value, $Res Function(UsersReqUpdateUser) then) =
      _$UsersReqUpdateUserCopyWithImpl<$Res, UsersReqUpdateUser>;
  @useResult
  $Res call({UsersUpdateUser data});

  $UsersUpdateUserCopyWith<$Res> get data;
}

/// @nodoc
class _$UsersReqUpdateUserCopyWithImpl<$Res, $Val extends UsersReqUpdateUser>
    implements $UsersReqUpdateUserCopyWith<$Res> {
  _$UsersReqUpdateUserCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UsersReqUpdateUser
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
              as UsersUpdateUser,
    ) as $Val);
  }

  /// Create a copy of UsersReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $UsersUpdateUserCopyWith<$Res> get data {
    return $UsersUpdateUserCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$UsersReqUpdateUserImplCopyWith<$Res>
    implements $UsersReqUpdateUserCopyWith<$Res> {
  factory _$$UsersReqUpdateUserImplCopyWith(_$UsersReqUpdateUserImpl value,
          $Res Function(_$UsersReqUpdateUserImpl) then) =
      __$$UsersReqUpdateUserImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({UsersUpdateUser data});

  @override
  $UsersUpdateUserCopyWith<$Res> get data;
}

/// @nodoc
class __$$UsersReqUpdateUserImplCopyWithImpl<$Res>
    extends _$UsersReqUpdateUserCopyWithImpl<$Res, _$UsersReqUpdateUserImpl>
    implements _$$UsersReqUpdateUserImplCopyWith<$Res> {
  __$$UsersReqUpdateUserImplCopyWithImpl(_$UsersReqUpdateUserImpl _value,
      $Res Function(_$UsersReqUpdateUserImpl) _then)
      : super(_value, _then);

  /// Create a copy of UsersReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$UsersReqUpdateUserImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as UsersUpdateUser,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$UsersReqUpdateUserImpl implements _UsersReqUpdateUser {
  const _$UsersReqUpdateUserImpl({required this.data});

  factory _$UsersReqUpdateUserImpl.fromJson(Map<String, dynamic> json) =>
      _$$UsersReqUpdateUserImplFromJson(json);

  @override
  final UsersUpdateUser data;

  @override
  String toString() {
    return 'UsersReqUpdateUser(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UsersReqUpdateUserImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of UsersReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UsersReqUpdateUserImplCopyWith<_$UsersReqUpdateUserImpl> get copyWith =>
      __$$UsersReqUpdateUserImplCopyWithImpl<_$UsersReqUpdateUserImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UsersReqUpdateUserImplToJson(
      this,
    );
  }
}

abstract class _UsersReqUpdateUser implements UsersReqUpdateUser {
  const factory _UsersReqUpdateUser({required final UsersUpdateUser data}) =
      _$UsersReqUpdateUserImpl;

  factory _UsersReqUpdateUser.fromJson(Map<String, dynamic> json) =
      _$UsersReqUpdateUserImpl.fromJson;

  @override
  UsersUpdateUser get data;

  /// Create a copy of UsersReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UsersReqUpdateUserImplCopyWith<_$UsersReqUpdateUserImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
