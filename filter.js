import EventEmitter from 'events'

import { TOKEN_ABI } from './abi/TOKEN_ABI.js'
import { ERC20_ABI } from './abi/ERC20_ABI.js'
import { Uniswap_V2_Pool_ABI } from './Uniswap_V2_Pool_ABI.js'
import { Uniswap_V3_Pool_ABI } from './Uniswap_V3_Pool_ABI.js'
import * as uniconst from './uni-catch/const.js'
import { checkCEXWallet as checkKycWalletFromDB } from './db.js'
import * as afx from './global.js'
import * as utils from './utils.js'
import * as ethscan_api from './etherscan-api.js'
import * as apiRepeater from './api_repeater.js'

const MAX_TRANSACTION_COUNT = 100

export const getFilteredUsers = (web3, tokenInfo, usersInDb) => {

	let users = []
	for (const user of usersInDb) {

		if (user.wallet || user.vip === 1) {

			if (tokenInfo.secondaryAddress.toLowerCase() == uniconst.WETH_ADDRESS.toLowerCase()) {

				tokenInfo.initialLiquidity = parseFloat(web3.utils.fromWei(tokenInfo.secondaryAmount, "ether"))
				if (!user.init_eth || tokenInfo.initialLiquidity < parseFloat(user.init_eth)) {
					continue
				}

			} else if (tokenInfo.secondaryAddress.toLowerCase() == uniconst.USDT_ADDRESS.toLowerCase() || tokenInfo.secondaryAddress.toLowerCase() == uniconst.USDC_ADDRESS.toLowerCase()) {

				tokenInfo.initialLiquidity = parseFloat(web3.utils.fromWei(tokenInfo.secondaryAmount, "mwei"))
				if (!user.init_usd || tokenInfo.initialLiquidity < parseFloat(user.init_usd)) {
					continue
				}

			} else {
				continue
			}

			users.push(user)
		}
	}

	return users
}

export const getScamInfo = (web3, tokenDetailInfo, checksumForContract) => {

	if (!tokenDetailInfo.contract || !tokenDetailInfo.contract.functions) {
		return ''
	}

	const data = tokenDetailInfo.contract.functions

	var jsonArr = []
	if (Array.isArray(data)) {

		jsonArr = data

	} else {
		for (var key in data) {
			jsonArr.push(data[key])
		}
	}

	const scamTerms = ['tax', 'enable', 'disable', 'tx', 'bot', 'fee', 'upgrade']

	let result = '\n\n<u>Scam Info</u>'
	let susFuncShowLimit = 5

	let tempCount = susFuncShowLimit
	let susMethods = '⁉️ Suspicious Methods:'
	const totalCount = jsonArr.length
	let scamCount = 0
	let scamChecksum = checksumForContract

	let scamTermCount = 0
	let totalTermCount = 0

	for (const func of jsonArr) {
		if (func.category === 'Suspicious' || func.category === 'Unknown') {
			scamCount++

			if (func.methodId && func.name && susFuncShowLimit > 0) {
				susMethods += `\n  └─ ${func.methodId} | ${func.name}`
				susFuncShowLimit--
			}

			if (!scamChecksum && func.methodId) {
				scamChecksum = func.methodId
			}
		}

		if (!scamChecksum && func.name) {
			scamChecksum = web3.utils.keccak256(func.name).slice(0, 10);
		}

		if (func.name) {
			let prevIndex = 0
			let arr = []
			//console.log('---' + func.name + '---')
			for (var i = 0; i < func.name.length; i++) {
				let char = func.name.charAt(i);
				if (i > 0 && char === char.toUpperCase()) {
					if (func.name.charAt(i - 1) === func.name.charAt(i - 1).toUpperCase()
						&& (i < func.name.length - 1 && func.name.charAt(i + 1) === func.name.charAt(i + 1).toUpperCase())) {
						continue
					}

					let str = func.name.substring(prevIndex, i).toLowerCase()
					arr.push(str)
					// console.log(str)

					prevIndex = i
					continue
				}

				if (i === func.name.length - 1) {
					let str = func.name.substring(prevIndex).toLowerCase()
					// console.log(str)
					arr.push(str)
				}
			}

			for (const node of arr) {
				if (scamTerms.includes(node)) {
					scamTermCount++
				}
			}

			totalTermCount += arr.length
		}
	}

	if (scamCount > tempCount) {
		susMethods += `\n... We have found a total of ${scamCount} suspicious functions`
	}

	let arMethods = '‼️ Usable Functions After Ownership Renouncement:'
	let arFuncShowLimit = 5
	tempCount = arFuncShowLimit
	const data_ar = tokenDetailInfo.contract.afterRenounce
	let arCount = data_ar.length

	if (data_ar) {
		for (const func of data_ar) {
			if (func.name && arFuncShowLimit > 0) {
				arMethods += `\n     └─ ${func.name}`
				arFuncShowLimit--
			}
		}
	}

	if (!scamChecksum) {
		scamChecksum = '0x00000000'
	}

	if (arCount > tempCount) {
		arMethods += `\n... We have found a total of ${arCount} functions`
	}

	if (scamCount === 0) {

		if (totalTermCount > 0) {
			const percent = scamTermCount * 100.0 / totalTermCount
			result += `\n💀 Scam Detection: ${scamChecksum} (${utils.roundDecimal(percent, 3)} % scam) | Total ${totalTermCount} | Scams ${scamTermCount}`
		}

	} else {

		if (totalCount > 0) {
			const percent = scamCount * 100.0 / totalCount
			result += `\n💀 Scam Detection: ${scamChecksum} (${utils.roundDecimal(percent, 3)} % scam) | Total ${totalCount} | Scams ${scamCount}`
		}
	}

	if (scamCount > 0) {
		result += '\n'
		result += susMethods
	}

	if (arCount > 0) {
		result += '\n'
		result += arMethods
	}

	return result
}

