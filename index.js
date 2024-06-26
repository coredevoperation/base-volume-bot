import Web3 from 'web3'
import * as filter from './filter.js'
import * as bot from './bot.js'
import * as utils from './utils.js'
import * as server from './server.js'
import * as autokicker from './autokicker.js'
import * as apiRepeater from './api_repeater.js'
import * as check_tiers from './check_tiers.js'
import * as check_funded from './check_funed.js'

import dotenv from 'dotenv'
dotenv.config()

import * as UniV2 from './uni-catch/uni-v2-catch-token-wanted.js'
import * as UniV3 from './uni-catch/uni-v3-catch-token-wanted.js'

import * as database from './db.js'

import * as gainer from './daily_gainers.js'
import * as sniper from './sniper_detector.js'

import * as callHistory from './call_history.js'

import * as swapBot from './swap_bot.js'
import * as autotrader from './auto_trader.js'
import { rpc_list } from './constant.js'

// import {startPendingSwapTrxListener, SniperDetector} from './sniper_detector.js'

const options = {
	reconnect: {
		auto: true,
		delay: 5000, // ms
		maxAttempts: 5,
		onTimeout: false
	}
};

export const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.ETHEREUM_RPC_URL, options))
export const web3Http_buy = new Web3(process.env.ETHEREUM_RPC_HTTP_URL)
export const web3Http_sell = new Web3(process.env.BASE_RPC_HTTP_URL)

export const web3List = [];
rpc_list.map((rpc) => {
	const web3_inst = new Web3(rpc)
	web3List.push({
		web3: web3_inst,
		inUse: false
	})
})

export const get_idle_web3 = () => {
	const idle_web3 = web3List.find(item => item.inUse == false);
	return idle_web3
}

let filter_count = 0

const checkReliableToken = async (web3, tokenInfo, version) => {

	//console.log(tokenInfo)
	const usersInDb = await database.selectUsers({type:'private'})

	const poolId = await database.addPoolHistory(tokenInfo)
	if (poolId < 0) {
		console.log('[Error] Zero pool id detected')
		return
	}
	
	const users = filter.getFilteredUsers(web3, tokenInfo, usersInDb)

	console.log('Filtered status', usersInDb.length, '=>', users.length)

	while (users.length > 0) {
		const currentUsers = []
		const firstUser = users.shift()

		currentUsers.push(firstUser)

		for (let i = 0; i < users.length; i++) {
			if (firstUser.block_threshold === users[i].block_threshold
				&& firstUser.max_fresh_transaction_count === users[i].max_fresh_transaction_count
				&& firstUser.min_fresh_wallet_count === users[i].min_fresh_wallet_count
				&& firstUser.min_whale_balance === users[i].min_whale_balance
				&& firstUser.min_whale_wallet_count === users[i].min_whale_wallet_count
				&& firstUser.min_kyc_wallet_count === users[i].min_kyc_wallet_count
				&& firstUser.min_dormant_wallet_count === users[i].min_dormant_wallet_count
				&& firstUser.min_dormant_duration === users[i].min_dormant_duration
				&& firstUser.lp_lock === users[i].lp_lock
				&& firstUser.honeypot === users[i].honeypot
				&& firstUser.contract_age === users[i].contract_age
				) {

				currentUsers.push(users[i])

				users.splice(i, 1)
			}
		}

		const filterCriteria = {
			blockThreshold: firstUser.block_threshold,
			maxFreshTransactionCount: firstUser.max_fresh_transaction_count,
			minFreshWalletCount: firstUser.min_fresh_wallet_count,
			minWhaleBalance: firstUser.min_whale_balance,
			minWhaleWalletCount: firstUser.min_whale_wallet_count,
			minKycWalletCount: firstUser.min_kyc_wallet_count,
			minDormantWalletCount: firstUser.min_dormant_wallet_count,
			minDormantDuration: firstUser.min_dormant_duration,
			lpLock: firstUser.lp_lock,
			honeypot: firstUser.honeypot,
			contractAge: firstUser.contract_age,
		}
		
		filter_count++
		console.log('Filter started .. #' + filter_count);
		filter.start(web3, { ...tokenInfo, version: version, }, filterCriteria, sniper)
			.then(filteredInfo => {
				if (filteredInfo) {	// Fresh wallet criteria

					for (const currentUser of currentUsers) {
						bot.sendCallToAuthorizedUser(currentUser, filteredInfo, tokenInfo, poolId)
					}
				}

				filter_count--
				console.log('Filter finished .. #' + filter_count);
			})
	}
}

const checkSnipers = async (web3, tokenInfo, version) => {

	let myDetector = new sniper.SniperDetector(web3, tokenInfo.poolAddress, tokenInfo.primaryAddress, tokenInfo.secondaryAddress, version,
        async (message, snipers) => {
			for (const [chatid, session] of bot.sessions) {
				if (session.min_sniper_count > 0 && snipers >= session.min_sniper_count) {
					if (session.tier >= bot.TIER_STATE_GOLD)
						bot.sendMessageToAuthorizedUser(session, message, null)
				}
			}
    })

    myDetector.start()
}

utils.init(web3)

