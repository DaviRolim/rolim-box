import type { Dict } from '../en';

export const prs: Dict['prs'] = {
	title: 'PRs',
	categories: {
		weightlifting: 'LPO',
		benchmark: 'Benchmarks',
		gymnastics: 'Ginástica',
		cardio: 'Cardio'
	},
	measurements: { weight: 'Carga', time: 'Tempo', reps: 'Reps', distance: 'Distância' },
	repsUnit: 'reps',

	page: {
		reading: 'Lendo o quadro',
		logged: (done, total) => `${done} de ${total} marcados`,
		import: 'Importar',
		tabsLabel: 'Recordes pessoais',
		tabMine: 'Meus PRs',
		tabLeaderboard: 'Ranking',
		loadingPrs: 'Carregando PRs',
		loadFailed:
			'Não deu pra carregar a lista de exercícios. Ela ainda não está salva neste celular e o servidor não respondeu.',
		searchLabel: 'Buscar exercício',
		searchPlaceholder: 'Busque: snatch, fran, pull-up',
		categoryGroup: 'Categoria',
		recorded: 'Marcados',
		searchResults: 'Resultados',
		noMatch: 'Nada encontrado',
		noMatchBody: 'Nenhum exercício com esse nome.',
		clearSearch: 'Limpar busca',
		noPrsYet: 'Nenhum PR ainda',
		noPrsBody:
			'Escolhe uma categoria, toca no movimento e marca o seu melhor. Vai direto pro ranking do box.',
		logFirst: 'Marcar o primeiro',
		nothingHere: 'Nada aqui',
		emptyCategory: 'Essa categoria não tem exercícios.',
		noPrYet: 'Sem PR ainda',
		log: 'Marcar',
		noBox: 'Sem box',
		noBoxBody: 'O ranking é de um box. Entra em um pra ver onde você está.',
		saved: 'PR salvo!',
		deleted: 'PR apagado',
		imported: 'PRs importados!'
	},

	modal: {
		logNew: 'Marcar novo PR',
		best: (mark) => `Melhor ${mark}`,
		weightLabel: (unit) => `Carga (${unit})`,
		timeLabel: 'Tempo (mm:ss)',
		repsLabel: 'Reps',
		distanceLabel: (unit) => `Distância (${unit})`,
		date: 'Data',
		note: 'Obs.',
		notePlaceholder: 'Tava forte, com cinto, dia de campeonato',
		addNote: 'Adicionar obs.',
		timeFormatError: 'Escreve o tempo como minutos:segundos, tipo 5:30.',
		numberError: 'Coloca um número maior que zero.',
		saveFailed: 'Não deu pra salvar esse PR. Tenta de novo.',
		savePr: 'Salvar PR',
		history: 'Histórico',
		loadingHistory: 'Carregando histórico',
		emptyHistory: 'Nada marcado ainda. O primeiro é sempre PR.',
		bestTag: 'Melhor',
		deleteAria: (date) => `Apagar o PR de ${date}`,
		inTheBox: 'No box',
		loadingRanking: 'Carregando o ranking',
		youAre: 'Você está em',
		placeOf: (place, total) => `${place} de ${total}`,
		onThisOne: 'nesse aqui.',
		logToRank: 'Marca um PR pra entrar nesse ranking.',
		rankedMore: (n) => `${n} no ranking · a lista completa está no Ranking`,
		nobodyYet: 'Ninguém do box marcou esse ainda. Seja o primeiro.',
		rankingOffline: 'O ranking do box precisa de internet e não carregou.',
		deleteTitle: 'Apagar esse PR?',
		deleteMessage: 'Essa marca sai do seu histórico e do ranking do box. Não dá pra desfazer.',
		deleting: 'Apagando',
		deletePr: 'Apagar PR',
		keepIt: 'Deixa assim'
	},

	import: {
		title: 'Importar PRs',
		stepUpload: 'Passo 1 de 2 · imagem',
		stepReview: 'Passo 2 de 2 · conferir',
		readingImage: 'Lendo a imagem',
		saving: 'Salvando',
		pick: 'Escolher print',
		pickBody:
			'Um print da lista de PRs de outro app ou de uma nota. Solta aqui ou toca pra escolher.',
		fileRules: 'PNG, JPG ou WEBP · até 5 MB',
		previewAlt: 'O print que você escolheu',
		remove: 'Tirar',
		readingTitle: 'Lendo seus PRs',
		savingTitle: 'Salvando seus PRs',
		readingBody: 'Ligando cada linha a um exercício. Leva uns segundos.',
		almostThere: 'Quase lá.',
		found: (n) => `${n} ${n === 1 ? 'PR encontrado' : 'PRs encontrados'}`,
		selected: (n) => (n === 1 ? '1 marcado' : `${n} marcados`),
		skipped: (n) => (n === 1 ? '1 ignorado' : `${n} ignorados`),
		conflicts: (n) =>
			n === 1
				? '1 linha marcada substitui um PR que você já tem.'
				: `${n} linhas marcadas substituem PRs que você já tem.`,
		checkThis: 'Confere',
		unsure: 'Incerto',
		readAs: (text) => `Lido como: ${text}`,
		replaces: 'Substitui',
		valueFor: (name) => `Valor de ${name}`,
		unmatched: (n) =>
			n === 1 ? '1 linha não foi reconhecida' : `${n} linhas não foram reconhecidas`,
		readImage: 'Ler a imagem',
		importN: (n) => `Importar ${n} ${n === 1 ? 'PR' : 'PRs'}`,
		working: 'Trabalhando',
		wrongType: 'Escolhe uma imagem PNG, JPG ou WEBP.',
		tooBig: 'A imagem precisa ter menos de 5 MB.',
		analyzeFailed: 'Não deu pra ler a imagem. Tenta de novo.',
		nothingFound:
			'Nenhum PR encontrado nessa imagem. Confere se ela mostra bem o nome dos exercícios e as marcas.',
		importFailed: 'Não deu pra importar os PRs. Tenta de novo.'
	},

	leaderboard: {
		loading: 'Carregando o ranking',
		loadFailed: 'Não deu pra carregar o ranking.',
		offline: 'O ranking precisa de internet, e o servidor não está respondendo agora.',
		rankingFailed: 'Não deu pra carregar esse ranking. Tenta de novo.',
		rankingOffline: 'Não deu pra carregar esse ranking. Confere a conexão e tenta de novo.',
		boxRanking: 'Ranking do box',
		athletes: (n) => `${n} ${n === 1 ? 'atleta' : 'atletas'}`,
		nobody: 'Ainda não tem ninguém nesse box.',
		points: (n) => (n === 1 ? 'pt' : 'pts'),
		pointsNote: 'Um ponto pra cada exercício em que você tem a melhor marca do box.',
		whoHoldsWhat: 'Quem manda em quê',
		taken: (done, total) => `${done} de ${total} com dono`,
		you: 'Você',
		tied: (n) => ` +${n} empatados`,
		stillOpen: (n) => (n === 1 ? '1 ainda sem dono' : `${n} ainda sem dono`),
		loadingShort: 'Carregando',
		noPrsYet: 'Sem PRs ainda'
	},

	ranking: {
		title: 'Ranking',
		legend: (category, measurement) => `Ranking · ${category} · ${measurement}`,
		openPodium: 'Pódio aberto',
		openPodiumBody: 'Ninguém do box marcou esse ainda. Quem marcar primeiro fica em primeiro.',
		logged: (done, total) => `${done} de ${total} marcaram`,
		missing: (n) =>
			n === 1 ? '1 atleta ainda não marcou esse' : `${n} atletas ainda não marcaram esse`
	},

	rankRow: { you: 'Você' },

	savedOffline: 'PR salvo neste celular. Ele vai pro servidor quando a internet voltar.',
	deletedOffline: 'PR apagado neste celular. O servidor atualiza quando a internet voltar.',

	api: {
		notFound: 'PR não encontrado.',
		exerciseNotFound: 'Exercício não encontrado.',
		someExercisesNotFound: 'Alguns exercícios não foram encontrados.',
		importFailed: 'Não deu pra importar os PRs.',
		leaderboardFailed: 'Não deu pra carregar o ranking.',
		rankingsFailed: 'Não deu pra carregar o ranking do exercício.',
		importNotSetUp:
			'A importação por foto ainda não está configurada neste servidor. Dá pra marcar os PRs na mão.',
		invalidForm: 'Não deu pra ler o envio.',
		noImage: 'Nenhuma imagem foi enviada.',
		wrongType: 'Escolhe uma imagem PNG, JPG ou WEBP.',
		tooBig: 'A imagem precisa ter menos de 5 MB.',
		analyzeFailed: 'Não deu pra ler a imagem. Tenta de novo.',
		importedNote: 'Importado de foto'
	}
};