function waitForEvent(eventEmitter, eventName) {
	return new Promise(resolve => {
		eventEmitter.on(eventName, resolve)
	})
}

async function getTokenInfo(web3, tokenAddress) {
	var tokenContract = new web3.eth.Contract(TOKEN_ABI, tokenAddress)

	const [name, decimals, symbol] = await Promise.all([
		tokenContract.methods.name().call(),
		tokenContract.methods.decimals().call(),
		tokenContract.methods.symbol().call(),
	]);

	return { name, decimals, symbol }
}

async function getAddressInfo(web3, address) {
	const promises = []

	const addressInfo = {}

	const transactionCountPromise = web3.eth.getTransactionCount(address)
		.then(transactionCount => addressInfo.transactionCount = transactionCount)

	const balancePromise = web3.eth.getBalance(address)
		.then(balance => addressInfo.balance = balance)

	const wethTokenContract = new web3.eth.Contract(ERC20_ABI, uniconst.WETH_ADDRESS)
	const wethBalancePromise = wethTokenContract.methods.balanceOf(address).call()
		.then(wethBalance => addressInfo.wethBalance = wethBalance)

	const usdtTokenContract = new web3.eth.Contract(ERC20_ABI, uniconst.USDT_ADDRESS)
	const usdtBalancePromise = usdtTokenContract.methods.balanceOf(address).call()
		.then(usdtBalance => addressInfo.usdtBalance = usdtBalance)

	const usdcTokenContract = new web3.eth.Contract(ERC20_ABI, uniconst.USDC_ADDRESS)
	const usdcBalancePromise = usdcTokenContract.methods.balanceOf(address).call()
		.then(usdcBalance => addressInfo.usdcBalance = usdcBalance)

	promises.push(transactionCountPromise)
	promises.push(balancePromise)
	promises.push(wethBalancePromise)
	promises.push(usdtBalancePromise)
	promises.push(usdcBalancePromise)

	await Promise.all(promises)

	return addressInfo
}

const getSecondaryTokenPrice = async (web3, tokenAddress) => {

	if (tokenAddress.toLowerCase() === uniconst.USDT_ADDRESS.toLowerCase() || tokenAddress.toLowerCase() === uniconst.USDC_ADDRESS.toLowerCase()) {
		return 1;
	} else if (tokenAddress.toLowerCase() === uniconst.WETH_ADDRESS.toLowerCase()) {

		return await utils.getEthPrice(web3);
	}

	return 0;
}

export async function waitBlock(web3, blockCount) {
	let last_error = null

	const eventEmitter = new EventEmitter()

	const subscription = web3.eth.subscribe('newBlockHeaders', (error, blockHeader) => {
		if (error) {
			last_error = error
			console.error(error)
			blockCount = 0
		}

		blockCount--

		if (blockCount <= 0) {
			subscription.unsubscribe((error, success) => {
				if (error) {
					console.error(error)
				}
			})
			eventEmitter.emit('event')
		}
	})

	await waitForEvent(eventEmitter, 'event')

	return last_error
}

async function waitSeconds(seconds) {
	const eventEmitter = new EventEmitter()

	setTimeout(() => {
		eventEmitter.emit('TimeEvent')
	}, seconds * 1000)

	await waitForEvent(eventEmitter, 'TimeEvent')
}