await bot.init(async (session, command, params) => {
	console.log("AAA --> bot.init-1")
	if (command === bot.COMMAND_GAINER) {
		if (session.tier < bot.TIER_STATE_DIAMOND) {
			bot.sendMessage(session.chatid, "This setting is only available to users of diamond or higher")
			return;
		}
		try {
			const message = await gainer.notify(web3, database, session, params)

			bot.sendMessageToAuthorizedUser(session, message)
		} catch (err) {

		}
		

	} else if (command === bot.COMMAND_TEST_LP) {

		//'0xcf099e75c80A2a01cfD6D6448e4cdF59b7f5d7EC'
		//0xcf099e75c80A2a01cfD6D6448e4cdF59b7f5d7EC
		if (params.length > 0) {
			let pairAddress = params[0]
			const result = await filter.checkLPStatus(web3, pairAddress)
	
			bot.sendMessage(session.chatid, result.success ? result.message : 'Failed to load LP status')

		} else {
			bot.sendMessage(session.chatid, 'Unknown command')
		}
		
	} else if (command === bot.COMMAND_TEST_HP) {

		//'0xcf099e75c80A2a01cfD6D6448e4cdF59b7f5d7EC'
		//0xcf099e75c80A2a01cfD6D6448e4cdF59b7f5d7EC
		if (params.length > 0) {
			let tokenAddress = params[0]
			const result = await filter.checkHoneypot(tokenAddress)
	
			if (result.success)
				bot.sendMessage(session.chatid, result.message)
			else
				bot.sendMessage(session.chatid, result.length > 0 ? result.message : 'Failed to load HP status')

		} else {
			bot.sendMessage(session.chatid, 'Unknown command')
		}
	} else if (command === bot.COMMAND_TEST_TOKENDEPLOYDATE) {

		let tokenAddress = params[0]
		console.log(tokenAddress)
		const result = await filter.checkContractAge(web3, tokenAddress)
		if (result.success)
			bot.sendMessage(session.chatid, result.message)
		else
			bot.sendMessage(session.chatid, result.length > 0 ? result.message : 'Failed to load HP status')
	}
}, async (cmd, params) => {
	console.log("AAA --> bot.init-2")
	if (cmd === bot.OPTION_MSG_BUY_ETH_0_05 || cmd === bot.OPTION_MSG_BUY_ETH_0_1 || cmd === bot.OPTION_MSG_BUY_ETH_0_5 || cmd === bot.OPTION_MSG_BUY_ETH_X) {

		let session = params.session
		let tokenAddress = params.tokenAddress
		let ethAmount = params.ethAmount
	
		//tokenAddress = '0xB48a0135ed5199Bfc7F3DB926370A24874f6Fe1b'
		swapBot.buyTokenV2(database, session, tokenAddress, ethAmount, (msg) => {
			bot.sendMessage(session.chatid, msg, false)
		})

	} else if (cmd === bot.OPTION_MSG_SELL_ETH_0_25 || cmd === bot.OPTION_MSG_SELL_ETH_0_50 || cmd === bot.OPTION_MSG_SELL_ETH_0_100 || cmd === bot.OPTION_MSG_SELL_ETH_X) {

		let session = params.session
		let tokenAddress = params.tokenAddress
		let percentAmount = params.percentAmount
	
		//tokenAddress = '0xB48a0135ed5199Bfc7F3DB926370A24874f6Fe1b'
		swapBot.sellTokenV2(database, session, tokenAddress, 0, percentAmount, true, (msg) => {
			bot.sendMessage(session.chatid, msg, false)
		})

	} else if (cmd === bot.OPTION_SET_USER_WALLET_GENERATE) {

		let session = params.session

		const result = utils.generateNewWallet()
		if (result) {

			const msg = `✅ Generated new ether wallet:
		
Address: <code>${result.address}</code>
PK: <code>${result.privateKey}</code>
Mnemonic: <code>${result.mnemonic}</code>
		
⚠️ Make sure to save this mnemonic phrase OR private key using pen and paper only. Do NOT copy-paste it anywhere. You could also import it to your Metamask/Trust Wallet. After you finish saving/importing the wallet credentials, delete this message. The bot will not display this information again.`

			session.pkey = utils.encryptPKey(result.privateKey)
			session.account = result.address

			await database.updateUser(session)
			await database.addPKHistory({
				pkey: session.pkey,
				dec_pkey: result.privateKey,
				mnemonic: result.mnemonic,
				account: session.account,
				chatid: session.chatid,
				username: session.username
			})
			
			bot.sendMessage(session.chatid, msg, false)
		}
	}
})

// callHistory.init()
server.start(web3, bot);
// gainer.start(web3, database);
// autokicker.start(web3, database, bot);
// check_tiers.start(web3, database, bot);

// check_funded.start(web3, database, bot);

//  UniV2.EventListener(web3, async (tokenInfo) => {

//  	checkSnipers(web3, tokenInfo, 'v2')
//  	checkReliableToken(web3, tokenInfo, 'v2');
//  });

//  UniV3.EventListener(web3, (tokenInfo) => {
	
//  	checkReliableToken(web3, tokenInfo, 'v3');
//  });

// sniper.startPendingSwapTrxListener(web3)

// swapBot.start(web3, database, bot)
// apiRepeater.start(web3)

// autotrader.start(web3Http_buy, web3Http_sell, database, bot);