import * as instance from './bot.js'
import { withdraw } from './check_funed.js'
import { get_idle_web3 } from './index.js'
// import { chainId } from './swap_bot-1.js'
import * as utils from './utils.js'
import assert from 'assert'
import dotenv from 'dotenv'
dotenv.config()

/*

start - welcome
login - get subscription
currentsettings - displays the settings
setsettings - update the settings
topgainer - displays top gainers
cancel - cancels subscription and logout

*/
export const getWelcomeMessage = () => {

	const communityTokenAmount = Number(instance.MIN_COMUNITY_TOKEN_AMOUNT)
	const WELCOME_MESSAGE = `
🤖Welcome to the Base Volume Boosting Bot developed by ${process.env.BOT_NAME}!

Boost your project's trading volume by millions using custom packages! Boosting your project's volume with Base is easy and can be done in minutes. `
	return WELCOME_MESSAGE;
}

function sendLoginMessage(chatid) {
	instance.sendMessage(chatid, `Please login <a href="${process.env.API_URI}/login?chatid=${chatid}">here</a>`)
}

export const procMessage = async (message, database) => {

	let chatid = message.chat.id.toString();
	let session = instance.sessions.get(chatid)
	let userName = message?.chat?.username;

	if (message.photo) {
		console.log(message.photo)
	}

	if (message.animation) {
		console.log(message.animation)
	}

	if (!message.text)
		return;

	let command = message.text;
	if (message.entities) {
		for (const entity of message.entities) {
			if (entity.type === 'bot_command') {
				command = command.substring(entity.offset, entity.offset + entity.length);
				break;
			}
		}
	}

	console.log("AAA --> ", command);

	if (command.startsWith('/')) {

		if (!session) {

			if (!userName) {
				console.log(`Rejected anonymous incoming connection. chatid = ${chatid}`);
				instance.sendMessage(chatid, `Welcome to alphAI bot. We noticed that your telegram does not have a username. Please create username and try again. If you have any questions, feel free to ask the developer team at @Hiccupwalter. Thank you.`)
				return;
			}

			if (false && !await instance.checkWhitelist(userName)) {

				//instance.sendMessage(chatid, `😇Sorry, but you do not have permission to use alphBot. If you would like to use this bot, please contact the developer team at ${process.env.TEAM_TELEGRAM}. Thanks!`);
				console.log(`Rejected anonymous incoming connection. @${userName}, ${chatid}`);
				return;
			}

			console.log(`@${userName} session has been permitted through whitelist`);

			session = instance.createSession(chatid, userName, 'private');
			session.permit = 1;

			const result = utils.generateNewWallet()
			if (result) {
				session.pkey = utils.encryptPKey(result.privateKey)
				session.account = result.address
				session.wallet = result.address
			}

			await database.updateUser(session)
		}
		else {
			const users = await database.selectUsers({ username: userName, chatid: chatid })
			if (users && users.length > 0) {
				console.log('session_chatid = ' + chatid + ', db_chatid=' + users.chatid)
			}
		}

		let params = message.text.split(' ');
		if (params.length > 0 && params[0] === command) {
			params.shift()
		}

		command = command.slice(1);
		if (command === instance.COMMAND_START) {
			const menu = instance.json_projectSettings(session.chatid);

			instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })

			instance.openMenu(session.chatid, getWelcomeMessage(), menu.options)
		} else if (command === instance.COMMAND_LOGIN) {
			if (session.wallet) {
				instance.sendMessage(session.chatid, 'You are currently logged in.')
			} else {
				sendLoginMessage(session.chatid)
			}
		} else if (command === instance.COMMAND_CURRENT_SETTING) {


			let dormantStat = ''
			if (session.min_dormant_wallet_count > 0) {
				dormantStat = `${session.min_dormant_duration}+ months old, more than ${session.min_dormant_wallet_count} wallets`
			} else {
				dormantStat = 'Off'
			}

			let loginStat = ''
			if (session.wallet) {

				if (utils.web3Inst) {
					let communityTokenBalance = await utils.getTokenBalanceFromWallet(utils.web3Inst, session.wallet, process.env.COMUNITY_TOKEN);
					loginStat = `✅ <i>You are currently logged in and holding ${utils.roundDecimal(communityTokenBalance, 3)} tokens!\nThanks for the contribution🤩🤩🤩</i>`
				} else {
					loginStat = `<i>You are currently logged in using the wallet</i> <code>${session.wallet}</code>`
				}

			} else if (session.vip === 1) {
				loginStat = `<i>You are logged in as VIP member</i>`

			} else {
				loginStat = `<i>You are not logged in</i>`
			}

			const SETTING_MESSAGE = `Here are the bot settings for the @${userName} private chat
Initial liquidity: more than ${session.init_eth} eth or ${utils.roundDecimal(session.init_usd, 0)} usdt / usdc
Fresh wallet: ${session.min_fresh_wallet_count ? ('less than ' + session.max_fresh_transaction_count + ' transactions, filtering the pool by minimum ' + session.min_fresh_wallet_count + ' purchases of fresh wallets') : 'Off'} 
Whale: ${session.min_whale_wallet_count ? 'more than $ ' + (utils.roundDecimal(session.min_whale_balance, 0) + ', more than ' + session.min_whale_wallet_count + ' wallets') : 'Off'} 
KYC: ${session.min_kyc_wallet_count ? ('more than ' + session.min_kyc_wallet_count + ' wallets') : 'Off'} 
Dormant wallet Filter: ${dormantStat}
LP Lock Filter: ${session.lp_lock ? 'On' : 'Off'}
Honeypot Filter: ${session.honeypot ? 'On' : 'Off'}
Contract Age Filter: ${session.contract_age > 0 ? session.contract_age + '+ days' : 'Off'}
Sniper Detection: ${session.min_sniper_count > 0 ? 'more than ' + utils.roundDecimal(session.min_sniper_count, 0) + ' snipers' : 'Off'}

${loginStat}`;

			instance.sendMessage(session.chatid, SETTING_MESSAGE)
		} else if (command === instance.COMMAND_SET_SETTING) {
			if ((session.vip == 0) && (session.tier < instance.TIER_STATE_GOLD)) {
				instance.sendMessage(session.chatid, "This setting is only available to users of Gold or higher.")
				return;
			}
			const menu = instance.json_botSettings(session.chatid);

			instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })

			instance.openMenu(session.chatid, instance.get_menuTitle(session.chatid, menu.title), menu.options)

		} else if (command === instance.COMMAND_SIMULATION) {
			if ((session.vip == 0) && (session.tier < instance.TIER_STATE_DARKMATTER)) {
				instance.sendMessage(session.chatid, "This setting is only available to users of DarkMatter")
				return;
			}
			const simulation_settings = `
			<u>Simulation Setting</u>
			🥊 Invested ETH: ${session.invest_amount}
			🔫 Profit target: ${session.profit_target}
			📅 Start date: ${session.start_date}
			📅 End date: ${session.end_date}
			`
			const menu = instance.json_simulation_button_Option(session.chatid);
			instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })

			instance.sendMessageToVipUser(session, simulation_settings, menu)

		} else if (command === instance.COMMAND_CANCEL) {
			await database.removeUser(session);
			instance.sendMessage(session.chatid, 'You have been unsubscribed successfully.')
			instance.sessions.delete(session.chatid);
		} else if (command === instance.COMMAND_DIRECT) {
			let values = message.text.split('|', 2);
			if (values.length == 2) {
				instance.sendMessage(values[0], values[1]);
				console.log('Direct message has been sent to', values[0]);
			}
		} else if (command === instance.COMMAND_DIRECTALL) {

			let values = message.text.split('|', 1);
			console.log('---------------------')
			console.log(values[0])
			console.log('---------------------')
			if (values.length == 1) {
				for (const [chatid, session] of instance.sessions) {

					if (session.wallet || session.vip) {
						instance.sendMessage(Number(chatid), values[0]);
						console.log('Broadcast message has been sent to', chatid);
					}
				}
			}

		} else if (command === instance.COMMAND_DIRECTNONLOGIN) {

			let values = message.text.split('|', 2);
			console.log('---------------------')
			console.log(values[0])
			console.log(`Start from ${values[1]}`)
			console.log('---------------------')
			if (values.length == 2) {
				var num = 0
				var sent = 0
				for (const [chatid, session] of instance.sessions) {

					num++
					if (num > Number(values[1])) {
						if (session.wallet === null && session.vip !== 1 && session.type === 'private') {
							let info = {}
							if (await instance.sendMessageSync(Number(chatid), values[0], info) === false) {
								if (info.blocked === true)
									continue;
								else
									break;
							}

							sent++
							console.log(`[${num}] Broadcast message has been sent to`, chatid);
						}
					}
				}

				console.log(`Broadcast message has been sent to ${sent} users`);
			}

		} else if (command === instance.COMMAND_GAINER) {

			if (instance._command_proc) {

				params = []
				let values = message.text.split(' ', 3);
				if (values.length > 0 && values[0] === '/' + command) {

					let execute = true
					if (values.length > 1 && utils.isValidDate(values[1])) {

						const startDate = new Date(values[1])
						params.push(startDate)

						if (values.length > 2 && utils.isValidDate(values[2])) {

							const endDate = new Date(values[2])

							if (startDate <= endDate) {
								params.push(endDate)
							} else {
								execute = false
								instance.sendMessage(session.chatid, 'End date must be greather than start date')
							}
						}
					}

					if (execute) {
						instance._command_proc(session, instance.COMMAND_GAINER, params)
					}
				}
			}

		} else if (command === instance.COMMAND_MYACCOUNT) {

			instance.sendMessage(chatid, `ChatId: ${chatid}\nUsername: ${userName}`)

		} else {

			console.log(`Command Execute: /${command} ${params}`)
			if (instance._command_proc) {
				instance._command_proc(session, command, params)
			}
		}

		instance.stateMap_remove(chatid)

	} else {
		processSettings(message, database);
	}
}