async function filter(event, tokenInfo, result) {
	try {
		if (tokenInfo.version === 'v2') {
			if (!tokenInfo.primaryIndex) {
				if (Number(event.returnValues.amount0In)) {
					result.sellCount++
					result.sellAddresses.push(event.returnValues.sender)
					result.sellAmount += Number(event.returnValues.amount0In)
					result.sellBalance += Number(event.returnValues.amount1Out)
				} else if (Number(event.returnValues.amount1In)) {
					result.purchaseCount++
					result.purchaseAddresses.push(event.returnValues.to)
					result.purchaseAmount += Number(event.returnValues.amount0Out)
					result.purchaseBalance += Number(event.returnValues.amount1In)
				} else {
					console.log(event)
				}
			} else {
				if (Number(event.returnValues.amount1In)) {
					result.sellCount++
					result.sellAddresses.push(event.returnValues.sender)
					result.sellAmount += Number(event.returnValues.amount1In)
					result.sellBalance += Number(event.returnValues.amount0Out)
				} else if (Number(event.returnValues.amount0In)) {
					result.purchaseCount++
					result.purchaseAddresses.push(event.returnValues.to)
					result.purchaseAmount += Number(event.returnValues.amount1Out)
					result.purchaseBalance += Number(event.returnValues.amount0In)
				} else {
					console.log(event)
				}
			}
		} else if (tokenInfo.version === 'v3') {
			if (!tokenInfo.primaryIndex) {
				if (Number(event.returnValues.amount0) > 0) {
					result.sellCount++
					result.sellAddresses.push(event.returnValues.sender)
					result.sellAmount += Number(event.returnValues.amount0)
					result.sellBalance -= Number(event.returnValues.amount1)
				} else if (Number(event.returnValues.amount0) < 0) {
					result.purchaseCount++
					result.purchaseAddresses.push(event.returnValues.sender)
					result.purchaseAmount -= Number(event.returnValues.amount0)
					result.purchaseBalance += Number(event.returnValues.amount1)
				} else {
					console.log(event)
				}
			} else {
				if (Number(event.returnValues.amount1) > 0) {
					result.sellCount++
					result.sellAddresses.push(event.returnValues.sender)
					result.sellAmount += Number(event.returnValues.amount0)
					result.sellBalance -= Number(event.returnValues.amount1)
				} else if (Number(event.returnValues.amount1) < 0) {
					result.purchaseCount++
					result.purchaseAddresses.push(event.returnValues.sender)
					result.purchaseAmount -= Number(event.returnValues.amount0)
					result.purchaseBalance += Number(event.returnValues.amount1)
				} else {
					console.log(event)
				}
			}
		}
	} catch (error) {
		afx.error_log('filter', error)
	}
}

