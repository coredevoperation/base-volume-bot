import TelegramBot from 'node-telegram-bot-api'
//import { web3Inst } from './utils.js'
import assert from 'assert';
import dotenv from 'dotenv'
dotenv.config()

import * as database from './db.js'

import * as privateBot from './bot_private.js'
import * as groupBot from './bot_group.js'
import * as afx from './global.js'

import * as callHistory from './call_history.js'
import { md5 } from './md5.js'
import { distributeWallets, gatherWallets } from './check_funed.js';
import { get_idle_web3, web3 } from './index.js';
import { format } from 'path';
import { autoSwap_Buy_thread } from './auto_trader.js';

const token = process.env.BOT_TOKEN
export const bot = new TelegramBot(token,
	{
		polling: true
	})

export const myInfo = await bot.getMe();

export const sessions = new Map()
export const stateMap = new Map()

export const MIN_COMUNITY_TOKEN_AMOUNT = process.env.MIN_COMUNITY_TOKEN_AMOUNT

export const COMMAND_START = 'start'
export const COMMAND_LOGIN = 'login'
export const COMMAND_CURRENT_SETTING = 'currentsettings'
export const COMMAND_SET_SETTING = 'setsettings'
export const COMMAND_CANCEL = 'cancel'
export const COMMAND_DIRECT = 'direct'
export const COMMAND_DIRECTALL = 'directall'
export const COMMAND_DIRECTNONLOGIN = 'directnon'
export const COMMAND_GAINER = 'topgainer'
export const COMMAND_TEST_LP = 'test_lp'
export const COMMAND_TEST_HP = 'test_hp'
export const COMMAND_TEST_TOKENDEPLOYDATE = 'test_tokendeploydate'
export const COMMAND_STARTKICK = 'startkick'
export const COMMAND_STOPKICK = 'stopkick'
export const COMMAND_MYACCOUNT = 'myaccount'
export const COMMAND_SIMULATION = 'simulation'


export const STATE_IDLE = 0
export const STATE_CREATE_NEW_PROJECT = 1
export const STATE_VIEW_MY_PROJECTS = 2
export const STATE_MANAGE_PROJECTS = 3
export const STATE_VIEW_HELP = 4
export const STATE_WAIT_NEW_PROJECT_NAME = 5
export const STATE_WAIT_NEW_PROJECT_TOKEN = 6
export const STATE_WAIT_CHANGE_PROJECT_TOKEN = 7
export const STATE_CONFIRM_DELETE_PROJECT = 8
export const STATE_SET_PROJECT_BUY_AMOUNT = 9
export const STATE_SET_PROJECT_WALLET_COUNT = 10
export const STATE_SET_PROJECT_INTERVAL = 11
export const STATE_PROJECT_DIVIDE = 12
export const STATE_PROJECT_GATHER = 13
export const STATE_SET_PROJECT_WITHDRAW = 14
export const STATE_PROJECT_HELP = 15
export const STATE_SET_PROJECT_RUNNING_PERIOD = 16

export const STATE_WAIT_PROJECT_BUY_AMOUNT = 20
export const STATE_WAIT_PROJECT_WALLET_COUNT = 21
export const STATE_WAIT_PROJECT_INTERVAL = 22
export const STATE_WAIT_PROJECT_WITHDRAW_ADDRESS = 23
export const STATE_WAIT_PROJECT_RUNNING_PERIOD = 24

export const STATE_CHOOSE_PROJECT = 31; // 31~40
export const STATE_DELETE_PROJECT = 41;	// 31~40
export const STATE_CHANGE_TOKEN_PROJECT = 51; // 51~60

export const STATE_PROJECT_VOLUME_BOOST_START = 77;
export const STATE_PROJECT_REFRESH = 78;

export const STATE_PROJECT_VOLUME_BOOST_STOP = 99
export const STATE_BACK_TO_PROJECT_SETTING = 100;
export const STATE_BACK_TO_MANAGE_PROJECT = 101;

export const OPTION_BUY_AMOUNT = 130
export const OPTION_WALLET_COUNT = 131
export const OPTION_DIVIDE_ETH = 132
export const OPTION_WORK_INTERVAL = 133
export const OPTION_SET_BOOST_GATHER = 134
export const OPTION_SET_BOOST_WITHDRAW = 135
export const OPTION_WAIT_BUY_AMOUNT = 136

export const stateMap_set = (chatid, state, data = {}) => {
	stateMap.set(chatid, { state, data })
}

export const stateMap_get = (chatid) => {
	return stateMap.get(chatid)
}

export const stateMap_remove = (chatid) => {
	stateMap.delete(chatid)
}

export const stateMap_clear = () => {
	stateMap.clear()
}

