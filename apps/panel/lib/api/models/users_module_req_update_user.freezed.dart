// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'users_module_req_update_user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

UsersModuleReqUpdateUser _$UsersModuleReqUpdateUserFromJson(
    Map<String, dynamic> json) {
  return _UsersModuleReqUpdateUser.fromJson(json);
}

/// @nodoc
mixin _$UsersModuleReqUpdateUser {
  UsersModuleUpdateUser get data => throw _privateConstructorUsedError;

  /// Serializes this UsersModuleReqUpdateUser to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UsersModuleReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UsersModuleReqUpdateUserCopyWith<UsersModuleReqUpdateUser> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UsersModuleReqUpdateUserCopyWith<$Res> {
  factory $UsersModuleReqUpdateUserCopyWith(UsersModuleReqUpdateUser value,
          $Res Function(UsersModuleReqUpdateUser) then) =
      _$UsersModuleReqUpdateUserCopyWithImpl<$Res, UsersModuleReqUpdateUser>;
  @useResult
  $Res call({UsersModuleUpdateUser data});

  $UsersModuleUpdateUserCopyWith<$Res> get data;
}

/// @nodoc
class _$UsersModuleReqUpdateUserCopyWithImpl<$Res,
        $Val extends UsersModuleReqUpdateUser>
    implements $UsersModuleReqUpdateUserCopyWith<$Res> {
  _$UsersModuleReqUpdateUserCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UsersModuleReqUpdateUser
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
              as UsersModuleUpdateUser,
    ) as $Val);
  }

  /// Create a copy of UsersModuleReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $UsersModuleUpdateUserCopyWith<$Res> get data {
    return $UsersModuleUpdateUserCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$UsersModuleReqUpdateUserImplCopyWith<$Res>
    implements $UsersModuleReqUpdateUserCopyWith<$Res> {
  factory _$$UsersModuleReqUpdateUserImplCopyWith(
          _$UsersModuleReqUpdateUserImpl value,
          $Res Function(_$UsersModuleReqUpdateUserImpl) then) =
      __$$UsersModuleReqUpdateUserImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({UsersModuleUpdateUser data});

  @override
  $UsersModuleUpdateUserCopyWith<$Res> get data;
}

/// @nodoc
class __$$UsersModuleReqUpdateUserImplCopyWithImpl<$Res>
    extends _$UsersModuleReqUpdateUserCopyWithImpl<$Res,
        _$UsersModuleReqUpdateUserImpl>
    implements _$$UsersModuleReqUpdateUserImplCopyWith<$Res> {
  __$$UsersModuleReqUpdateUserImplCopyWithImpl(
      _$UsersModuleReqUpdateUserImpl _value,
      $Res Function(_$UsersModuleReqUpdateUserImpl) _then)
      : super(_value, _then);

  /// Create a copy of UsersModuleReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$UsersModuleReqUpdateUserImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as UsersModuleUpdateUser,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$UsersModuleReqUpdateUserImpl implements _UsersModuleReqUpdateUser {
  const _$UsersModuleReqUpdateUserImpl({required this.data});

  factory _$UsersModuleReqUpdateUserImpl.fromJson(Map<String, dynamic> json) =>
      _$$UsersModuleReqUpdateUserImplFromJson(json);

  @override
  final UsersModuleUpdateUser data;

  @override
  String toString() {
    return 'UsersModuleReqUpdateUser(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UsersModuleReqUpdateUserImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of UsersModuleReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UsersModuleReqUpdateUserImplCopyWith<_$UsersModuleReqUpdateUserImpl>
      get copyWith => __$$UsersModuleReqUpdateUserImplCopyWithImpl<
          _$UsersModuleReqUpdateUserImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UsersModuleReqUpdateUserImplToJson(
      this,
    );
  }
}

abstract class _UsersModuleReqUpdateUser implements UsersModuleReqUpdateUser {
  const factory _UsersModuleReqUpdateUser(
          {required final UsersModuleUpdateUser data}) =
      _$UsersModuleReqUpdateUserImpl;

  factory _UsersModuleReqUpdateUser.fromJson(Map<String, dynamic> json) =
      _$UsersModuleReqUpdateUserImpl.fromJson;

  @override
  UsersModuleUpdateUser get data;

  /// Create a copy of UsersModuleReqUpdateUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UsersModuleReqUpdateUserImplCopyWith<_$UsersModuleReqUpdateUserImpl>
      get copyWith => throw _privateConstructorUsedError;
}
