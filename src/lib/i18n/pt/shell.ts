import type { Dict } from '../en';

export const shell: Dict['shell'] = {
	nav: { today: 'Hoje', wods: 'WoDs', clock: 'Relógio', prs: 'PRs' },
	mainNav: 'Principal',
	homeLink: 'RolimBox, hoje',
	newWod: 'Novo WoD',
	settings: 'Ajustes',
	logOut: 'Sair',
	offlineStrip: 'Sem internet. Mostrando o que está salvo neste celular.',
	refused: (n) =>
		n === 1
			? '1 alteração foi recusada pelo servidor.'
			: `${n} alterações foram recusadas pelo servidor.`,
	review: 'Ver',
	language: 'Idioma',
	languageNames: { en: 'English', pt: 'Português' },
	sync: {
		offline: 'Offline',
		refused: (n) => (n === 1 ? '1 recusada' : `${n} recusadas`),
		unreachable: 'Sem servidor',
		syncing: 'Enviando',
		pending: (n) => `${n} p/ enviar`,
		synced: 'Em dia',
		aria: (label) => `Sincronização: ${label}. Abrir ajustes.`
	},
	box: {
		label: 'Box',
		switchAria: (name) => `Box: ${name}. Trocar de box.`,
		switchTitle: 'Trocar de box',
		youTrainIn: (n) => `Você treina em ${n} boxes`,
		switching: 'Trocando',
		switchFailed: 'Não deu pra trocar de box. Confere a conexão e tenta de novo.'
	}
};