const json_buttonItem = (key, cmd, text) => {
	return {
		text: text,
		callback_data: JSON.stringify({ k: key, c: cmd }),
	}
}

export const json_projectSettings = (sessionId) => {
	const json = [
		[
			json_buttonItem(sessionId, -1, '🎖 Magic Base Volume Bot')
		],
		[
			json_buttonItem(sessionId, STATE_CREATE_NEW_PROJECT, '🆕 New Project')
		],
		[
			json_buttonItem(sessionId, STATE_MANAGE_PROJECTS, '✍ Manage Projects'),
			json_buttonItem(sessionId, STATE_VIEW_MY_PROJECTS, '📂 My Projects'),
		],
		[
			json_buttonItem(sessionId, STATE_VIEW_HELP, '📖 Help'),
		]
	]
	return { title: '', options: json }
}

export const json_viewProjects = async (sessionId) => {
	const session = sessions.get(sessionId);

	const projects = await database.allProjects(session);

	const json = [];
	projects.map((project, index) => {
		json.push([
			json_buttonItem(sessionId, STATE_CHOOSE_PROJECT + index, `🗂 ${project.project_name}`)
		])
	})
	json.push([
		json_buttonItem(sessionId, STATE_BACK_TO_PROJECT_SETTING, '⬅ Back')
	])
	return { title: 'These are currently placed projects for you. Please select a project to use.', options: json }
}

export const json_manageProjects = async (sessionId) => {
	const session = sessions.get(sessionId);

	const projects = await database.allProjects(session);
	const json = []
	projects.map((project, index) => {
		json.push([
			json_buttonItem(sessionId, -1, `🗂 ${project.project_name}`),
			json_buttonItem(sessionId, STATE_CHANGE_TOKEN_PROJECT + index, `💸 Change Token`),
			json_buttonItem(sessionId, STATE_DELETE_PROJECT + index, `🗑 Delete`)
		])
	})
	json.push([
		json_buttonItem(sessionId, STATE_BACK_TO_PROJECT_SETTING, '⬅ Back')
	])
	return { title: 'These are currently placed projects for you. Please click delete button if you want to delete a project.', options: json }
}

export const json_deleteConfirmProjects = (sessionId) => {
	const json = [
		[
			json_buttonItem(sessionId, STATE_BACK_TO_MANAGE_PROJECT, '❌ Cancel'),
			json_buttonItem(sessionId, STATE_CONFIRM_DELETE_PROJECT, '✅ Confirm')
		]
	]
	return { title: 'Do you really want to delete this project?', options: json }
}

export const json_showHelp = (sessionId) => {
	const json = [
		[
			json_buttonItem(sessionId, STATE_BACK_TO_PROJECT_SETTING, '⬅ Back')
		],
	]
	const title = `Welcome to Help
You should follow the steps to boost your volume.
1. Create New Project.
2. Deposit ETH to project's deposite wallet.
3. Divide ETH to zombie wallets.
4. You can also change some options of project.
6. Click "Start" to start bot.
7. After swap is finished, you can gather and withraw ETH and token to project withdraw wallet.`
	return { title: title, options: json }
}

export const json_boostVolumeSettings = async (sessionId) => {
	const session = sessions.get(sessionId);
	if (!session) return { title: '', options: [] };

	const web3Instance = get_idle_web3();
	web3Instance.inUse = true;
	const web3 = web3Instance.web3;
	const balance = await web3.eth.getBalance(session.target_project.wallet);
	web3Instance.inUse = false;
	const formattedEth = balance / (10 ** 18);

	const json = [
		[
			json_buttonItem(sessionId, STATE_PROJECT_VOLUME_BOOST_START/*OPTION_SET_BOOST_VOLUME*/, '🚀 Start'),
			json_buttonItem(sessionId, STATE_PROJECT_VOLUME_BOOST_STOP/*OPTION_SET_BOOST_VOLUME*/, '🛑 Stop'),
		],
		[
			json_buttonItem(sessionId, STATE_PROJECT_REFRESH, '🔄 Refresh')
		],
		[
			json_buttonItem(sessionId, STATE_SET_PROJECT_BUY_AMOUNT, `💸 Buy with ${session.target_project.buy_amount}% ETH`),
			json_buttonItem(sessionId, STATE_SET_PROJECT_RUNNING_PERIOD, `⏰ Running Period (${session.target_project.period}h)`)
		],
		[
			json_buttonItem(sessionId, STATE_SET_PROJECT_WALLET_COUNT, `🧾  Set Wallet Size (${session.target_project.wallet_count})`),
			json_buttonItem(sessionId, STATE_PROJECT_DIVIDE, '✂ Divide'),
			json_buttonItem(sessionId, STATE_SET_PROJECT_INTERVAL, `🕰  Set Interval (${session.target_project.interval}s)`),
		],
		[
			json_buttonItem(sessionId, STATE_PROJECT_GATHER, '💷 Gather'),
			json_buttonItem(sessionId, STATE_SET_PROJECT_WITHDRAW, '💰 Withdraw')
		],
		[
			json_buttonItem(sessionId, STATE_BACK_TO_PROJECT_SETTING, '⬅ Back')
		],
	]
	const title = `🏅 Welcome to ${session.target_project.project_name} Project 🏅
	To increase the volume, you first deposit ETH to deposit wallet. Then you should divide ETH to zombi wallets and after finished click start.
	
	🔍 Deposit ETH Amount Calculation:
	Token Buy ETH Amount * 1.2 * Wallet Count
	
	📜 Token Info: ${session.target_project.token_symbol}
<code>${session.target_project.token_address}</code>

	⌛ Bot worked: 0 min
	💹 Bot state: ${session.target_project.state}
	
	💳 Your Deposit Wallet:
<code>${session.target_project.wallet}</code>
	💰 Balance: ${formattedEth} ETH`

	return { title: title, options: json };
}

