import * as afx from './global.js'
import * as uniconst from './uni-catch/const.js'
import {UNISWAP_V2_FACTORY_ABI} from './abi/uniswapv2-factory-abi.js'
import {UNISWAP_V3_FACTORY_ABI} from './abi/uniswapv3-factory-abi.js'
import {UNISWAP_V2_POOL_ABI} from './abi/uniswapv2-pool-abi.js'

import * as utils from './utils.js'

const getTokenKey = (token) => {

    return `${token.address}_${token.dex}`
}

const getPairs = async (web3, tokenAddress, tokenSymbol, factoryABI, factoryAddress) => {

    let pairsResult = []

    const factoryContract = new web3.eth.Contract(factoryABI, factoryAddress);

    let pairBaseNodes = [ { address: uniconst.WETH_ADDRESS, symbol: 'ETH' }, { address: uniconst.USDT_ADDRESS, symbol: 'USDT' }, { address: uniconst.USDC_ADDRESS, symbol: 'USDC' } ]

    var pairsPromises = [];
    for (const node of pairBaseNodes) {

        pairsPromises.push(factoryContract.methods.getPair(tokenAddress, node.address).call());
    }

    const pairAddresses = await Promise.all(pairsPromises)
    
    for (let i = 0; i < pairAddresses.length; i++) {
        const pairAddress = pairAddresses[i]
        const pairBaseNode = pairBaseNodes[i]

        if (pairAddress !== "0x0000000000000000000000000000000000000000") {

            let pairData = { address: pairAddress, label : `${tokenSymbol} / ${pairBaseNode.symbol}`, base: `${pairBaseNode.symbol}`, symbol: `${tokenSymbol}` }
            pairsResult.push(pairData);
        }
    }
    
    // try {

        

    // } catch (err) {
    //     console.log(err)

    //     return pairsResult
    // }

    return pairsResult
}

const calculateTokenPrice_UniswapV2 = async (web3, pairsResult, tokenAddress, tokenDecimal, callback) => {

    return new Promise(async (resolve, reject) => {

        let usdPrice = 0
        let resultPair = null
        let liquiditySize = 0

        for (const pairData of pairsResult) {
            
            const pairContract = new web3.eth.Contract(UNISWAP_V2_POOL_ABI, pairData.address);
    
            let tokenPromise = []
            tokenPromise.push(pairContract.methods.token0().call())
            tokenPromise.push(pairContract.methods.token1().call())
            tokenPromise.push(pairContract.methods.getReserves().call())
    
            const result = await Promise.all(tokenPromise)
    
            let tokenBalance = 0.0, baseTokenBalance = 0.0
            let baseTokenAddress = ''
    
            if (result[0].toLowerCase() === tokenAddress.toLowerCase()) {
                tokenBalance = result[2]._reserve0
                baseTokenBalance = result[2]._reserve1
                baseTokenAddress = result[1].toString()
            } else {
                tokenBalance = result[2]._reserve1
                baseTokenBalance = result[2]._reserve0
                baseTokenAddress = result[0].toString()
            }
    
            tokenBalance = Number(tokenBalance) / 10 ** Number(tokenDecimal)
    
            if (pairData.base === 'ETH') {
    
                baseTokenBalance = Number(web3.utils.fromWei(baseTokenBalance, "ether"))
    
                const ethPriceInUsd = await utils.getEthPrice(web3)
                baseTokenBalance *= ethPriceInUsd
    
            } else if (pairData.base === 'USDT') {
    
                baseTokenBalance = Number(web3.utils.fromWei(baseTokenBalance, "mwei"))
    
            } else if (pairData.base === 'USDC') {
    
                baseTokenBalance = Number(web3.utils.fromWei(baseTokenBalance, "mwei"))
    
            } else {
    
                continue
            }
    
            const currentLiquiditySize = baseTokenBalance * 2
    
            if (tokenBalance && tokenBalance != 0) {
    
                const price = baseTokenBalance / tokenBalance
                if (liquiditySize < currentLiquiditySize) {
                    liquiditySize = currentLiquiditySize
                    usdPrice = price
                    resultPair = pairData
                }

                callback(price, pairData)

            }
        }
    
        resolve({ usdPrice, resultPair })
    })
}

const calculateTokenPrice_UniswapV3 = async (pairsResult, tokenDecimal) => {
    return 0
}

const appendRecordInfo = async (database, tokenInfo, pairData, dex, tokenPrice, marketCap) => {

    database.addGainerHistory(tokenInfo.address, tokenInfo.name, tokenInfo.symbol, pairData.address, dex, pairData.base, tokenPrice, marketCap)
    //console.log(`Added gainer history : ${tokenInfo.symbol} / ${pairData.base}, Dex: ${dex}, MCap : ${utils.roundDecimal(marketCap, 5)}`)
}

export const start = (web3, database) => {

    console.log('Gainer daemon has been started...')
    //doEvent(web3, database)

    setTimeout(() => {
        doEvent(web3, database)
    }
    , 60 * 1000)
}

