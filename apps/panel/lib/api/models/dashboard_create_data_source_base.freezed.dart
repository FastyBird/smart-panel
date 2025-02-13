// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_data_source_base.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateDataSourceBase _$DashboardCreateDataSourceBaseFromJson(
    Map<String, dynamic> json) {
  return _DashboardCreateDataSourceBase.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateDataSourceBase {
  /// Unique identifier for the data source (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateDataSourceBase to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateDataSourceBaseCopyWith<DashboardCreateDataSourceBase>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateDataSourceBaseCopyWith<$Res> {
  factory $DashboardCreateDataSourceBaseCopyWith(
          DashboardCreateDataSourceBase value,
          $Res Function(DashboardCreateDataSourceBase) then) =
      _$DashboardCreateDataSourceBaseCopyWithImpl<$Res,
          DashboardCreateDataSourceBase>;
  @useResult
  $Res call({String id});
}

/// @nodoc
class _$DashboardCreateDataSourceBaseCopyWithImpl<$Res,
        $Val extends DashboardCreateDataSourceBase>
    implements $DashboardCreateDataSourceBaseCopyWith<$Res> {
  _$DashboardCreateDataSourceBaseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCreateDataSourceBaseImplCopyWith<$Res>
    implements $DashboardCreateDataSourceBaseCopyWith<$Res> {
  factory _$$DashboardCreateDataSourceBaseImplCopyWith(
          _$DashboardCreateDataSourceBaseImpl value,
          $Res Function(_$DashboardCreateDataSourceBaseImpl) then) =
      __$$DashboardCreateDataSourceBaseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id});
}

/// @nodoc
class __$$DashboardCreateDataSourceBaseImplCopyWithImpl<$Res>
    extends _$DashboardCreateDataSourceBaseCopyWithImpl<$Res,
        _$DashboardCreateDataSourceBaseImpl>
    implements _$$DashboardCreateDataSourceBaseImplCopyWith<$Res> {
  __$$DashboardCreateDataSourceBaseImplCopyWithImpl(
      _$DashboardCreateDataSourceBaseImpl _value,
      $Res Function(_$DashboardCreateDataSourceBaseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
  }) {
    return _then(_$DashboardCreateDataSourceBaseImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardCreateDataSourceBaseImpl
    implements _DashboardCreateDataSourceBase {
  const _$DashboardCreateDataSourceBaseImpl({required this.id});

  factory _$DashboardCreateDataSourceBaseImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateDataSourceBaseImplFromJson(json);

  /// Unique identifier for the data source (optional during creation).
  @override
  final String id;

  @override
  String toString() {
    return 'DashboardCreateDataSourceBase(id: $id)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateDataSourceBaseImpl &&
            (identical(other.id, id) || other.id == id));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id);

  /// Create a copy of DashboardCreateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateDataSourceBaseImplCopyWith<
          _$DashboardCreateDataSourceBaseImpl>
      get copyWith => __$$DashboardCreateDataSourceBaseImplCopyWithImpl<
          _$DashboardCreateDataSourceBaseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCreateDataSourceBaseImplToJson(
      this,
    );
  }
}

abstract class _DashboardCreateDataSourceBase
    implements DashboardCreateDataSourceBase {
  const factory _DashboardCreateDataSourceBase({required final String id}) =
      _$DashboardCreateDataSourceBaseImpl;

  factory _DashboardCreateDataSourceBase.fromJson(Map<String, dynamic> json) =
      _$DashboardCreateDataSourceBaseImpl.fromJson;

  /// Unique identifier for the data source (optional during creation).
  @override
  String get id;

  /// Create a copy of DashboardCreateDataSourceBase
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateDataSourceBaseImplCopyWith<
          _$DashboardCreateDataSourceBaseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
