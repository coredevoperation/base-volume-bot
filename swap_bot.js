
import * as bot from './bot.js'
import * as utils from './utils.js'

import * as uniconst from './uni-catch/const.js'
import * as afx from './global.js'
import * as adv_utils from './adv_utils.js'

import dotenv from 'dotenv'

dotenv.config()

const calcFee = (amount) => {
    const swapFeeAmount = amount * afx.Swap_Fee_Percent / 100.0
    const refRewardAmount = swapFeeAmount * afx.Reward_Percent / 100.0
    return { swapFeeAmount, refRewardAmount }
}

export const start = (web3, database, bot) => {

    console.log('Swapbot daemon has been started...')

    startRewardPayer(web3, database, bot, 1000)
}

const startRewardPayer = (web3, database, bot, interval) => {

    setTimeout(() => {

        rewardPayerThread(web3, database, bot)

    }, interval)
}

const isDoneTodayReward = (database) => {

    const env = database.getEnv()
    if (!env.last_reward_time) {
        return false
    }

    const lastRewardDate = new Date(env.last_reward_time)
    const currentDate = new Date();

    if (lastRewardDate.getTime() > currentDate.getTime()) {
        return true
    }

    if (lastRewardDate.getUTCFullYear() == currentDate.getUTCFullYear() &&
        lastRewardDate.getUTCMonth() == currentDate.getUTCMonth() &&
        lastRewardDate.getUTCDay() == currentDate.getUTCDay()
     ) {
        return true
     }
    
     return false
}

export const rewardPayerThread = async (web3, database, bot) => {

    if (!isDoneTodayReward(database)) {

        await sendReward(web3, database, (msg) => {
            bot.sendInfoMessage(afx.Owner_Chatid, msg)
        })
    }

    startRewardPayer(web3, database, bot, 1000 * 60 * 10)
}

export const sendReward = async (web3, database, sendMsg) => {

    console.log('sendReward func todo')
    // const rewards = await database.selectRewards({ amount: { $gt: 0 } })

    // let rewardWallets = []
    // let values = []
    // let chatids = []
    // let sum = web3.utils.toBN(0)
    // for (const item of rewards) {
    //     if (item.amount >= afx.get_reward_heap()) {

    //         const session = bot.sessions.get(item.chatid)
            
    //         if (session.reward_wallet) {

    //             chatids.push(item.chatid)
    //             rewardWallets.push(session.reward_wallet)

    //             const reward = utils.toBNe18(web3, item.amount)
    //             values.push(reward)
    //             sum = sum.add(reward)

    //         } else {
    //             console.log(`@${session.username} has been skipped rewarding due to no wallet assigned`)
    //         }
    //     }
    // }

    // if (values.length === 0) {
    //     // sendMsg(`No pending rewards`)
    //     return
    // }

    // await withdrawToUsers(web3, rewardWallets, values, sum, sendMsg, async (res) => {

    //     if (res.status === 'success') {
            
    //         for (let i = 0; i < chatids.length; i++) {
    //             const wallet = rewardWallets[i]
    //             const value = values[i]
    //             const chatid = chatids[i]

    //             await database.addRewardHistory(chatid, wallet, value, res.txHash)
    //         }

    //         database.updateEnv({ last_reward_time: new Date() })
    //     }
    // })
}

