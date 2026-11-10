import type { Dict } from '../en';

export const auth: Dict['auth'] = {
	email: 'E-mail',
	password: 'Senha',
	passwordHelp: 'No mínimo 8 caracteres.',
	alreadyHaveAccount: 'Já tem conta?',
	logIn: 'Entrar',
	errors: {
		invalid_email: 'E-mail inválido',
		password_required: 'Digita a senha',
		password_short: 'A senha precisa ter no mínimo 8 caracteres',
		bad_credentials: 'E-mail ou senha incorretos',
		email_taken: 'Esse e-mail já tem conta',
		email_taken_login: 'Esse e-mail já tem conta. Entra por lá.',
		invite_invalid: 'Convite inválido ou vencido'
	},
	login: {
		title: 'Entrar',
		eyebrow: 'Entrada dos alunos',
		opening: 'Abrindo a porta',
		newHere: 'Primeira vez aqui?',
		backToInvite: 'Voltar pro seu convite',
		createAccount: 'Criar uma conta',
		gotCode: 'Recebeu um código de convite do coach?',
		join: 'Usar'
	},
	register: {
		pageTitle: 'Criar conta',
		eyebrow: 'Novo no box',
		title: 'Criar conta',
		intro:
			'Vai entrar num box que já existe? Pede o link de convite pro coach: ele te coloca direto no quadro do box.',
		creating: 'Criando',
		submit: 'Criar conta'
	},
	join: {
		pageTitle: (box) => `Entrar no ${box}`,
		pageTitleFallback: 'Convite',
		notFoundEyebrow: 'Convite não encontrado',
		notFoundTitle: 'Código errado',
		notFoundBody:
			'Esse convite não existe ou foi cancelado. Confere o link ou pede um novo pro seu coach.',
		expiredEyebrow: 'Convite vencido',
		expiredTitle: 'Já era',
		expiredBody: 'O convite vale sete dias e esse já venceu. Pede um link novo pro seu coach.',
		goToLogin: 'Ir pro login',
		invitedTo: 'Você foi convidado pro',
		inviteCode: (code) => `Convite ${code}`,
		alreadyMember: 'Você já faz parte deste box.',
		seeToday: 'Ver o WoD de hoje',
		asCoach: 'Como coach, você programa e edita os WoDs.',
		asAthlete: 'Você vai ver o WoD todo dia, usar os timers e guardar seus PRs no quadro do box.',
		joining: 'Entrando',
		joinBox: (box) => `Entrar no ${box}`,
		joinFailed: 'Não deu pra entrar neste box.',
		unreachable: 'Não deu pra falar com o servidor. Confere a conexão e tenta de novo.',
		createToJoin: 'Cria sua conta pra entrar no quadro.',
		creating: 'Criando',
		createAndJoin: 'Criar conta e entrar'
	},
	error: {
		notFound: 'Não encontrado',
		broke: 'Deu ruim',
		nothingHere: 'Nada neste endereço',
		moved: 'A página pode ter mudado de lugar, ou o link foi digitado errado.',
		needsConnection: 'Essa parte precisa de internet',
		offlineBody:
			'Você está sem internet. O WoD de hoje, a lista e os timers continuam funcionando.',
		unexpected: 'Um erro inesperado.',
		nothingLost: 'Nada do que você salvou se perdeu.',
		backToToday: 'Voltar pra hoje',
		tryAgain: 'Tentar de novo'
	},
	noBox: {
		pageTitle: 'Ache seu box',
		title: 'Sem box ainda',
		body: (email) =>
			`Você entrou como ${email}, mas ainda não está no quadro de nenhum box. Pede um link de convite pro coach, ou digita o código que ele te passou.`,
		inviteCode: 'Código do convite',
		join: 'Entrar'
	},
	redirecting: 'Redirecionando…'
};
