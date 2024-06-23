//import asyncHanler from "express-async-handler";
//import Config from "../models/configModels.js";
//import fetch from "node-fetch";
import { ERC20_ABI } from "./abi/ERC20_ABI.js"
import { ethers } from "ethers";
import { Uniswap_V2_Pool_ABI } from "./Uniswap_V2_Pool_ABI.js"
import EthDater from 'ethereum-block-by-date'
import { sessions } from "./bot.js";
import Web3 from "web3"
import { roundDecimal, getBlockTimeStampFromBlockNumber, getBlockNumberByTimestamp, sleep, getEthPrice} from "./utils.js";

const options = {
    reconnect: {
        auto: true,
        delay: 5000, // ms
        maxAttempts: 5,
        onTimeout: false
    }
};

export const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.ETHEREUM_RPC_URL, options))

export const querySubGraphAPI = async (query_data) => {
    const url = process.env.MY_THEGRAPH_URL
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query_data
            })
        });
        const resData = await res.json()
        // console.log('done')
        return resData;

    } catch (error) {

        console.log('executeEthscanAPI', error)
    }
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
export const simulation = async(sessionId) => {
    try {
        let config = sessions.get(sessionId)

        const start_date = new Date(config.start_date);
        const end_date = new Date(config.end_date);
        console.log(`start ${start_date} end ${end_date}`)
        let trailing_lose_data = {
            invest_eth: config.invest_amount,
            profit_target: config.profit_target,
            trailing_stop_loss: config.trailing_stop_loss,
            trailing_stop: 0,
            owned_tokens: 0,
            delta_tokens: 0,
            owned_eths: config.invest_amount,
            delta_eths: 0,
            buyable_eth: config.invest_amount,
            highestPrice: 0,
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
        
       let start_block = await getBlockNumberByTimestamp(start_date.getTime() / 1000);
       let end_block = await getBlockNumberByTimestamp(end_date.getTime() / 1000);
        // let start_block = 17163764;
        // let end_block = 17817922;
        let token_address = config.simul_token_address;

        const query_data = `query {
            pairCreateds(
              orderBy: blockNumber
              where: {or: [
                  { token0: "${token_address}" },
                  { token1: "${token_address}" }
                ]}
            ) {
              token0
              token1
              pair
              transactionHash
              blockNumber
            }
          }`
        let poolInfoContainer = await querySubGraphAPI(query_data);
        let poolInfoList = poolInfoContainer["data"]["pairCreateds"];
        const length = poolInfoList.length;
        if (poolInfoList.length == 0) {
            console.log("can't find uniswap pool")
            return;
        }
        let { token0, token1, pair } = poolInfoList[length - 1];
        let sort = token_address == token0 ? true : false; //for ETH/TOKEN

        const token0_info = sort ? await getTokenInfo(token1) : await getTokenInfo(token0);
        const token1_info = sort ? await getTokenInfo(token0) : await getTokenInfo(token1);

        let poolContract = new web3.eth.Contract(Uniswap_V2_Pool_ABI, pair)
        let last_block = 0;
        let index = 0;
        const ethPrice = await getEthPrice(web3)
        if (token0_info.symbol === 'USDT' ||  token0_info.symbol === 'USDC'){
            trailing_lose_data.invest_eth = Number(trailing_lose_data.invest_eth) * Number(ethPrice);
            trailing_lose_data.trailing_stop_loss = Number(trailing_lose_data.trailing_stop_loss) * Number(ethPrice);
            trailing_lose_data.owned_eths = trailing_lose_data.invest_eth;
            trailing_lose_data.buyable_eth = trailing_lose_data.invest_eth;
        }

        console.log(`start_block = ${start_block}, end_block=${end_block}, token0_info=${token0_info.name}. token1_info=${token1_info.name}`)
        while (start_block <= end_block) {
            let reserveList = [];
            let swapList = [];
            last_block = start_block + Number(process.env.SIMULATION_GET_BLOCK_THRESHOLD);
            if (last_block > end_block)
                last_block = end_block;

            let events = await poolContract.getPastEvents('Sync',
                {
                    fromBlock: start_block,
                    toBlock: last_block,
                },
                (err, events) => {
                    console.log(events);
                });

            if (events.length == 0){
                start_block = last_block + 1;
                continue;
            }
            
            for (const event of events) {
                reserveList.push({
                    reserve0: sort ? event.returnValues.reserve1 : event.returnValues.reserve0,
                    reserve1: sort ? event.returnValues.reserve0 : event.returnValues.reserve1,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            }

            sleep(100)
            events = await poolContract.getPastEvents('Swap',
                {
                    fromBlock: start_block,
                    toBlock: last_block,
                },
                (err, events) => {
                    console.log(events);
                });
            for (const event of events) {
                swapList.push({
                    amount0In: sort ? event.returnValues.amount1In : event.returnValues.amount0In,
                    amount0Out: sort ? event.returnValues.amount1Out : event.returnValues.amount0Out,
                    amount1In: sort ? event.returnValues.amount0In : event.returnValues.amount1In,
                    amount1Out: sort ? event.returnValues.amount0Out : event.returnValues.amount1Out,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            }

            if (index == 0) {
                trailing_lose_data.trailing_stop = Number(reserveList[0].reserve0) / Number(reserveList[0].reserve1) + trailing_lose_data.trailing_stop_loss;
                // invest_tokens = invest_eth * (Number(poolInfoList[0].reserve1) / Number(poolInfoList[0].reserve0));
                // owned_tokens = invest_tokens;
                // trailing_stop = start_price * profit_target;
                console.log(`start_price=${trailing_lose_data.trailing_stop}`)
            }
            let analysis_info = await tailing_stop_algo(trailing_lose_data, reserveList, swapList, token0_info, token1_info);
            trailing_lose_data = analysis_info;
            if (trailing_lose_data.trailing_stop == 0 ){
                break;
            }
            start_block = last_block + 1;
            index++;
            sleep(100)
        }
        if (token0_info.symbol === 'USDT' ||  token0_info.symbol === 'USDC'){
            trailing_lose_data.invest_eth = Number(trailing_lose_data.invest_eth) / Number(ethPrice);
            trailing_lose_data.trailing_stop_loss = Number(trailing_lose_data.trailing_stop_loss) / Number(ethPrice);
            trailing_lose_data.owned_eths = Number(trailing_lose_data.owned_eths) / Number(ethPrice);
            trailing_lose_data.buyable_eth = Number(trailing_lose_data.buyable_eth) / Number(ethPrice);
            trailing_lose_data.highestPrice = Number(trailing_lose_data.highestPrice) / Number(ethPrice);
            trailing_lose_data.highestMarketcap = Number(trailing_lose_data.highestMarketcap) / Number(ethPrice);
        }
        return trailing_lose_data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

export const tailing_stop_algo = async (trailing_lose_data, reserveList, swapList, token0_info, token1_info) => {
    let user_data = trailing_lose_data;
    try {
        let prev_pool_info = reserveList[0];
        let pre_price = user_data.trailing_stop;
        for (const poolInfo of reserveList) {
            for (const swapInfo of swapList) {
                if (user_data.transactionHash == swapInfo.transactionHash){
                    let impact_percent = 0;
                    impact_percent = swapInfo.amount0In * 100 / poolInfo.reserve0;
                    let timestamp = await getBlockTimeStampFromBlockNumber(poolInfo.blockNumber);
                    impact_percent = roundDecimal(timestamp, 1);
                    if (impact_percent > 15) {
                        user_data.rugs_impact.push({impact_blocktimestamp: timestamp, impact_percent: `${impact_percent} %`})
                        break;
                    } 
                    impact_percent = swapInfo.amount1In * 100 / poolInfo.reserve1;
                    impact_percent = roundDecimal(timestamp, 1);
                    if (impact_percent > 15){
                        user_data.rugs_impact.push({impact_blocktimestamp: timestamp, impact_percent: `${impact_percent} %`})
                        break;
                    }
                }
            }
            if ((poolInfo.reserve0 / prev_pool_info.reserve0) < 0.01 ){
                let timestamp = await getBlockTimeStampFromBlockNumber(poolInfo.blockNumber);
                user_data.rugs_liqudity_remove = {transaction: poolInfo.transactionHash, blockTimestamp: timestamp}
                user_data.trailing_stop = 0;
                
                user_data.delta_tokens += user_data.owned_tokens;
                user_data.owned_eths += user_data.owned_tokens * pre_price;
                user_data.delta_eths -= user_data.owned_tokens * pre_price;
                user_data.owned_tokens = 0;
                user_data.trailing_stop = 0;
                user_data.sell_points.push(prev_pool_info.transactionHash);
                user_data.ROI.push(roundDecimal((user_data.owned_eths - user_data.invest_eth) * 100 / user_data.invest_eth, 1));
                console.log(`point liquidity_remove_risk pre_reserve0 = ${prev_pool_info.reserve0} cur_reserve0 = ${poolInfo.reserve0}`)

            }
            if (user_data.trailing_stop == 0) {
                break;
            }
            let minusflag_eth = user_data.delta_eths > 0 ? 1 : -1;
            let minusflag_token = user_data.delta_tokens > 0 ? 1 : -1;
            let new_reserve0 = Number(poolInfo.reserve0) + minusflag_eth * Number((minusflag_eth * user_data.delta_eths) * 10 ** token0_info.decimal);
            let new_reserve1 = Number(poolInfo.reserve1) + minusflag_token * Number((minusflag_token * user_data.delta_tokens) * 10 ** token1_info.decimal);
  
            let price = new_reserve0 / new_reserve1;//reserve0 WETH, reserve1 Token

            if (user_data.highestPrice < price) {
                user_data.highestPrice = price;
                user_data.highestMarketcap = user_data.highestPrice * token1_info.totalSupply;//must current totalSupply
            }
            if ((user_data.owned_tokens != 0) && ((user_data.owned_eths + user_data.owned_tokens * price) > (user_data.invest_eth * user_data.profit_target))) {
                user_data.delta_tokens += user_data.owned_tokens;
                user_data.owned_eths += user_data.owned_tokens * price;
                user_data.delta_eths -= user_data.owned_tokens * price;
                user_data.owned_tokens = 0;
                user_data.trailing_stop = 0;
                user_data.sell_points.push(poolInfo.transactionHash);
                user_data.ROI.push(roundDecimal((user_data.owned_eths - user_data.invest_eth) * 100 / user_data.invest_eth, 1));
                break;
            }
            if ((price > user_data.trailing_stop) && (user_data.buy_sell_mode == "sell")) {
                // if (isInit) {
                //     let sell_token = (owned_tokens < 2) ? owned_tokens : owned_tokens / 2;
                //     const temp_eth = extraEth + price * sell_token;
                //     if (Number(temp_eth * 10 ** decimal_Eth) > Number(poolInfo.reserve0)) {
                //         continue;
                //     }
                //     console.log(`owned_tokens=${owned_tokens} sell_token = ${sell_token} temp_eth=${temp_eth}`);
                //     extraToken = extraToken + sell_token;
                //     extraEth = temp_eth;

                //     owned_tokens = owned_tokens - sell_token;
                //     buy_sell_mode = "buy";
                //     sell_points.push(poolInfo.blockTimestamp);
                //     buyable_eth = (extraEth - invest_eth) / 2;
                //     if (buyable_eth < 0) {
                //         buyable_eth = 0;
                //     }

                //     ROI.push(((extraEth - buyable_eth) - invest_eth) / invest_eth);
                //     isInit = false;
                // }
                if (price >= (user_data.trailing_stop + user_data.trailing_stop_loss)) {
                    user_data.trailing_stop = price - user_data.trailing_stop_loss;
                   //console.log(`stop_lose_up = ${user_data.trailing_stop}`)
                }
            } else if ((price <= user_data.trailing_stop) && (user_data.buy_sell_mode == "sell")) {
                let sell_token = (user_data.owned_tokens < 2) ? user_data.owned_tokens : user_data.owned_tokens / 2;
                const temp_eth = user_data.delta_eths - pre_price * sell_token;

                user_data.delta_tokens = user_data.delta_tokens + sell_token;
                user_data.delta_eths = temp_eth;
                user_data.owned_eths += pre_price * sell_token;
                user_data.owned_tokens = user_data.owned_tokens - sell_token;
                if (user_data.owned_tokens == 0){
                    user_data.trailing_stop = 0;
                }
                user_data.buyable_eth = pre_price * sell_token / 2;
                
                user_data.buy_sell_mode = "buy";
                user_data.sell_points.push(poolInfo.transactionHash);
                user_data.ROI.push(roundDecimal(((user_data.owned_eths + user_data.owned_tokens * pre_price) - user_data.invest_eth) * 100 / user_data.invest_eth, 1));
               // console.log(`sell point owned_eths = ${user_data.owned_eths}, owned_tokens = ${user_data.owned_tokens}`)
            } else if ((price <= (user_data.trailing_stop - user_data.trailing_stop_loss)) && (user_data.buy_sell_mode == "buy")) {
                user_data.trailing_stop = price + user_data.trailing_stop_loss;
              //  console.log(`stop_lose_down = ${user_data.trailing_stop}`)
            } else if ((price >= user_data.trailing_stop) && (user_data.buy_sell_mode == "buy")) {
                let buy_kens = user_data.buyable_eth / pre_price;
                user_data.owned_tokens = user_data.owned_tokens + buy_kens;
                user_data.delta_tokens -= buy_kens;
                user_data.owned_eths -= user_data.buyable_eth;
                user_data.delta_eths += user_data.buyable_eth;
                user_data.buy_points.push(poolInfo.transactionHash);//buy strategy
                user_data.buy_sell_mode = "sell";
              //  console.log(`buy point owned_eths = ${user_data.owned_eths}, owned_tokens = ${user_data.owned_tokens}`)
            } else {
                //console.log(`else trailing_stop = ${user_data.trailing_stop}, current price = ${price}`)
            }
            prev_pool_info = poolInfo;
            pre_price = price;
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