const withdrawToUsers = async (web3, rewardWallets, values, sum, sendMsg, callback = null) => {

    try {

        const privateKey = afx.DragonRouterOwner_Key

        if (!privateKey) {
            console.log(`[withdrawReward] DragonRouterOwner_Key error`);
            sendMsg('❗ Invalid router owner wallet key')
        }

        let wallet = null
        try {
            wallet = web3.eth.accounts.privateKeyToAccount(privateKey);
        } catch (error) {

            console.log(`[withdrawReward] ${error.reason}`)
            sendMsg('❗ Invalid router owner wallet key')
            return
        }

        if (!web3.utils.isAddress(wallet.address)) {
            console.log(`[withdrawReward] ${error.reason}`)
            sendMsg('❗ Invalid router owner wallet address')
            return
        }

        let rewardTx = adv_utils.dragon_contract.methods.withdraw2users(rewardWallets, values, 0);
        let encodedRewardTx = rewardTx.encodeABI();
        let estimatedGas 
        try {
            estimatedGas = await rewardTx.estimateGas({
                from: wallet.address, 
                to: afx.get_dragonrouter_address(),
                value: 0,
                data: encodedRewardTx
            })

            estimatedGas = Number(estimatedGas.toString())

        } catch (e) {
            console.error('withdrawReward Estimated gas', e)
            estimatedGas = uniconst.DEFAULT_ETH_GAS
        }
        
        const gasTotalPrice = await utils.getGasPrices(web3);
        const gasPrice = gasTotalPrice.medium;
        const maxFeePerGas = gasTotalPrice.high;

        const estimateTxFee = gasPrice.muln(estimatedGas)

        const contractBalance = web3.utils.toBN(await web3.eth.getBalance(afx.get_dragonrouter_address()))

        if (contractBalance.lt(sum.add(estimateTxFee))) {
            console.log(`[withdrawReward] Insufficient router contract balance`)

            sendMsg('❗ Insufficient router contract balance')
            return
        }

        rewardTx = adv_utils.dragon_contract.methods.withdraw2users(rewardWallets, values, estimateTxFee);
        encodedRewardTx = rewardTx.encodeABI();

        let nonce = await web3.eth.getTransactionCount(wallet.address, 'pending');
        nonce = web3.utils.toHex(nonce);
        
        const tx = {
            from: wallet.address,
            to: afx.get_dragonrouter_address(),
            gasLimit: Math.ceil(estimatedGas * 1.2),
            baseFeePerGas: web3.utils.toHex(gasPrice),
            data: encodedRewardTx,
            // maxFeePerGas: maxFeePerGas,
            value: 0,
            nonce: web3.utils.toHex(nonce)
        }
        const signedTx = await wallet.signTransaction(tx)

        let result = null
        await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on('transactionHash', async function (hash) {

                let txLink = utils.getFullTxLink(afx.get_chain_id(), hash)
                console.log('Waiting for reward sharing...')
                sendMsg(`⌛ Pending transaction...\n${txLink}`)
            })
            .on('receipt', async function (tx) {

                sendMsg(`🟢 Daily reward has been delivered to ${utils.roundDecimal(rewardWallets.length)} users`)
                if (callback) {
                    callback({
                        status: 'success',
                        txHash: tx.transactionHash,
                    })
                }

            })
            .on('error', function (error, receipt) {
                console.log(`${afx.parseError(error)}`)
                // sendMsg('❗ Transaction failed.')

                if (callback) {
                    callback({
                        status: 'failed',
                        txHash: tx.transactionHash
                    })
                }
            })

    } catch (error) {
        console.error(error)
    }
}

