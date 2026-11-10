import type { Dict } from '../en';

export const bank: Dict['bank'] = {
	pageTitle: 'Banco de WoDs',
	title: 'Banco',
	switch: { aria: 'WoDs: calendário ou banco', calendar: 'Calendário', bank: 'Banco' },
	list: {
		readingBank: 'Lendo o banco',
		count: (n) => (n === 1 ? '1 WoD no banco' : `${n} WoDs no banco`),
		couldNotRefresh: ' · não deu pra atualizar',
		newIdea: 'Nova ideia',
		search: 'Buscar no banco',
		searchPlaceholder: 'Buscar: sandbag, emom, burpees',
		format: 'Formato',
		all: 'Todos',
		idea: 'Ideia',
		loadingAria: 'Carregando o banco',
		emptyTitle: 'O banco tá vazio',
		emptyBody:
			'Guarda aqui os WoDs pra depois, sem data: um nome e a ideia por cima já bastam. Quando chegar a hora, coloca num dia.',
		emptyStale: 'O servidor não responde e ainda não tem nada do banco salvo neste celular.',
		tryAgain: 'Tentar de novo',
		firstIdea: 'Salvar a primeira ideia',
		noMatchTitle: 'Nada encontrado',
		noMatch: 'Nada no banco bate com essa busca.',
		clearSearch: 'Limpar busca',
		lastOn: (day) => `Última vez: ${day}`,
		nextOn: (day) => `Próxima: ${day}`,
		onToday: 'No quadro hoje',
		never: 'Nunca foi pro quadro',
		schedule: 'Colocar num dia',
		scheduleAria: (name) => `Colocar ${name} num dia`,
		edit: 'Editar',
		editAria: (name) => `Editar ${name}`,
		delete: 'Apagar',
		deleteAria: (name) => `Apagar ${name} do banco`,
		actionsAria: (name) => `Ações de ${name}`,
		pickingFor: (day) => `Escolhendo um WoD pra ${day}`,
		stopPicking: 'Qualquer dia',
		fromBank: 'ou escolhe do banco'
	},
	editor: {
		pageTitleNew: 'Nova ideia',
		pageTitleEdit: 'WoD do banco',
		newIdea: 'Nova ideia',
		editIdea: 'WoD do banco',
		save: 'Salvar no banco',
		saveShort: 'Salvar',
		saveChanges: 'Salvar',
		name: 'Nome',
		namePlaceholder: 'Chipper de sandbag, EMOM do Danilo',
		noDate: 'Sem data',
		nameRequired: 'Dá um nome.',
		nameTooLong: 'Nome longo demais (máx. 100).',
		briefPlaceholder:
			'A ideia por cima: movimentos, cargas, pra que serve. As partes podem vir depois.',
		sectionsEmpty:
			'Nenhuma parte ainda. Nome e ideia já bastam pra salvar; as partes (ou a Varinha) ficam pra quando chegar o dia.',
		stamp: 'Do banco',
		saved: 'Salvo no banco.',
		updated: 'WoD do banco atualizado.',
		saveFailed: 'Não deu pra salvar no banco. Nada se perdeu: tenta de novo.',
		back: 'Voltar pro banco'
	},
	schedule: {
		title: 'Colocar num dia',
		day: 'Dia',
		nextDays: 'Próximos dias',
		hasWod: 'WoD',
		dayAria: (day, taken) => (taken ? `${day}, já tem WoD` : day),
		alreadyHas: (day, titles) => `${day} já tem ${titles}. Este entra do lado.`,
		copies: (n) =>
			`Copia o nome, o recado e ${n === 1 ? '1 parte' : `${n} partes`}. O banco fica com a cópia dele pra próxima vez.`,
		copiesIdea:
			'Ainda não tem partes, então a cópia abre no editor pra você terminar. A ideia continua no banco.',
		submit: (day) => `Colocar na ${day}`,
		pickDay: 'Escolhe um dia',
		working: 'Colocando no quadro',
		cancel: 'Cancelar',
		done: (day) => `No quadro pra ${day}.`,
		failed: 'Não deu pra colocar nesse dia. Tenta de novo.'
	},
	save: {
		button: 'Salvar no banco',
		title: 'Salvar no banco',
		name: 'Nome no banco',
		copies: (n, day) =>
			`Copia o recado e ${n === 1 ? '1 parte' : `${n} partes`}. O WoD de ${day} fica como está.`,
		submit: 'Salvar no banco',
		saving: 'Salvando',
		cancel: 'Cancelar',
		done: (name) => `"${name}" tá no banco.`,
		failed: 'Não deu pra salvar no banco. Tenta de novo.'
	},
	remove: {
		title: 'Apagar do banco?',
		message: 'Só a cópia do banco vai embora. Os WoDs que já foram pra um dia continuam no quadro.',
		confirm: 'Apagar',
		deleting: 'Apagando',
		keep: 'Manter',
		deleted: (name) => `"${name}" apagado do banco.`,
		failed: 'Não deu pra apagar do banco.'
	},
	guard: {
		body: (box) =>
			`O banco de WoDs é onde os coaches do ${box} guardam treinos pra depois. Você vê eles no quadro quando forem programados.`,
		notFound: 'Não tá no banco',
		notFoundBody: 'Pode ter sido apagado, ou é de um box do qual você não faz parte.',
		notOnPhoneBody: 'Este WoD do banco não foi salvo aqui e o servidor não responde agora.',
		backToBank: 'Voltar pro banco'
	},
	api: {
		coachesOnly: 'Só os coaches usam o banco de WoDs.',
		notFound: 'Este WoD não está no banco.',
		alreadyExists: 'Este WoD já foi salvo no banco.'
	}
};