async function switchMenu(chatId, messageId, json_buttons) {

	const keyboard = {
		inline_keyboard: json_buttons,
		resize_keyboard: true,
		one_time_keyboard: true,
		force_reply: true
	};

	await bot.editMessageReplyMarkup(keyboard, { chat_id: chatId, message_id: messageId })
}

async function removeMessage(chatId, messageId) {
	if (chatId && messageId) {
		await bot.deleteMessage(chatId, messageId);
	}
}

async function switchMenuWithTitle(chatId, messageId, title, json_buttons) {

	const keyboard = {
		inline_keyboard: json_buttons,
		resize_keyboard: true,
		one_time_keyboard: true,
		force_reply: true
	};

	try {

		await bot.editMessageText(title, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'HTML' })

	} catch (error) {
		afx.error_log('[switchMenuWithTitle]', error)
	}
}

async function editAnimationMessageCaption(chatId, messageId, title, json_buttons) {

	const keyboard = {
		inline_keyboard: json_buttons,
		resize_keyboard: true,
		one_time_keyboard: true,
		force_reply: true
	};

	try {

		//protect_content: true, 
		await bot.editMessageCaption(title, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: keyboard })

	} catch (error) {
		afx.error_log('[switchMenuWithTitle]', error)
	}
}

export async function openMenu(chatId, menuTitle, json_buttons) {

	const keyboard = {
		inline_keyboard: json_buttons,
		resize_keyboard: true,
		one_time_keyboard: true,
		force_reply: true
	};

	await bot.sendMessage(chatId, menuTitle, { reply_markup: keyboard, parse_mode: 'HTML' });
}

export const get_menuTitle = (sessionId, subTitle) => {

	const session = sessions.get(sessionId)
	if (!session) {
		return ''
	}

	let result = session.type === 'private' ? `@${session.username}'s configuration setup` : `@${session.username} group's configuration setup`

	if (subTitle && subTitle !== '') {

		//subTitle = subTitle.replace('%username%', `@${session.username}`)
		result += `\n${subTitle}`
	}

	return result
}

export const get_volumeMenuTitle = (sessionId, subTitle) => {

	const session = sessions.get(sessionId)
	if (!session) {
		return ''
	}

	// let result = session.type === 'private' ? `@${session.username}'s configuration setup` : `@${session.username} group's configuration setup`
	let result = `Choose the desired volume making package`

	if (subTitle && subTitle !== '') {

		//subTitle = subTitle.replace('%username%', `@${session.username}`)
		result += `\n${subTitle}`
	}

	return result
}

export function sendMessage(chatid, message, enableLinkPreview = true) {
	try {

		let data = { parse_mode: 'HTML' }

		if (enableLinkPreview)
			data.disable_web_page_preview = false
		else
			data.disable_web_page_preview = true

		data.disable_forward = true

		bot.sendMessage(chatid, message, data)

		return true
	} catch (error) {
		afx.error_log('sendMessage', error)

		return false
	}
}

export async function sendMessageSync(chatid, message, info = {}) {
	try {

		let data = { parse_mode: 'HTML' }

		data.disable_web_page_preview = false
		data.disable_forward = true

		await bot.sendMessage(chatid, message, data)

		return true
	} catch (error) {

		if (error?.response?.body?.error_code === 403) {
			info.blocked = true
		}

		console.log(error?.response?.body)
		afx.error_log('sendMessage', error)

		return false
	}
}

export function sendOptionMessage(chatid, message, option) {
	try {
		bot.sendMessage(chatid, message, option);
	} catch (error) {
		afx.error_log('sendMessage', error)
	}
}

