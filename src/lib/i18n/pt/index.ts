import type { Dict } from '../en';
import { common } from './common';
import { shell } from './shell';
import { date } from './date';
import { format } from './format';
import { today } from './today';
import { editor } from './editor';
import { timer } from './timer';
import { prs } from './prs';
import { auth } from './auth';
import { settings } from './settings';
import { api } from './api';
import { bank } from './bank';

/** Português do Brasil, written the way the coaches at the box talk. */
export const pt: Dict = {
	common,
	shell,
	date,
	format,
	today,
	editor,
	timer,
	prs,
	auth,
	settings,
	api,
	bank
};
