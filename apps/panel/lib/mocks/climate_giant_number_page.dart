import 'package:flutter/material.dart';

/// Climate domain page with "Giant Number" hero style.
///
/// This widget renders the full climate page layout including:
/// - Domain header with icon, title, subtitle, and action button
/// - Hero card with oversized temperature, gradient range bar, and +/- controls
/// - Sensors section (temperature, humidity)
/// - Auxiliary devices section
///
/// Designed for SmartPanel portrait layout (360×720 reference).
class ClimateGiantNumberPage extends StatelessWidget {
  const ClimateGiantNumberPage({super.key});

  // ── Design tokens ──────────────────────────────────────────────
  static const _green = Color(0xFF4CAF50);
  static const _greenBg = Color(0x1A4CAF50);
  static const _coral = Color(0xFFE85A4F);
  static const _coralBg = Color(0x1AE85A4F);
  static const _coralBgStrong = Color(0x2EE85A4F);
  static const _blue = Color(0xFF2196F3);
  static const _blueBg = Color(0x1A2196F3);
  static const _surfaceDim = Color(0xFFEEEAE5);
  static const _textPrimary = Color(0xFF2C2C2C);
  static const _textSecondary = Color(0xFF999999);
  static const _textHint = Color(0xFFBBBBBB);
  static const _border = Color(0x0F000000);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF5F0EB),
      child: Column(
        children: [
          // ── Header ───────────────────────────────────────────
          _buildHeader(),

          // ── Scrollable content ───────────────────────────────
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHeroCard(),
                  const SizedBox(height: 10),
                  _buildSectionTitle('Sensors'),
                  const SizedBox(height: 8),
                  _buildSensorRow(),
                  const SizedBox(height: 10),
                  _buildSectionTitle('Auxiliary'),
                  const SizedBox(height: 8),
                  _buildAuxRow(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Header ─────────────────────────────────────────────────────

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 12),
      child: Row(
        children: [
          // Domain icon
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: _greenBg,
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Center(
              child: Icon(Icons.thermostat, color: _green, size: 24),
            ),
          ),
          const SizedBox(width: 12),

          // Title & subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Climate',
                  style: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w700,
                    color: _textPrimary,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  'Idle · 21,0°C',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    color: _green,
                  ),
                ),
              ],
            ),
          ),

          // Home button
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(color: _border),
            ),
            child: const Center(
              child: Icon(Icons.home_outlined, color: Color(0xFF666666), size: 20),
            ),
          ),
        ],
      ),
    );
  }

  // ── Hero Card ──────────────────────────────────────────────────

  Widget _buildHeroCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _border),
      ),
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
      child: Column(
        children: [
          // AUTO badge
          _buildModeBadge(),
          const SizedBox(height: 12),

          // Giant temperature number
          _buildGiantTemp(),
          const SizedBox(height: 20),

          // Gradient range bar
          _buildRangeBar(),
          const SizedBox(height: 6),

          // Range labels
          _buildRangeLabels(),
          const SizedBox(height: 16),

          // Controls row: − Target +
          _buildControlsRow(),
        ],
      ),
    );
  }

  Widget _buildModeBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: _greenBg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: _green,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          const Text(
            'AUTO',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: _green,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGiantTemp() {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        const Text(
          '21',
          style: TextStyle(
            fontSize: 104,
            fontWeight: FontWeight.w200,
            color: _textPrimary,
            height: 1,
            letterSpacing: -5,
          ),
        ),
        const Positioned(
          top: 10,
          right: -28,
          child: Text(
            '°C',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w300,
              color: _textSecondary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRangeBar() {
    return SizedBox(
      height: 22,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Gradient track
          Positioned(
            top: 8,
            left: 0,
            right: 0,
            child: Container(
              height: 6,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(3),
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFF4FC3F7), // cool blue
                    Color(0xFF81C784), // green
                    Color(0xFFFFB74D), // orange
                    Color(0xFFE57373), // red
                  ],
                ),
              ),
            ),
          ),

          // Thumb pointer at ~42%
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final thumbLeft = constraints.maxWidth * 0.42 - 8;
                return Stack(
                  children: [
                    Positioned(
                      left: thumbLeft,
                      child: Container(
                        width: 16,
                        height: 16,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: _green, width: 3),
                          boxShadow: [
                            BoxShadow(
                              color: _green.withValues(alpha: 0.3),
                              blurRadius: 6,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRangeLabels() {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text('16°', style: TextStyle(fontSize: 9.5, color: _textHint)),
        Text('20°', style: TextStyle(fontSize: 9.5, color: _textHint)),
        Text('24°', style: TextStyle(fontSize: 9.5, color: _textHint)),
        Text('28°', style: TextStyle(fontSize: 9.5, color: _textHint)),
      ],
    );
  }

  Widget _buildControlsRow() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Minus button
        _buildAdjustButton(Icons.remove),
        const SizedBox(width: 24),

        // Target label
        const Text(
          'Target 21,0°C',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: _green,
          ),
        ),
        const SizedBox(width: 24),

        // Plus button
        _buildAdjustButton(Icons.add),
      ],
    );
  }

  Widget _buildAdjustButton(IconData icon) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: _border, width: 1.5),
      ),
      child: Center(
        child: Icon(icon, color: _textSecondary, size: 20),
      ),
    );
  }

  // ── Section Title ──────────────────────────────────────────────

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: _textSecondary,
        ),
      ),
    );
  }

  // ── Sensors Row ────────────────────────────────────────────────

  Widget _buildSensorRow() {
    return Row(
      children: [
        Expanded(
          child: _buildSensorChip(
            icon: Icons.thermostat_outlined,
            iconColor: _blue,
            iconBg: _blueBg,
            value: '18,7°C',
            label: 'Temp',
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildSensorChip(
            icon: Icons.water_drop_outlined,
            iconColor: _green,
            iconBg: _greenBg,
            value: '35%',
            label: 'Humidity',
          ),
        ),
      ],
    );
  }

  Widget _buildSensorChip({
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String value,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Center(
              child: Icon(icon, color: iconColor, size: 18),
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: _textPrimary,
                ),
              ),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w500,
                  color: _textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Auxiliary Row ──────────────────────────────────────────────

  Widget _buildAuxRow() {
    return Row(
      children: [
        Expanded(
          child: _buildAuxChip(
            icon: Icons.air,
            name: 'Air Purifier',
            status: 'On',
            isActive: true,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _buildAuxChip(
            icon: Icons.toys_outlined,
            name: 'Couch Fan',
            status: 'Off',
            isActive: false,
          ),
        ),
      ],
    );
  }

  Widget _buildAuxChip({
    required IconData icon,
    required String name,
    required String status,
    required bool isActive,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isActive ? _coralBg : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isActive ? _coralBgStrong : _border,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: isActive ? _coralBgStrong : _surfaceDim,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Center(
              child: Icon(
                icon,
                color: isActive ? _coral : _textSecondary,
                size: 18,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isActive ? _coral : _textPrimary,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  status,
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: _textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
