// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_validation.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthValidation _$AuthValidationFromJson(Map<String, dynamic> json) {
  return _AuthValidation.fromJson(json);
}

/// @nodoc
mixin _$AuthValidation {
  /// Indicates whether the provided validation field is valid.
  bool get valid => throw _privateConstructorUsedError;

  /// Serializes this AuthValidation to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthValidation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthValidationCopyWith<AuthValidation> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthValidationCopyWith<$Res> {
  factory $AuthValidationCopyWith(
          AuthValidation value, $Res Function(AuthValidation) then) =
      _$AuthValidationCopyWithImpl<$Res, AuthValidation>;
  @useResult
  $Res call({bool valid});
}

/// @nodoc
class _$AuthValidationCopyWithImpl<$Res, $Val extends AuthValidation>
    implements $AuthValidationCopyWith<$Res> {
  _$AuthValidationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthValidation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? valid = null,
  }) {
    return _then(_value.copyWith(
      valid: null == valid
          ? _value.valid
          : valid // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthValidationImplCopyWith<$Res>
    implements $AuthValidationCopyWith<$Res> {
  factory _$$AuthValidationImplCopyWith(_$AuthValidationImpl value,
          $Res Function(_$AuthValidationImpl) then) =
      __$$AuthValidationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool valid});
}

/// @nodoc
class __$$AuthValidationImplCopyWithImpl<$Res>
    extends _$AuthValidationCopyWithImpl<$Res, _$AuthValidationImpl>
    implements _$$AuthValidationImplCopyWith<$Res> {
  __$$AuthValidationImplCopyWithImpl(
      _$AuthValidationImpl _value, $Res Function(_$AuthValidationImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthValidation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? valid = null,
  }) {
    return _then(_$AuthValidationImpl(
      valid: null == valid
          ? _value.valid
          : valid // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthValidationImpl implements _AuthValidation {
  const _$AuthValidationImpl({required this.valid});

  factory _$AuthValidationImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthValidationImplFromJson(json);

  /// Indicates whether the provided validation field is valid.
  @override
  final bool valid;

  @override
  String toString() {
    return 'AuthValidation(valid: $valid)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthValidationImpl &&
            (identical(other.valid, valid) || other.valid == valid));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, valid);

  /// Create a copy of AuthValidation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthValidationImplCopyWith<_$AuthValidationImpl> get copyWith =>
      __$$AuthValidationImplCopyWithImpl<_$AuthValidationImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthValidationImplToJson(
      this,
    );
  }
}

abstract class _AuthValidation implements AuthValidation {
  const factory _AuthValidation({required final bool valid}) =
      _$AuthValidationImpl;

  factory _AuthValidation.fromJson(Map<String, dynamic> json) =
      _$AuthValidationImpl.fromJson;

  /// Indicates whether the provided validation field is valid.
  @override
  bool get valid;

  /// Create a copy of AuthValidation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthValidationImplCopyWith<_$AuthValidationImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
