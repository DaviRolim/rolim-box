import type { Dict } from '../en';

export const today: Dict['today'] = {
	dashboard: {
		title: 'Hoje',
		inDays: (n) => (n === 1 ? 'Daqui a 1 dia' : `Daqui a ${n} dias`),
		daysAgo: (n) => (n === 1 ? 'Há 1 dia' : `Há ${n} dias`),
		backToToday: 'Voltar pra hoje',
		loadingAria: 'Carregando o WoD',
		readingBoard: 'Lendo o quadro',
		wodsOnDay: 'WoDs deste dia',
		edit: 'Editar',
		duplicate: 'Duplicar',
		offline: 'Offline',
		noAnswer: 'O servidor não respondeu',
		blankTitle: 'Quadro em branco',
		blankBody:
			'Este celular ainda não salvou nenhum WoD e o servidor não responde. Conecta uma vez e da próxima vez tá tudo aqui, com sinal ou sem.',
		trying: 'Tentando',
		tryAgain: 'Tentar de novo',
		emptyTitle: 'Nada no quadro',
		noneProgrammed: (day) => `Nenhum WoD programado pra ${day}.`,
		noneWas: (day) => `Não teve WoD em ${day}.`,
		notPostedToday: 'Os coaches ainda não postaram o WoD de hoje. Aparece aqui assim que postarem.',
		notPostedDay: (day) =>
			`Os coaches ainda não postaram o WoD de ${day}. Aparece aqui assim que postarem.`,
		programToday: 'Programar hoje',
		programDay: (day) => `Programar ${day}`,
		nextUp: (day, title) => `Próximo: ${day} · ${title}`
	},
	view: {
		placarMode: 'Modo placar',
		runningOrder: 'Ordem do treino',
		parts: (n) => (n === 1 ? '1 parte' : `${n} partes`),
		noSections: 'Este WoD ainda não tem partes.'
	},
	poster: {
		format: (a, b) => `Formato: ${a}, ${b}`,
		fromCoach: 'Recado do coach'
	},
	section: {
		startClock: 'Iniciar relógio'
	},
	placar: {
		dialog: (name) => `Modo placar: ${name}`,
		close: 'Fechar o modo placar',
		previous: 'Parte anterior',
		next: 'Próxima parte',
		startClock: 'Iniciar relógio',
		noClock: 'Sem relógio nesta parte'
	},
	week: {
		pickDay: 'Escolha um dia',
		previousWeek: 'Semana anterior',
		nextWeek: 'Próxima semana',
		todaySuffix: ', hoje',
		hasWod: ', tem WoD',
		nothing: ', nada programado'
	},
	duplicate: {
		title: 'Duplicar',
		copyTo: 'Copiar para',
		today: 'Hoje',
		tomorrow: 'Amanhã',
		sameDayNextWeek: 'Mesmo dia, semana que vem',
		copied: (day) => `Copiado para ${day}.`,
		failed: 'Não deu pra duplicar este WoD.',
		alreadyHas: (day, n, titles) =>
			`${day} já tem ${n === 1 ? 'um WoD' : `${n} WoDs`} (${titles}). A cópia entra do lado.`,
		copying: 'Copiando',
		submit: 'Duplicar WoD',
		cancel: 'Cancelar'
	},
	list: {
		title: 'WoDs',
		readingBoard: 'Lendo o quadro',
		onBoard: (n) => `${n} no quadro`,
		couldNotRefresh: ' · não deu pra atualizar',
		newWod: 'Novo WoD',
		search: 'Buscar WoDs',
		searchPlaceholder: 'Buscar: fran, thrusters, emom',
		format: 'Formato',
		all: 'Todos',
		loadingAria: 'Carregando WoDs',
		emptyTitle: 'Nenhum WoD ainda',
		emptyStale: 'O servidor não responde e ainda não tem nada salvo neste celular.',
		emptyCoach:
			'O quadro deste box tá vazio. Programa o primeiro e ele aparece no celular de todo mundo.',
		emptyAthlete: 'Os coaches ainda não programaram nada neste box.',
		tryAgain: 'Tentar de novo',
		programFirst: 'Programar o primeiro WoD',
		noMatchTitle: 'Nada encontrado',
		noMatch: 'Nada no quadro bate com essa busca.',
		clearSearch: 'Limpar busca',
		duplicate: 'Duplicar',
		edit: 'Editar',
		delete: 'Apagar',
		duplicateAria: (title, day) => `Duplicar ${title}, ${day}`,
		editAria: (title, day) => `Editar ${title}, ${day}`,
		deleteAria: (title, day) => `Apagar ${title}, ${day}`,
		actionsAria: (title, day) => `Ações de ${title}, ${day}`,
		saveToBankAria: (title, day) => `Salvar ${title}, ${day}, no banco`,
		fromBankAria: (day) => `Escolher um WoD do banco pra ${day}`,
		programToday: 'Programar hoje',
		programDay: (weekday) => `Programar ${weekday}`,
		nothingYet: '· nada no quadro ainda',
		showOlder: (n) => `Ver WoDs mais antigos (mais ${n})`
	},
	detail: {
		allWods: 'Todos os WoDs',
		today: 'Hoje',
		edit: 'Editar',
		duplicate: 'Duplicar',
		delete: 'Apagar',
		deleteAria: 'Apagar este WoD',
		loadingAria: 'Carregando o WoD',
		offline: 'Offline',
		notHereTitle: 'Não tá neste celular',
		notHereBody:
			'Este WoD não foi salvo aqui e o servidor não responde agora. Ele abre assim que tiver conexão.',
		backToToday: 'Voltar pra hoje',
		notFoundTitle: 'WoD não encontrado',
		notFoundBody: 'Pode ter sido apagado, ou é de um box do qual você não faz parte.'
	},
	remove: {
		title: 'Apagar este WoD?',
		message: 'Ele some do quadro de todo mundo. Não dá pra desfazer.',
		deleting: 'Apagando',
		confirm: 'Apagar WoD',
		keep: 'Manter',
		deleted: (title) => `"${title}" apagado.`,
		failed: 'Não deu pra apagar este WoD.'
	}
};
