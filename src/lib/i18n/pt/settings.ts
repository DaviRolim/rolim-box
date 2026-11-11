import type { Dict } from '../en';

export const settings: Dict['settings'] = {
	title: 'Ajustes',
	ground: {
		heading: 'Fundo',
		aria: 'Fundo (tema)',
		auto: 'Auto',
		autoHint: 'Segue o celular',
		solHint: 'Claro, pro box iluminado',
		noiteHint: 'Escuro',
		note: 'Sol é o fundo claro: fica mais fácil de ler quando o sol da manhã bate no box.'
	},
	language: {
		heading: 'Idioma',
		englishHint: 'O padrão',
		portugueseHint: 'Português do Brasil'
	},
	units: {
		heading: 'Unidades',
		forPrs: 'Pros seus PRs',
		metric: 'Métrico',
		metricHint: 'kg, metros',
		imperial: 'Imperial',
		imperialHint: 'lb, milhas',
		nowKg: 'Agora seus PRs aparecem em kg.',
		nowLb: 'Agora seus PRs aparecem em lb.',
		saveFailed: 'Não deu pra salvar. Esse ajuste precisa de internet.'
	},
	sound: {
		heading: 'Som do relógio',
		on: 'Ligado',
		off: 'Desligado',
		toggle: 'Bipes e avisos de voz',
		note: '3-2-1, "metade", "dez segundos" e "tempo". Aumenta o volume do celular: o som no box é alto.'
	},
	phone: {
		heading: 'Este celular',
		checked: (ago) => `Conferido ${ago}`,
		notChecked: 'Ainda não conferido',
		status: {
			offline: 'Sem internet. As alterações ficam guardadas aqui e vão quando o sinal voltar.',
			error: 'O servidor recusou algumas alterações. Decide aqui embaixo o que fazer.',
			unreachable: 'Com internet, mas o servidor não responde. Ele continua tentando.',
			syncing: 'Mandando as alterações pro servidor.',
			pending: (n) =>
				n === 1
					? '1 alteração esperando pra ser enviada.'
					: `${n} alterações esperando pra ser enviadas.`,
			synced: 'Tudo o que está neste celular já está no servidor.'
		},
		change: {
			create: { wod: 'WoD novo', pr: 'PR novo', bank: 'WoD novo no banco' },
			update: { wod: 'Edição de WoD', pr: 'Edição de PR', bank: 'Edição no banco' },
			delete: { wod: 'WoD apagado', pr: 'PR apagado', bank: 'WoD apagado do banco' }
		},
		syncing: 'Sincronizando',
		syncNow: 'Sincronizar',
		discardRefused: 'Descartar recusadas',
		note: 'WoDs e PRs ficam salvos neste celular, então o app abre e os timers rodam mesmo sem sinal.',
		upToDate: 'Tudo em dia.',
		stillOffline: 'Ainda sem internet. Sincroniza sozinho depois.',
		noAnswer: 'O servidor não respondeu. Tenta de novo daqui a pouco.',
		discarded: 'Alterações recusadas descartadas. O quadro bate com o servidor de novo.',
		discardTitle: 'Descartar as alterações recusadas?',
		discardMessage:
			'As alterações que o servidor recusou vão pro lixo e este celular volta a ficar igual ao servidor. O que ainda está esperando pra ser enviado continua guardado.',
		discard: 'Descartar',
		keepThem: 'Manter'
	},
	box: {
		heading: 'Seu box',
		membersAndInvites: 'Membros e convites'
	},
	account: 'Conta',
	sync: {
		notSaved: (reason) => `Uma alteração não foi salva: ${reason}`,
		unsupported: 'Esse tipo de alteração não é aceito.',
		refusedStatus: (status) => `O servidor recusou (${status}).`,
		notAccepted: 'O servidor não aceitou essa alteração.'
	},
	members: {
		pageTitle: (box) => `${box} · Membros`,
		onTheBoard: (n) => `${n} no quadro`,
		invite: {
			heading: 'Convidar alguém',
			lasts: 'O link vale 7 dias',
			inviteAs: 'Convidar como',
			athleteHint: 'Vê os WoDs, usa os timers, registra PRs',
			coachHint: 'Também programa e edita os WoDs',
			creating: 'Criando',
			create: 'Criar link de convite',
			createFailed: 'Não deu pra criar o convite.',
			fresh: 'Convite novo · manda pra pessoa',
			share: 'Compartilhar',
			copied: 'Copiado',
			copyLink: 'Copiar link',
			copyFailed: 'Não deu pra copiar. Seleciona o link e copia na mão.',
			shareTitle: (box) => `Entra no ${box} pelo RolimBox`
		},
		open: {
			heading: 'Convites abertos',
			none: 'Nenhum convite esperando.',
			until: (role, date) => `${role} · até ${date}`,
			copyAria: (code) => `Copiar o link do convite ${code}`,
			cancelAria: (code) => `Cancelar o convite ${code}`,
			cancel: 'Cancelar convite'
		},
		list: {
			heading: 'Membros',
			since: (date) => `Desde ${date}`,
			you: ' · você',
			removeAria: (email) => `Tirar ${email} do box`,
			remove: 'Tirar'
		},
		revoke: {
			done: 'Convite cancelado.',
			failed: 'Não deu pra cancelar o convite.',
			title: 'Cancelar este convite?',
			message: 'O link para de funcionar na hora. Quem já entrou com ele continua no box.',
			cancelling: 'Cancelando',
			keepIt: 'Manter'
		},
		removal: {
			done: (email) => `${email} saiu do box.`,
			failed: 'Não deu pra tirar essa pessoa.',
			title: 'Tirar do box?',
			message:
				'A pessoa perde o acesso aos WoDs e ao ranking deste box. Os PRs dela continuam na conta dela.',
			removing: 'Tirando',
			keepThem: 'Manter'
		}
	}
};
