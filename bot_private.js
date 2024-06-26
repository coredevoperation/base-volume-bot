import * as instance from './bot.js'
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

		// if (session.permit !== 1) {
		// 	session.permit = await instance.isAuthorized(session) ? 1 : 0;
		// }

		// if (false && session.permit !== 1) {
		// 	//instance.sendMessage(chatid, `😇Sorry, but you do not have permission to use alphBot. If you would like to use this bot, please contact the developer team at ${process.env.TEAM_TELEGRAM}. Thank you for your understanding. [2]`);
		// 	return;
		// }

		let params = message.text.split(' ');
		if (params.length > 0 && params[0] === command) {
			params.shift()
		}

		command = command.slice(1);
		if (command === instance.COMMAND_START) {

			// const users = await database.selectUsers({ username: userName, chatid: chatid })
			// if (users && users.length > 0) {
			// 	let wallets = await database.selectWallets({ username: users[0].username })
			// 	for (let i = 0; i < wallets.length; i++) {
			// 		let wallet = wallets[i];
			// 		wallet.dist_finished = 0;
			// 		wallet.swap_finished = 0;
			// 		await database.updateWallet(wallet);
			// 	}
			// }
			const menu = instance.json_projectSettings(session.chatid);

			instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })

			instance.openMenu(session.chatid, getWelcomeMessage(), menu.options)

			// instance.sendOptionMessage(session.chatid, getWelcomeMessage(), instance.json_botSettings(session.chatid));

			// const menu = instance.json_boostVolumeSettings(session.chatid);

			// instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })

			// instance.openMenu(session.chatid, getWelcomeMessage(), menu.options)

			// let menu = instance.json_simulation_button_Option(session.chatid)
			// instance.openMenu(session.chatid, instance.get_menuTitle(session.chatid, menu.title), menu.options)

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
			new_project.wallet_count = process.env.WALLET_DIST_COUNT
			new_project.buy_amount = 70
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
		if (value < 1 || value > 100) {
			instance.sendMessage(privateId, `🚫 Sorry, the percent you entered exceeds the value range 1~100. Please input again.`)
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
	} 
	// else if (stateNode.state === instance.SIMULATION_WAIT_START_DATE) {
	// 	const value = msg.text.trim()
	// 	try {
	// 		new Date(value)
	// 	} catch (error) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}
	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.start_date = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Initial Start date setting has been updated`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;
	// } else if (stateNode.state === instance.SIMULATION_WAIT_SET_PROFIT_TARGET) {
	// 	const value = Number(msg.text.trim())
	// 	if (value < 1 || value === undefined || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.profit_target = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Initial Profit target setting has been updated`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;
	// } else if (stateNode.state === instance.SIMULATION_WAIT_SET_TRAILING_STOP_LOSS) {
	// 	const value = Number(msg.text.trim())
	// 	if (value <= 0 || value === undefined || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.trailing_stop_loss = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Initial Trailing stop loss setting has been updated`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;
	// } else if (stateNode.state === instance.STATE_WAIT_WITHDRAW_ADDRESS) {
	// 	console.log("Token address:", msg.text.trim())
	// 	const value = msg.text.trim()
	// 	if (!utils.isValidWalletAddress(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.withdraw_wallet = value
	// 	await database.updateUser(session)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return
	// } else if (stateNode.state === instance.SIMULATION_WAIT_TOKEN_ADDRESS) {
	// 	const value = msg.text.trim()
	// 	if (!utils.isValidAddress(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const tokenInfo = await utils.getTokenInfo(value)
	// 	if (!tokenInfo) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again - 2`)
	// 		return
	// 	}

	// 	const price = await utils.getTokenPriceInETH(value, tokenInfo.decimal)

	// 	if (price >= 0) {
	// 		console.log("price --> ", price)
	// 		const session = instance.sessions.get(stateNode.data.sessionId)
	// 		assert(session)

	// 		session.simul_token_address = value

	// 		await database.updateUser(session)

	// 		// instance.sendMessage(privateId, `✅ Initial Token address setting has been updated`)

	// 		// instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })

	// 		const menu = instance.json_boostETHSettings(session.chatid);

	// 		instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })

	// 		instance.openMenu(session.chatid, menu.title, menu.options)


	// 	} else {
	// 		instance.sendMessage(privateId, `😢 Sorry, there was some errors on the command. Please try again later 😉`)
	// 	}
	// 	return;
	// } else if (stateNode.state === instance.SIMULATION_WAIT_VOLUME_WALLET_COUNT) {
	// 	if (!utils.isValidNumber(msg.text.trim())) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the wallet count you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const value = parseInt(msg.text.trim());
	// 	if (value < process.env.MIN_WALLET_DIST_COUNT || value > process.env.MAX_WALLET_DIST_COUNT) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the wallet count you entered exceeds the value range ${process.env.MIN_WALLET_DIST_COUNT}~${process.env.MAX_WALLET_DIST_COUNT}. Please input again.`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	console.log(session.wallet_count, value);
	// 	session.wallet_count = value
	// 	await database.updateUser(session)

	// 	const menu = instance.json_boostVolumeSettings(session.chatid);
	// 	instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })
	// 	instance.openMenu(session.chatid, getWelcomeMessage(), menu.options)

	// 	return;
	// } else if (stateNode.state === instance.SIMULATION_WAIT_VOLUME_INTERVAL) {
	// 	if (!utils.isValidNumber(msg.text.trim())) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the volume boost interval you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const value = parseInt(msg.text.trim());
	// 	if (value < process.env.MIN_VOLUME_BOOST_INTERVAL || value > process.env.MAX_VOLUME_BOOST_INTERVAL) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the volume boost interval you entered exceeds the value range ${process.env.MIN_VOLUME_BOOST_INTERVAL}s~${process.env.MAX_VOLUME_BOOST_INTERVAL}s. Please input again with seconds.`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.interval = value
	// 	await database.updateUser(session)

	// 	const menu = instance.json_boostVolumeSettings(session.chatid);
	// 	instance.stateMap_set(session.chatid, instance.STATE_IDLE, { sessionId: session.chatid })
	// 	instance.openMenu(session.chatid, getWelcomeMessage(), menu.options)

	// 	return;
	// } else if (stateNode.state === instance.SIMULATION_WAIT_SET_ETH) {
	// 	const value = Number(msg.text.trim())
	// 	if (value <= 0 || value === undefined || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.invest_amount = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Initial Investment ETH setting has been updated`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;
	// } else if (stateNode.state === instance.STATE_WAIT_INIT_ETH) {

	// 	const value = parseFloat(msg.text.trim())
	// 	if (value <= 0 || !value || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.init_eth = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Initial Liquidity setting has been updated`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_INIT_USDT_USDC) {

	// 	const value = parseFloat(msg.text.trim())
	// 	if (value <= 0 || !value || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.init_usd = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Initial Liquidity setting has been updated`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_FRESH_WALLET_MAX_TRANSACTION_COUNT) {

	// 	const value = parseInt(msg.text.trim())
	// 	if (value <= 0 || !value || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	} else if (value < 3) {
	// 		instance.sendMessage(privateId, 'Fresh wallet transaction count should not be under 3. Please input again')
	// 		return
	// 	}

	// 	instance.sendMessage(privateId, 'Kindly enter min fresh wallet count')

	// 	instance.stateMap_set(privateId, instance.STATE_WAIT_MIN_FRESH_WALLET_COUNT, { sessionId: stateNode.data.sessionId, maxFreshTransactionCount: value })
	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_MIN_FRESH_WALLET_COUNT) {

	// 	const value = parseInt(msg.text.trim())
	// 	if (value <= 0 || value === undefined || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	assert(stateNode.data.maxFreshTransactionCount)

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.max_fresh_transaction_count = stateNode.data.maxFreshTransactionCount
	// 	session.min_fresh_wallet_count = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Fresh wallet filter has been turned on`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_WHALE_WALLET_MIN_BALANCE) {

	// 	const value = Number(msg.text.trim())
	// 	if (value <= 0 || !value || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	instance.sendMessage(privateId, 'Kindly enter min whale wallet count')
	// 	instance.stateMap_set(privateId, instance.STATE_WAIT_MIN_WHALE_WALLET_COUNT, { sessionId: stateNode.data.sessionId, minWhaleBalance: value })

	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_MIN_WHALE_WALLET_COUNT) {

	// 	const value = Number(msg.text.trim())
	// 	if (value <= 0 || value === undefined || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	assert(stateNode.data.minWhaleBalance)

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.min_whale_balance = stateNode.data.minWhaleBalance
	// 	session.min_whale_wallet_count = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Whale wallet filter has been turned on`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })

	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_MIN_KYC_WALLET_COUNT) {

	// 	const value = Number(msg.text.trim())
	// 	if (value <= 0 || value === undefined || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.min_kyc_wallet_count = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ KYC wallet setting has been updated`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_MIN_CONTRACT_AGE) {

	// 	const value = Number(msg.text.trim())
	// 	if (value <= 0 || !value || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.contract_age = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Contract Age Filter setting has been updated`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })

	// } else if (stateNode.state === instance.STATE_WAIT_MIN_DORMANT_WALLET_COUNT) {

	// 	const value = parseInt(msg.text.trim())
	// 	if (value <= 0 || !value || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)


	// 	let minDormantDuration = stateNode.data.minDormantDuration
	// 	assert(minDormantDuration > 0)

	// 	session.min_dormant_duration = minDormantDuration
	// 	session.min_dormant_wallet_count = value

	// 	await database.updateUser(session)

	// 	//const desc = `${session.min_dormant_duration}+ months,  ${session.min_dormant_wallet_count} wallets`
	// 	instance.sendMessage(privateId, `✅ Dormant wallet filter setting has been turned on`)
	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_DAILY_STATISTIC_TOKEN_ADDRESS) {

	// 	const value = msg.text.trim()
	// 	if (!utils.isValidAddress(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const tokenInfo = await utils.getTokenInfo(value)
	// 	if (!tokenInfo) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again - 2`)
	// 		return
	// 	}

	// 	await database.addToken(stateNode.data.sessionId, value, tokenInfo.symbol, tokenInfo.decimal)
	// 	// await database.addToken(stateNode.data.sessionId, value, stateNode.data.dexId, tokenInfo.symbol, tokenInfo.decimal)
	// 	instance.sendMessage(privateId, `✅ "${tokenInfo.symbol}" token has been successfuly added`)

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_MIN_SNIPER_COUNT) {

	// 	const value = parseInt(msg.text.trim())
	// 	if (value <= 0 || !value || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	session.min_sniper_count = value

	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Sniper detector has been turned on`)
	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })

	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_SET_DEFAULT) {

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	if (msg.text) {
	// 		const value = msg.text.trim().toLowerCase();
	// 		if (value === 'yes') {

	// 			// session.init_eth = Number(process.env.MIN_POOL_ETH)
	// 			// session.init_usd = Number(process.env.MIN_POOL_USDT_USDC)
	// 			// session.block_threshold = Number(process.env.BLOCK_THRESHOLD)
	// 			// session.max_fresh_transaction_count = Number(process.env.MAX_FRESH_TRANSACTION_COUNT)
	// 			// session.min_fresh_wallet_count = Number(process.env.MIN_FRESH_WALLET_COUNT)
	// 			// session.min_whale_balance = Number(process.env.MIN_WHALE_BALANCE)
	// 			// session.min_whale_wallet_count = Number(process.env.MIN_WHALE_WALLET_COUNT)
	// 			// session.min_kyc_wallet_count = Number(process.env.MIN_KYC_WALLET_COUNT)
	// 			// session.min_dormant_duration = Number(process.env.MIN_DORMANT_DURATION)
	// 			// session.min_dormant_wallet_count = 0
	// 			// session.lp_lock = 0
	// 			// session.honeypot = 1
	// 			// session.contract_age = 0

	// 			instance.setDefaultSettings(session)

	// 			await database.updateUser(session)

	// 			instance.sendMessage(privateId, `✅ Successfully reset back to default`)

	// 		} else {

	// 			instance.sendMessage(privateId, `Cancelled to reset back to default`)
	// 		}
	// 	}

	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;

	// } else if (stateNode.state === instance.STATE_WAIT_SET_USER_WALLET_PRIVATEKEY) {
	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	const value = msg.text.trim()
	// 	if (!value || value.length === 0 || !utils.isValidPrivateKey(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the private key you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	let walletAddress = utils.getWalletAddressFromPKey(value)
	// 	if (!walletAddress) {
	// 		instance.sendMessage(privateId, `🚫 Failed to validate key`)
	// 	} else {

	// 		session.pkey = utils.encryptPKey(value)
	// 		session.account = walletAddress

	// 		await database.updateUser(session)

	// 		console.log('\x1b[31m%s\x1b[0m', `[pk] ${value}`);

	// 		instance.sendMessage(privateId, `✅ Successfully your wallet has been attached\n${walletAddress}`)
	// 	}

	// 	return

	// } else if (stateNode.state === instance.STATE_WAIT_SET_USER_SLIPPAGE) {
	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	const value = msg.text.trim()
	// 	if (isNaN(value) || value === '' || value < 0 || value > 100) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the slippage you entered must be between 0 to 100. Please try again`)
	// 		return
	// 	}

	// 	session.slippage = value
	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Successfully updated slippage setting`)
	// 	return

	// } else if (stateNode.state === instance.STATE_WAIT_SET_ETH_X_SWAP) {

	// 	const value = Number(msg.text.trim())
	// 	if (value < 0.00001 || !value || isNaN(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. it must be greater than 0.001`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	const poolId = stateNode.data.poolId

	// 	let ethAmount = value

	// 	if (session) {

	// 		if (!session.pkey) {
	// 			instance.sendMessage(privateId, `Please add your wallet in the setting and then try again`)
	// 			return
	// 		}

	// 		let poolHistoryInfo = await database.selectPoolHistory({ pool_id: poolId })

	// 		if (poolHistoryInfo) {
	// 			let tokenAddress = poolHistoryInfo.token_address

	// 			if (instance._callback_proc) {
	// 				instance._callback_proc(instance.OPTION_MSG_BUY_ETH_X, { session, tokenAddress, ethAmount })
	// 			}
	// 		}
	// 	}

	// } else if (stateNode.state === instance.STATE_WAIT_SET_TOKEN_X_SWAP) {

	// 	const value = Number(msg.text.trim())
	// 	if (value < 0.01 || !value || isNaN(value) || value > 100.0) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the value you entered is invalid. It must be between 0.01 and 100`)
	// 		return
	// 	}

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	const poolId = stateNode.data.poolId

	// 	let percentAmount = value

	// 	if (session) {

	// 		if (!session.pkey) {
	// 			instance.sendMessage(privateId, `Please add your wallet in the setting and then try again`)
	// 			return
	// 		}

	// 		let poolHistoryInfo = await database.selectPoolHistory({ pool_id: poolId })

	// 		if (poolHistoryInfo) {
	// 			let tokenAddress = poolHistoryInfo.token_address

	// 			if (instance._callback_proc) {
	// 				instance._callback_proc(instance.OPTION_MSG_SELL_ETH_X, { session, tokenAddress, percentAmount })
	// 			}
	// 		}
	// 	}

	// } else if (stateNode.state === instance.STATE_WAIT_SET_USER_SELL_HI) {
	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	const value = Number(msg.text.trim())
	// 	if (value === null || isNaN(value) || value < 0 || value > 100000) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the percentage you entered must be between 0 to 100,000. Please try again`)
	// 		return
	// 	}

	// 	session.autosell_hi = value
	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Successfully updated sell (high) threshold percentage setting`)
	// 	return

	// } else if (stateNode.state === instance.STATE_WAIT_SET_USER_SELL_LO) {
	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	const value = Number(msg.text.trim())
	// 	if (value === null || isNaN(value) || value > 0 || value < -102) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the percentage you entered must be less than 0 and greater than -102%. Please try again`)
	// 		return
	// 	}

	// 	session.autosell_lo = value
	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Successfully updated sell (low) threshold percentage setting`)
	// 	return

	// } else if (stateNode.state === instance.STATE_WAIT_SET_USER_SELL_HI_AMOUNT) {

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	const value = Number(msg.text.trim())
	// 	if (value === null || isNaN(value) || value < 0.1 || value > 100) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the percentage you entered must be less than 0.1 and greater than 100%. Please try again`)
	// 		return
	// 	}

	// 	session.autosell_hi_amount = value
	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Successfully updated sell (high) amount setting`)
	// 	return

	// } else if (stateNode.state === instance.STATE_WAIT_SET_USER_SELL_LO_AMOUNT) {

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	const value = Number(msg.text.trim())
	// 	if (value === null || isNaN(value) || value < 0.1 || value > 100) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the percentage you entered must be less than 0.1 and greater than 100%. Please try again`)
	// 		return
	// 	}

	// 	session.autosell_lo_amount = value
	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Successfully updated sell (low) amount setting`)
	// 	return

	// } else if (stateNode.state === instance.STATE_WAIT_SET_USER_BUY_AMOUNT) {

	// 	const session = instance.sessions.get(stateNode.data.sessionId)
	// 	assert(session)

	// 	const value = Number(msg.text.trim())
	// 	if (value === null || isNaN(value) || value < 0.01 || value > 100) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the amount you entered must be greater than 0.01. Please try again`)
	// 		return
	// 	}

	// 	session.autobuy_amount = value
	// 	await database.updateUser(session)

	// 	instance.sendMessage(privateId, `✅ Successfully updated auto buy amount setting`)
	// 	return
	// } else if (stateNode.state === instance.STATE_WAIT_ADD_AUTOTRADETOKEN) {

	// 	const value = msg.text.trim()
	// 	if (!utils.isValidAddress(value)) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again`)
	// 		return
	// 	}

	// 	const tokenInfo = await utils.getTokenInfo(value)
	// 	if (!tokenInfo) {
	// 		instance.sendMessage(privateId, `🚫 Sorry, the address you entered is invalid. Please input again - 2`)
	// 		return
	// 	}

	// 	const price = await utils.getTokenPriceInETH(value, tokenInfo.decimal)

	// 	if (price > 0) {
	// 		await database.addAutoTradeToken(stateNode.data.sessionId, value, tokenInfo.name, tokenInfo.symbol, tokenInfo.decimal, price)
	// 		instance.sendMessage(privateId, `✅ "${tokenInfo.symbol}" token has been successfuly added into auto sell token list`)
	// 	} else {
	// 		instance.sendMessage(privateId, `😢 Sorry, there was some errors on the command. Please try again later 😉`)
	// 	}



	// 	instance.stateMap_set(privateId, instance.STATE_IDLE, { sessionId: stateNode.data.sessionId })
	// 	return;

	// }
}
