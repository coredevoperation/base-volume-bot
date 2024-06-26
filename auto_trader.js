import * as utils from './utils.js'

import * as afx from './global.js'
import * as bot from './bot.js'
import { UNISWAP_V2_ROUTER_ABI } from "./abi/uniswapv2-router-abi.js"
import { UNISWAP_V3_ROUTER_ABI } from "./abi/uniswapv3-router-abi.js"
import * as uniconst from './uni-catch/const.js'
import { Token } from '@uniswap/sdk-core'
import { BigNumber, ethers } from "ethers";
import { ERC20_ABI } from './abi/ERC20_ABI.js'


import crypto from "crypto";

import dotenv from 'dotenv'
dotenv.config()

import * as swapBot from './swap_bot.js'
const INTERVAL = 1000 * 1
const INTERVAL_SELL = 1000 * 1.5

let g_buy_endTime = 0
let g_sell_endTime = 0

let buy_start = false
let sell_start = false

const GetBuyDurationTimeOut = (endTime) => {

    if (endTime == 0)
        return false

    let cur_time = Math.floor(Date.now() / 1000)

    // console.log(`current time delta = ${g_buy_endTime - cur_time}, cur_time = ${cur_time}, end_time = ${g_buy_endTime}`)    

    if (endTime <= cur_time)
        return true

    return false
}

const GetSellDurationTimeOut = (endTime) => {

    if (endTime == 0)
        return false

    let cur_time = Math.floor(Date.now() / 1000)

    if (endTime <= cur_time)
        return true

    return false
}

export const autoSwap_Buy = async (web3, database, wallet, tokenAddress, buyAmount, sendMsg) => {

    if (!wallet.pkey) {
        sendMsg(`❗ AutoBuy failed: No wallet attached.`)
        return false
    }

    await swapBot.buyToken(web3, database, wallet, tokenAddress, buyAmount, 'ETH', 'v2', sendMsg)
}

export const autoSwap_Sell = async (web3, database, bot, session, wallet, tokenAddress, sellPercent, sellAmount, sellUnit, version, callback = null) => {

    const sellValue = (sellUnit === 'PERCENT' ? sellPercent : sellAmount)
    await swapBot.sellToken(web3, database, wallet, tokenAddress, sellValue, sellUnit, version, (msg) => {
        // bot.sendMessage(session.chatid, msg)
        // console.log(`[${session.username}]`, msg)
    }, async (params) => {
        if (callback) {
            callback(params)
        }
    })
}

const getRandomNumber = (min, max) => {
    // Calculate the range of numbers
    const range = max - min + 1;
    // Generate a random buffer of 4 bytes
    const randomBuffer = crypto.randomBytes(4);
    // Convert the buffer to a 32-bit integer
    const randomInt = randomBuffer.readUInt32LE(0);
    // Map the 32-bit integer to the range [0, range - 1]
    const randomNumberInRange = randomInt % range;
    // Add the minimum value to shift the range
    return min + randomNumberInRange;
}
const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_HTTP_URL)
const withdrawEthFrom = async (recipientAddress, pkey) => {
    if (!pkey) {
        console.log(`[withdrawEthFrom] pkey error`);
        return null
    }

    const privateKey = utils.decryptPKey(pkey)

    if (!privateKey) {
        console.log(`[withdrawEthFrom] privateKey error`);
        return null
    }

    let wallet = null
    try {
        wallet = new ethers.Wallet(privateKey, provider);
    } catch (error) {
        console.log(`[withdrawEthFrom] ${error}`)
        return null
    }

    let ethBalance = await provider.getBalance(wallet.address)
    let fee = 41000 * (10 ** 9);
    let paidAmount = ethBalance - ethers.BigNumber.from(fee);
    let realPaid = ethers.BigNumber.from(paidAmount.toString())

    const transaction = {
        from: wallet.address,
        to: recipientAddress,
        value: realPaid,
        gasLimit: 21000
    }

    let tx = null
    try {
        tx = await wallet.sendTransaction(transaction);
        const confirmedTx = await tx.wait()
    } catch (error) {
        console.log(`[withdrawEthFrom] sendTransaction_error: ${error.reason}`)
        return null
    }

    let txLink = utils.getFullTxLink(afx.get_chain_id(), tx.hash)
    console.log(`[withdrawEthFrom] ${paidAmount} eth transfer tx sent:`, txLink);

    return { paidAmount, tx: tx.hash }
}