export const buyToken = async (web3, database, session, tokenAddress, buyAmount, unit, ver, sendMsg, callback = null) => {
    
    // console.log("token = ", tokenAddress)
    if (!session.pkey) {
        sendMsg(`❗ Buy Swap failed: No wallet attached.`)
        return
    }

    const privateKey = utils.decryptPKey(session.pkey)

    if (!privateKey) {
        console.log(`[buySwap] ${session.username} wallet error`);
        sendMsg(`❗ Buy Swap failed: Invalid wallet.`)
        return false
    }

    let wallet = null
    try {
        wallet = web3.eth.accounts.privateKeyToAccount(privateKey);
    } catch (error) {
        // console.log(error)
        sendMsg(`❗ Buy Swap failed: ${error}`)
        return false
    }

    if (!web3.utils.isAddress(wallet.address)) {
        sendMsg(`❗ Buy Swap failed: Invalid wallet 2.`)
        return false
    }

    // console.log("wallet address = ", wallet.address)
    let tokenContract = null;
    let tokenDecimals = null
    let tokenSymbol = null

    try {

        tokenContract = new web3.eth.Contract(afx.get_ERC20_abi(), tokenAddress)
        tokenDecimals = await tokenContract.methods.decimals().call()
        tokenSymbol = await tokenContract.methods.symbol().call()

    } catch (error) {
        console.log("Buy Swap failed", error);
        sendMsg(`❗ Buy Swap failed: Invalid tokenContract.`)
        return false
    }

    let routerContract = null;
    try {
        routerContract = new web3.eth.Contract(afx.get_uniswapv2_router_abi(), afx.get_uniswapv2_router_address());
    } catch (error) {
        sendMsg(`❗ Buy Swap failed: Invalid routerContract.`)
        return false
    }

    let slippage = 5 //session.wallets[session.wallets_index].snipe_buy_slippage ? session.wallets[session.wallets_index].snipe_buy_slippage : 5;
    let rawEthAmount = null;
    let rawEthBalance = null;
    let rawEthPlusGasAmount = null
    let rawTokenAmountsOut = null
    const gasTotalPrice = await utils.getGasPrices(web3);
    const estimateGasPrice = gasTotalPrice.high;
    const gasPrice = gasTotalPrice.medium;
    let maxFeePerGas = gasTotalPrice.high;
    // maxFeePerGas = session.wallets[session.wallets_index].snipe_max_gas_price > maxFeePerGas ? afx.GWEI.mul(session.wallets[session.wallets_index].snipe_max_gas_price) : maxFeePerGas;
    const swapPath = [afx.get_weth_address(), tokenAddress]

    if (unit === afx.get_chain_symbol()) {

        try {
            rawEthAmount = utils.toBNe18(web3, buyAmount)
            const amountsOut = await routerContract.methods.getAmountsOut(rawEthAmount, swapPath).call()
            rawTokenAmountsOut = web3.utils.toBN(amountsOut[1])

        } catch (error) {
            // console.log(error)
            sendMsg(`❗ Buy Swap failed: valid check. [1]`)
            return false
        }

    } else {

        try {

            rawTokenAmountsOut = web3.utils.toBN(buyAmount * 10 ** tokenDecimals)
            //console.log(rawTokenAmountsOut.toString())
            const amountsIn = await routerContract.methods.getAmountsIn(rawTokenAmountsOut,
                swapPath).call()

            rawEthAmount = web3.utils.toBN(amountsIn[0])

        } catch (error) {
            // console.log(error)
            sendMsg(`❗ Buy Swap failed: valid check. [2]`)
            return false
        }
    }

    sendMsg('🚀 Starting Buy Swap...')

    try {
        const deadline =  parseInt(Date.now() / 1000 + 1800); // parseInt(session.deadline ? Date.now() / 1000 + session.deadline : Date.now() / 1000 + 1800);

        let swapTx = null
        let estimatedGas = null
        let router_address = null

        // if (adv_utils.uniSwap_iface === null || adv_utils.dragon_contract === null) {
        //     console.log("Swap Engine error")
        //     return false;
        // }

        // if (session.snipe_antimev) {
            // let swapData = adv_utils.uniSwap_iface.encodeFunctionData(afx.get_swap_eth_for_token(), [rawTokenAmountsOut.muln(100 - slippage).divn(100).toString(), swapPath, wallet.address, deadline]);
            // console.log("swapPath", swapPath)
            // console.log("swapData", swapData)
            // // swapTx = adv_utils.dragon_contract.methods.execute(0, [rawEthAmount.toString()], [afx.get_uniswapv2_router_address()], [swapData]);
            // swapTx = await adv_utils.dragon_contract.methods.execute(afx.Swap_Stamp, [rawEthAmount.toString()], [afx.get_uniswapv2_router_address()], [swapData]);
            // router_address = afx.get_dragonrouter_address();
        // } else {
            swapTx = routerContract.methods.swapExactETHForTokensSupportingFeeOnTransferTokens(
                rawTokenAmountsOut.muln(100 - slippage).divn(100).toString(),
                swapPath,
                wallet.address,
                deadline
            )
            router_address = afx.get_uniswapv2_router_address();
        // }

        const encodedSwapTx = swapTx.encodeABI();
        let nonce = await web3.eth.getTransactionCount(wallet.address, 'pending');
        nonce = web3.utils.toHex(nonce);
        try {
            estimatedGas = await swapTx.estimateGas({
                from: wallet.address, to: router_address,
                value: rawEthAmount.toString(), data: encodedSwapTx
            });

            console.log("======================estimatedGas result", estimatedGas)

            estimatedGas = Number(estimatedGas.toString())
        } catch (error) {
            console.log("GetGasEstimated error")
            estimatedGas = uniconst.DEFAULT_ETH_GAS //session.wallets[session.wallets_index].snipe_max_gas_limit > uniconst.DEFAULT_ETH_GAS ? session.wallets[session.wallets_index].snipe_max_gas_limit : uniconst.DEFAULT_ETH_GAS
        }

        const swapFee = calcFee(buyAmount)
        const rawSwapFee = utils.toBNeN(web3, swapFee.swapFeeAmount, 9)

        try {
            rawEthBalance = web3.utils.toBN(await web3.eth.getBalance(wallet.address));
            rawEthPlusGasAmount = estimateGasPrice.muln(estimatedGas).add(rawEthAmount).add(rawSwapFee);

            console.log("==================balance", rawEthBalance.toString(), rawEthPlusGasAmount.toString())
            // balance validate
            if (rawEthBalance.lt(rawEthPlusGasAmount)) {
                sendMsg(`Sorry, Insufficient ${afx.get_chain_symbol()} balance!
    🚫 Required max ${afx.get_chain_symbol()} balance: ${utils.roundDecimal(rawEthPlusGasAmount / 10 ** 18, 5)} ${afx.get_chain_symbol()}
    🚫 Your ${afx.get_chain_symbol()} balance: ${utils.roundDecimal(rawEthBalance / 10 ** 18, 5)} ${afx.get_chain_symbol()}`)

                return false
            }

        } catch (error) {
            // console.log(error)
            sendMsg(`❗ Buy Swap failed: valid check.`)
            return false
        }
        const transEthAmt = parseInt(session.referred_by) === 0? rawEthAmount : rawEthAmount.add(rawSwapFee) //RJM
        const tx = {
            from: wallet.address,
            to: router_address,
            gasLimit: estimatedGas,
            baseFeePerGas: gasPrice,
            // maxFeePerGas: maxFeePerGas,
            value: transEthAmt.toString(),
            data: encodedSwapTx,
            nonce,
        }

        // console.log("rawEthBalance", rawEthBalance.toString())
        // console.log("rawSwapFee", rawSwapFee.toString())
        // console.log("buyAmount", buyAmount)
        // console.log("rawEthAmount", rawEthAmount.toString())
        // console.log("tx.value", tx.value)
        const tokenAmount = rawTokenAmountsOut / (10 ** tokenDecimals)
        const signedTx = await wallet.signTransaction(tx);
        sendMsg(`🔖 Swap Info
  └─ ${afx.get_chain_symbol()} Amount: ${utils.roundEthUnit(buyAmount, 5)}
  └─ Estimated Amount: ${utils.roundDecimal(tokenAmount, 5)} ${tokenSymbol}
  └─ Gas Price: ${utils.roundDecimal(gasPrice / (10 ** 9), 5)} GWEI
  └─ Swap Fee: ${utils.roundEthUnit(swapFee.swapFeeAmount, 9)} (${utils.roundDecimal(afx.Swap_Fee_Percent, 2)} %)`
        )
        await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on('transactionHash', async function (hash) {
                let txLink = utils.getFullTxLink(afx.get_chain_id(), hash)
                console.log('Waiting...')
                sendMsg(`⌛ Pending transaction...\n${txLink}`)
            })
            .on('receipt', async function (tx) {

                // if (session.referred_by && swapFee.refRewardAmount) {
                //     await database.updateReward(session.referred_by, swapFee.refRewardAmount)
                //     // await sendReward(web3, database, (msg) => {
                //     //     bot.sendInfoMessage(afx.Owner_Chatid, msg)
                //     // })
                // }

                // database.addTxHistory({
                //     chatid: session.chatid,
                //     username: session.username,
                //     account: session.account,
                //     mode: 'buy',
                //     eth_amount: (rawEthAmount / 10 ** 18),
                //     token_amount: tokenAmount,
                //     token_address: tokenAddress,
                //     ver: 'v2',
                //     tx: tx.transactionHash
                // })

                sendMsg(`🟢 You've purchased ${utils.roundDecimal(tokenAmount, 5)} ${tokenSymbol}`)
                if (callback) {
                    callback({
                        status: 'success',
                        txHash: tx.transactionHash,
                        ethAmount: (rawEthAmount / 10 ** 18),
                        tokenAmount: tokenAmount
                    })
                }
            })
            .on('error', function (error, receipt) {

                // console.log(error)
                sendMsg('❗ Transaction failed.')

                if (callback) {
                    callback({
                        status: 'failed',
                        txHash: tx.transactionHash
                    })
                }
            })
        return true
    } catch (error) {
        // console.log(error)
        sendMsg(`😢 Sorry, token's tax is high. It seems you might need to increase the slippage.`)

        if (callback) {
            callback({ status: 'error' })
        }

        return false
    }
}

