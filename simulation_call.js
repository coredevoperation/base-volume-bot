//import asyncHanler from "express-async-handler";
//import Config from "../models/configModels.js";
//import fetch from "node-fetch";
import { ERC20_ABI } from "./abi/ERC20_ABI.js"
import { ethers } from "ethers";
import { Uniswap_V2_Pool_ABI } from "./Uniswap_V2_Pool_ABI.js"
import EthDater from 'ethereum-block-by-date'
import * as instance from './bot.js'
import Web3 from "web3"
import { getCallHistory } from "./db.js";
import { waitBlock } from "./filter.js";
import { roundDecimal, getBlockTimeStampFromBlockNumber, getBlockNumberByTimestamp, sleep, getEthPrice } from "./utils.js";

const options = {
    reconnect: {
        auto: true,
        delay: 5000, // ms
        maxAttempts: 5,
        onTimeout: false
    }
};

export const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.ETHEREUM_RPC_URL, options))

export const userTotalProfit = new Map()

const calcTotalProfit = (sessionId) => {
    const userInfo = userTotalProfit.get(sessionId);
    if (!userInfo)
        return;
    if ((userInfo.calc_fail_amount + userInfo.calc_success_amount + userInfo.calc_rugs_amount) != userInfo.callhistory_limit)
        return;
    const roi = roundDecimal((userInfo.profit_amount - userInfo.invest_amount) / userInfo.invest_amount, 2);
    const simulation_total = `
	<u>Simulation Total Result</u>
    Total Investment: ${roundDecimal(userInfo.invest_amount, 4)} ETH
    ROI with algo: (${roundDecimal(userInfo.invest_amount, 4)} x ${roi}): ${roundDecimal(userInfo.invest_amount * roi, 4)} ETH net profit
    Algo Profit Target: x${instance.sessions.get(sessionId).profit_target}
    Start Date: ${instance.sessions.get(sessionId).start_date} ETH
    End Date: ${instance.sessions.get(sessionId).end_date}

    Total Amount of calls: ${userInfo.callhistory_limit - userInfo.calc_fail_amount}
    Amount of rugs: ${userInfo.calc_rugs_amount}
    Rug risk %: ${roundDecimal(userInfo.calc_rugs_amount * 100 /userInfo.callhistory_limit, 2)}
    `
    instance.sendMessage(sessionId, simulation_total);
}