export const doEvent = async (web3, database) => {

    const baseTokens = await database.getAllTokens()

    // flatten tokens from db
    let updatedTokens = new Map()
    for (const token of baseTokens) {

        let value = updatedTokens.get(token.address)
        if (!value) {

            value = {address: token.address, chatids:[token.chatid]}
            updatedTokens.set(token.address, value)

        } else {

            if (!value.chatids.find(opt => opt == token.chatid)) {

                value.chatids.push(token.chatid)
            }

        }
    }

    for (const [address, token] of updatedTokens) {

        let tokenInfo = await utils.getTokenInfoW(web3, token.address)

        if (!tokenInfo) {
            continue
        }

        getPairs(web3, token.address, tokenInfo.symbol, UNISWAP_V2_FACTORY_ABI, uniconst.UniswapV2FactoryContractAddress).then(async pairsResult => {
            calculateTokenPrice_UniswapV2(web3, pairsResult, tokenInfo.address, tokenInfo.decimal, (price, pairData) => {

                let marketCap = tokenInfo.totalSupply * price
                appendRecordInfo(database, tokenInfo, pairData, afx.UniswapV2, price, marketCap, token.chatids)

            }).then (res => {

            })
        })

        // getPairs(web3, token.address, tokenInfo.symbol, UNISWAP_V3_FACTORY_ABI, uniconst.UniswapV3FactoryContractAddress).then(async pairsResult => {
        //     const {usdPrice, resultPair} = await calculateTokenPrice_UniswapV2(web3, pairsResult, tokenInfo.address, tokenInfo.decimal)
        //     if (resultPair) {
        //         let marketCap = tokenInfo.totalSupply * usdPrice
        //         appendRecordInfo(database, tokenInfo, resultPair, afx.UniswapV3, usdPrice, marketCap, token.chatids)
        //     }
        // })
    }

    setTimeout(() => {
        doEvent(web3, database)
    }
    , 15 * 60 * 1000)
}

const getPairAddressList = async (web3, tokenAddress) => {

    let result = []

    let pairsResult = await getPairs(web3, tokenAddress, '', UNISWAP_V2_FACTORY_ABI, uniconst.UniswapV2FactoryContractAddress)

    let pairsResult2 = null; //await getPairs(web3, tokenAddress, '', UNISWAP_V3_FACTORY_ABI, uniconst.UniswapV3FactoryContractAddress)

    if (pairsResult) {
        for (const pairData of pairsResult) {
            result.push(pairData.address)
        }
    }

    if (pairsResult2) {
        for (const pairData of pairsResult2) {
            result.push(pairData.address)
        }
    }

    return result
}

export const notify = async (web3, database, session, params) => {

     const baseTokens = await database.getTokens(session.chatid)
    //const baseTokens = await database.getAllTokens()

    let pairAddressSet = new Set()
    for (const token of baseTokens) {

        const pairAddressListForToken = await getPairAddressList(web3, token.address)

        pairAddressSet.add(...pairAddressListForToken)
    }

    let startDate = null
    let endDate = null

    let histDurationMsg = ''  

    if (params.length > 0) {
        startDate = params[0]

        if (params.length > 1) {
            endDate = params[1]

            histDurationMsg = `Filter duration : 
\tfrom ${utils.getTimeStringUTC(startDate)} UTC
\tto ${utils.getTimeStringUTC(endDate)} UTC`

        } else {

            histDurationMsg = `Filter duration : 
\tfrom ${utils.getTimeStringUTC(startDate)} UTC`
        }
    }

    let message = ''
    if (!startDate) {
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)

        message = `alphAI Daily Top Gainers 🤖\n`

    } else {

        message = `alphAI Top Gainers on historical database 🤖\n`
    }

    if (histDurationMsg.length > 0) {
        message += '\n' + histDurationMsg + '\n'
    }

    let latestDate = null
    let itemNum = 0

    let result = []
    for (const pairAddress of pairAddressSet) {

        let startItem = null, latestItem = null

        if (!endDate) {

            startItem = await database.selectGainerFrom(pairAddress, startDate)
            latestItem = await database.selectGainerLatest(pairAddress)

            
        } else {

            const tempItem = await database.selectGainerBetween(pairAddress, startDate, endDate)

            if (!tempItem) {
                continue
            }

            startItem = tempItem.from
            latestItem = tempItem.to
        }

        // console.log('startItem', startItem)
        // console.log('latestItem', latestItem)

        if (!latestItem) {
            continue
        }

        if (!startItem) {
            startItem = latestItem
        }

        if (!startItem.market_cap) {
            continue
        }

        if (!latestDate || latestDate < latestItem.timestamp) {
            latestDate = latestItem.timestamp
        }

        const fX = Number(latestItem.market_cap / startItem.market_cap)

        if (fX < 1.0 || latestItem.market_cap < 1) {
            continue
        }

        result.push({tokenName: latestItem.token_name, fX, marketCap: latestItem.market_cap, pairAddress})
    }

    if (!latestDate) {
        latestDate = new Date(Date.now())
    }

    result.sort((a, b) => {
        return b.fX - a.fX;
    });

    for (const node of result) {
        itemNum++
        const msgItem = `\n${itemNum}: <a href="https://dexscreener.com/ethereum/${node.pairAddress}"><u>${node.tokenName}</u></a> (${utils.roundDecimal(node.fX, 1)}X) | MC: $${utils.roundDecimal(node.marketCap, 0)}`
        message += msgItem
    }

    message += `\n\n<i>Last update ${utils.getTimeStringUTC(latestDate)} UTC</i>

<i>Please add more tokens to check the daily top gainers. [Settings -> ROI Statistics -> Add a token address]</i>

<a href="https://dexscreener.com/ethereum/0x695051b0028d02172d0204c964b293d7b25b6710"><u>Chart</u></a>`

//console.log(message)

    return message
}