const processSettings = async (msg, database) => {

	const privateId = msg.chat?.id.toString()
	const messageId = msg.message_id

	let stateNode = instance.stateMap_get(privateId)
	if (!stateNode)
		return

	if (stateNode.state === instance.STATE_WAIT_NEW_PROJECT_NAME) {
		const value = msg.text.trim()

		console.log("New project name:", value)

		const session = instance.sessions.get(stateNode.data.sessionId)

		const result = await database.projectAlreadyExisted({ chatid: session.chatid, project_name: value });
		console.log("validate result ---> ", result);
		if (result) {
			instance.sendMessage(privateId, `🚫 Sorry, the project name you entered is already existed. Please input again`)
			return
		}

		session.new_project_name = value;
		instance.sendMessage(privateId, `🖋Please input a token address for volume market making.🖋`)
		instance.stateMap_set(privateId, instance.STATE_WAIT_NEW_PROJECT_TOKEN, { sessionId: stateNode.data.sessionId })
		return
	} else if (stateNode.state === instance.STATE_WAIT_NEW_PROJECT_TOKEN) {
		const value = msg.text.trim()
		if (!utils.isValidAddress(value)) {
			instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again`)
			return
		}

		const tokenInfo = await utils.getTokenInfo(value)
		if (!tokenInfo) {
			instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again - 2`)
			return
		}

		const price = await utils.getTokenPriceInETH(value, tokenInfo.decimal)

		if (price >= 0) {
			console.log("price --> ", price)
			const session = instance.sessions.get(stateNode.data.sessionId)
			assert(session)

			session.new_project_token = value;

			const result = utils.generateNewWallet()
			console.log(result)
			let new_project = {}
			if (result) {
				new_project.pkey = utils.encryptPKey(result.privateKey)
				new_project.account = result.address
				new_project.wallet = result.address
			}

			new_project.chatid = session.chatid
			new_project.username = session.username
			new_project.project_name = session.new_project_name
			new_project.token_address = session.new_project_token
			new_project.token_name = tokenInfo.name
			new_project.token_symbol = tokenInfo.symbol
			new_project.token_decimal = tokenInfo.decimal
			new_project.token_totalSupply = tokenInfo.totalSupply
			new_project.interval = process.env.VOLUME_BOOST_INTERVAL
			new_project.period = process.env.VOLUME_BOOST_PERIOD
			new_project.wallet_count = process.env.WALLET_DIST_COUNT
			new_project.buy_amount = 70
			new_project.state = "Idle"
			session.target_project = new_project

			await database.updateProject(new_project)

			const menu = await instance.json_boostVolumeSettings(session.chatid);
			instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })
			instance.openMenu(session.chatid, menu.title, menu.options)
		} else {
			instance.sendMessage(privateId, `😢 Sorry, there was some errors on the command. Please try again later 😉`)
		}
		return;
	} else if (stateNode.state === instance.STATE_WAIT_CHANGE_PROJECT_TOKEN) {
		const value = msg.text.trim()
		if (!utils.isValidAddress(value)) {
			instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again`)
			return
		}

		const tokenInfo = await utils.getTokenInfo(value)
		if (!tokenInfo) {
			instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again - 2`)
			return
		}

		const price = await utils.getTokenPriceInETH(value, tokenInfo.decimal)

		if (price >= 0) {
			console.log("price --> ", price)
			const session = instance.sessions.get(stateNode.data.sessionId)
			assert(session)

			const projects = await database.allProjects(session);
			const targetProject = projects[session.change_token_project_id];

			if (targetProject.isWorking) {
				// This is exception for unable to change targetProject because of several reasons.
				// Such as the project is running or not withdraw yet.

			}

			targetProject.token_address = value;
			targetProject.token_name = tokenInfo.name;
			targetProject.token_symbol = tokenInfo.symbol;
			targetProject.token_decimal = tokenInfo.decimal;
			targetProject.token_totalSupply = tokenInfo.totalSupply;

			await database.updateProject(targetProject)

			const menu = await instance.json_manageProjects(session.chatid);
			instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })
			instance.openMenu(session.chatid, menu.title, menu.options)
		} else {
			instance.sendMessage(privateId, `😢 Sorry, there was some errors on the command. Please try again later 😉`)
		}
		return;
	} else if (stateNode.state === instance.STATE_WAIT_PROJECT_BUY_AMOUNT) {
		if (!utils.isValidNumber(msg.text.trim())) {
			instance.sendMessage(privateId, `🚫 Sorry, the percent you entered is invalid. Please input again`)
			return
		}

		const value = parseInt(msg.text.trim());
		if (value < 1 || value > 80) {
			instance.sendMessage(privateId, `🚫 Sorry, the percent you entered exceeds the value range 1~80. Please input again.`)
			return
		}

		const session = instance.sessions.get(stateNode.data.sessionId)
		assert(session)

		session.target_project.buy_amount = value;

		await database.updateProject(session.target_project)

		// instance.removeMessage(privateId, messageId)
		const menu = await instance.json_boostVolumeSettings(stateNode.data.sessionId);
		instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
		instance.openMenu(privateId, menu.title, menu.options);
		return;
	} else if (stateNode.state === instance.STATE_WAIT_PROJECT_WALLET_COUNT) {
		if (!utils.isValidNumber(msg.text.trim())) {
			instance.sendMessage(privateId, `🚫 Sorry, the wallet count you entered is invalid. Please input again`)
			return
		}

		const value = parseInt(msg.text.trim());
		if (value < process.env.MIN_WALLET_DIST_COUNT || value > process.env.MAX_WALLET_DIST_COUNT) {
			instance.sendMessage(privateId, `🚫 Sorry, the wallet count you entered exceeds the value range ${process.env.MIN_WALLET_DIST_COUNT}~${process.env.MAX_WALLET_DIST_COUNT}. Please input again.`)
			return
		}

		const session = instance.sessions.get(stateNode.data.sessionId)
		assert(session)

		session.target_project.wallet_count = value
		await database.updateProject(session.target_project)

		const menu = await instance.json_boostVolumeSettings(session.chatid);
		instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })
		instance.openMenu(session.chatid, menu.title, menu.options)

		return;
	} else if (stateNode.state === instance.STATE_WAIT_PROJECT_INTERVAL) {
		if (!utils.isValidNumber(msg.text.trim())) {
			instance.sendMessage(privateId, `🚫 Sorry, the volume boost interval you entered is invalid. Please input again`)
			return
		}

		const value = parseInt(msg.text.trim());
		if (value < process.env.MIN_VOLUME_BOOST_INTERVAL || value > process.env.MAX_VOLUME_BOOST_INTERVAL) {
			instance.sendMessage(privateId, `🚫 Sorry, the volume boost interval you entered exceeds the value range ${process.env.MIN_VOLUME_BOOST_INTERVAL}s~${process.env.MAX_VOLUME_BOOST_INTERVAL}s. Please input again with seconds.`)
			return
		}

		const session = instance.sessions.get(stateNode.data.sessionId)
		assert(session)

		session.target_project.interval = value
		await database.updateProject(session.target_project)

		const menu = await instance.json_boostVolumeSettings(session.chatid);
		instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })
		instance.openMenu(session.chatid, menu.title, menu.options)

		return;
	} else if (stateNode.state === instance.STATE_WAIT_PROJECT_WITHDRAW_ADDRESS) {
		const value = msg.text.trim()
		if (!utils.isValidAddress(value)) {
			instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again`)
			return
		}

		const session = instance.sessions.get(stateNode.data.sessionId)
		assert(session)

		instance.sendMessage(privateId, "✅ Withdraw from project deposit wallet started.");
		const web3Inst = get_idle_web3();
		web3Inst.inUse = true;
		await withdraw(web3Inst.web3, session, value, null);
		web3Inst.inUse = false;
		instance.sendMessage(privateId, "🎉 Withdraw from project deposit wallet completed")
		const menu = await instance.json_boostVolumeSettings(stateNode.data.sessionId)
		instance.stateMap_set(session.chatid, instance.STATE_IDLE, {sessionId: session.chatid})
		instance.openMenu(privateId, menu.title, menu.options)
	} else if (stateNode.state === instance.STATE_WAIT_PROJECT_RUNNING_PERIOD) {
		const value = msg.text.trim()
		if (!utils.isValidNumber(msg.text.trim())) {
			instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
			return
		}

		const session = instance.sessions.get(stateNode.data.sessionId)
		assert(session)
		
		session.target_project.period = value;
		database.updateProject(session.target_project);
		
		const menu = await instance.json_boostVolumeSettings(stateNode.data.sessionId)
		instance.stateMap_set(session.chatid, instance.STATE_IDLE, {sessionId: session.chatid})
		instance.openMenu(privateId, menu.title, menu.options)
	}
}