export const getBlockNumerFromTimeStamp = async (start_date, end_date) => {
    const provider = new ethers.providers.CloudflareProvider();
    const dater = new EthDater(
        provider // Ethers provider, required.
    );
    let block_data = await dater.getDate(start_date, true, false);
    let start_block = block_data.block;
    block_data = await dater.getDate(end_date, true, false);
    let end_block = block_data.block;
    return { start_block, end_block };
}
function kFormatter(num) {
    const suffixes = ["", "K", "M", "B", "T"]
    let suffixIndex = 0
    num = parseInt(Math.abs(num).toFixed(0))
    while (num >= 1000 && suffixIndex < suffixes.length - 1) {
        num = parseFloat((Math.abs(num) / 1000).toFixed(0))
        suffixIndex++
    }
    // if (isUsd) return `$${num}${suffixes[suffixIndex]}`;
    return `${num}${suffixes[suffixIndex]}`;
}
export const simulation = async (sessionId) => {
    try {
        let config = instance.sessions.get(sessionId)
        const start_date = new Date(config.start_date);
        const end_date = new Date(config.end_date);
        const duration = (end_date.getTime() - start_date.getTime()) / (1000 * 60 * 60 * 24 * 30);//1 month
        if ((start_date.getTime() > end_date.getTime()) || (duration > 1)) {
            instance.sendMessage(sessionId, `Sorry you have to set period 1 month or less`)
            return null
        }
        if (config.invest_amount <= 0) {
            instance.sendMessage(sessionId, `Sorry invalid investment`)
            return null
        }
        let call_tokens = await getCallHistory(sessionId, start_date.getTime());
        if (call_tokens.length == 0) {
            instance.sendMessage(sessionId, `Don't exist bot call`);
        }

        let filterProfit = {
            chat_id: sessionId,
            callhistory_limit: call_tokens.length,
            calc_fail_amount: 0,
            calc_success_amount: 0,
            calc_rugs_amount: 0,
            invest_amount: 0,
            profit_amount: 0,
        }
        userTotalProfit.set(sessionId, filterProfit);

        for (const call_token of call_tokens) {
            perform_simulation(config, call_token, async (simul_data, calltoken) => {
                if (simul_data == null) {
                    console.log("------------------#################----------------", calltoken);
                    const userProfit = userTotalProfit.get(sessionId);
                    userProfit.calc_fail_amount += 1;
                    //instance.sendMessage(sessionId, `🚫 Sorry, error ${calltoken}`);
                } else {
                    let liqudity_remove_message;
                    if (simul_data.rugs_liqudity_remove.transaction == 0) {
                        liqudity_remove_message = "❌ Liquidity_remove: No"
                    } else {
                        liqudity_remove_message = "❌ Liquidity_remove: Yes"
                        liqudity_remove_message += `\n     └─ transaction: <code class="text-entity-code">${simul_data.rugs_liqudity_remove.transaction}</code>`
                        const date = new Date(simul_data.rugs_liqudity_remove.blockTimestamp * 1000);
                        liqudity_remove_message += `\n     └─ time: ${date.toLocaleString()}`
                    }
                    let impact_message;
                    if (simul_data.rugs_impact.length == 0) {
                        impact_message = "❗ Impact Info: No"
                    } else {
                        impact_message = "❗ Impact Info: Yes"
                        for (const impact_info of simul_data.rugs_impact) {
                            impact_message += `\n   └─ impact info`
                            const date = new Date(impact_info.impact_blocktimestamp * 1000);
                            impact_message += `\n     └─ time: ${date.toLocaleString()}`
                            impact_message += `\n     └─ %: ${impact_info.impact_percent}`
                        }
                    }
                    let roi_message;
                    roi_message = "ROI :"
                    for (const roi of simul_data.ROI) {
                        roi_message += ` ${roi}%`
                    }
                    const token_info = await getTokenInfo(calltoken.token_address)
                    const base_info = await getTokenInfo(calltoken.base_address)
                    // console.log("#################################")
                    // console.log(simul_data.highestPrice);
                    // console.log(simul_data.startPrice);
                    const highest_potential_profit = simul_data.startPrice == 0 ? simul_data.startPrice : roundDecimal(Number((simul_data.highestPrice - simul_data.startPrice) / simul_data.startPrice), 3)
                    const highest_potential_profit_value = simul_data.invest_eth * highest_potential_profit;
                    const current_potential_profit = simul_data.ROI.length == 0? 0 : roundDecimal(simul_data.ROI[simul_data.ROI.length - 1] / 100, 3);
                    let highest_content = ""
                    if (current_potential_profit <= highest_potential_profit){
                        highest_content = `Highest ROI: (${simul_data.invest_eth} x ${highest_potential_profit}): ${highest_potential_profit_value}`
                    }
                    const ethPrice = await getEthPrice(web3);
                    const lastSellTime = simul_data.sell_points.length == 0? new Date() : new Date(simul_data.sell_points[simul_data.sell_points.length - 1] * 1000);
                    const simulation_settings = `
    <u>Simulation Result</u>
    ⚡ Token Info: ${token_info.name} ${base_info.symbol}/${token_info.symbol}
    🏠 Token address: <code class="text-entity-code">${token_info.address}</code>
        Marketcap called: $ ${kFormatter(simul_data.firstMargetcap * ethPrice)}
        Initial investment: ${simul_data.invest_eth} ETH
        Marketcap all time high: $ ${kFormatter(simul_data.highestMarketcap * ethPrice)}
        ${highest_content}
        ROI with Algo: (${simul_data.invest_eth} x ${current_potential_profit}): ${roundDecimal(simul_data.owned_eths - simul_data.invest_eth, 3)} ETH net profit 
        Time: ${lastSellTime.toLocaleString()}
        ${liqudity_remove_message}
        ${impact_message}
        📊 Chart: <a href="https://www.dextools.io/app/en/ether/pair-explorer/${calltoken.pair_address}">DexTools</a>
                        `
                    instance.sendMessage(sessionId, simulation_settings);
                    const userProfit = userTotalProfit.get(sessionId);
                    if (simul_data.rugs_liqudity_remove.transaction == 0){
                        userProfit.calc_success_amount += 1;
                    }else{
                        userProfit.calc_rugs_amount += 1;
                    }
                    
                    userProfit.invest_amount = Number(userProfit.invest_amount) + simul_data.invest_eth;
                    userProfit.profit_amount = Number(userProfit.profit_amount) + simul_data.owned_eths;
                }
                calcTotalProfit(sessionId);
            });
        }

    } catch (error) {
        console.log('error', error);
        return null
    }
}

