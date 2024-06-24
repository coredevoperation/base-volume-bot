import Web3 from 'web3'
import { ethers } from "ethers";
import * as afx from './global.js'
import * as uniconst from './uni-catch/const.js'
import {UNISWAP_V2_FACTORY_ABI} from './abi/uniswapv2-factory-abi.js'
import {UNISWAP_V3_FACTORY_ABI} from './abi/uniswapv3-factory-abi.js'
import {UNISWAP_V2_POOL_ABI} from './abi/uniswapv2-pool-abi.js'

import * as utils from './utils.js'

const options = {
    reconnect: {
        auto: true,
        delay: 5000, // ms
        maxAttempts: 5,
        onTimeout: false
    }
};

const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_HTTP_URL)

const MAX_FEE = 0.000041;
const eth_per_wallet_opt3 = (process.env.VOL_BUY_OPT3 - MAX_FEE * process.env.WALLET_DIST_COUNT) / (process.env.WALLET_DIST_COUNT);
const eth_per_wallet_opt2 = (process.env.VOL_BUY_OPT2 - MAX_FEE * process.env.WALLET_DIST_COUNT) / (process.env.WALLET_DIST_COUNT);
const eth_per_wallet_opt1 = (process.env.VOL_BUY_OPT1 - MAX_FEE * process.env.WALLET_DIST_COUNT) / (process.env.WALLET_DIST_COUNT);

async function distributeWallets(web3, session, database, _user) {

    console.log("distribute wallet begin...")

    let wallets = await database.selectWallets({username: session.username})
    let existCount = 0
    if(wallets && wallets.length > 0) existCount = wallets.length

    for(let i = 0; i < session.wallet_count - existCount; i++) {
        const result = utils.generateNewWallet()
        let _wallet = {
            address: result.address,
            pkey: utils.encryptPKey(result.privateKey),
            user_id: _user._id,
            username: _user.username,
            dist_finished: 0,
            swap_finished: 0
        }
        await database.addWallet(_wallet)
        wallets.push(result)        
    }

    const ethBalance = await web3.eth.getBalance(session.wallet);
    const formattedEth = ethBalance / (10 ** 18);
    const distributeAmount = (formattedEth - MAX_FEE * session.wallet_count) / (session.wallet_count);

    for(let i = 0; i < session.wallet_count; i++) {
        if (wallets[i].dist_finished == 0) {
            for(let j = 0; j < 5; j++) {
                if (i + j >= wallets.length) break;
                let _wallet = wallets[i+j]
                await transferEthTo(distributeAmount, _wallet.address, session.pkey)
                _wallet.dist_finished = 1;
                await database.updateWallet(_wallet);
            }
            break;
        }
    }
    // session.dist_finished = 1
}

const transferEthTo = async (amount, recipientAddress, pkey) => {
    if (!pkey) {
        console.log(`[transferEthTo] pkey error`);
        return null
    }
    
    const privateKey = utils.decryptPKey(pkey)

    if (!privateKey) {
        console.log(`[transferEthTo] privateKey error`);
        return null
    }

    let wallet = null
    try {
        wallet = new ethers.Wallet(privateKey, provider);
    } catch (error) {
        console.log(`[transferEthTo] ${error}`)
        return null
    }

    let ethBalance = await provider.getBalance(wallet.address)

    let transactionFeeLimit = 21000 * (10 ** 9)
    let decimalAmount = amount * (10 ** 18)
    let realDecimalAmount = decimalAmount

    // if (ethBalance < (decimalAmount + transactionFeeLimit)) {
    //     realDecimalAmount = ethBalance - transactionFeeLimit
    // }

    if(realDecimalAmount > ethBalance) realDecimalAmount = ethBalance

    const transaction = {
        from: wallet.address,
        to: recipientAddress,
        value: ethers.BigNumber.from(realDecimalAmount.toString()),
        gasLimit: 21000
    }

    let tx = null
    try {
        tx = await wallet.sendTransaction(transaction);
        const confirmedTx = await tx.wait()
    } catch (error) {
        console.log(`[transferEthTo] sendTransaction_error: ${error.reason}`)
        return null
    }
    
    const paidAmount = realDecimalAmount / (10 ** 18)
    ethBalance = ethBalance / (10 ** 18)
    let txLink = utils.getFullTxLink(afx.get_chain_id(), tx.hash)
    console.log(`[transferEthTo] ${ethBalance} - ${paidAmount} eth transfer tx sent:`, txLink);

    return {paidAmount, tx: tx.hash}
}

export const start = (web3, database, bot) => {

    console.log('checkFunded daemon has been started...')

    setTimeout(() => {
        doEvent(web3, database, bot)
    }
    , 1000 * 1)
}

export const doEvent = async (web3, database, bot) => {

    const users = await database.selectUsers({type:'private', charge_active: 1, tier: 0})

	for (const user of users) {
        let session = bot.sessions.get(user.chatid)
        if (!session || !session.wallet) {continue;}
        web3.eth.getBalance(session.wallet)
            .then(async balance => {
                balance = balance / (10 ** 18)
                console.log(`@${session.username} has ${balance} ETH`)
                let tier = 0
                let lvlName = ''
                // const usedWallets = await database.selectWallets({user_id: user.user_id, dist_finished: 1});

                // if (usedWallets.length == process.env.WALLET_DIST_COUNT) {
                //     return;
                // }

                if(balance >= process.env.VOL_ETH_OPT4) {
                    tier = 4;
                    lvlName = 'Diamond'
                }
                if(balance >= process.env.VOL_ETH_OPT3) {
                    tier = 3
                    lvlName = 'Gold'
                }
                else if(balance >= process.env.VOL_ETH_OPT2) {
                    tier = 2
                    lvlName = 'Silver'
                }
                else if(balance >= process.env.VOL_ETH_OPT1) {
                    tier = 1
                    lvlName = 'Normal'
                }
                if(tier > 0) {
                    session.tier = tier
                    session.charge_active = 0
                    await database.updateUser(session)

                    console.log('user tier is updated: username=' + user.username + ', tier=' + tier)

                    let message = `Hi @${session.username}!\nYour wallet hold ${balance} ETH.\nSo we set you ${lvlName} user. \nSilver: 10ETH, Gold: 15ETH, Diamond: 30ETH`
                    bot.sendMessage(user.chatid, message)

                    message = `⌛ ETH distribution is processing...`
                    bot.sendMessage(user.chatid, message)

                    await distributeWallets(web3, session, database, user)

                    session.dist_finished = 1
                    session.swap_finished = 0
                    session.swap_end_time = 0;
                    session.swap_start = 0;
                    bot.sessions.set(user.chatid, session)
                    await database.updateUser(session)

                    message = `ETH distribution is finished!`
                    bot.sendMessage(user.chatid, message)
                }
            })
    }

    setTimeout(() => {
        doEvent(web3, database, bot)
    }
    , 1000 * 10)
}
