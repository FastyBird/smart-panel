export function PhoneMockup() {
	return (
		<div
			className="w-[280px] rounded-[26px] border-2 border-white/[0.13] overflow-hidden"
			style={{
				boxShadow: '0 40px 90px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
			}}
		>
			{/* Sky / Weather Section */}
			<div className="relative overflow-hidden px-[18px] pt-[26px] pb-5" style={{ background: 'linear-gradient(180deg, #08111e, #101c2e)' }}>
				{/* Moon */}
				<div
					className="absolute top-[10px] right-[12px] w-[15px] h-[15px] rounded-full"
					style={{
						background: 'radial-gradient(circle at 35% 35%, #fff8e8, #f0d080)',
						boxShadow: '0 0 8px 3px rgba(240,200,80,0.28)',
					}}
				/>
				{/* Rain overlay */}
				<div className="phone-mockup-rain absolute inset-0 pointer-events-none opacity-[0.18]" />

				<div className="relative z-10 text-center">
					<div className="font-syne text-[2.2rem] font-bold text-white leading-none">19:09</div>
					<div className="text-[0.7rem] text-white/55 mt-0.5">Tuesday, 17 March</div>
					<div className="flex items-center justify-center gap-[5px] mt-[10px]">
						<span
							className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[0.65rem] text-white/75"
							style={{
								background: 'rgba(0,0,0,0.3)',
								backdropFilter: 'blur(8px)',
								border: '1px solid rgba(255,255,255,0.1)',
							}}
						>
							🌧 6° slight rain
						</span>
					</div>
				</div>
			</div>

			{/* Sensor Strip */}
			<div className="flex items-center justify-center gap-[6px] bg-[#dde2ea] px-[10px] py-[6px]">
				<SensorChip icon="🌡" value="20.3°C" />
				<SensorChip icon="💧" value="34%" />
				<SensorChip icon="⚡" value="0.0 kWh" />
			</div>

			{/* Tiles Grid */}
			<div className="grid grid-cols-2 gap-2 bg-[#edf0f5] p-[10px]">
				<Tile icon="💡" iconBg="rgba(249,115,22,0.12)" label="Lights" value="Custom"
					chips={[{ text: "Off", cls: "chip-orange" }, { text: "50%", cls: "chip-orange" }, { text: "100%", cls: "chip-orange" }]} />
				<Tile icon="🌡" iconBg="rgba(59,130,246,0.12)" label="Climate" value="21.0°C"
					chips={[{ text: "Cool", cls: "chip-blue" }, { text: "−", cls: "chip-blue" }, { text: "+", cls: "chip-blue" }]} />
				<Tile icon="⬛" iconBg="rgba(20,184,166,0.12)" label="Shading" value="Custom"
					chips={[{ text: "Open", cls: "chip-teal" }, { text: "50%", cls: "chip-teal" }, { text: "Close", cls: "chip-teal" }]} />
				<Tile icon="🛡" iconBg="rgba(232,90,79,0.12)" label="Security" value="Armed"
					chips={[{ text: "Arm", cls: "chip-red" }, { text: "Disarm", cls: "chip-red" }]} />
			</div>

			{/* Bottom Navigation */}
			<div className="flex items-center border-t border-gray-200 bg-white py-[7px] px-[4px]">
				<NavItem icon="🏠" label="Home" active />
				<NavItem icon="🚪" label="Rooms" />
				<NavItem icon="▦" label="Tiles" />
				<NavItem icon="⚙" label="Settings" />
			</div>
		</div>
	);
}

function SensorChip({ icon, value }: { icon: string; value: string }) {
	return (
		<span className="flex items-center gap-[3px] bg-white rounded-full px-2 py-[3px] text-[0.58rem] font-semibold text-gray-500 shadow-sm">
			{icon} {value}
		</span>
	);
}

interface ChipData {
	text: string;
	cls: string;
}

const chipColors: Record<string, { bg: string; border: string; color: string }> = {
	"chip-orange": { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)", color: "#b45309" },
	"chip-blue": { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", color: "#1d4ed8" },
	"chip-teal": { bg: "rgba(20,184,166,0.1)", border: "rgba(20,184,166,0.3)", color: "#0f766e" },
	"chip-red": { bg: "rgba(232,90,79,0.1)", border: "rgba(232,90,79,0.3)", color: "#b91c1c" },
};

function Tile({ icon, iconBg, label, value, chips }: { icon: string; iconBg: string; label: string; value: string; chips: ChipData[] }) {
	return (
		<div className="bg-white rounded-[11px] p-[9px] shadow-sm">
			<div className="flex items-start gap-[5px] mb-[2px]">
				<span
					className="w-[22px] h-[22px] rounded-[6px] flex items-center justify-center text-[11px]"
					style={{ background: iconBg }}
				>
					{icon}
				</span>
				<span className="text-[0.55rem] text-gray-400 font-medium mt-[3px]">{label}</span>
			</div>
			<div className="text-[0.7rem] font-bold text-gray-800 mb-[5px]">{value}</div>
			<div className="flex gap-[3px]">
				{chips.map((chip) => {
					const c = chipColors[chip.cls] || chipColors["chip-orange"];
					return (
						<span
							key={chip.text}
							className="px-[5px] py-[2px] rounded text-[0.53rem] font-semibold"
							style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
						>
							{chip.text}
						</span>
					);
				})}
			</div>
		</div>
	);
}

function NavItem({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
	return (
		<div className={`flex-1 flex flex-col items-center text-[0.42rem] ${active ? 'text-[#e85a4f]' : 'text-gray-300'}`}>
			<span className="text-sm">{icon}</span>
			<span>{label}</span>
		</div>
	);
}
