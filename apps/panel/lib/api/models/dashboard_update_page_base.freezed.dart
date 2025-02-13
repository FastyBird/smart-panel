// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_update_page_base.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardUpdatePageBase _$DashboardUpdatePageBaseFromJson(
    Map<String, dynamic> json) {
  return _DashboardUpdatePageBase.fromJson(json);
}

/// @nodoc
mixin _$DashboardUpdatePageBase {
  /// The title of the page.
  String get title => throw _privateConstructorUsedError;

  /// The display order of the page.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardUpdatePageBase to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardUpdatePageBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardUpdatePageBaseCopyWith<DashboardUpdatePageBase> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardUpdatePageBaseCopyWith<$Res> {
  factory $DashboardUpdatePageBaseCopyWith(DashboardUpdatePageBase value,
          $Res Function(DashboardUpdatePageBase) then) =
      _$DashboardUpdatePageBaseCopyWithImpl<$Res, DashboardUpdatePageBase>;
  @useResult
  $Res call({String title, int order, String? icon});
}

/// @nodoc
class _$DashboardUpdatePageBaseCopyWithImpl<$Res,
        $Val extends DashboardUpdatePageBase>
    implements $DashboardUpdatePageBaseCopyWith<$Res> {
  _$DashboardUpdatePageBaseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardUpdatePageBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardUpdatePageBaseImplCopyWith<$Res>
    implements $DashboardUpdatePageBaseCopyWith<$Res> {
  factory _$$DashboardUpdatePageBaseImplCopyWith(
          _$DashboardUpdatePageBaseImpl value,
          $Res Function(_$DashboardUpdatePageBaseImpl) then) =
      __$$DashboardUpdatePageBaseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String title, int order, String? icon});
}

/// @nodoc
class __$$DashboardUpdatePageBaseImplCopyWithImpl<$Res>
    extends _$DashboardUpdatePageBaseCopyWithImpl<$Res,
        _$DashboardUpdatePageBaseImpl>
    implements _$$DashboardUpdatePageBaseImplCopyWith<$Res> {
  __$$DashboardUpdatePageBaseImplCopyWithImpl(
      _$DashboardUpdatePageBaseImpl _value,
      $Res Function(_$DashboardUpdatePageBaseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardUpdatePageBase
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardUpdatePageBaseImpl(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardUpdatePageBaseImpl implements _DashboardUpdatePageBase {
  const _$DashboardUpdatePageBaseImpl(
      {required this.title, required this.order, this.icon});

  factory _$DashboardUpdatePageBaseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdatePageBaseImplFromJson(json);

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardUpdatePageBase(title: $title, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdatePageBaseImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, title, order, icon);

  /// Create a copy of DashboardUpdatePageBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdatePageBaseImplCopyWith<_$DashboardUpdatePageBaseImpl>
      get copyWith => __$$DashboardUpdatePageBaseImplCopyWithImpl<
          _$DashboardUpdatePageBaseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdatePageBaseImplToJson(
      this,
    );
  }
}

abstract class _DashboardUpdatePageBase implements DashboardUpdatePageBase {
  const factory _DashboardUpdatePageBase(
      {required final String title,
      required final int order,
      final String? icon}) = _$DashboardUpdatePageBaseImpl;

  factory _DashboardUpdatePageBase.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdatePageBaseImpl.fromJson;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardUpdatePageBase
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdatePageBaseImplCopyWith<_$DashboardUpdatePageBaseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