function roundDecimal(number, digits) {
	//return Number(number.toFixed(digits));
	return number.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export const checkContractAge = async (web3, tokenAddress) => {

	let url = `https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${tokenAddress}`

	let result = { success: false, contractAge: -1, message: '' }
	const apiKey = await ethscan_api.getApiKey()
	const resp = await ethscan_api.executeEthscanAPI(url, apiKey)

	if (!resp || !resp.result || !resp.result[0]) {
		return result
	}

	const txHash = resp.result[0].txHash

	try {
		const txReceipt = await web3.eth.getTransactionReceipt(txHash);
		if (!txReceipt) {
			return result
		}

		const blockInfo = await web3.eth.getBlock(txReceipt.blockNumber)
		// console.log(blockInfo.timestamp, Date.now())

		let span = Date.now() / 1000 - blockInfo.timestamp

		if (span < 0) {
			return result
		}

		span = span / (24 * 60 * 60)
		span = Math.floor(span * 10) / 10
		result.contractAge = span
		result.message = `⌛ Contract Age: ${utils.roundDecimal(span)} days`
		result.success = true

	} catch (error) {
		afx.error_log('checkContractAge', error)
		return result
	}

	return result
}

export const checkLPStatus = async (web3, poolAddress) => {

	let apiUrl = 'https://api.honeypot.is/v1/'

	let result = { success: false, lpLocked: false, contractOwnedPercent: 0, contractOwnedAmount: 0 }
	const resp = await utils.fetchAPI(`${apiUrl}TopHolders?address=${poolAddress}&chainID=1`)

	if (!resp || resp.error) {
		return result
	}

	let nodes = []
	const totalSupply = Number(resp.totalSupply)
	let contractOwnedAmount = 0

	for (const holder of resp.holders) {

		let node = {}

		node.percent = Number(holder.balance) * 100.0 / totalSupply

		if (node.percent < 1.0) {
			continue
		}

		if (holder.address === uniconst.NULL_ADDRESS) {

			if (totalSupply <= 1000) {
				node.msg = `Liquidity Removed`
			} else {
				node.msg = `${utils.roundDecimal(node.percent)}% burned`

				if (node.percent >= 50.0) {
					result.lpLocked = true
				}
			}


		} else if (holder.isContract === true) {

			const lowerAddr = holder.address.toLowerCase()
			let lockerName = ''
			let resp = null
			if (lowerAddr == uniconst.UNILOCKER_CONTRACT_ADDRESS.toLowerCase()) {

				resp = await utils.getUniLockerDetails(web3, poolAddress)
				lockerName = 'UniLocker'

			} else if (lowerAddr == uniconst.PINKLOCK_CONTRACT_ADDRESS.toLowerCase()) {

				resp = await utils.getPinkLockDetails(web3, poolAddress)
				lockerName = 'PinkLock'

			} else if (lowerAddr == uniconst.TEAMFINANCE_CONTRACT_ADDRESS.toLowerCase()) {

				resp = await utils.getTeamFinanceDetails(web3, poolAddress)
				lockerName = 'Team Finance'

			} else {

				lockerName = 'Unknown'
			}

			if (resp) {
				let span = resp.resUnlockDate * 1000 - Date.now()
				if (span < 0) {
					span = 0
				}

				span = Math.round(span / (24 * 60 * 60 * 1000))
				node.msg = `${utils.roundDecimal(node.percent)}% of LP Locked for ${span} days left via ${lockerName}`
				result.lpLocked = true

			} else {

				node.msg = `${lockerName}`
			}

			contractOwnedAmount += Number(holder.balance)

		} else {
			continue
		}

		nodes.push(node)
	}


	nodes.sort((a, b) => {
		return b.percent - a.percent;
	});

	result.message = '🔒 LP: '

	if (nodes.length == 0) {

		result.message += 'Unlocked'

	} else if (nodes.length == 1) {

		result.message += nodes[0].msg

	} else {

		for (const node of nodes) {
			result.message += `\n     └─ ${node.msg}`
		}
	}

	result.success = true

	if (totalSupply > 0)
		result.contractOwnedPercent = contractOwnedAmount * 100 / totalSupply

	result.contractOwnedAmount = contractOwnedAmount
	//console.log('LP status', result)
	return result
}


export const getTokensInContract = async (tokenAddress) => {

	let apiUrl = 'https://api.honeypot.is/v1/'

	let result = { success: false, contractOwnedPercent: 0, contractOwnedAmount: 0 }
	const resp = await utils.fetchAPI(`${apiUrl}TopHolders?address=${tokenAddress}&chainID=1`)

	if (!resp || resp.error) {
		return result
	}

	let nodes = []
	const totalSupply = Number(resp.totalSupply)
	let contractOwnedAmount = 0

	for (const holder of resp.holders) {

		if (holder.isContract === true) {

			contractOwnedAmount += Number(holder.balance)

		}
	}

	result.success = true

	if (totalSupply > 0)
		result.contractOwnedPercent = contractOwnedAmount * 100 / totalSupply

	result.contractOwnedAmount = contractOwnedAmount
	return result
}

export const checkHoneypot = async (tokenAddress) => {

	let apiUrl = 'https://api.honeypot.is'

	// const tokenAddress = tokenInfo.primaryAddress
	// const routerAddress = tokenInfo.routerAddress
	// const poolAddress = tokenInfo.poolAddress

	let result = { success: false, honeypot: true, message: '' }
	let url = ''
	// if (routerAddress == "simulate") {

	// 	url = `${apiUrl}/v2/IsHoneypot?address=${tokenAddress}&forceSimulateLiquidity=true&chainID=1`

	// } else if (tokenAddress == poolAddress) {

	// 	url = `${apiUrl}/v2/IsHoneypot?address=${tokenAddress}&chainID=1`

	// } else {

	// 	url = `${apiUrl}/v2/IsHoneypot?address=${tokenAddress}&pair=${poolAddress}&chainID=1`
	// } 

	url = `${apiUrl}/v2/IsHoneypot?address=${tokenAddress}&chainID=1`

	//console.log(url)

	const resp = await utils.fetchAPI(url, 'GET')
	if (!resp) {
		return result
	}

	let status = '';
	let honeyPot = true

	if (!resp.simulationSuccess) {
		status = "unknown";
		honeyPot = true

	} else if (resp.honeypotResult.isHoneypot === false) {

		status = "passed";
		honeyPot = false

		if (resp.flags !== null && resp.flags.length > 0) {
			status = "warning";
			honeyPot = false
		}

	} else {
		status = "failed";
		honeyPot = true
	}

	resp.status = status;

	resp.taxHigh = false

	if (status === "warning") {
		for (const flag of resp.flags) {
			if (flag === "EXTREMELY_HIGH_TAXES") {
				resp.taxHigh = true
				honeyPot = true
				break;
			}
		}
	}

	let honeyPotStat = honeyPot ? 'Yes ❌' : 'No ✅'

	if (resp.pair && resp.pair.liquidity === 0) {
		honeyPotStat = "Liquidity removed ❌";
		honeyPot = true
	}

	let message = `🍯 Honeypot: ${honeyPotStat}`

	if (resp.simulationResult) {
		message += `\n     └─ Buy Tax: ${utils.roundDecimal(resp.simulationResult.buyTax, 1)}%`
		message += `\n     └─ Sell Tax: ${utils.roundDecimal(resp.simulationResult.sellTax, 1)}%`
		//message += `\n     └─ Transfer Tax: ${utils.roundDecimal(resp.simulationResult.transferTax, 1)}%`
		// message += `\n     └─ Buy Gas: ${utils.roundDecimal(resp.simulationResult.buyGas, 0)}`
		// message += `\n     └─ Sell Gas: ${utils.roundDecimal(resp.simulationResult.sellGas, 0)}`
	}

	result.message = message
	result.success = true
	result.honeypot = honeyPot

	return result
}

export const checkDormantWallet = async (walletAddress, minDormantDuration) => {

	try {
		const timeStamp = await utils.getLastTransactionDateFromAddress(walletAddress)
		if (!timeStamp) {
			return false
		}

		let span = Date.now() / 1000 - timeStamp
		span = span / (24 * 60 * 60)

		if (span >= minDormantDuration) {
			return true
		}


	} catch (error) {
		afx.error_log('checkContractAge', error)
		return result
	}

	return false
}

export const start = async (web3, tokenInfo, filterCriteria, sniper) => {
	let last_error = null

	try {
		const result = {
			purchaseCount: 0,
			sellCount: 0,
			purchaseAmount: 0,
			sellAmount: 0,
			purchaseBalance: 0,
			sellBalance: 0,
			addresses: [],
			purchaseAddresses: [],
			sellAddresses: [],
		}

		const primaryContract = new web3.eth.Contract(ERC20_ABI, tokenInfo.primaryAddress)
		const secondaryContract = new web3.eth.Contract(ERC20_ABI, tokenInfo.secondaryAddress)

		const primaryInfo = await getTokenInfo(web3, tokenInfo.primaryAddress)
		const secondaryInfo = await getTokenInfo(web3, tokenInfo.secondaryAddress)

		let poolContract

		if (tokenInfo.version === 'v2') {
			poolContract = new web3.eth.Contract(Uniswap_V2_Pool_ABI, tokenInfo.poolAddress)
		} else if (tokenInfo.version === 'v3') {
			poolContract = new web3.eth.Contract(Uniswap_V3_Pool_ABI, tokenInfo.poolAddress)
		}

		const eventEmitter = new EventEmitter()

		const subscription = poolContract.events.Swap({}, (error, event) => {
			if (error) {
				last_error = error
				console.error('Swap', error)
			}

			eventEmitter.emit('Swap')
		})

		console.log("Waiting for first swap ...");

		//await waitForEvent(eventEmitter, 'Swap')

		if (last_error) {
			return
		}

		subscription.unsubscribe((error, success) => {
			if (error) {
				console.error('Swap unsubscribe', error)
			}
		})

		if (filterCriteria.blockThreshold <= 0) {
			filterCriteria.blockThreshold = 1
		}

		console.log('First swap event emitted. Waiting for ' + filterCriteria.blockThreshold + ' blocks confirmation...')

		let block0Liquidity = await secondaryContract.methods.balanceOf(tokenInfo.poolAddress).call()

		const startBlockNumber = await web3.eth.getBlockNumber()

		//last_error = await waitBlock(web3, 1)
		last_error = await waitBlock(web3, filterCriteria.blockThreshold - 1)

		const endBlockNumber = await web3.eth.getBlockNumber() - 1

		if (last_error) {
			return
		}

		//console.log(`${filterCriteria.blockThreshold} blocks created`)

		const events = await poolContract.getPastEvents('Swap', {
			fromBlock: startBlockNumber,
			toBlock: endBlockNumber,
			},);
			// (err, events) => {
			// 	console.log(events);
			// });
		console.log('Analysing event ...')

		const promises = []

		for (const event of events) {
			const promise = filter(event, tokenInfo, result)
			promises.push(promise)
		}

		await Promise.all(promises)

		console.log('Event #1 done...')

		let sniperPurchaseCount = sniper.getSnipers(tokenInfo.poolAddress)

		const purchaseAddresses = Array.from(new Set(result.purchaseAddresses))
		const sellAddresses = Array.from(new Set(result.sellAddresses))

		promises.length = 0

		let freshWalletCount = 0
		let freshTotalBalance = 0
		let whaleWalletCount = 0
		let whaleTotalBalance = 0
		let kycWalletCount = 0
		let tokenHolderCount = 0
		let dormantWalletCount = 0

		const ethPrice = await utils.getEthPrice(web3)
		for (const purchaseAddress of purchaseAddresses) {
			const filterAddress = async () => {
				const addressInfo = await getAddressInfo(web3, purchaseAddress)

				const isFresh = addressInfo.transactionCount <= filterCriteria.maxFreshTransactionCount

				const totalBalance = (Number(addressInfo.balance) + Number(addressInfo.wethBalance)) * Number(ethPrice) / 10 ** 18
					+ (Number(addressInfo.usdtBalance) + Number(addressInfo.usdcBalance)) / 10 ** 6
				const isWhale = totalBalance >= filterCriteria.minWhaleBalance

				const primaryBalance = await primaryContract.methods.balanceOf(purchaseAddress).call()

				let isDormant = false

				if (filterCriteria.minDormantWalletCount
					&& filterCriteria.minDormantWalletCount > 0
					&& dormantWalletCount < filterCriteria.minDormantWalletCount) {
					isDormant = await checkDormantWallet(purchaseAddress, filterCriteria.minDormantDuration)
				}

				if (isFresh) {
					freshTotalBalance += totalBalance
					freshWalletCount++
				}

				if (isWhale) {
					whaleTotalBalance += totalBalance
					whaleWalletCount++
				}

				if (Number(primaryBalance) > 0) {
					tokenHolderCount++
				}

				if (isDormant) {
					console.log("Dormant wallet detected: ", purchaseAddress);
					dormantWalletCount++
				}
			}

			const promise = filterAddress()

			promises.push(promise)
		}

		await Promise.all(promises)

		console.log('Event #2 done...')

		if (filterCriteria.minFreshWalletCount && freshWalletCount < filterCriteria.minFreshWalletCount) {
			console.log(`Fresh wallet count is ${freshWalletCount} which is less than ${filterCriteria.minFreshWalletCount}`)
			return
		}

		if (filterCriteria.minWhaleWalletCount && whaleWalletCount < filterCriteria.minWhaleWalletCount) {
			console.log(`Whale wallet count is ${whaleWalletCount} which is less than ${filterCriteria.minWhaleWalletCount}`)
			return
		}

		if (filterCriteria.minDormantWalletCount > 0
			&& dormantWalletCount < filterCriteria.minDormantWalletCount) {

			console.log(`Dormant wallet count is ${dormantWalletCount} which is less than ${filterCriteria.minDormantWalletCount}`)
			return
		}

		if (filterCriteria.minKycWalletCount > 0) {
			const checkKycWallet = async (walletAddress, apiKey) => {

				try {

					const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&offset=${MAX_TRANSACTION_COUNT}&page=1`
					const resData = await ethscan_api.executeEthscanAPI(url, apiKey)
					const transactions = resData.result;

					if (!transactions) {
						return
					}

					for (const transaction of transactions) {
						// if (kycWalletCount > filterCriteria.minKycWalletCount) {
						// 	//console.log(`KYC wallet count is bigger than ${filterCriteria.minKycWalletCount}`)
						// 	return
						// }

						if (!transaction.to || !transaction.from) {
							continue;
						}

						if (transaction.to.toLowerCase() === walletAddress.toLowerCase()) {
							if (await checkKycWalletFromDB(transaction.from)) {
								kycWalletCount++
								console.log("KYC wallet detected: ", walletAddress);
								return
							}
						}
					}
				} catch (error) {
					afx.error_log('checkKycWallet', error)
				}
			}

			promises.length = 0

			for (const purchaseAddress of purchaseAddresses) {

				const apiKey = await ethscan_api.getApiKey()
				const checkModule = checkKycWallet(purchaseAddress, apiKey)

				promises.push(checkModule)

				// if (kycWalletCount >= filterCriteria.minKycWalletCount) {
				// 	break
				// }
			}

			await Promise.all(promises)
		}

		console.log('Event #3 done...')

		if (filterCriteria.minKycWalletCount > 0 && kycWalletCount < filterCriteria.minKycWalletCount) {
			console.log(`KYC wallet count is less than ${filterCriteria.minKycWalletCount}`)
			return
		}

		// let primaryPriceBySecondary = await utils.getTokenPrice(tokenInfo.poolAddress, tokenInfo.primaryIndex)
		// const secondaryPriceByUSD = await utils.getSecondaryTokenPrice(tokenInfo.secondaryAddress)
		// const primaryPriceByUSD = primaryPriceBySecondary * secondaryPriceByUSD

		let currentPrimaryAmount = await primaryContract.methods.balanceOf(tokenInfo.poolAddress).call()
		currentPrimaryAmount = Number(currentPrimaryAmount)

		if (currentPrimaryAmount == 0) {
			console.log('Liquidity was removed.')
			return
		}

		const lpStat = await checkLPStatus(web3, tokenInfo.poolAddress)

		//		console.log('lpStat.lpLocked', lpStat.lpLocked, 'filterCriteria.lpLock', filterCriteria.lpLock, !lpStat.lpLocked, !lpStat.lpLocked && filterCriteria.lpLocked === 1)
		if (lpStat.lpLocked === false && filterCriteria.lpLock === 1) {
			console.log(`The call has been skipped due to lp lock filter on`)
			return
		}

		let lpStatMsg = ''
		if (lpStat.success) {
			lpStatMsg = lpStat.message
		}

		let honeypotStat = await checkHoneypot(tokenInfo.primaryAddress)

		if (honeypotStat.honeypot === true && filterCriteria.honeypot === 1) {
			console.log(`The call has been skipped due to honeypot filter on`)
			return
		}

		let honeypotMsg = ''
		if (honeypotStat.success) {
			honeypotMsg = honeypotStat.message
		}

		const contractAgeStat = await checkContractAge(web3, tokenInfo.primaryAddress)

		if (filterCriteria.contractAge > 0 && contractAgeStat.contractAge < filterCriteria.contractAge) {
			console.log(`The call has been skipped due to contract age filter on`)
			return
		}

		let contractAgeMsg = ''
		if (contractAgeStat.success) {
			contractAgeMsg = contractAgeStat.message
		}

		const checksumForContract = await utils.getContractVerified(web3, tokenInfo.primaryAddress)

		const contractVerified = checksumForContract ? true : false

		let tokensInContractStat = await getTokensInContract(tokenInfo.primaryAddress)

		let tokensInContractPercent = 0
		let tokensInContractAmount = 0

		if (tokensInContractStat.success) {
			tokensInContractPercent = utils.roundDecimal(tokensInContractStat.contractOwnedPercent, 1)
			tokensInContractAmount = utils.roundDecimal(tokensInContractStat.contractOwnedAmount / (10 ** Number(primaryInfo.decimals)))
		}

		let sniperOwnedPercent = 0
		if (result.purchaseCount > 0) {
			sniperOwnedPercent = sniperPurchaseCount * 100 / result.purchaseCount
		}

		sniperOwnedPercent = utils.roundDecimal(sniperOwnedPercent, 1)

		let freshOwnedPercent = 0

		if (purchaseAddresses.length > 0) {
			freshOwnedPercent = freshWalletCount * 100 / purchaseAddresses.length
		}

		freshOwnedPercent = utils.roundDecimal(freshOwnedPercent, 1)

		// get top holders
		const tokenDetailInfo = await apiRepeater.getTokenDetailInfo(tokenInfo.primaryAddress)
		let topHoldersResult = await apiRepeater.getTopHolders(tokenInfo.primaryAddress, primaryInfo.decimals)

		let topHoldersMsg = topHoldersResult.topHoldersMsg
		let holderCount = topHoldersResult.holderCount

		if (tokenDetailInfo && tokenDetailInfo.holders) {
			tokenHolderCount = Number(tokenDetailInfo.holders.totalHolders)
		} else if (tokenHolderCount < holderCount) {
			tokenHolderCount = holderCount
		}

		// get social links

		let socialMsg = ''
		if (tokenDetailInfo && tokenDetailInfo.links && tokenDetailInfo.links.length > 0) {
			socialMsg = '\n\n<u>Social Info</u>'
			for (const link of tokenDetailInfo.links) {
				socialMsg += '\n'
				if (link.startsWith("https://t.me/") || link.startsWith("http://t.me/") || link.startsWith("t.me/")) {
					socialMsg += `🔊 <a href='${link}'>Telegram</a>`
				} else if (link.startsWith("https://twitter.com/") || link.startsWith("http://twitter.com/") || link.startsWith("twitter.com/")) {
					socialMsg += `🔊 <a href='${link}'>Twitter</a>`
				} else {
					socialMsg += `🔊 <a href='${link}'>${link}</a>`
				}
			}
		}

		let ownershipRenouncedMsg = ''
		if (tokenDetailInfo && tokenDetailInfo.ownership) {
			ownershipRenouncedMsg = '\n🔍 Ownership Renounced: ' + (tokenDetailInfo.ownership.renounced ? 'Yes' : 'No')
		}

		let scamInfoMsg = ''
		if (tokenDetailInfo) {
			scamInfoMsg = getScamInfo(web3, tokenDetailInfo, checksumForContract)
		}

		let currentSecondaryAmount = await secondaryContract.methods.balanceOf(tokenInfo.poolAddress).call()
		currentSecondaryAmount = Number(currentSecondaryAmount)

		const primaryPriceBySecondary = currentSecondaryAmount / currentPrimaryAmount * 10 ** (Number(primaryInfo.decimals) - Number(secondaryInfo.decimals))
		const secondaryPriceByUSD = await getSecondaryTokenPrice(web3, tokenInfo.secondaryAddress)

		const primaryPriceByUSD = primaryPriceBySecondary * secondaryPriceByUSD

		const initialLiquidity = tokenInfo.secondaryAmount / (10 ** Number(secondaryInfo.decimals))
		const initialLiquidityFund = initialLiquidity * secondaryPriceByUSD

		let currentLiquidity = await secondaryContract.methods.balanceOf(tokenInfo.poolAddress).call()
		currentLiquidity /= 10 ** Number(secondaryInfo.decimals)
		const currentLiquidityFund = currentLiquidity * secondaryPriceByUSD

		const block0Volume = Number(block0Liquidity) * secondaryPriceByUSD / (10 ** Number(secondaryInfo.decimals))

		const totalSupply = await primaryContract.methods.totalSupply().call()
		const marketCap = Number(totalSupply) * primaryPriceByUSD / 10 ** Number(primaryInfo.decimals)

		result.purchaseAmount /= 10 ** Number(primaryInfo.decimals)
		result.sellAmount /= 10 ** Number(primaryInfo.decimals)

		result.purchaseBalance /= 10 ** Number(secondaryInfo.decimals)
		result.sellBalance /= 10 ** Number(secondaryInfo.decimals)
		//🏠 Token address: <code class="text-entity-code">${tokenInfo.primaryAddress}</code>
		const content0 =
			`⚡ Name: ${primaryInfo.name} (${primaryInfo.symbol})
💧 Initial Liquidity: ${roundDecimal(initialLiquidity, 3)} ${secondaryInfo.symbol} ($ ${roundDecimal(initialLiquidityFund, 2)})
🏠 Token address: <code class="text-entity-code">${tokenInfo.primaryAddress}</code>
💎 Mcap: $ ${roundDecimal(marketCap, 2)}
🎯 Block 0 Volume: $ ${roundDecimal(block0Volume, 2)}
🐋 Whales: ${whaleWalletCount} ($ ${roundDecimal(whaleTotalBalance, 2)})
☘️ Freshes: ${freshWalletCount} ($ ${roundDecimal(freshTotalBalance, 2)})
👴 Dormant: More than ${dormantWalletCount} wallets
📝 KYC: More than ${kycWalletCount} wallets
${lpStatMsg}
${honeypotMsg}
${contractAgeMsg}
📊 Chart: <a href="https://dexscreener.com/ethereum/${tokenInfo.primaryAddress}">Dexscreener</a> | <a href="https://www.dextools.io/app/en/ether/pair-explorer/${tokenInfo.poolAddress}">DexTools</a>`

		const tag = `\n
<a href="https://t.me/MaestroProBot?start=${tokenInfo.primaryAddress}">Buy with Maestro Pro</a> | <a href="https://t.me/MaestroSniperBot?start=${tokenInfo.primaryAddress}">Buy with Maestro</a> | <a href="https://t.me/unibotsniper_bot?start=alphai">Buy with Unibot</a> | <a href="https://tokensniffer.com/token/eth/${tokenInfo.primaryAddress}">Analyze Contract</a>`

		{/* <u>Social Info</u>
🔊 Token Mentions: -
🔍 Unique Groups: -
👤 First Checker: -
💰 First Market Cap: -

 <u>Token Info</u> */}
		const content1 = `
<u>Token Info</u>
🏠 Token address: <code class="text-entity-code">${tokenInfo.primaryAddress}</code>
👨‍💼 Number of Holders: ${tokenHolderCount}
📃 Contract Source: ${contractVerified ? 'Verified' : 'Unverified'}
🏦 Balance in contract: ${tokensInContractAmount} ${primaryInfo.symbol} own ${tokensInContractPercent}%
🔫 Snipers: ${sniperPurchaseCount} own ${sniperOwnedPercent}%
☘️ Freshes: ${freshWalletCount} own ${freshOwnedPercent}% ${ownershipRenouncedMsg}

${topHoldersMsg}${scamInfoMsg}${socialMsg}`
		const message = { content0, content1, tag }
		{/* <a href="https://t.me/MaestroSniperBot?start=${tokenInfo.primaryAddress}">Buy with Maestro</a> | <a href="https://t.me/unibotsniper_bot?start=alphai">Unibot</a> | <a href="https://tokensniffer.com/token/eth/${tokenInfo.primaryAddress}">Analyze Contract</a> */ }


		//💧 Current Liquidity: ${roundDecimal(currentLiquidity, 3)} ${secondaryInfo.symbol} ($ ${roundDecimal(currentLiquidityFund, 3)})
		// const reply_markup = {
		// 	inline_keyboard: [
		// 		[
		// 			{
		// 				text: 'Dexscreener',
		// 				callback_data: `https://dexscreener.com/ethereum/${tokenInfo.primaryAddress}`
		// 			},
		// 			{
		// 				text: 'DexTools',
		// 				callback_data: `https://www.dextools.io/app/en/ether/pair-explorer/${tokenInfo.poolAddress}`
		// 			}
		// 		]
		// 	]
		// }

		console.log(content0)

		return message
	} catch (error) {
		//console.log(error)
		afx.error_log('filter.start', error)
	}
}