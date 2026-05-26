export const SETTINGS_STORAGE_KEY = 'zodiac-settings';
export const SETTINGS_UPDATED_EVENT = 'zodiac:settings-updated';
export const WAITING_AUDIO_STATE_EVENT = 'zodiac:waiting-audio-state';

export type WaitingAudioStateDetail = {
	isActive: boolean;
};

export type GameSettingsState = {
	masterVolume: number;
	musicVolume: number;
	sfxVolume: number;
	highQuality: boolean;
	showAnimations: boolean;
	reduceMotion: boolean;
};

export const defaultGameSettings: GameSettingsState = {
	masterVolume: 80,
	musicVolume: 60,
	sfxVolume: 70,
	highQuality: true,
	showAnimations: true,
	reduceMotion: false
};

export const loadGameSettings = (): GameSettingsState => {
	if (typeof window === 'undefined') return defaultGameSettings;

	try {
		const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
		if (!raw) return defaultGameSettings;
		return { ...defaultGameSettings, ...JSON.parse(raw) };
	} catch {
		return defaultGameSettings;
	}
};

export const saveGameSettings = (settings: GameSettingsState) => {
	try {
		localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
		}
	} catch {
		// Ignore localStorage failures quietly.
	}
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

export const getEffectiveMusicVolume = (settings: GameSettingsState): number => {
	const master = clampPercent(settings.masterVolume) / 100;
	const music = clampPercent(settings.musicVolume) / 100;
	return master * music;
};

export const getEffectiveSfxVolume = (settings: GameSettingsState): number => {
	const master = clampPercent(settings.masterVolume) / 100;
	const sfx = clampPercent(settings.sfxVolume) / 100;
	return master * sfx;
};