export const sellToken = async (web3, database, session, tokenAddress, sellAmount, unit, ver, sendMsg, callback = null) => {

    if (!session.pkey) {
        sendMsg(`❗ Sell Swap failed: No wallet attached.`)
        return
    }

    const privateKey = utils.decryptPKey(session.pkey)

    if (!privateKey) {
        sendMsg(`❗ Sell Swap failed: Invalid wallet.`)
        return false
    }

    // console.log(privateKey)

    let wallet = null
    try {
        wallet = web3.eth.accounts.privateKeyToAccount(privateKey);
    } catch (error) {
        // console.log(error)
        sendMsg(`❗ Sell Swap failed: ${error}`)
        return false
    }

    if (!web3.utils.isAddress(wallet.address)) {
        sendMsg(`❗ Sell Swap failed: Invalid wallet 2.`)
        return false
    }

    let tokenContract = null;
    let tokenDecimals = null
    let tokenSymbol = null

    try {
        tokenContract = new web3.eth.Contract(afx.get_ERC20_abi(), tokenAddress)
        tokenDecimals = await tokenContract.methods.decimals().call()
        tokenSymbol = await tokenContract.methods.symbol().call()

    } catch (error) {
        console.error(error)
        sendMsg(`❗ Sell Swap failed: Invalid tokenContract.`)
        return false
    }

    let slippage = null;
    let rawTokenAmount = null;
    let rawTokenBalance = null;

    try {
        slippage = 10 //session.wallets[session.wallets_index].snipe_sell_slippage ? session.wallets[session.wallets_index].snipe_sell_slippage : 5
        rawTokenBalance = web3.utils.toBN(await tokenContract.methods.balanceOf(wallet.address).call());

        if (unit === 'PERCENT') {

            rawTokenAmount = rawTokenBalance.muln(sellAmount).divn(100)
            sellAmount = rawTokenAmount / (10 ** tokenDecimals)

        } else {

            rawTokenAmount = utils.toBNeN(web3, sellAmount, tokenDecimals)
        }

    } catch (error) {
        sendMsg(`❗ Sell Swap failed: Invalid raw Data.`)
        return false
    }
    const totalGasPrice = await utils.getGasPrices(web3);
    const gasPrice = totalGasPrice.medium;
    let maxFeePerGas = totalGasPrice.high;
    const estimatedGasPrice = maxFeePerGas;
    // maxFeePerGas = session.wallets[session.wallets_index].snipe_max_gas_price > maxFeePerGas ? afx.GWEI.mul(session.wallets[session.wallets_index].snipe_max_gas_price) : maxFeePerGas;

    let needApprove = true;
    let rawEthBalance = web3.utils.toBN("0");
    try {
        rawEthBalance = web3.utils.toBN(await web3.eth.getBalance(wallet.address));

        const rawTokenAllowance = web3.utils.toBN(await tokenContract.methods.allowance(wallet.address, afx.get_uniswapv2_router_address()).call());

        // console.log("Token Allowance =", rawTokenAllowance.toString())
        // console.log("Token Amount = ", rawTokenAmount.toString())

        // balance validate
        if (rawTokenBalance.isZero() || rawTokenBalance.lt(rawTokenAmount)) {
            await sendMsg(`🚫 Sorry, Insufficient ${tokenSymbol} token balance!
    
🚫 Required ${tokenSymbol} token balance: ${utils.roundDecimal(sellAmount, 5)} ${tokenSymbol}
🚫 Your ${tokenSymbol} token balance: ${utils.roundDecimal(rawTokenBalance, 5)} ${tokenSymbol}`);

            return false
        }
        
        // allowance validate
        if (rawTokenAllowance.gte(rawTokenAmount)) {
            needApprove = false;
        }

    } catch (error) {
        // console.log(error)
        sendMsg(`❗ Sell Swap failed: valid check.`)
        return false
    }

    console.log("needApprove=", needApprove)

    if (needApprove) {

        try {
            const approveTx = tokenContract.methods.approve(
                afx.get_uniswapv2_router_address(),
                // '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
                rawTokenAmount.toString()
            );
            const encodedApproveTx = approveTx.encodeABI();
            let estimatedGas;
            try {
                estimatedGas = await approveTx.estimateGas({
                    from: wallet.address, to: tokenAddress,
                    value: 0, data: encodedApproveTx
                });

                estimatedGas = Number(estimatedGas.toString())

            } catch (error) {
                console.log("needApprove -> GetGasEstimate error")
                estimatedGas = uniconst.DEFAULT_ETH_GAS //session.wallets[session.wallets_index].snipe_max_gas_limit > uniconst.DEFAULT_ETH_GAS ? session.wallets[session.wallets_index].snipe_max_gas_limit : uniconst.DEFAULT_ETH_GAS
            }

            const rawGasAmount = estimatedGasPrice.muln(estimatedGas);
            if (rawEthBalance.lt(rawGasAmount)) {
                await sendMsg(`🚫 Sorry, Insufficient Transaction fee balance!
        
    🚫 Required max fee balance: ${utils.roundDecimal(rawGasAmount / 10 ** 18, 8)} ${afx.get_chain_symbol()}
    🚫 Your ${afx.get_chain_symbol()} balance: ${utils.roundDecimal(rawEthBalance / 10 ** 18, 8)} ${afx.get_chain_symbol()}`);

                return false
            }

            let nonce = await web3.eth.getTransactionCount(wallet.address, 'pending');
            nonce = web3.utils.toHex(nonce);
            const tx = {
                from: wallet.address,
                to: tokenAddress,
                gasLimit: estimatedGas,
                baseFeePerGas: gasPrice,
                // maxFeePerGas: maxFeePerGas,
                data: encodedApproveTx,
                value: 0,
                nonce,
            }
            const signedTx = await wallet.signTransaction(tx);
            await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        } catch (error) {
            console.log(error)
            sendMsg(`❗ Sell Swap failed: Approve Fail.`)
            return false
        }
    }

    let routerContract = null;
    try {
        routerContract = new web3.eth.Contract(afx.get_uniswapv2_router_abi(), afx.get_uniswapv2_router_address());
    } catch (error) {
        sendMsg(`❗ Sell Swap failed: Invalid routerContract.`)
        return false
    }

    sendMsg('🚀 Starting Sell Swap...')

    let rawEthAmountsOut = null

    const swapPath = [tokenAddress, afx.get_weth_address()]

    try {
        const amountsOut = await routerContract.methods.getAmountsOut(rawTokenAmount,
            swapPath).call()

        rawEthAmountsOut = web3.utils.toBN(amountsOut[1])

    } catch (error) {
        // console.log(error)
        sendMsg(`❗ Sell Swap failed: getAmountsOut check.`)
        return false
    }

    try {
        const deadline = parseInt(Date.now() / 1000 + 1800); //parseInt(session.deadline ? Date.now() / 1000 + session.deadline : Date.now() / 1000 + 1800);

        let swapTx = null
        let estimatedGas = null
        if (false)//afx.get_chain_id() === afx.Avalanche_ChainId) 
        {
            swapTx = routerContract.methods.swapExactTokensForAVAXSupportingFeeOnTransferTokens(
                rawTokenAmount.toString(),
                rawEthAmountsOut.muln(100 - slippage).divn(100).toString(),
                swapPath,
                wallet.address,
                deadline
            )
        } else {

            // console.log("rawTokenAmount = ", rawTokenAmount.toString())
            // console.log("rawEthAmountsOut = ", rawEthAmountsOut.toString())
            // console.log("slippage = ", slippage)
            // console.log("deadline = ", deadline)
            // console.log("swapPath=",swapPath)
            
            swapTx = routerContract.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(
                rawTokenAmount.toString(),
                rawEthAmountsOut.muln(100 - slippage).divn(100).toString(),
                swapPath,
                wallet.address,
                deadline
            )
        }

        const encodedSwapTx = swapTx.encodeABI();
        try {

            // console.log("ROUTER = ", afx.get_uniswapv2_router_address());

            estimatedGas = await swapTx.estimateGas({
                from: wallet.address, to: afx.get_uniswapv2_router_address(),
                value: 0, data: encodedSwapTx
            });
            // console.log(estimatedGas)
            estimatedGas = Number(estimatedGas.toString())
        } catch (error) {                        
            console.log("swapTx.GetGasEstimate Error");
            // console.log(error)
            estimatedGas = uniconst.DEFAULT_ETH_GAS // session.wallets[session.wallets_index].snipe_max_gas_limit > uniconst.DEFAULT_ETH_GAS ? session.wallets[session.wallets_index].snipe_max_gas_limit : uniconst.DEFAULT_ETH_GAS
        }
        /*
                const swapFee = calcFee(ethAmount)
                const rawSwapFee = utils.toBNe18(web3, swapFee.swapFeeAmount)*/

        const rawGasAmount = estimatedGasPrice.muln(estimatedGas);
        if (rawEthBalance.lt(rawGasAmount)) {
            await sendMsg(`🚫 Sorry, Insufficient Transaction fee balance!
    
🚫 Required max fee balance: ${utils.roundDecimal(rawGasAmount / 10 ** 18, 8)} ${afx.get_chain_symbol()}
🚫 Your ${afx.get_chain_symbol()} balance: ${utils.roundDecimal(rawEthBalance / 10 ** 18, 8)} ${afx.get_chain_symbol()}`);

            return false
        }

        let nonce = await web3.eth.getTransactionCount(wallet.address, 'pending');
        nonce = web3.utils.toHex(nonce);

        const tx = {
            from: wallet.address,
            to: afx.get_uniswapv2_router_address(),
            gasLimit: estimatedGas,
            baseFeePerGas: gasPrice,
            // maxFeePerGas: maxFeePerGas,
            value: 0,
            data: encodedSwapTx,
            nonce,
        }
        console.log("=====================Sell Transaction=========================", tx)
        const ethAmount = rawEthAmountsOut / (10 ** 18)
        const signedTx = await wallet.signTransaction(tx);
        sendMsg(`🔖 Swap Info
  └─ Amount: ${utils.roundDecimal(sellAmount, 5)} ${tokenSymbol}
  └─ Estimated ${afx.get_chain_symbol()} Amount: ${utils.roundEthUnit(ethAmount, 5)}
  └─ Gas Price: ${utils.roundDecimal(gasPrice / (10 ** 9), 5)} GWEI`
        )
        await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
            .on('transactionHash', async function (hash) {
                let txLink = utils.getFullTxLink(afx.get_chain_id(), hash)
                console.log('Waiting...')
                sendMsg(`⌛ Pending transaction...\n${txLink}`)
            })
            .on('receipt', async function (tx) {
                /*
                  if (session.referred_by && swapFee.refRewardAmount) {
                      database.updateReward(session.referred_by, swapFee.refRewardAmount)
                  }*/

                // database.addTxHistory({
                //     chatid: session.chatid,
                //     username: session.username,
                //     account: session.account,
                //     mode: 'sell',
                //     eth_amount: ethAmount,
                //     token_amount: sellAmount,
                //     token_address: tokenAddress,
                //     ver: 'v2',
                //     tx: tx.transactionHash
                // })

                sendMsg(`🟢 You've sold ${utils.roundDecimal(sellAmount, 5)} ${tokenSymbol}`)

                if (callback) {
                    callback({ status: 'success', txHash: tx.transactionHash })
                }
            })
            .on('error', function (error, receipt) {
                sendMsg(`❗ Transaction failed. (${afx.parseError(error)})`)

                if (callback) {
                    callback({ status: 'failed', txHash: tx.transactionHash })
                }
            })
        return true

    } catch (error) {
        // console.log(error)
        sendMsg(`😢 Sorry, token's tax is high. It seems you might need to increase the slippage.`)

        if (callback) {
            callback({ status: 'error' })
        }

        return false
    }
}

