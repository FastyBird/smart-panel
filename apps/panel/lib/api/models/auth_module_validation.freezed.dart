// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_validation.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleValidation _$AuthModuleValidationFromJson(Map<String, dynamic> json) {
  return _AuthModuleValidation.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleValidation {
  /// Indicates whether the provided validation field is valid.
  bool get valid => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleValidation to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleValidation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleValidationCopyWith<AuthModuleValidation> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleValidationCopyWith<$Res> {
  factory $AuthModuleValidationCopyWith(AuthModuleValidation value,
          $Res Function(AuthModuleValidation) then) =
      _$AuthModuleValidationCopyWithImpl<$Res, AuthModuleValidation>;
  @useResult
  $Res call({bool valid});
}

/// @nodoc
class _$AuthModuleValidationCopyWithImpl<$Res,
        $Val extends AuthModuleValidation>
    implements $AuthModuleValidationCopyWith<$Res> {
  _$AuthModuleValidationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleValidation
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
abstract class _$$AuthModuleValidationImplCopyWith<$Res>
    implements $AuthModuleValidationCopyWith<$Res> {
  factory _$$AuthModuleValidationImplCopyWith(_$AuthModuleValidationImpl value,
          $Res Function(_$AuthModuleValidationImpl) then) =
      __$$AuthModuleValidationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({bool valid});
}

/// @nodoc
class __$$AuthModuleValidationImplCopyWithImpl<$Res>
    extends _$AuthModuleValidationCopyWithImpl<$Res, _$AuthModuleValidationImpl>
    implements _$$AuthModuleValidationImplCopyWith<$Res> {
  __$$AuthModuleValidationImplCopyWithImpl(_$AuthModuleValidationImpl _value,
      $Res Function(_$AuthModuleValidationImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleValidation
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? valid = null,
  }) {
    return _then(_$AuthModuleValidationImpl(
      valid: null == valid
          ? _value.valid
          : valid // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleValidationImpl implements _AuthModuleValidation {
  const _$AuthModuleValidationImpl({required this.valid});

  factory _$AuthModuleValidationImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleValidationImplFromJson(json);

  /// Indicates whether the provided validation field is valid.
  @override
  final bool valid;

  @override
  String toString() {
    return 'AuthModuleValidation(valid: $valid)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleValidationImpl &&
            (identical(other.valid, valid) || other.valid == valid));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, valid);

  /// Create a copy of AuthModuleValidation
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleValidationImplCopyWith<_$AuthModuleValidationImpl>
      get copyWith =>
          __$$AuthModuleValidationImplCopyWithImpl<_$AuthModuleValidationImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleValidationImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleValidation implements AuthModuleValidation {
  const factory _AuthModuleValidation({required final bool valid}) =
      _$AuthModuleValidationImpl;

  factory _AuthModuleValidation.fromJson(Map<String, dynamic> json) =
      _$AuthModuleValidationImpl.fromJson;

  /// Indicates whether the provided validation field is valid.
  @override
  bool get valid;

  /// Create a copy of AuthModuleValidation
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleValidationImplCopyWith<_$AuthModuleValidationImpl>
      get copyWith => throw _privateConstructorUsedError;
}