export function sendMessageToAuthorizedAllUsers(message) {

	for (const [chatid, session] of sessions) {
		sendMessageToAuthorizedUser(session, message)
	}
}

export function sendMessageToAuthorizedUser(session, message, menu = null) {

	return new Promise(async (resolve, reject) => {

		if (session.wallet || session.vip === 1) {

			const fileId = 'CgACAgEAAxkBAALA8mSJ8fqLFP7iWN2llAJZM69Up6riAAIYAwACUmxQRCNXq-ljLrcOLwQ'
			sendAnimation(session.chatid, fileId, message, menu).then((res) => {
				console.log(`Notification has been sent to @${session.username} (${session.chatid})`)

				resolve(true)

			}).catch(() => {
				resolve(false)
			})
		} else {
			resolve(false)
		}
	})
}


export function sendMessageToVipUser(session, message, menu = null) {
	//if (session.vip === 1) {
	if (session.wallet || session.vip === 1) {

		let option = { caption: message, parse_mode: 'HTML', disable_web_page_preview: true }

		if (menu) {

			const keyboard = {
				inline_keyboard: menu.options,
				resize_keyboard: true,
				one_time_keyboard: true,
				force_reply: true
			};

			option.reply_markup = keyboard
		}

		return new Promise(async (resolve, reject) => {
			bot.sendMessage(session.chatid, message, option).catch((err) => {
				console.log('\x1b[31m%s\x1b[0m', `sendAnimation Error: ${chatid} ${err.response.body.description}`);
			}).then((msg) => {
				resolve(true)
			});
		})
	} else {
		bot.sendMessage(session.chatid, "Only VIP member can use the simulation.")
		return false;
	}
}

export async function sendCallToAuthorizedUser(session, filteredInfo, tokenInfo, poolId) {
	const delay = 0;
	if (session.tier < TIER_STATE_GOLD) {
		delay = 1000 * 60 * 3;
	}
	setTimeout(() => {
		const menu = json_msgOption(session.chatid, tokenInfo.primaryAddress, tokenInfo.poolAddress, poolId, true);

		const message = filteredInfo.content0 + filteredInfo.tag
		sendMessageToAuthorizedUser(session, message, menu).then(res => {

			if (res) {
				const hashCode = md5(tokenInfo.poolAddress)
				callHistory.storeMsgData(session.chatid, tokenInfo.poolAddress, tokenInfo.primaryAddress, poolId, hashCode, filteredInfo)
				database.addCallHistory(session.chatid, tokenInfo)
			} else {
				console.log("message send error");
			}
		})
	}, delay)

}

export async function sendAnimation(chatid, file_id, message, json_buttons = null) {

	//, protect_content: true
	let option = { caption: message, parse_mode: 'HTML', disable_web_page_preview: true }

	if (json_buttons) {

		const keyboard = {
			inline_keyboard: json_buttons.options,
			resize_keyboard: true,
			one_time_keyboard: true,
			force_reply: true
		};

		option.reply_markup = keyboard
	}

	return new Promise(async (resolve, reject) => {
		bot.sendAnimation(chatid, file_id, option).catch((err) => {
			console.log('\x1b[31m%s\x1b[0m', `sendAnimation Error: ${chatid} ${err.response.body.description}`);
		}).then((msg) => {
			resolve(true)
		});
	})
}

export function sendPhoto(chatid, file_id, message) {
	bot.sendPhoto(chatid, file_id, { caption: message, parse_mode: 'HTML', disable_web_page_preview: true }).catch((err) => {
		console.log('\x1b[31m%s\x1b[0m', `sendPhoto Error: ${chatid} ${err.response.body.description}`);
	});
}

export function sendLoginSuccessMessage(session) {

	if (session.type === 'private') {
		sendMessage(session.chatid, `You have successfully logged in with your wallet. From this point forward, you will receive calls based on the settings that you adjusted. If you have any questions, please feel free to contact developer team @Hiccupwalter. Thank you!`)
		console.log(`@${session.username} user has successfully logged in with the wallet ${session.wallet}`);
	} else if (session.type === 'group') {
		sendMessage(session.from_chatid, `@${session.username} group has been successfully logged in with your wallet`)
		console.log(`@${session.username} group has successfully logged in with the owner's wallet ${session.wallet}`);
	} else if (session.type === 'channel') {
		sendMessage(session.chatid, `@${session.username} channel has been successfully logged in with your wallet`)
		console.log(`@${session.username} channel has successfully logged in with the creator's wallet ${session.wallet}`);
	}
}

