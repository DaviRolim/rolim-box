import type { Dict } from '../en';

export const api: Dict['api'] = {
	unauthorized: 'Sua sessão caiu. Entra de novo.',
	invalidJson: 'Não deu pra ler o pedido.',
	validationFailed: 'Alguns dados não estão certos.',
	notMember: 'Você não faz parte deste box.',
	workspaceRequired: 'Escolhe um box primeiro.',
	ownersOnly: 'Só o dono do box pode fazer isso.',
	soleOwner: 'Você é o único dono, então não pode se remover. Passa o box pra outra pessoa antes.',
	invalidRole: 'O convite é pra coach ou pra atleta.',
	inviteNotFound: 'Esse convite não existe mais.',
	inviteCodeRequired: 'Digita o código do convite.',
	inviteInvalid: 'Esse código de convite não existe.',
	inviteExpired: 'Esse convite venceu. Pede um novo.',
	alreadyMember: 'Você já faz parte deste box.'
};
