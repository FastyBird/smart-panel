// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_req_register.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleReqRegister _$AuthModuleReqRegisterFromJson(
    Map<String, dynamic> json) {
  return _AuthModuleReqRegister.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleReqRegister {
  AuthModuleRegister get data => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleReqRegister to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleReqRegisterCopyWith<AuthModuleReqRegister> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleReqRegisterCopyWith<$Res> {
  factory $AuthModuleReqRegisterCopyWith(AuthModuleReqRegister value,
          $Res Function(AuthModuleReqRegister) then) =
      _$AuthModuleReqRegisterCopyWithImpl<$Res, AuthModuleReqRegister>;
  @useResult
  $Res call({AuthModuleRegister data});

  $AuthModuleRegisterCopyWith<$Res> get data;
}

/// @nodoc
class _$AuthModuleReqRegisterCopyWithImpl<$Res,
        $Val extends AuthModuleReqRegister>
    implements $AuthModuleReqRegisterCopyWith<$Res> {
  _$AuthModuleReqRegisterCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleReqRegister
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
              as AuthModuleRegister,
    ) as $Val);
  }

  /// Create a copy of AuthModuleReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthModuleRegisterCopyWith<$Res> get data {
    return $AuthModuleRegisterCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthModuleReqRegisterImplCopyWith<$Res>
    implements $AuthModuleReqRegisterCopyWith<$Res> {
  factory _$$AuthModuleReqRegisterImplCopyWith(
          _$AuthModuleReqRegisterImpl value,
          $Res Function(_$AuthModuleReqRegisterImpl) then) =
      __$$AuthModuleReqRegisterImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthModuleRegister data});

  @override
  $AuthModuleRegisterCopyWith<$Res> get data;
}

/// @nodoc
class __$$AuthModuleReqRegisterImplCopyWithImpl<$Res>
    extends _$AuthModuleReqRegisterCopyWithImpl<$Res,
        _$AuthModuleReqRegisterImpl>
    implements _$$AuthModuleReqRegisterImplCopyWith<$Res> {
  __$$AuthModuleReqRegisterImplCopyWithImpl(_$AuthModuleReqRegisterImpl _value,
      $Res Function(_$AuthModuleReqRegisterImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$AuthModuleReqRegisterImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as AuthModuleRegister,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleReqRegisterImpl implements _AuthModuleReqRegister {
  const _$AuthModuleReqRegisterImpl({required this.data});

  factory _$AuthModuleReqRegisterImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleReqRegisterImplFromJson(json);

  @override
  final AuthModuleRegister data;

  @override
  String toString() {
    return 'AuthModuleReqRegister(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleReqRegisterImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of AuthModuleReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleReqRegisterImplCopyWith<_$AuthModuleReqRegisterImpl>
      get copyWith => __$$AuthModuleReqRegisterImplCopyWithImpl<
          _$AuthModuleReqRegisterImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleReqRegisterImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleReqRegister implements AuthModuleReqRegister {
  const factory _AuthModuleReqRegister(
      {required final AuthModuleRegister data}) = _$AuthModuleReqRegisterImpl;

  factory _AuthModuleReqRegister.fromJson(Map<String, dynamic> json) =
      _$AuthModuleReqRegisterImpl.fromJson;

  @override
  AuthModuleRegister get data;

  /// Create a copy of AuthModuleReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleReqRegisterImplCopyWith<_$AuthModuleReqRegisterImpl>
      get copyWith => throw _privateConstructorUsedError;
}
