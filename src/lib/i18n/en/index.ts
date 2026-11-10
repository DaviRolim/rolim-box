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

/** English, the default. Its shape is the contract every other locale must meet. */
export const en = {
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
	api
};

export type Dict = typeof en;