export function showSessionLog(session) {

	if (session.type === 'private') {
		console.log(`@${session.username} user${session.wallet ? ' joined' : '\'s session has been created (' + session.chatid + ')'}`)
	} else if (session.type === 'group') {
		console.log(`@${session.username} group${session.wallet ? ' joined' : '\'s session has been created (' + session.chatid + ')'}`)
	} else if (session.type === 'channel') {
		console.log(`@${session.username} channel${session.wallet ? ' joined' : '\'s session has been created'}`)
	}
}

export const createSession = (chatid, username, type) => {

	let session = {
		chatid: chatid,
		username: username,
		// init_eth: Number(process.env.MIN_POOL_ETH),
		// init_usd: Number(process.env.MIN_POOL_USDT_USDC),
		// block_threshold: Number(process.env.BLOCK_THRESHOLD),
		// max_fresh_transaction_count: Number(process.env.MAX_FRESH_TRANSACTION_COUNT),
		// min_fresh_wallet_count: Number(process.env.MIN_FRESH_WALLET_COUNT),
		// min_whale_balance: Number(process.env.MIN_WHALE_BALANCE),
		// min_whale_wallet_count: Number(process.env.MIN_WHALE_WALLET_COUNT),
		// min_kyc_wallet_count: Number(process.env.MIN_KYC_WALLET_COUNT),
		// min_dormant_duration: Number(process.env.MIN_DORMANT_DURATION),
		// min_dormant_wallet_count: 0,
		// lp_lock: 0,
		// honeypot:1,
		// contract_age:0,
		wallet: null,
		permit: 0,
		type: type
	}

	setDefaultSettings(session)

	sessions.set(session.chatid, session)
	showSessionLog(session)

	return session;
}

export const updateSession = async (user) => {
	let session = sessions.get(user.chatid);
	if (session) {
		session.chatid = user.chatid
		session.username = user.username
		session.init_eth = user.init_eth
		session.init_usd = user.init_usd
		session.block_threshold = user.block_threshold
		session.max_fresh_transaction_count = user.max_fresh_transaction_count
		session.min_fresh_wallet_count = user.min_fresh_wallet_count
		session.min_whale_balance = user.min_whale_balance
		session.min_whale_wallet_count = user.min_whale_wallet_count
		session.min_kyc_wallet_count = user.min_kyc_wallet_count
		session.min_dormant_wallet_count = user.min_dormant_wallet_count
		session.min_dormant_duration = user.min_dormant_duration
		session.min_sniper_count = user.min_sniper_count
		session.lp_lock = user.lp_lock
		session.honeypot = user.honeypot
		session.contract_age = user.contract_age
		session.wallet = user.wallet;
		session.from_chatid = user.from_chatid;
		session.type = user.type;
		session.vip = user.vip;
		session.invest_amount = user.invest_amount;
		session.profit_target = user.profit_target;
		session.trailing_stop_loss = user.trailing_stop_loss;
		session.start_date = user.start_date;
		session.end_date = user.end_date;
		session.simul_token_address = user.simul_token_address;
		session.tier = user.tier
		session.swap_finished = user.swap_finished
		session.swap_end_time = user.swap_end_time
		session.swap_start = user.swap_start
		session.withdraw_wallet = user.withdraw_wallet
		session.wallet_count = user.wallet_count
		session.interval = user.interval
	}
}

export const setDefaultSettings = (session) => {

	session.init_eth = Number(process.env.MIN_POOL_ETH)
	session.init_usd = Number(process.env.MIN_POOL_USDT_USDC)
	session.block_threshold = Number(process.env.BLOCK_THRESHOLD)
	session.max_fresh_transaction_count = Number(process.env.MAX_FRESH_TRANSACTION_COUNT)
	session.min_fresh_wallet_count = Number(process.env.MIN_FRESH_WALLET_COUNT)
	session.min_whale_balance = Number(process.env.MIN_WHALE_BALANCE)
	session.min_whale_wallet_count = Number(process.env.MIN_WHALE_WALLET_COUNT)
	session.min_kyc_wallet_count = Number(process.env.MIN_KYC_WALLET_COUNT)
	session.min_dormant_duration = Number(process.env.MIN_DORMANT_DURATION)
	session.min_sniper_count = Number(process.env.MIN_SNIPER_COUNT)
	session.min_dormant_wallet_count = Number(process.env.MIN_DORMANT_WALLET_COUNT)
	session.lp_lock = Number(process.env.LP_LOCK)
	session.honeypot = Number(process.env.HONEYPOT)
	session.contract_age = Number(process.env.CONTRACT_AGE)
	session.pkey = null
	session.account = null
	session.slippage = Number(process.env.SLIPPAGE)
	session.autobuy = Number(process.env.AUTO_BUY)
	session.autosell = Number(process.env.AUTO_SELL)
	session.autosell_hi = Number(process.env.AUTO_SELL_HI)
	session.autosell_lo = Number(process.env.AUTO_SELL_LO)
	session.autosell_hi_amount = Number(process.env.AUTO_SELL_HI_AMOUNT)
	session.autosell_lo_amount = Number(process.env.AUTO_SELL_LO_AMOUNT)
	session.autobuy_amount = Number(process.env.AUTO_BUY_AMOUNT)

	session.invest_amount = Number(0.1)
	session.profit_target = Number(1)
	session.trailing_stop_loss = 0.00000001
	session.start_date = "8/9/2023"
	session.end_date = "8/11/2023"
	session.simul_token_address = "0xf68415be72377611e95d59bc710ccbbbf94c4fa2"
	session.tier = 0
	session.charge_active = 0
	session.dist_finished = 0
	session.swap_finished = 0
	session.swap_end_time = 0
	session.swap_start = 0
	session.withdraw_wallet = ""
	session.wallet_count = process.env.WALLET_DIST_COUNT
	session.interval = process.env.VOLUME_BOOST_INTERVAL
}

