// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_req_check_username.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleReqCheckUsername _$AuthModuleReqCheckUsernameFromJson(
    Map<String, dynamic> json) {
  return _AuthModuleReqCheckUsername.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleReqCheckUsername {
  AuthModuleCheckUsername get data => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleReqCheckUsername to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleReqCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleReqCheckUsernameCopyWith<AuthModuleReqCheckUsername>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleReqCheckUsernameCopyWith<$Res> {
  factory $AuthModuleReqCheckUsernameCopyWith(AuthModuleReqCheckUsername value,
          $Res Function(AuthModuleReqCheckUsername) then) =
      _$AuthModuleReqCheckUsernameCopyWithImpl<$Res,
          AuthModuleReqCheckUsername>;
  @useResult
  $Res call({AuthModuleCheckUsername data});

  $AuthModuleCheckUsernameCopyWith<$Res> get data;
}

/// @nodoc
class _$AuthModuleReqCheckUsernameCopyWithImpl<$Res,
        $Val extends AuthModuleReqCheckUsername>
    implements $AuthModuleReqCheckUsernameCopyWith<$Res> {
  _$AuthModuleReqCheckUsernameCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleReqCheckUsername
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
              as AuthModuleCheckUsername,
    ) as $Val);
  }

  /// Create a copy of AuthModuleReqCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthModuleCheckUsernameCopyWith<$Res> get data {
    return $AuthModuleCheckUsernameCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthModuleReqCheckUsernameImplCopyWith<$Res>
    implements $AuthModuleReqCheckUsernameCopyWith<$Res> {
  factory _$$AuthModuleReqCheckUsernameImplCopyWith(
          _$AuthModuleReqCheckUsernameImpl value,
          $Res Function(_$AuthModuleReqCheckUsernameImpl) then) =
      __$$AuthModuleReqCheckUsernameImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthModuleCheckUsername data});

  @override
  $AuthModuleCheckUsernameCopyWith<$Res> get data;
}

/// @nodoc
class __$$AuthModuleReqCheckUsernameImplCopyWithImpl<$Res>
    extends _$AuthModuleReqCheckUsernameCopyWithImpl<$Res,
        _$AuthModuleReqCheckUsernameImpl>
    implements _$$AuthModuleReqCheckUsernameImplCopyWith<$Res> {
  __$$AuthModuleReqCheckUsernameImplCopyWithImpl(
      _$AuthModuleReqCheckUsernameImpl _value,
      $Res Function(_$AuthModuleReqCheckUsernameImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleReqCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$AuthModuleReqCheckUsernameImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as AuthModuleCheckUsername,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleReqCheckUsernameImpl implements _AuthModuleReqCheckUsername {
  const _$AuthModuleReqCheckUsernameImpl({required this.data});

  factory _$AuthModuleReqCheckUsernameImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$AuthModuleReqCheckUsernameImplFromJson(json);

  @override
  final AuthModuleCheckUsername data;

  @override
  String toString() {
    return 'AuthModuleReqCheckUsername(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleReqCheckUsernameImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of AuthModuleReqCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleReqCheckUsernameImplCopyWith<_$AuthModuleReqCheckUsernameImpl>
      get copyWith => __$$AuthModuleReqCheckUsernameImplCopyWithImpl<
          _$AuthModuleReqCheckUsernameImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleReqCheckUsernameImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleReqCheckUsername
    implements AuthModuleReqCheckUsername {
  const factory _AuthModuleReqCheckUsername(
          {required final AuthModuleCheckUsername data}) =
      _$AuthModuleReqCheckUsernameImpl;

  factory _AuthModuleReqCheckUsername.fromJson(Map<String, dynamic> json) =
      _$AuthModuleReqCheckUsernameImpl.fromJson;

  @override
  AuthModuleCheckUsername get data;

  /// Create a copy of AuthModuleReqCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleReqCheckUsernameImplCopyWith<_$AuthModuleReqCheckUsernameImpl>
      get copyWith => throw _privateConstructorUsedError;
}