export const perform_simulation = async (config, call_token, callback) => {
    let reserve0 = 0;
    let reserve1 = 0;
    const start_time = Math.floor(Number(call_token.timestamp) / 1000);
    const end_date = new Date(config.end_date);
    const end_time = Math.floor(end_date.getTime() / 1000);

    let trailing_lose_data = {
        invest_eth: config.invest_amount,
        profit_target: config.profit_target,
        trailing_stop_loss: 0,
        trailing_stop: 0,
        owned_tokens: 0,
        delta_tokens: 0,
        owned_eths: config.invest_amount,
        delta_eths: 0,
        buyable_eth: config.invest_amount,
        highestPrice: 0,
        firstMargetcap: 0,
        startPrice: 0,
        highestMarketcap: 0,
        rugs_liqudity_remove: {
            transaction: 0,
            blockTimestamp: 0,
        },
        rugs_impact: [],
        buy_sell_mode: "buy",
        ROI: [],
        buy_points: [],
        sell_points: [],
    }
    let last_timestamp = start_time;

    try {
        
        let start_block = await getBlockNumberByTimestamp(start_time);
        start_block = Number(start_block);
        //let end_block = await getBlockNumberByTimestamp(end_date.getTime() / 1000);
        // let start_block = 17163764;
        // let end_block = 17817922;
        //console.log(`base_address = ${call_token.base_address} token_address = ${call_token.token_address}`)
        const token0_info = await getTokenInfo(call_token.base_address);
        const token1_info = await getTokenInfo(call_token.token_address);

        // if (token1_info.name == "HISOMU" || token1_info.name == "spurdo" ){
            
        // }else{
        //     return;
        // }
        let poolContract = new web3.eth.Contract(Uniswap_V2_Pool_ABI, call_token.pair_address)
        let last_block = 0;
        
        let index = 0;
        const ethPrice = await getEthPrice(web3)
        if (token0_info.symbol === 'USDT' || token0_info.symbol === 'USDC') {
            trailing_lose_data.invest_eth = Number(trailing_lose_data.invest_eth) * Number(ethPrice);
            trailing_lose_data.trailing_stop_loss = Number(trailing_lose_data.trailing_stop_loss) * Number(ethPrice);
            trailing_lose_data.owned_eths = trailing_lose_data.invest_eth;
            trailing_lose_data.buyable_eth = trailing_lose_data.invest_eth;
        }
        // console.log(`start_block = ${start_block}, token0_info=${token0_info.name}. token1_info=${token1_info.name}`)
        while (last_timestamp <= end_time) {
            let reserveList = [];
            let swapList = [];
           //console.log(`loop#########, ${index}, lastTime = ${last_timestamp}, end_time=${end_time})`)
            last_block = start_block + Number(process.env.SIMULATION_GET_BLOCK_THRESHOLD);
            // if (last_block > end_block)
            //     last_block = end_block;
            let events = await poolContract.getPastEvents('Sync',
                {
                    fromBlock: start_block,
                    toBlock: last_block,
                },);
            // (err, events) => {
            //     console.log(events);
            // });
            if (events.length == 0) {
                last_timestamp = await getBlockTimeStampFromBlockNumber(last_block);
                let currentDate = new Date()
                if ((last_timestamp + 60 * 10) > currentDate.getTime() / 1000) {
                    waitBlock(web3, Number(process.env.SIMULATION_GET_BLOCK_THRESHOLD));
                } else {
                    sleep(1000)
                }
                start_block = last_block + 1;
                continue;
            }

            for (const event of events) {
                reserve0 = call_token.primaryIndex == 0 ? event.returnValues.reserve1 : event.returnValues.reserve0;
                reserve0 /= (10 ** token0_info.decimal);
                reserve1 = call_token.primaryIndex == 0 ? event.returnValues.reserve0 : event.returnValues.reserve1;
                reserve1 /= (10 ** token1_info.decimal);
                reserveList.push({
                    reserve0: reserve0,
                    reserve1: reserve1,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            }

            sleep(1000)
            events = await poolContract.getPastEvents('Swap',
                {
                    fromBlock: start_block,
                    toBlock: last_block,
                },);

            // (err, events) => {
            //     console.log(events);
            // });
            for (const event of events) {
                const amount0In = call_token.primaryIndex == 0 ? event.returnValues.amount1In : event.returnValues.amount0In;
                const amount0Out = call_token.primaryIndex == 0 ? event.returnValues.amount1Out : event.returnValues.amount0Out;
                const amount1In = call_token.primaryIndex == 0 ? event.returnValues.amount0In : event.returnValues.amount1In;
                const amount1Out = call_token.primaryIndex == 0 ? event.returnValues.amount0Out : event.returnValues.amount1Out;
                swapList.push({
                    amount0In: amount0In / (10 ** token0_info.decimal),
                    amount0Out: amount0Out / (10 ** token0_info.decimal),
                    amount1In: amount1In / (10 ** token1_info.decimal),
                    amount1Out: amount1Out / (10 ** token1_info.decimal),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            }

            if (index == 0) {
                const start_price = Number(reserveList[0].reserve0) / Number(reserveList[0].reserve1);
                trailing_lose_data.firstMargetcap = start_price * token1_info.totalSupply;
                if (trailing_lose_data.firstMargetcap == 0){
                    console.log(`${call_token.pair_address} pool is empty`);
                    return callback(null, `pool is empty`);
                }
                trailing_lose_data.trailing_stop_loss = start_price / 100;
                trailing_lose_data.trailing_stop = start_price + trailing_lose_data.trailing_stop_loss;
                trailing_lose_data.startPrice = start_price;
                // invest_tokens = invest_eth * (Number(poolInfoList[0].reserve1) / Number(poolInfoList[0].reserve0));
                // owned_tokens = invest_tokens;
                // trailing_stop = start_price * profit_target;
                //console.log(`start_price=${start_price} base = ${token0_info.address} token=${token1_info.address}`);
            }
            let analysis_info = await tailing_stop_algo(trailing_lose_data, reserveList, swapList, token0_info, token1_info);
            trailing_lose_data = analysis_info;
            if (trailing_lose_data.trailing_stop == 0) {
                break;
            }
            start_block = last_block + 1;
            last_timestamp = await getBlockTimeStampFromBlockNumber(last_block);
            index++;
            sleep(1000)
        }
        if (trailing_lose_data.owned_tokens != 0){
            let minusflag_eth = trailing_lose_data.delta_eths > 0 ? 1 : -1;
            let minusflag_token = trailing_lose_data.delta_tokens > 0 ? 1 : -1;
            let new_reserve0 = Number(reserve0) + minusflag_eth * Number(minusflag_eth * trailing_lose_data.delta_eths);
            let new_reserve1 = Number(reserve1) + minusflag_token * Number(minusflag_token * trailing_lose_data.delta_tokens);

            const out_eth = getAmountOut(trailing_lose_data.owned_tokens, new_reserve1, new_reserve0)
            console.log(`time limit sell price = ${reserve0 / reserve1}, tokens= ${trailing_lose_data.owned_tokens}`)
            trailing_lose_data.owned_eths += out_eth;
            trailing_lose_data.ROI.push(roundDecimal((trailing_lose_data.owned_eths - trailing_lose_data.invest_eth) * 100 / trailing_lose_data.invest_eth, 1));
            trailing_lose_data.sell_points.push(last_timestamp)
          //  console.log(`sell point owned_eths = ${trailing_lose_data.owned_eths}, owned_tokens = ${trailing_lose_data.owned_tokens} current_price = ${reserve0/reserve1}`)
        }
        if (token0_info.symbol === 'USDT' || token0_info.symbol === 'USDC') {
            trailing_lose_data.invest_eth = Number(trailing_lose_data.invest_eth) / Number(ethPrice);
            trailing_lose_data.trailing_stop_loss = Number(trailing_lose_data.trailing_stop_loss) / Number(ethPrice);
            trailing_lose_data.owned_eths = Number(trailing_lose_data.owned_eths) / Number(ethPrice);
            trailing_lose_data.buyable_eth = Number(trailing_lose_data.buyable_eth) / Number(ethPrice);
            trailing_lose_data.highestPrice = Number(trailing_lose_data.highestPrice) / Number(ethPrice);
            trailing_lose_data.startPrice = Number(trailing_lose_data.startPrice) / Number(ethPrice);
            trailing_lose_data.highestMarketcap = Number(trailing_lose_data.highestMarketcap) / Number(ethPrice);
            trailing_lose_data.firstMargetcap = Number(trailing_lose_data.firstMargetcap) / Number(ethPrice);
        }
        if (trailing_lose_data.startPrice == 0){
            callback(null, call_token);
        }else{
            callback(trailing_lose_data, call_token);
        }
    } catch (error) {
        if (trailing_lose_data.ROI.startPrice == 0){
            callback(null, `${error}`);
            return;
        }
        if (trailing_lose_data.owned_tokens != 0){
            let minusflag_eth = trailing_lose_data.delta_eths > 0 ? 1 : -1;
            let minusflag_token = trailing_lose_data.delta_tokens > 0 ? 1 : -1;
            let new_reserve0 = Number(reserve0) + minusflag_eth * Number(minusflag_eth * trailing_lose_data.delta_eths);
            let new_reserve1 = Number(reserve1) + minusflag_token * Number(minusflag_token * trailing_lose_data.delta_tokens);
            const out_eth = getAmountOut(trailing_lose_data.owned_tokens, new_reserve1, new_reserve0)
            trailing_lose_data.owned_eths += out_eth;
            trailing_lose_data.ROI.push(roundDecimal((trailing_lose_data.owned_eths - trailing_lose_data.invest_eth) * 100 / trailing_lose_data.invest_eth, 1));
            trailing_lose_data.sell_points.push(last_timestamp)
           // console.log(`sell point owned_eths = ${trailing_lose_data.owned_eths}, owned_tokens = ${trailing_lose_data.owned_tokens} current_price = ${reserve0/reserve1}`)
        }
        if (token0_info.symbol === 'USDT' || token0_info.symbol === 'USDC') {
            trailing_lose_data.invest_eth = Number(trailing_lose_data.invest_eth) / Number(ethPrice);
            trailing_lose_data.trailing_stop_loss = Number(trailing_lose_data.trailing_stop_loss) / Number(ethPrice);
            trailing_lose_data.owned_eths = Number(trailing_lose_data.owned_eths) / Number(ethPrice);
            trailing_lose_data.buyable_eth = Number(trailing_lose_data.buyable_eth) / Number(ethPrice);
            trailing_lose_data.highestPrice = Number(trailing_lose_data.highestPrice) / Number(ethPrice);
            trailing_lose_data.startPrice = Number(trailing_lose_data.startPrice) / Number(ethPrice);
            trailing_lose_data.highestMarketcap = Number(trailing_lose_data.highestMarketcap) / Number(ethPrice);
            trailing_lose_data.firstMargetcap = Number(trailing_lose_data.firstMargetcap) / Number(ethPrice);
        }
        callback(trailing_lose_data, call_token);
    }
}
function getAmountOut(amountIn, reserveIn, reserveOut) {
    const amountInWithFee = amountIn * 997;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000 + amountInWithFee;
    const amountOut = numerator / denominator;
    return amountOut;
}
export const tailing_stop_algo = async (trailing_lose_data, reserveList, swapList, token0_info, token1_info) => {
    let user_data = trailing_lose_data;
    try {
        let prev_pool_info = reserveList[0];
        //let pre_price = user_data.trailing_stop;
        let prev_reserve0 = prev_pool_info.reserve0;
        let prev_reserve1 = prev_pool_info.reserve1;
        for (const poolInfo of reserveList) {
            for (const swapInfo of swapList) {
                if (user_data.transactionHash == swapInfo.transactionHash) {
                    let impact_percent = 0;
                    impact_percent = swapInfo.amount0In * 100 / poolInfo.reserve0;
                    let timestamp = await getBlockTimeStampFromBlockNumber(poolInfo.blockNumber);
                    impact_percent = roundDecimal(impact_percent, 1);
                    if (impact_percent > 15) {
                        user_data.rugs_impact.push({ impact_blocktimestamp: timestamp, impact_percent: `${impact_percent} %` })
                        break;
                    }
                    impact_percent = swapInfo.amount1In * 100 / poolInfo.reserve1;
                    impact_percent = roundDecimal(impact_percent, 1);
                    if (impact_percent > 15) {
                        user_data.rugs_impact.push({ impact_blocktimestamp: timestamp, impact_percent: `${impact_percent} %` })
                        break;
                    }
                }
            }
            if ((poolInfo.reserve0 / prev_pool_info.reserve0) < 0.01) {
                let timestamp = await getBlockTimeStampFromBlockNumber(poolInfo.blockNumber);
                user_data.rugs_liqudity_remove = { transaction: poolInfo.transactionHash, blockTimestamp: timestamp }
                user_data.trailing_stop = 0;
                let buy_eth = getAmountOut(user_data.owned_tokens, prev_reserve1, prev_reserve0);
                user_data.delta_tokens += user_data.owned_tokens;
                user_data.owned_eths += buy_eth;
                user_data.delta_eths -= buy_eth;
                user_data.owned_tokens = 0;
                user_data.trailing_stop = 0;
                const sell_time = await getBlockTimeStampFromBlockNumber(prev_pool_info.blockNumber);
                user_data.sell_points.push(sell_time);
                user_data.ROI.push(roundDecimal((user_data.owned_eths - user_data.invest_eth) * 100 / user_data.invest_eth, 1));
                console.log(`point liquidity_remove_risk pre_reserve0 = ${prev_pool_info.reserve0} cur_reserve0 = ${poolInfo.reserve0}`)

            }
            if (user_data.trailing_stop == 0) {
                break;
            }
            let minusflag_eth = user_data.delta_eths > 0 ? 1 : -1;
            let minusflag_token = user_data.delta_tokens > 0 ? 1 : -1;
            let new_reserve0 = Number(poolInfo.reserve0) + minusflag_eth * Number(minusflag_eth * user_data.delta_eths);
            let new_reserve1 = Number(poolInfo.reserve1) + minusflag_token * Number(minusflag_token * user_data.delta_tokens);
            if ((new_reserve0 < 0) || (new_reserve1 < 0)) {
                user_data.trailing_stop = 0;
                break;
            }
            let price = new_reserve0 / new_reserve1;//reserve0 WETH, reserve1 Token

            if (user_data.highestPrice < price) {
                user_data.highestPrice = price;
                user_data.highestMarketcap = user_data.highestPrice * token1_info.totalSupply;//must current totalSupply
            }
            if ((price >= (user_data.trailing_stop + user_data.trailing_stop_loss)) && (user_data.buy_sell_mode == "sell")) {
                user_data.trailing_stop = price - user_data.trailing_stop_loss;
                //console.log(`stop_lose_up = ${user_data.trailing_stop}`)
            } else if ((price <= user_data.trailing_stop) && (user_data.buy_sell_mode == "sell")) {
                let sell_token = user_data.owned_tokens;//(user_data.owned_tokens < 2) ? user_data.owned_tokens : user_data.owned_tokens / 2;
                //let buy_eth = getAmountOut(sell_token, prev_reserve1, prev_reserve0);
                let buy_eth = getAmountOut(sell_token, new_reserve1, new_reserve0);
                const temp_eth = user_data.delta_eths - buy_eth;
                if (temp_eth > Math.abs(new_reserve1)) {
                    temp_eth = new_reserve1;
                    user_data.owned_eths += (temp_eth - user_data.delta_eths);
                    user_data.trailing_stop = 0;
                }else{
                    user_data.owned_eths += buy_eth;
                }
                user_data.delta_tokens = user_data.delta_tokens + sell_token;
                user_data.delta_eths = temp_eth;
                user_data.owned_tokens = user_data.owned_tokens - sell_token;
                // if (user_data.owned_tokens == 0) {
                //     user_data.trailing_stop = 0;
                // }
                user_data.buyable_eth = user_data.owned_eths;//pre_price * sell_token / 2;

                user_data.buy_sell_mode = "buy";
                const sell_time = await getBlockTimeStampFromBlockNumber(poolInfo.blockNumber);
                user_data.sell_points.push(sell_time);
                user_data.ROI.push(roundDecimal((user_data.owned_eths - user_data.invest_eth) * 100 / user_data.invest_eth, 1));
                if (user_data.owned_eths > (user_data.invest_eth * user_data.profit_target)) {
                    user_data.trailing_stop = 0;
                }
                //user_data.ROI.push(roundDecimal(((user_data.owned_eths + user_data.owned_tokens * pre_price) - user_data.invest_eth) * 100 / user_data.invest_eth, 1));
               // console.log(`sell point owned_eths = ${user_data.owned_eths}, owned_tokens = ${user_data.owned_tokens} current_price = ${price}`)
            } else if ((price <= (user_data.trailing_stop - user_data.trailing_stop_loss)) && (user_data.buy_sell_mode == "buy")) {
                user_data.trailing_stop = price + user_data.trailing_stop_loss;
                //console.log(`stop_lose_down = ${user_data.trailing_stop}`)
            } else if ((price >= user_data.trailing_stop) && (user_data.buy_sell_mode == "buy")) {
                //let buy_tokens = getAmountOut(user_data.buyable_eth, prev_reserve0, prev_reserve1);//user_data.buyable_eth / pre_price;
                let buy_tokens = getAmountOut(user_data.buyable_eth, new_reserve0, new_reserve1);
                user_data.delta_tokens -= buy_tokens;
                if (Math.abs(user_data.delta_tokens) > new_reserve1) {
                    user_data.trailing_stop = 0;
                    break;
                }
                user_data.owned_tokens = user_data.owned_tokens + buy_tokens;

                user_data.owned_eths -= user_data.buyable_eth;
                user_data.delta_eths += user_data.buyable_eth;
                // if (trailing_lose_data.startPrice == 0){
                //     trailing_lose_data.startPrice = price;
                // }
                user_data.buy_points.push(poolInfo.transactionHash);//buy strategy
                user_data.buy_sell_mode = "sell";
                //console.log(`buy point owned_eths = ${user_data.owned_eths}, owned_tokens = ${user_data.owned_tokens} buyable_eth = ${user_data.buyable_eth} current_price = ${price}`)
            } else {
                //console.log(`else trailing_stop = ${user_data.trailing_stop}, current price = ${price}`)
            }
            prev_pool_info = poolInfo;
            prev_reserve0 = new_reserve0;
            prev_reserve1 = new_reserve1;
            //pre_price = price;
        }
    } catch (error) {
        console.error(error);
    }
    return user_data;
}

export const getTokenInfo = async (tokenAddress) => {

    return new Promise(async (resolve, reject) => {

        let tokenContract = null
        const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_MEVBLOCKER_HTTP_URL);

        try {
            tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        } catch (err) {

            console.error('getTokenInfo2', err)
        }
        var tokenPromises = [];

        tokenPromises.push(tokenContract.name());
        tokenPromises.push(tokenContract.symbol());
        tokenPromises.push(tokenContract.decimals());
        tokenPromises.push(tokenContract.totalSupply());

        Promise.all(tokenPromises).then(tokenInfo => {

            const decimal = parseInt(tokenInfo[2])
            const totalSupply = Number(tokenInfo[3]) / 10 ** decimal
            const result = { address: tokenAddress, name: tokenInfo[0], symbol: tokenInfo[1], decimal, totalSupply }
            resolve(result)

        }).catch(err => {
            console.error('getTokenInfo2', err)

            resolve(null)
        })
    })
}