import Web3 from 'web3'
import { ethers } from "ethers";
import * as afx from './global.js'
import * as uniconst from './uni-catch/const.js'
import { UNISWAP_V2_FACTORY_ABI } from './abi/uniswapv2-factory-abi.js'
import { UNISWAP_V3_FACTORY_ABI } from './abi/uniswapv3-factory-abi.js'
import { UNISWAP_V2_POOL_ABI } from './abi/uniswapv2-pool-abi.js'

import * as utils from './utils.js'
import { ERC20_ABI } from './abi/ERC20_ABI.js';

const options = {
    reconnect: {
        auto: true,
        delay: 5000, // ms
        maxAttempts: 5,
        onTimeout: false
    }
};



const MAX_FEE = 41000 * (10 ** -9);
const eth_per_wallet_opt3 = (process.env.VOL_BUY_OPT3 - MAX_FEE * process.env.WALLET_DIST_COUNT) / (process.env.WALLET_DIST_COUNT);
const eth_per_wallet_opt2 = (process.env.VOL_BUY_OPT2 - MAX_FEE * process.env.WALLET_DIST_COUNT) / (process.env.WALLET_DIST_COUNT);
const eth_per_wallet_opt1 = (process.env.VOL_BUY_OPT1 - MAX_FEE * process.env.WALLET_DIST_COUNT) / (process.env.WALLET_DIST_COUNT);

export async function distributeWallets(web3, session, database, _user) {

    console.log("distribute wallet begin...")
    const project_name = session.target_project.project_name

    let wallets = await database.selectWallets({ username: session.username, project_name: project_name })
    let existCount = 0
    if (wallets && wallets.length > 0) existCount = wallets.length

    for (let i = 0; i < session.wallet_count - existCount; i++) {
        const result = utils.generateNewWallet()
        let _wallet = {
            address: result.address,
            pkey: utils.encryptPKey(result.privateKey),
            username: session.username,
            project_name: project_name
        }
        await database.addWallet(_wallet)
        wallets.push(result)
    }

    const ethBalance = await web3.eth.getBalance(session.target_project.wallet);
    const formattedEth = ethBalance / (10 ** 18);
    const distributeAmount = (formattedEth - MAX_FEE * session.target_project.wallet_count) / (session.target_project.wallet_count);

    for (let i = 0; i < session.target_project.wallet_count; i++) {
        await transferEthTo(web3, distributeAmount, wallets[i].address, session.target_project.pkey)
    }
    // session.dist_finished = 1
}

const transferEthTo = async (web3, amount, recipientAddress, pkey) => {
    if (!pkey) {
        console.log(`[transferEthTo] pkey error`);
        return null
    }

    const privateKey = utils.decryptPKey(pkey)

    if (!privateKey) {
        console.log(`[transferEthTo] privateKey error`);
        return null
    }
    
    const provider = new ethers.providers.JsonRpcProvider(web3.currentProvider.host)
    let wallet = null
    try {
        wallet = new ethers.Wallet(privateKey, provider);
    } catch (error) {
        console.log(`[transferEthTo] ${error}`)
        return null
    }
    let ethBalance = await provider.getBalance(wallet.address)

    let transactionFeeLimit = 41000 * (10 ** 9)
    let decimalAmount = amount * (10 ** 18)
    let realDecimalAmount = decimalAmount

    // if (ethBalance < (decimalAmount + transactionFeeLimit)) {
    //     realDecimalAmount = ethBalance - transactionFeeLimit
    // }

    if (realDecimalAmount > ethBalance - transactionFeeLimit) realDecimalAmount = ethBalance - transactionFeeLimit

    const transaction = {
        from: wallet.address,
        to: recipientAddress,
        value: ethers.BigNumber.from(parseInt(realDecimalAmount.toString()).toString()),
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

    return { paidAmount, tx: tx.hash }
}

export async function gatherWallets(web3, session, database, _user) {

    console.log("gathering from wallet begin...")
    const project = session.target_project

    let wallets = await database.selectWallets({ username: project.username, project_name: project.project_name })

    for (let i = 0; i < wallets.length; i++) {
        await gatherFrom(web3, wallets[i].pkey, project)
    }
    // session.dist_finished = 1
}

const gatherFrom = async (web3, pkey, project) => {
    if (!pkey) {
        console.log(`[gatherFrom] pkey error`);
        return null
    }

    const privateKey = utils.decryptPKey(pkey)

    if (!privateKey) {
        console.log(`[gatherFrom] privateKey error`);
        return null
    }
    const provider = new ethers.providers.JsonRpcProvider(web3.currentProvider.host)
    let wallet = null
    try {
        wallet = new ethers.Wallet(privateKey, provider);
    } catch (error) {
        console.log(`[gatherFrom] ${error}`)
        return null
    }

    const contract = new ethers.Contract(project.token_address, ERC20_ABI, wallet);
    let promises = []
    promises.push(contract.balanceOf(wallet.address))
    promises.push(provider.getBalance(wallet.address))
    let [tokenBalance, ethBalance] = await Promise.all(promises);
    console.log(tokenBalance, ethBalance / (10 ** 9))

    let transactionFeeLimit = 41000 * (10 ** 9)

    let gatheredEthAmount = 0;
    let gatheredTokenAmount = 0;
    promises = []
    if (ethBalance > transactionFeeLimit && tokenBalance > 0) {
        promises.push(contract.transfer(project.wallet, tokenBalance));
        gatheredTokenAmount = tokenBalance;
        if (ethBalance > transactionFeeLimit * 2) {
            let realDecimalAmount = ethBalance - 2 * transactionFeeLimit > 0 ? ethBalance - 2 * transactionFeeLimit : 0
            const transaction = {
                from: wallet.address,
                to: project.wallet,
                value: ethers.BigNumber.from(parseInt(realDecimalAmount.toString()).toString()),
                gasLimit: 21000
            }
            promises.push(wallet.sendTransaction(transaction));
            gatheredEthAmount = realDecimalAmount
        }
    } else if (ethBalance > transactionFeeLimit) {
        let realDecimalAmount = ethBalance - transactionFeeLimit
        console.log(realDecimalAmount)
        const transaction = {
            from: wallet.address,
            to: project.wallet,
            value: ethers.BigNumber.from(parseInt(realDecimalAmount.toString()).toString()),
            gasLimit: 21000
        }
        promises.push(wallet.sendTransaction(transaction));
        gatheredEthAmount = realDecimalAmount;
    }

    let txs = [];
    try {
        txs = await Promise.all(promises);
        promises = [];
        txs.map(tx => promises.push(tx.wait()))
        let confirmedTxs = Promise.all(promises);
    } catch (error) {
        console.log(`[gatherFrom] sendTransaction_error: ${error.reason}`)
        return null
    }

    ethBalance = ethBalance / (10 ** 18)
    gatheredEthAmount = gatheredEthAmount / (10 ** 18)
    // let txLink1 = utils.getFullTxLink(afx.get_chain_id(), txs[1].hash)
    console.log(`[gatherFrom] ${ethBalance} - ${gatheredEthAmount} eth gathered`);
    // let txLink0 = utils.getFullTxLink(afx.get_chain_id(), txs[0].hash)
    console.log(`[gatherFrom] ${tokenBalance} - ${gatheredTokenAmount} token gathered`);

    return { gatheredEthAmount, gatheredTokenAmount, txs: txs }
}