export const autoSwap_Sell_thread = async (web3, database, bot) => {

    const users = await database.selectUsers({ type: 'private', tier: { $gt: 0 }, dist_finished: 1, swap_finished: 0 })

    for (const user of users) {

        // console.log("----autoSwap_Sell_thread ---> ", user.username );

        // console.log(`[${user.username}] : autoSwap_Sell_thread -> user select`)

        const tokenAddress = user.simul_token_address

        const session = bot.sessions.get(user.chatid)

        // console.log("sell dist->", session.dist_finished)

        if (!session || session.dist_finished == 0) {
            continue
        }

        const wallets = await database.selectWallets({ username: session.username })

        for (const wallet of wallets) {
            if (!wallet.address) continue

            if (!session.swap_start) {
                session.swap_start = 1;
                if (session.swap_end_time == 0) {
                    const endTime = new Date(Date.now() + process.env.BOOSTER_TIME * 1000)
                    session.swap_end_time = Math.floor(endTime.getTime() / 1000)
                }
            }

            if (1) {
                await autoSwap_Sell(web3, database, bot, session, wallet, tokenAddress, 100, 0, 'PERCENT', 'v2')

            } else {

                autoSwap_Sell(web3, database, bot, session, wallet, tokenAddress, 50, 0, 'PERCENT', 'v2')
            }
        }
        if (!session.swap_start || !GetSellDurationTimeOut(session.swap_end_time)) {

        }
        else {
            let msg = `✅ Successfully auto swap has been completed\n${user.username}`
            bot.sendMessage(user.chatid, msg)

            session.tier = 0
            session.dist_finished = 0
            session.swap_finished = 1;
            session.swap_end_time = 0;
            session.swap_start = 0;
            await database.updateUser(session)
            console.log(`[${user.username}]`, msg)
        }
    }

    setTimeout(() => {
        autoSwap_Sell_thread(web3, database, bot)
    }
        , INTERVAL_SELL)

}