export let _command_proc = null
export let _callback_proc = null
export async function init(command_proc, callback_proc) {

	_command_proc = command_proc
	_callback_proc = callback_proc

	await database.init()
	const users = await database.selectUsers()

	let loggedin = 0
	for (const user of users) {

		const session = {
			chatid: user.chatid,
			username: user.username,
			init_eth: Number(user.init_eth),
			init_usd: Number(user.init_usd),
			block_threshold: Number(user.block_threshold),
			max_fresh_transaction_count: Number(user.max_fresh_transaction_count),
			min_fresh_wallet_count: Number(user.min_fresh_wallet_count),
			min_whale_balance: Number(user.min_whale_balance),
			min_whale_wallet_count: Number(user.min_whale_wallet_count),
			min_kyc_wallet_count: Number(user.min_kyc_wallet_count),
			min_dormant_wallet_count: Number(user.min_dormant_wallet_count),
			min_dormant_duration: Number(user.min_dormant_duration),
			min_sniper_count: Number(user.min_sniper_count),
			lp_lock: Number(user.lp_lock),
			honeypot: Number(user.honeypot),
			contract_age: Number(user.contract_age),
			wallet: user.wallet,
			from_chatid: user.from_chatid,
			permit: 0,
			type: user.type,
			vip: user.vip,
			kickmode: user.kickmode,
			slippage: user.slippage,
			account: user.account,
			pkey: user.pkey,
			invest_amount: user.invest_amount,
			profit_target: user.profit_target,
			trailing_stop_loss: user.trailing_stop_loss,
			start_date: user.start_date,
			end_date: user.end_date,
			simul_token_address: user.simul_token_address,
			tier: user.tier,
			charge_active: user.charge_active,
			dist_finished: user.dist_finished,
			swap_finished: user.swap_finished,
			swap_end_time: user.swap_end_time,
			swap_start: user.swap_start,
			withdraw_wallet: user.withdraw_wallet,
			wallet_count: user.wallet_count,
			interval: user.interval
		}

		if (session.wallet) {
			loggedin++
		}

		const projects = await database.allProjects(session);
		for (let i = 0; i < projects?.length; i++) {
			projects[i].state = "Idle";
			await database.updateProject(projects[i])
		}

		sessions.set(session.chatid, session)
		//showSessionLog(session)

		if (session.vip === 1) {
			console.log(`@${session.username} user joined as VIP ( ${session.chatid} )`)
		}
	}

	console.log(`${users.length} users, but only ${loggedin} logged in`)
}

export const isAuthorized = async (session) => {

	if (session) {

		let user = await database.selectUser({ chatid: session.chatid });
		if (user && user.permit)
			return true;
	}

	return false;
}

export const checkWhitelist = async (username) => {

	let item = await database.existInWhitelist(username);
	if (item) {
		return true;
	}

	return false;
}

bot.on('message', async (message) => {

	// console.log(`========== message ==========`)
	// console.log(message)
	// console.log(`=============================`)

	const msgType = message?.chat?.type;
	console.log("AAA --> ", message.text);

	if (msgType === 'private') {
		privateBot.procMessage(message, database);

	} else if (msgType === 'group' || msgType === 'supergroup') {
		groupBot.procMessage(message, database);

	} else if (msgType === 'channel') {

	}
})

bot.on('callback_query', async (callbackQuery) => {
	// console.log('========== callback query ==========')
	// console.log(callbackQuery)
	// console.log('====================================')

	const message = callbackQuery.message;

	if (!message) {
		return
	}

	const option = JSON.parse(callbackQuery.data);
	let chatid = message.chat.id.toString();

	const cmd = option.c;
	const id = option.k;

	executeCommand(chatid, message.message_id, callbackQuery.id, option)
})

