import React from "react";

function BotMessage({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex items-start gap-2">
			<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e85a4f]/20 text-sm">
				🤖
			</div>
			<div className="rounded-lg border border-white/10 bg-[#141a26] px-3 py-2 text-sm text-gray-300">
				{children}
			</div>
		</div>
	);
}

function UserMessage({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-row-reverse items-start gap-2">
			<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e85a4f]/20 text-sm">
				👤
			</div>
			<div className="rounded-lg bg-[#e85a4f]/15 px-3 py-2 text-sm text-gray-300">{children}</div>
		</div>
	);
}

function Accent({ children }: { children: React.ReactNode }) {
	return <span className="font-bold text-[#e85a4f]">{children}</span>;
}

export function ChatMockup() {
	return (
		<div className="relative rounded-xl border border-white/10 bg-[#1a2130] p-4">
			<div className="flex flex-col gap-3">
				<BotMessage>
					Good evening! Lights are at <Accent>90%</Accent>. You usually dim them around this time — want me to
					set them to 30%?
				</BotMessage>

				<UserMessage>Yes, and set the temperature to 22°.</UserMessage>

				<BotMessage>
					Done! Lights at <Accent>30%</Accent>, thermostat set to <Accent>22°C</Accent>. Room temp is 19.4°C —
					target in ~15 min.
				</BotMessage>
			</div>

			<div className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#e85a4f] text-lg shadow-lg">
				🤖
			</div>
		</div>
	);
}
