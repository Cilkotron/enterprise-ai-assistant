// All company data is fictional (Brightwave Media AG).
export interface HrPolicy {
	id: string;
	title: string;
	text: string;
}

export const HR_POLICIES: readonly HrPolicy[] = [
	{
		id: 'vacation',
		title: 'Vacation',
		text: '25 days per year plus 1 day for the patron saint day. Requests go through the HR portal; managers approve within 3 working days.',
	},
	{
		id: 'remote-work',
		title: 'Hybrid work',
		text: 'Up to 2 remote days per week, agreed with the team lead. Core hours 10:00-16:00.',
	},
	{
		id: 'parental-leave',
		title: 'Parental leave',
		text: '16 weeks paid leave for the primary caregiver, 4 weeks for the other parent.',
	},
	{
		id: 'equipment',
		title: 'Equipment',
		text: 'Every employee gets a laptop based on their equipment profile. Replacement cycle is 4 years.',
	},
];

export const EQUIPMENT_PROFILES = {
	designer: {
		profile: 'creative-workstation',
		laptop: 'MacBook Pro 16',
		software: ['Figma', 'Adobe Creative Cloud'],
		extras: ['External 4K monitor'],
	},
	developer: {
		profile: 'dev-workstation',
		laptop: 'ThinkPad P1',
		software: ['Docker', 'JetBrains IDE'],
		extras: [] as string[],
	},
	office: {
		profile: 'standard-office',
		laptop: 'ThinkPad T14',
		software: ['Microsoft 365'],
		extras: [] as string[],
	},
} as const;

export type EquipmentRole = keyof typeof EQUIPMENT_PROFILES;