const executeCommand = async (chatid, messageId, callbackQueryId, option) => {

	const cmd = option.c;
	const id = option.k;

	//stateMap_clear();

	try {
		if (cmd == STATE_CREATE_NEW_PROJECT) {
			const sessionId = id;
			assert(sessionId)

			const msg = `🖋Please input new project name.🖋`
			sendMessage(chatid, msg)

			await bot.answerCallbackQuery(callbackQueryId, { text: msg })
			stateMap_set(chatid, STATE_WAIT_NEW_PROJECT_NAME, { sessionId })
		} else if (cmd == STATE_VIEW_MY_PROJECTS) {
			const sessionId = id;
			assert(sessionId)

			const menu = await json_viewProjects(sessionId)
			stateMap_set(chatid, STATE_IDLE, { sessionId })
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)
		} else if (cmd >= STATE_CHOOSE_PROJECT && cmd <= STATE_CHOOSE_PROJECT + 9) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);

			const projects = await database.allProjects(session);
			const target_project = projects[cmd - STATE_CHOOSE_PROJECT];
			session.target_project = target_project;

			const menu = await json_boostVolumeSettings(sessionId);
			stateMap_set(chatid, STATE_IDLE, { sessionId })
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)
		} else if (cmd == STATE_BACK_TO_PROJECT_SETTING) {
			const sessionId = id;
			assert(sessionId)

			const menu = json_projectSettings(sessionId)
			stateMap_set(chatid, STATE_IDLE, { sessionId })
			switchMenuWithTitle(chatid, messageId, privateBot.getWelcomeMessage(), menu.options)
		} else if (cmd == STATE_BACK_TO_MANAGE_PROJECT) {
			const sessionId = id;
			assert(sessionId)

			const menu = await json_manageProjects(sessionId)
			stateMap_set(chatid, STATE_IDLE, { sessionId })
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)
		} else if (cmd == STATE_MANAGE_PROJECTS) {
			const sessionId = id;
			assert(sessionId)

			const menu = await json_manageProjects(sessionId)
			stateMap_set(chatid, STATE_IDLE, { sessionId })
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)
		} else if (cmd >= STATE_CHANGE_TOKEN_PROJECT && cmd <= STATE_CHANGE_TOKEN_PROJECT + 9) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			session.change_token_project_id = cmd - STATE_CHANGE_TOKEN_PROJECT;
			stateMap_set(chatid, STATE_WAIT_CHANGE_PROJECT_TOKEN, { sessionId });
			sendMessage(chatid, "🖋Please input a token address for volume market making.🖋");
		} else if (cmd >= STATE_DELETE_PROJECT && cmd <= STATE_DELETE_PROJECT + 9) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			session.delete_project_id = cmd - STATE_DELETE_PROJECT;
			const menu = json_deleteConfirmProjects(sessionId);
			stateMap_set(chatid, STATE_IDLE, { sessionId });
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)
		} else if (cmd == STATE_CONFIRM_DELETE_PROJECT) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			const projects = await database.allProjects(session);
			const targetProject = projects[session.delete_project_id];
			await database.removeProject(targetProject);

			const menu = await json_manageProjects(sessionId);
			stateMap_set(chatid, STATE_IDLE, { sessionId });
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)
		} else if (cmd == STATE_SET_PROJECT_BUY_AMOUNT) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			if (session.target_project.state != "Idle") return;
			// const msg = `Input token address (0x....)`
			const msg = `🔢 Please input buy amount for ETH.(1% ~ 100%)`
			sendMessage(chatid, msg)
			await bot.answerCallbackQuery(callbackQueryId, { text: msg })
			stateMap_set(chatid, STATE_WAIT_PROJECT_BUY_AMOUNT, { sessionId })
		} else if (cmd == STATE_SET_PROJECT_WALLET_COUNT) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			if (session.target_project.state != "Idle") return;

			const msg = `🔢 Please input your wallet count for volume boost. Value range is ${process.env.MIN_WALLET_DIST_COUNT}~${process.env.MAX_WALLET_DIST_COUNT}.`
			sendMessage(chatid, msg)
			await bot.answerCallbackQuery(callbackQueryId, { text: msg })
			stateMap_set(chatid, STATE_WAIT_PROJECT_WALLET_COUNT, { sessionId })
		} else if (cmd == STATE_SET_PROJECT_INTERVAL) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			if (session.target_project.state != "Idle") return;

			const msg = `🔢 Please input your volume boosting interval. Value range is ${process.env.MIN_VOLUME_BOOST_INTERVAL}s~${process.env.MAX_VOLUME_BOOST_INTERVAL}s.`
			sendMessage(chatid, msg)
			await bot.answerCallbackQuery(callbackQueryId, { text: msg })
			stateMap_set(chatid, STATE_WAIT_PROJECT_INTERVAL, { sessionId })
		} else if (cmd == STATE_SET_PROJECT_WITHDRAW) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			if (session.target_project.state != "Idle") return;

			const msg = `🔢 Please send a wallet address for withdraw ETH.(0x....)`
			sendMessage(chatid, msg)
			await bot.answerCallbackQuery(callbackQueryId, { text: msg })
			stateMap_set(chatid, STATE_WAIT_PROJECT_WITHDRAW_ADDRESS, { sessionId })
		} else if (cmd == STATE_PROJECT_DIVIDE) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			if (session.target_project.state != "Idle") return;

			sendMessage(chatid, `✅ Divide for zombie wallets started.`);
			session.target_project.state = 'Dividing'
			await database.updateProject(session.target_project)

			const web3Instance = get_idle_web3()
			web3Instance.inUse = true;
			distributeWallets(web3Instance.web3, session, database, null).then(async (value) => {
				web3Instance.inUse = false;

				session.target_project.state = 'Idle'
				await database.updateProject(session.target_project)

				sendMessage(chatid, `🎉 Divide for zombie wallets completed`)
				const menu = await json_boostVolumeSettings(sessionId)
				stateMap_set(chatid, STATE_IDLE, { sessionId })
				openMenu(chatid, menu.title, menu.options)
			})
		} else if (cmd == STATE_PROJECT_GATHER) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			if (session.target_project.state != "Idle") return;

			sendMessage(chatid, `✅ Gathering from zombie wallets started.`);
			session.target_project.state = 'Gathering'
			await database.updateProject(session.target_project)

			const web3Instance = get_idle_web3()
			web3Instance.inUse = true;
			gatherWallets(web3Instance.web3, session, database, null).then(async (value) => {
				web3Instance.inUse = false;

				session.target_project.state = 'Idle'
				await database.updateProject(session.target_project)

				sendMessage(chatid, `🎉 Gathering from zombie wallets completed`)
				const menu = await json_boostVolumeSettings(sessionId)
				stateMap_set(chatid, STATE_IDLE, { sessionId })
				openMenu(chatid, menu.title, menu.options)
			})
		} else if (cmd == STATE_PROJECT_REFRESH) {
			const sessionId = id;
			assert(sessionId)

			const menu = await json_boostVolumeSettings(sessionId)
			stateMap_set(chatid, STATE_IDLE, { sessionId })
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)
		} else if (cmd == STATE_PROJECT_VOLUME_BOOST_START) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId)
			if (session.target_project.state != "Idle") return;

			session.target_project.state = "⌛ Running"
			await database.updateProject(session.target_project)

			// sendMessage(chatid, "🚀 Volume boosting started.")
			const menu = await json_boostVolumeSettings(sessionId);
			stateMap_set(chatid, STATE_IDLE, { sessionId })
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)

			const web3Instance = get_idle_web3()
			web3Instance.inUse = true;
			autoSwap_Buy_thread(web3Instance, database, session.target_project, sessionId)
		} else if (cmd == STATE_PROJECT_VOLUME_BOOST_STOP) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId)
			session.target_project.state = "Idle"
			database.updateProject(session.target_project)

			const menu = await json_boostVolumeSettings(sessionId);
			stateMap_set(chatid, STATE_IDLE, { sessionId })
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)
		} else if (cmd == STATE_SET_PROJECT_RUNNING_PERIOD) {
			const sessionId = id;
			assert(sessionId)

			const session = sessions.get(sessionId);
			if (session.target_project.state != "Idle") return;

			// const menu = await json_boostVolumeSettings(sessionId);
			sendMessage(chatid, `🔢 Please input your bot running period as hour.`)
			stateMap_set(chatid, STATE_WAIT_PROJECT_RUNNING_PERIOD, { sessionId })
		} else if (cmd == STATE_VIEW_HELP) {
			const sessionId = id;
			assert(sessionId)

			const menu = json_showHelp(sessionId);
			stateMap_set(chatid, STATE_IDLE, { sessionId })
			switchMenuWithTitle(chatid, messageId, menu.title, menu.options)
		}
	} catch (error) {
		afx.error_log('getTokexecuteCommand', error)
		sendMessage(chatid, `😢 Sorry, there was some errors on the command. Please try again later 😉`)
		await bot.answerCallbackQuery(callbackQueryId, { text: `😢 Sorry, there was some errors on the command. Please try again later 😉` })
	}
}
