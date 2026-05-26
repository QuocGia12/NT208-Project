'use client';

import { useEffect, useRef } from 'react';

import {
	SETTINGS_STORAGE_KEY,
	SETTINGS_UPDATED_EVENT,
	getEffectiveSfxVolume,
	loadGameSettings
} from '@/lib/game-audio-settings';

export const GlobalClickSfx = () => {
	const audioContextRef = useRef<AudioContext | null>(null);
	const gainRef = useRef<number>(0);

	useEffect(() => {
		const updateGain = () => {
			const settings = loadGameSettings();
			gainRef.current = getEffectiveSfxVolume(settings);
		};

		updateGain();

		const handleSettingsUpdated = () => {
			updateGain();
		};

		const handleStorage = (event: StorageEvent) => {
			if (event.key !== SETTINGS_STORAGE_KEY) return;
			updateGain();
		};

		const handleButtonClick = (event: MouseEvent) => {
			const target = event.target as Element | null;
			const clickable = target?.closest(
				'button, a[href], [role="button"], input[type="button"], input[type="submit"], input[type="reset"], [data-click-sfx]'
			);
			if (!clickable) return;

			if (
				clickable instanceof HTMLButtonElement &&
				(clickable.disabled || clickable.hasAttribute('disabled'))
			) {
				return;
			}

			if (
				clickable instanceof HTMLInputElement &&
				(clickable.disabled || clickable.hasAttribute('disabled'))
			) {
				return;
			}

			if (clickable.getAttribute('aria-disabled') === 'true') {
				return;
			}

			const volume = gainRef.current;
			if (volume <= 0) return;

			try {
				if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
					audioContextRef.current = new AudioContext();
				}

				const context = audioContextRef.current;
				if (context.state === 'suspended') {
					void context.resume();
				}

				const now = context.currentTime;
				const oscillator = context.createOscillator();
				const accentOscillator = context.createOscillator();
				const gain = context.createGain();

				oscillator.type = 'triangle';
				oscillator.frequency.setValueAtTime(1200, now);
				oscillator.frequency.exponentialRampToValueAtTime(680, now + 0.08);

				accentOscillator.type = 'square';
				accentOscillator.frequency.setValueAtTime(2400, now);
				accentOscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.03);

				gain.gain.setValueAtTime(Math.max(0.001, volume * 0.42), now);
				gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);

				oscillator.connect(gain);
				accentOscillator.connect(gain);
				gain.connect(context.destination);

				oscillator.start(now);
				accentOscillator.start(now);
				oscillator.stop(now + 0.095);
				accentOscillator.stop(now + 0.03);
			} catch {
				// Ignore sound-playback issues quietly.
			}
		};

		document.addEventListener('click', handleButtonClick, true);
		window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
		window.addEventListener('storage', handleStorage);

		return () => {
			document.removeEventListener('click', handleButtonClick, true);
			window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
			window.removeEventListener('storage', handleStorage);
			void audioContextRef.current?.close();
			audioContextRef.current = null;
		};
	}, []);

	return null;
};
