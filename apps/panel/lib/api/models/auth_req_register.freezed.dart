// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_req_register.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthReqRegister _$AuthReqRegisterFromJson(Map<String, dynamic> json) {
  return _AuthReqRegister.fromJson(json);
}

/// @nodoc
mixin _$AuthReqRegister {
  AuthRegister get data => throw _privateConstructorUsedError;

  /// Serializes this AuthReqRegister to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthReqRegisterCopyWith<AuthReqRegister> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthReqRegisterCopyWith<$Res> {
  factory $AuthReqRegisterCopyWith(
          AuthReqRegister value, $Res Function(AuthReqRegister) then) =
      _$AuthReqRegisterCopyWithImpl<$Res, AuthReqRegister>;
  @useResult
  $Res call({AuthRegister data});

  $AuthRegisterCopyWith<$Res> get data;
}

/// @nodoc
class _$AuthReqRegisterCopyWithImpl<$Res, $Val extends AuthReqRegister>
    implements $AuthReqRegisterCopyWith<$Res> {
  _$AuthReqRegisterCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthReqRegister
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
              as AuthRegister,
    ) as $Val);
  }

  /// Create a copy of AuthReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthRegisterCopyWith<$Res> get data {
    return $AuthRegisterCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthReqRegisterImplCopyWith<$Res>
    implements $AuthReqRegisterCopyWith<$Res> {
  factory _$$AuthReqRegisterImplCopyWith(_$AuthReqRegisterImpl value,
          $Res Function(_$AuthReqRegisterImpl) then) =
      __$$AuthReqRegisterImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthRegister data});

  @override
  $AuthRegisterCopyWith<$Res> get data;
}

/// @nodoc
class __$$AuthReqRegisterImplCopyWithImpl<$Res>
    extends _$AuthReqRegisterCopyWithImpl<$Res, _$AuthReqRegisterImpl>
    implements _$$AuthReqRegisterImplCopyWith<$Res> {
  __$$AuthReqRegisterImplCopyWithImpl(
      _$AuthReqRegisterImpl _value, $Res Function(_$AuthReqRegisterImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$AuthReqRegisterImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as AuthRegister,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthReqRegisterImpl implements _AuthReqRegister {
  const _$AuthReqRegisterImpl({required this.data});

  factory _$AuthReqRegisterImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthReqRegisterImplFromJson(json);

  @override
  final AuthRegister data;

  @override
  String toString() {
    return 'AuthReqRegister(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthReqRegisterImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of AuthReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthReqRegisterImplCopyWith<_$AuthReqRegisterImpl> get copyWith =>
      __$$AuthReqRegisterImplCopyWithImpl<_$AuthReqRegisterImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthReqRegisterImplToJson(
      this,
    );
  }
}

abstract class _AuthReqRegister implements AuthReqRegister {
  const factory _AuthReqRegister({required final AuthRegister data}) =
      _$AuthReqRegisterImpl;

  factory _AuthReqRegister.fromJson(Map<String, dynamic> json) =
      _$AuthReqRegisterImpl.fromJson;

  @override
  AuthRegister get data;

  /// Create a copy of AuthReqRegister
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthReqRegisterImplCopyWith<_$AuthReqRegisterImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
