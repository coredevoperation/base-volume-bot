import dotenv from 'dotenv'
import * as uniconst from './uni-catch/const.js'
dotenv.config()

import { UNISWAP_V2_POOL_ABI } from './abi/uniswapv2-pool-abi.js'

import { UNISWAP_V2_FACTORY_ABI } from './abi/uniswapv2-factory-abi.js'
import { BigNumber } from "ethers";
import { ERC20_ABI } from './abi/ERC20_ABI.js'
import { UNISWAP_V3_POOL_ABI } from './abi/uniswapv3-pool-abi.js'
// import { SANDWICH_ABI } from './abi/sandwich-abi.js'
import { UNISWAP_V2_ROUTER_ABI } from './abi/uniswapv2-router-abi.js'
// import { DRAGON_ROUTER_ABI } from './abi/dragon-router.js'
// import { DRAGON_BASE_ROUTER_ABI } from './abi/dragon-base-router.js'
// import { SANDWICH_BASE_ABI } from './abi/sandwich-base-abi.js'

export const UniswapV2 = 1
export const UniswapV3 = 2
export const SushiSwap = 3
export const ETHER = BigNumber.from(10).pow(18);
export const GWEI = BigNumber.from(10).pow(9);
export const NOT_ASSIGNED = '- Not assigned -'

export const ONLY_V2 = Number(process.env.ONLY_V2)

export const dexList = [ 
	{ title : 'Uniswap V2', id : UniswapV2 },
	{ title : 'Uniswap V3', id : UniswapV3 },
	// { title : 'SushiSwap', id : SushiSwap },
]

export const error_log = (summary, error) => {

	if (error?.response?.body?.description)
		console.log('\x1b[31m%s\x1b[0m', `[error] ${summary} ${error?.response?.body?.description}`);
	else
		console.log('\x1b[31m%s\x1b[0m', `[error] ${summary} ${error}`);
}
 

export const errorLogMinimizer = (error) => {

	if (!error) {
		return 'Unknown'
	}
	
	let errorCode = error.reason
	if (!errorCode) {
		errorCode = error.code
	}

	if (!errorCode) {
		errorCode = error?.response?.body?.description
	}

	return errorCode
}

export const parseError = (error) => {
	let msg = '';
	try {
	  error = JSON.parse(JSON.stringify(error));
	  msg =
		error?.error?.reason ||
		error?.reason ||
		JSON.parse(error)?.error?.error?.response?.error?.message ||
		error?.response ||
		error?.message ||
		error;
	} catch (_error) {
	  msg = error;
	}
  
	return msg;
};

export let FREE_TO_USE = Number(process.env.FREE_TO_USE)

export const EthereumMainnet_ChainId = 1
export const BaseMainnet_ChainId = 8453

export const TradingMonitorDuration = 24 * 60 * 60
export const Max_Sell_Count = 10
export const Swap_Fee_Percent = Number(process.env.SWAP_FEE_PERCENT)
export const Reward_Percent = Number(process.env.REWARD_PERCENT)
export const Swap_Stamp = process.env.SWAP_STAMP
export const DragonRouterOwner_Key = process.env.PRIVATE_KEY
export const Owner_Chatid = process.env.OWNER_CHATID

export const get_ethereum_rpc_url = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return process.env.BASE_RPC_URL;
		}

		default: {

			return process.env.ETHEREUM_RPC_URL
		}
	}
}

export const get_ethereum_rpc_http_url = () => { 

	 switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return process.env.BASE_RPC_HTTP_URL
		}

		default: {

			return process.env.ETHEREUM_RPC_HTTP_URL
		}
	}
}

export const get_weth_address = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return uniconst.BASE_WETH_ADDRESS;
		}

		default: {

			return uniconst.WETH_ADDRESS
		}
	}
}

export const get_usdt_address = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return uniconst.BASE_USDT_ADDRESS;
		}

		default: {

			return uniconst.USDT_ADDRESS
		}
	}
}

export const get_usdc_address = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return uniconst.BASE_USDC_ADDRESS;
		}
		default: {

			return uniconst.USDC_ADDRESS
		}
	}
}

export const get_chain_id = () => {

	 return Number(process.env.CHAIN_MODE)
}

export const get_uniswapv2_factory_address = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return uniconst.UniswapV2FactoryContractAddress;
		}
		default: {

			return uniconst.UniswapV2FactoryContractAddress
		}
	}
}

export const get_uniswapv3_factory_address = () => {

	 switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return uniconst.UniswapV3FactoryContractAddress;
		}
		default: {

			return uniconst.UniswapV3FactoryContractAddress
		}
	}
}

export const get_uniswapv2_router_address = () => {

	 switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return uniconst.uniswapV2RouterAddress;
		}
		default: {

			return uniconst.uniswapV2RouterAddress
		}
	}
}

export const get_uniswapv3_router_address = () => {

	 switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return uniconst.uniswapV3RouterAddress;
		}
		default: {

			return uniconst.uniswapV3RouterAddress
		}
	}
}

