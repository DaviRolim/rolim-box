import type { Dict } from '../en';

export const editor: Dict['editor'] = {
	pageTitleNew: 'Novo WoD',
	pageTitleEdit: 'Editar WoD',
	newWod: 'Novo WoD',
	editWod: 'Editar WoD',
	status: { saving: 'Salvando', unsaved: 'Não salvo', blank: 'Em branco', saved: 'Salvo' },
	saveWod: 'Salvar WoD',
	save: 'Salvar',
	saveChanges: 'Salvar',
	saving: 'Salvando',
	cancel: 'Cancelar',
	back: 'Voltar',
	viewSwitch: 'Modo do editor',
	tabEdit: 'Editar',
	tabPreview: 'Prévia',
	when: 'Quando',
	date: 'Data',
	today: 'Hoje',
	tomorrow: 'Amanhã',
	sameDay: (date, titles) =>
		`${date} já tem ${titles.map((title) => `"${title}"`).join(' e ')}. Se salvar, o dia fica com dois WoDs.`,
	brief: {
		label: 'Recado do coach',
		placeholder: 'Qual é a do treino de hoje? A galera lê isso embaixo do nome do WoD.'
	},
	errors: {
		pickDate: 'Escolhe uma data.',
		briefTooLong: 'O recado ficou longo demais (máx. 500 caracteres).',
		noSections: 'Coloca pelo menos uma parte.',
		sectionsNeedName: 'Tem parte sem nome.',
		nameRequired: 'Dá um nome pra essa parte.',
		nameTooLong: 'Nome longo demais (máx. 100).',
		contentTooLong: 'Longo demais (máx. 2000 caracteres).'
	},
	wand: {
		button: 'Varinha Mágica',
		drafting: 'Montando',
		draftingAria: 'A Varinha Mágica está montando o treino',
		helpEmpty: 'Escreve uma ou duas linhas e a Varinha monta as partes pra você.',
		helpReady: 'Monta as partes a partir do recado. Dá pra editar ou desfazer tudo.',
		off: 'A Varinha Mágica não está configurada neste servidor (falta a OPENROUTER_API_KEY). O resto funciona normal: monta as partes na mão aqui embaixo.',
		offline: 'A Varinha Mágica precisa de internet. Você está offline.',
		failed: 'A Varinha não conseguiu montar esse. Tenta de novo.',
		empty: 'A Varinha voltou vazia. Detalha mais o recado.',
		unreachable: 'Não deu pra falar com o servidor. Confere a conexão e tenta de novo.',
		drafted: (n) =>
			`A Varinha montou ${n} ${n === 1 ? 'parte' : 'partes'}. Confere as cargas e ajusta o que não estiver certo.`,
		undo: 'Desfazer'
	},
	toast: {
		savedOffline: 'Salvo neste celular. Vai pro servidor quando a internet voltar.',
		updated: 'WoD atualizado.',
		savedFor: (date) => `WoD salvo pra ${date}.`,
		saveFailed: 'Não deu pra salvar este WoD. Nada se perdeu: tenta de novo.'
	},
	sections: {
		heading: 'Partes',
		parts: (n) => `${n} ${n === 1 ? 'parte' : 'partes'}`,
		removed: (name) => `"${name}" removida.`,
		section: 'parte',
		undo: 'Desfazer',
		empty: 'Nenhuma parte ainda. Começa pelo aquecimento ou vai direto pro WoD.',
		add: 'Adicionar parte',
		or: 'ou',
		addTypeAria: (type) => `Adicionar parte: ${type}`,
		shortcuts: '⌘S salvar · ⌘↵ nova parte · ⌥↑ ⌥↓ mover a parte atual'
	},
	preview: {
		aria: 'Prévia',
		heading: 'O que a galera vê',
		live: 'Ao vivo',
		empty: 'O quadro vai se montando enquanto você escreve.'
	},
	leave: {
		title: 'Sair sem salvar?',
		message: 'As mudanças que você fez neste WoD não foram salvas.',
		confirm: 'Descartar',
		cancel: 'Continuar editando'
	},
	section: {
		legend: (n, name) => `Parte ${n}: ${name}`,
		unnamed: 'sem nome',
		section: 'parte',
		typeLabel: (n) => `Tipo da parte ${n}`,
		moveUpAria: (name) => `Subir ${name}`,
		moveUpTitle: 'Subir (Alt+↑)',
		moveDownAria: (name) => `Descer ${name}`,
		moveDownTitle: 'Descer (Alt+↓)',
		removeAria: (name) => `Remover ${name}`,
		removeTitle: 'Remover parte',
		name: 'Nome',
		namePlaceholder: 'Fran, Força, Aquecimento',
		content: 'O que vai no quadro',
		contentHint: '· um movimento por linha',
		example: '21-15-9 for time:\nThrusters (43/30 kg)\nPull-ups\n\nTime cap: 10 min'
	},
	timer: {
		legend: 'Relógio',
		formatAria: 'Formato do relógio',
		none: 'Sem relógio',
		capMin: 'Cap (min)',
		minutes: 'Minutos',
		rounds: 'Rounds',
		every: 'A cada (s)',
		work: 'Work (s)',
		rest: 'Descanso (s)',
		total: (time) => `Total ${time}`
	},
	guard: {
		coachesOnly: 'Só coaches',
		title: 'Esse quadro não é seu',
		thisBox: 'este box',
		cannotProgram: (box) => `Só os coaches do ${box} programam WoDs. Mas você pode ver todos eles.`,
		cannotChange: (box) => `Só os coaches do ${box} podem mexer num WoD.`,
		backToToday: 'Voltar pra hoje',
		backToWod: 'Voltar pro WoD',
		loading: 'Carregando',
		loadingWod: 'Carregando o WoD',
		offline: 'Offline',
		notOnPhone: 'Não está no celular',
		notOnPhoneBody: 'Este WoD não está salvo aqui e o servidor não responde agora.',
		allWods: 'Todos os WoDs',
		notFound: 'WoD não encontrado',
		notFoundBody: 'Pode ter sido apagado, ou é de um box do qual você não faz parte.'
	},
	api: {
		wodNotFound: 'WoD não encontrado.',
		workspaceRequired: 'Escolhe um box primeiro.',
		membersCannotCreate: 'Só coaches programam WoDs.',
		membersCannotEdit: 'Só coaches podem mexer nos WoDs.',
		membersCannotDelete: 'Só coaches podem apagar WoDs.',
		membersCannotDuplicate: 'Só coaches podem copiar WoDs.',
		alreadyExists: 'Este WoD já foi salvo.',
		coachesOnlyWand: 'Só coaches podem usar a Varinha Mágica.',
		wandNotConfigured:
			'A Varinha Mágica ainda não está configurada neste servidor. Dá pra montar as partes na mão.',
		wandNoSections: 'Não deu pra montar as partes com essa descrição. Detalha mais.',
		wandKeyRejected:
			'A chave da Varinha Mágica foi recusada. Confere a OPENROUTER_API_KEY no servidor.',
		rateLimited: 'Muitos pedidos de uma vez. Espera um pouco e tenta de novo.',
		wandFailed: 'A Varinha não conseguiu montar esse. Tenta de novo.'
	}
};