export const transferEthForSnipping = async (web3, wallet, toWallet) => {
    try {
        const rawEthBalance = web3.utils.toBN(await web3.eth.getBalance(wallet.address))
        let gasPrice = await utils.getGasPrices(web3);
        let maxFeePerGas = gasPrice.medium;
        gasPrice = gasPrice.low;
        try {
            estimatedGas = await web3.eth.estimateGas({
                from: wallet.address,
                to: toWallet,
                value: web3.utils.toHex(rawEthBalance),
            })
        } catch (error) {
            console.log("GetGasEstimate error");
            estimatedGas = session.snipe_max_gas_limit > uniconst.DEFAULT_ETH_GAS ? session.snipe_max_gas_limit : uniconst.DEFAULT_ETH_GAS
        }
        const rawGas = maxFeePerGas.muln(estimatedGas)

        const realRawEthAmount = rawEthBalance.sub(rawGas)

        let nonce = await web3.eth.getTransactionCount(wallet.address, 'pending');
        nonce = web3.utils.toHex(nonce);

        //session.snipe_max_gas_limit > 0 ? session.snipe_max_gas_limit : uniconst.DEFAULT_ETH_GAS;
        const tx = {
            from: wallet.address,
            to: toWallet,
            gasLimit: estimatedGas,
            baseFeePerGas: web3.utils.toHex(gasPrice),
            maxFeePerGas: maxFeePerGas,
            value: web3.utils.toHex(realRawEthAmount),
            nonce: web3.utils.toHex(nonce)
        }

        const signedTx = await wallet.signTransaction(tx)

        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        if (receipt.status) {
            console.log('Snipping fund sending succeeded', receipt.transactionHash);
            return result;
        } else {
            console.log('Snipping fund sending failed:', receipt.transactionHash);
            return result;
        }
    } catch (error) {
        console.error(error)
    }
    return result;
}