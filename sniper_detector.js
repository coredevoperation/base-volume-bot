
import * as utils from './utils.js'
import { UNISWAP_V2_ROUTER_ABI } from "./abi/uniswapv2-router-abi.js"
import abiDecoder from "abi-decoder";

abiDecoder.addABI(UNISWAP_V2_ROUTER_ABI);

export const mempoolFilterMap = new Map()
export const getSnipers = (poolAddress) => {

    let info = mempoolFilterMap.get(poolAddress)
    if (info) {
        return info.swapTransactions
    }

    return 0
}

export class SniperDetector {

	constructor(web3, poolAddress, tokenAddress, baseTokenAddress, version, callback) {

		this.web3 = web3
		this.tokenAddress = tokenAddress
        this.baseTokenAddress = baseTokenAddress
        this.poolAddress = poolAddress
		this.tokenInfo = {}
		this.callback = callback
	}

	async start() {

		if (!this.web3.utils.isAddress(this.tokenAddress)) {
			return
		}
		
		this.tokenInfo = await utils.getTokenInfoW(this.web3, this.tokenAddress)
		if (!this.tokenInfo) {
			return
		}

        let filterNode = {
            tokenAddress: this.tokenAddress,
            baseTokenAddress: this.baseTokenAddress,
            poolAddress: this.poolAddress,
            swapTransactions: 0
        }

        console.log(`Listen transactions for the token ${this.tokenAddress} ${this.tokenInfo.name} ...`)
        mempoolFilterMap.set(this.poolAddress, filterNode)

        setTimeout(() => {
    
            setTimeout(() => {
                mempoolFilterMap.delete(this.poolAddress)
            }, 1000 * 60 * 10)

            let bullets = parseInt(filterNode.swapTransactions / 5)

            let bulletsMsg = ''

            for (let i = 0; i < bullets; i++) {
                bulletsMsg += '🤖'
            }

            if (filterNode.swapTransactions > 0) {
                const message = `SNIPE DETECTOR

Snipe scale: ${bulletsMsg}
Pending buys from snipers: ${filterNode.swapTransactions}
Token name: ${this.tokenInfo.name} (${this.tokenInfo.symbol})
Contract: <code>${this.tokenAddress}</code>

<a href="https://etherscan.io/address/${this.tokenAddress}">Etherscan</a> | <a href="https://www.dextools.io/app/ether/pair-explorer/${this.tokenAddress}">Dextools</a> | <a href="https://app.uniswap.org/#/swap?outputCurrency=${this.tokenAddress}">Uniswap</a> | <a href="https://dexscreener.com/ethereum/${this.tokenAddress}">DexScreener</a>`
                
                console.log(message)
    
                if (this.callback) {
                    this.callback(message, filterNode.swapTransactions)
                }

            } else {
                console.log(`Snipe detect: ${this.tokenAddress}, ${this.tokenInfo.name}, ${this.tokenInfo.symbol}, ${filterNode.swapTransactions}`)
            }
        }
        , 20 * 1000)
    }
}

const filterSwapTransaction = (path) => {

    if (path.length < 2) {
        return
    }

    const token0 = path[0]
    const token1 = path[1]

    for (const [poolAddress, filterNode] of mempoolFilterMap) {

        const _token0 = filterNode.tokenAddress.toLowerCase()
        const _token1 = filterNode.baseTokenAddress.toLowerCase()

        const _token2 = token0.toLowerCase()
        const _token3 = token1.toLowerCase()

        if ((_token0 === _token2 && _token1 === _token3) || (_token0 === _token3 && _token1 === _token2)) {
            filterNode.swapTransactions++
        }
    }
}

export const startPendingSwapTrxListener = (web3) => {

    web3.eth.subscribe('pendingTransactions', function(error, result){
        // console.log('111111111 [startPendingSwapTrxListener]', result)
    }).on("data", function(transactionHash){
        web3.eth
        .getTransaction(transactionHash)
        .then(function (transaction) {
            // console.log(transaction)
            const data = parseTx(transaction.input)
            if (transaction && transaction.input) {

                if (data) {
                    // console.log(data.name)

                    if (data.name === "swapExactTokensForTokens") {

                        const [amountIn, amountOutMin, path, to, deadline] = data.params.map((x) => x.value);
                        filterSwapTransaction(path)

                    } else if (data.name === "swapTokensForExactTokens") {

                        const [amountOut, amountInMax, path, to, deadline] = data.params.map((x) => x.value);
                        filterSwapTransaction(path)

                    } else if (data.name === "swapExactETHForTokens") {

                        const [amountOutMin, path, to, deadline] = data.params.map((x) => x.value);
                        filterSwapTransaction(path)

                    } else if (data.name === "swapTokensForExactETH") {
                        
                        const [amountOut, amountInMax, path, to, deadline] = data.params.map((x) => x.value);
                        filterSwapTransaction(path)

                    } else if (data.name === "swapExactTokensForETH") {
                        
                        const [amountIn, amountOutMin, path, to, deadline] = data.params.map((x) => x.value);
                        filterSwapTransaction(path)

                    } else if (data.name === "swapETHForExactTokens") {
                        
                        const [amountOut, path, to, deadline] = data.params.map((x) => x.value);
                        filterSwapTransaction(path)

                    } else if (data.name === "swapExactTokensForTokensSupportingFeeOnTransferTokens") {
                        
                        const [amountIn, amountOutMin, path, to, deadline] = data.params.map((x) => x.value);
                        filterSwapTransaction(path)

                    } else if (data.name === "swapExactETHForTokensSupportingFeeOnTransferTokens") {
                        
                        const [amountOutMin, path, to, deadline] = data.params.map((x) => x.value);
                        filterSwapTransaction(path)

                    } else if (data.name === "swapExactTokensForETHSupportingFeeOnTransferTokens") {
                        
                        const [amountIn, amountOutMin, path, to, deadline] = data.params.map((x) => x.value);
                        filterSwapTransaction(path)
                    } 
                }
            }
        })
        .catch((error) => { })
    });

    console.log('Sniper detector daemon has been started...')
}

const parseTx = (txData) => {

    let data = null
    try {
        data = abiDecoder.decodeMethod(txData);
    } catch (e) {
        
    }

    return data
}