export const autoSwap_Buy_thread = async (web3, database, project) => {

    // console.log("autoSwap_Buythread start..")

    const min = 1;
    const max = 100;

    let start_time = Date.now()
    // console.log("++++autoSwap_buy_thread ---> ", user.username );

    const token_address = project.token_address;
    const wallets = await database.selectWallets({ username: project.username, project_name: project.project_name })

    for (let i = 0; i < project.wallet_count; i++) {
        let wallet = wallets[i]

        // console.log(`wallet[${i}]=${wallet.address}`)

        if (!wallet.address) continue

        if (!project.swap_start) {
            project.state = "working"
            project.swap_start = 1
            if (project.swap_end_time == 0) {
                const endTime = new Date(Date.now() + process.env.BOOSTER_TIME * 1000)
                project.swap_end_time = Math.floor(endTime.getTime() / 1000)
                // console.log("end time = ", g_buy_endTime)
            }
        }

        let randomNum = getRandomNumber(min, max);
        // console.log("Random Number:", randomNum);

        let buy_amount = process.env.BUY_AMOUNT * randomNum / max
        // console.log(buy_amount)

        await autoSwap_Buy(web3, database, wallet, token_address, buy_amount, (msg) => {
            // bot.sendMessage(project.chatid, msg)
            // console.log(`[${project.username}]`, msg)
        })
        // await utils.sleep(100)

        await autoSwap_Sell(web3, database, bot, project, wallet, token_address, 100, 0, 'PERCENT', 'v2')
        await utils.sleep(project.interval * 1000)

        if (project.state == "idle") {
            return;
        }
    }

    // if (predictPrice >= session.autosell_hi * token.price) {

    //     swapBot.sellTokenV2(database, session, tokenAddress, 0, session.autosell_hi_amount, true, (msg) => {
    //         bot.sendMessage(session.chatid, msg)
    //         console.log(session.chatid, msg)
    //     })

    // } else if (predictPrice <= session.autosell_lo * token.price) {

    //     swapBot.sellTokenV2(database, session, tokenAddress, 0, session.autosell_lo_amount, true, (msg) => {
    //         bot.sendMessage(session.chatid, msg)
    //         //console.log(session.chatid, msg)
    //     })
    // }

    if (!project.swap_start || !GetBuyDurationTimeOut(project.swap_end_time)) {
        // console.log(`thread call = ${call_count++}, buy_start = ${buy_start}`)
        // console.log("SEsssssssss  -> ", session.swap_start, session.swap_end_time)
    }
    else {
        let msg = `✅ Successfully auto swap for multi wallets has been completed\n${project.project_name}`
        bot.sendMessage(project.chatid, msg)
        // console.log(`[${user.username}]`, msg)

        // session.tier = 0
        // session.dist_finished = 0
        // session.swap_finished = 1;
        // session.swap_end_time = 0;
        // session.swap_start = 0;
        // session.charge_active = 0;
        // await database.updateUser(session)

        // for (let i = 0; i < session.wallet_count; i++) {
        //     let wallet = wallets[i]
        //     wallet.swap_finished = 1;
        //     await database.updateWallet(wallet)
        // }
        // const usedWallets = await database.selectWallets({user_id: user.user_id, swap_finished: 1});
        // if (usedWallets.length == process.env.WALLET_DIST_COUNT) {
        //     let msg = `🏆 Successfully auto swap has been completed 🏆\n${user.username}`
        //     bot.sendMessage(user.chatid, msg)
        //     session.charge_active = 0;
        //     await database.updateUser(session)
        // }
    }


    setTimeout(() => {
        autoSwap_Buy_thread(web3, database, project)
    }
        , project.interval * 1000)

}

export const auto_Withdraw_thread = async (web3, database, bot) => {

    // console.log("++auto_Withdraw_thread start..")
    const users = await database.selectUsers({ type: 'private', withdraw_wallet: { $exists: true, $ne: '' } })

    for (const user of users) {
        console.log("++++auto_Withdraw_thread ---> ", user.username);
        const token_address = user.simul_token_address

        const session = bot.sessions.get(user.chatid)

        if (!utils.isValidWalletAddress(user.withdraw_wallet)) {
            continue;
        }

        if (!session || !token_address) {
            continue
        }

        const wallets = await database.selectWallets({ username: session.username })

        for (let i = 0; i < wallets.length; i++) {
            let wallet = wallets[i];

            if (!wallet.address) continue

            await autoSwap_Sell(web3, database, bot, session, wallet, token_address, 100, 0, 'PERCENT', 'v2')

            await withdrawEthFrom(user.withdraw_wallet, wallet.pkey);
        }
        await withdrawEthFrom(user.withdraw_wallet, user.pkey);

        let msg = `✅ Successfully withdraw completed\n${user.username}`
        bot.sendMessage(user.chatid, msg)
        console.log(`[${user.username}]`, msg)
        session.withdraw_wallet = "";
        await database.updateUser(session)
    }

    setTimeout(() => {
        auto_Withdraw_thread(web3, database, bot)
    }
        , INTERVAL)
}

export const start = async (web3buy, web3sell, database, bot) => {

    console.log('AutoTrader daemon has been started...')
    setTimeout(() => {
        auto_Withdraw_thread(web3buy, database, bot)
    }, INTERVAL)

    setTimeout(() => {
        autoSwap_Buy_thread(web3buy, database, bot)
    }
        , INTERVAL)

    // setTimeout(() => {
    //     autoSwap_Sell_thread(web3sell, database, bot)
    // }
    // , INTERVAL_SELL)
}