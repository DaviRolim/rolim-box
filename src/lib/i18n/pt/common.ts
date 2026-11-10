import type { Dict } from '../en';

export const common: Dict['common'] = {
	appName: 'RolimBox',
	cancel: 'Cancelar',
	confirm: 'Confirmar',
	close: 'Fechar',
	dismiss: 'Fechar',
	save: 'Salvar',
	saving: 'Salvando',
	delete: 'Apagar',
	edit: 'Editar',
	back: 'Voltar',
	retry: 'Tentar de novo',
	loading: 'Carregando',
	less: (what) => `Menos ${what}`,
	more: (what) => `Mais ${what}`,
	roles: { owner: 'Dono', coach: 'Coach', member: 'Atleta' },
	pageTitle: (page) => `${page} - RolimBox`
};