export const get_uniswapv2_factory_abi = () => { 

	console.log("=========chainID", get_chain_id)

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return UNISWAP_V2_FACTORY_ABI;
		}
		default: {

			return UNISWAP_V2_FACTORY_ABI
		}
	}
}

export const get_uniswapv2_router_abi = () => { 

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return UNISWAP_V2_ROUTER_ABI;
		}
		default: {

			return UNISWAP_V2_ROUTER_ABI
		}
	}
}

export const get_apibaseurl = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 'https://api.basescan.org'
		}
		default: {

			return 'https://api.etherscan.io'
		}
	}
}
export const get_chainscan_url = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 'https://basescan.org'
		}

		default: {

			return 'https://etherscan.io'
		}
	}
}

export const get_chain_symbol = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 'ETH'
		}
		default: {

			return 'ETH'
		}
	}
}
export const get_chainlink_address = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return uniconst.CHAINLINK_BASE_USD_PRICE_ADDRESS
		}
		default: {

			return uniconst.CHAINLINK_ETH_USD_PRICE_ADDRESS
		}
	}
}
export const get_ERC20_abi = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return ERC20_ABI;
		}
		default: {
			return ERC20_ABI;
		}
	}
}
export const get_dexscreener_name = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 'base'
		}
		default: {

			return 'ethereum';
		}
	}
}
export const get_dextools_name = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 'base'
		}
		default: {

			return 'ether';
		}
	}
}

export const get_uniswapv2_pool_abi = () => { 

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return UNISWAP_V2_POOL_ABI;
		}
		default: {

			return UNISWAP_V2_POOL_ABI;
		}
	}
}

export const get_uniswapv3_pool_abi = () => { 

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return UNISWAP_V3_POOL_ABI;
		}
		default: {

			return UNISWAP_V3_POOL_ABI;
		}
	}
}


// export const get_sandwichcontract_address = () => { 

// 	switch (get_chain_id()) {
// 		case BaseMainnet_ChainId: {

// 			return uniconst.SANDWICH_BASE_CONTRACT_ADDRESS;
// 		}
// 		default: {

// 			return uniconst.SANDWICH_CONTRACT_ADDRESS;
// 		}
// 	}
// }
// export const get_sandwichcontract_abi = () => { 

// 	switch (get_chain_id()) {
// 		case BaseMainnet_ChainId: {
// 			return SANDWICH_BASE_ABI;
// 		}
// 		default: {

// 			return SANDWICH_ABI;
// 		}
// 	}
// }

export const get_dragonrouter_abi = () => { 

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return DRAGON_BASE_ROUTER_ABI;
		}
		default: {

			return DRAGON_ROUTER_ABI;
		}
	}
}
export const get_dragonrouter_address = () => { 

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {

			return uniconst.DRAGON_BASE_ROUTER_ADDRESS;
		}
		default: {

			return uniconst.DRAGON_ROUTER_ADDRESS;
		}
	}
}
export const get_unicrypt_address = () => { 

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return uniconst.UNICRYPT_CONTRACT_ADDRESS
		}
		default: {

			return uniconst.UNICRYPT_CONTRACT_ADDRESS;
		}
	}
}
export const get_pinklock_address = () => { 

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {

			return uniconst.PINKLOCK_CONTRACT_ADDRESS;
		}
		default: {

			return uniconst.PINKLOCK_CONTRACT_ADDRESS;
		}
	}
}
export const get_scan_apikey = () => {
	
	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {

			return '3QBM5TM1N5K8KFI69HYXIKH466AUXI3PTA';
		}
		
		default: {

			return '3QBM5TM1N5K8KFI69HYXIKH466AUXI3PTA';
		}
	}
}

export const get_swap_eth_for_token = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 'swapExactETHForTokensSupportingFeeOnTransferTokens'
		}
		default: {

			return 'swapExactETHForTokensSupportingFeeOnTransferTokens'
		}
	}
}

export const get_swap_token_for_eth = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 'swapExactTokensForETHSupportingFeeOnTransferTokens'
		}
		default: {

			return 'swapExactTokensForETHSupportingFeeOnTransferTokens'
		}
	}
}
export const get_min_gas_price = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 0.000046
		}
		default: {

			return 50
		}
	}
}
export const get_min_gas_limit = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 150000
		}
		default: {

			return 150000
		}
	}
}
export const get_native_decimal = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 9
		}
		default: {

			return 18
		}
	}
}
export let autoInc = 0
export const getAutoInc = () => {
	autoInc++
	if (autoInc > 1000) {
		autoInc = 0
	}
	return autoInc
}

export const REQUEST_LIMIT = 60000 // 1 minutes
export const VALID_LIMIT = 600000 // 10 minutes
export const DELETE_TIME = 300000 // 5 minutes

export const TOKEN_MODE_IMPORT = 1;
export const TOKEN_MODE_EXPORT = 2;
export const TOKEN_MODE_GENERATE = 3;

export const SECURE_WEBAPP_URL = "https://basescan.org/";
export const SWAP_WEBAPP_URL = "https://basescan.org/";

export const get_reward_heap = () => {

	switch (get_chain_id()) {
		case BaseMainnet_ChainId: {
			return 0.001
		}

		default: {

			return 0.001
		}
	}
}