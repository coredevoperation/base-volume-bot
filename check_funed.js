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
    const project = session.target_project;
    const project_name = project.project_name

    let wallets = await database.selectWallets({ username: project.username, project_name: project_name })
    let existCount = 0
    if (wallets && wallets.length > 0) existCount = wallets.length

    for (let i = 0; i < project.wallet_count - existCount; i++) {
        const result = utils.generateNewWallet()
        let _wallet = {
            address: result.address,
            pkey: utils.encryptPKey(result.privateKey),
            username: project.username,
            project_name: project_name
        }
        await database.addWallet(_wallet)
        wallets.push(result)
    }

    let ethBalance;
    let nonce;
    try {
        ethBalance = await web3.eth.getBalance(project.wallet);
        nonce = await web3.eth.getTransactionCount(project.wallet, 'pending');
    } catch (error) {
        console.log(`[Distribute] ${error.reason}`)
        return null
    }
    const formattedEth = ethBalance / (10 ** 18);
    const distributeAmount = (formattedEth - MAX_FEE * project.wallet_count) / (project.wallet_count);

    let pendings = []
    for (let i = 0; i < project.wallet_count; i++) {
        const tx = await transferEthTo(web3, distributeAmount, wallets[i].address, project.pkey, nonce + i)
        if (tx != null) {
            pendings.push(tx);
        }
    }
    try {
        const transactions = await Promise.all(pendings)
        let confirmPendings = []
        transactions.map(transaction => confirmPendings.push(transaction.wait()));
        const confirms = await Promise.all(confirmPendings);
    } catch (error) {
        console.log("[Distribute Wallets] error", error)
    }
    // session.dist_finished = 1
}

const transferEthTo = async (web3, amount, recipientAddress, pkey, nonce) => {
    if (!pkey) {
        console.log(`[transferEthTo] pkey error`);
        return null
    }

    const privateKey = utils.decryptPKey(pkey)

    if (!privateKey) {
        console.log(`[transferEthTo] privateKey error`);
        return null
    }

    try {
        const provider = new ethers.providers.JsonRpcProvider(web3.currentProvider.host)
        let wallet = null
        let ethBalance = 0;

        wallet = new ethers.Wallet(privateKey, provider);
        // ethBalance = await provider.getBalance(wallet.address)

        // let transactionFeeLimit = 41000 * (10 ** 9)
        let decimalAmount = amount * (10 ** 18)
        let realDecimalAmount = decimalAmount

        // if (realDecimalAmount > ethBalance - transactionFeeLimit) realDecimalAmount = ethBalance - transactionFeeLimit

        const transaction = {
            from: wallet.address,
            to: recipientAddress,
            value: ethers.BigNumber.from(parseInt(realDecimalAmount.toString()).toString()),
            gasLimit: 21000,
            nonce
        }

        let tx = null

        tx = wallet.sendTransaction(transaction);
        return tx;
        const confirmedTx = await tx.wait()

        const paidAmount = realDecimalAmount / (10 ** 18)
        ethBalance = ethBalance / (10 ** 18)
        let txLink = utils.getFullTxLink(afx.get_chain_id(), tx.hash)
        console.log(`[transferEthTo] ${ethBalance} - ${paidAmount} eth transfer tx sent:`, txLink);

        return { paidAmount, tx: tx.hash }
    } catch (error) {
        console.log(`[transferEthTo] ${error.reason}`)
        return null;
    }
}

export async function gatherWallets(web3, session, database, _user) {

    console.log("gathering from wallet begin...")
    const project = session.target_project

    let wallets = await database.selectWallets({ username: project.username, project_name: project.project_name })
    let pendings = []
    for (let i = 0; i < wallets.length; i++) {
        const waits = await gatherFrom(web3, wallets[i].pkey, project)
        pendings.push(...waits);
    }
    try {
        await Promise.all(pendings)
    } catch (error) {
        console.log("[gatherWalles] error", error)
    }
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

    try {
        const provider = new ethers.providers.JsonRpcProvider(web3.currentProvider.host)
        let wallet = null
        wallet = new ethers.Wallet(privateKey, provider);

        const contract = new ethers.Contract(project.token_address, ERC20_ABI, wallet);
        let promises = []
        promises.push(contract.balanceOf(wallet.address))
        promises.push(provider.getBalance(wallet.address))
        let tokenBalance, ethBalance;
        [tokenBalance, ethBalance] = await Promise.all(promises);

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
        txs = await Promise.all(promises);

        ethBalance = ethBalance / (10 ** 18)
        gatheredEthAmount = gatheredEthAmount / (10 ** 18)
        // let txLink1 = utils.getFullTxLink(afx.get_chain_id(), txs[1].hash)
        console.log(`[gatherFrom] ${ethBalance} - ${gatheredEthAmount} eth gathered`);
        // let txLink0 = utils.getFullTxLink(afx.get_chain_id(), txs[0].hash)
        console.log(`[gatherFrom] ${tokenBalance} - ${gatheredTokenAmount} token gathered`);

        promises = [];
        txs.map(tx => promises.push(tx.wait()))
        // let confirmedTxs = Promise.all(promises);

        return promises
    } catch (error) {
        console.log(`[gatherFrom] ${error.reason}`)
        return null
    }
}

export async function withdraw(web3, session, withdraw_address, _user) {
    const project = session.target_project;
    if (!project.pkey) {
        console.log(`[withdraw] pkey error`);
        return null
    }

    const privateKey = utils.decryptPKey(project.pkey)

    if (!privateKey) {
        console.log(`[withdraw] privateKey error`);
        return null
    }

    try {
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        const tokenContract = new web3.eth.Contract(ERC20_ABI, project.token_address);

        let promises = []
        promises.push(tokenContract.methods.balanceOf(account.address).call())
        promises.push(web3.eth.getBalance(account.address))
        promises.push(web3.eth.getTransactionCount(account.address, 'latest'));
        let [tokenBalance, ethBalance, nonce] = await Promise.all(promises);
        console.log(tokenBalance, ethBalance / (10 ** 9), nonce)

        let transactionFeeLimit = 41000 * (10 ** 9)
        // rawTokenAmountsOut = web3.utils.toBN(amountsOut[1])
        let gatheredEthAmount = 0;
        let gatheredTokenAmount = 0;
        if (ethBalance > transactionFeeLimit && tokenBalance > 0) {
            const tokentx = {
                from: account.address,
                to: project.token_address,
                gas: 2000000,
                data: tokenContract.methods.transfer(withdraw_address, tokenBalance).encodeABI()
            };
            const signedTokenTx = await web3.eth.accounts.signTransaction(tokentx, privateKey);
            const receiptTokenTx = await web3.eth.sendSignedTransaction(signedTokenTx.rawTransaction);
            gatheredTokenAmount = tokenBalance;
            if (ethBalance > transactionFeeLimit * 2) {
                let realDecimalAmount = ethBalance - 2 * transactionFeeLimit > 0 ? ethBalance - 2 * transactionFeeLimit : 0
                const ethTx = {
                    from: account.address,
                    to: withdraw_address,
                    value: web3.utils.toBN(realDecimalAmount),
                    gasLimit: 21000
                }
                const signedEthTx = await web3.eth.accounts.signTransaction(ethTx, privateKey);
                const receiptEthTx = await web3.eth.sendSignedTransaction(signedEthTx.rawTransaction);
                gatheredEthAmount = realDecimalAmount
            }
        } else if (ethBalance > transactionFeeLimit) {
            let realDecimalAmount = ethBalance - transactionFeeLimit;
            const ethTx = {
                from: account.address,
                to: withdraw_address,
                value: web3.utils.toBN(realDecimalAmount),
                gasLimit: 21000
            }
            const signedEthTx = await web3.eth.accounts.signTransaction(ethTx, privateKey);
            const receiptEthTx = await web3.eth.sendSignedTransaction(signedEthTx.rawTransaction);
            gatheredEthAmount = realDecimalAmount
        }
        // let txLink1 = utils.getFullTxLink(afx.get_chain_id(), txs[1].hash)
        console.log(`[withdraw] ${ethBalance} - ${gatheredEthAmount} eth withdrawed`);
        // let txLink0 = utils.getFullTxLink(afx.get_chain_id(), txs[0].hash)
        console.log(`[withdraw] ${tokenBalance} - ${gatheredTokenAmount} token withdrawed`);

        return { gatheredEthAmount, gatheredTokenAmount }
    } catch (error) {
        console.log(`[withdraw] ${error}`)
        return null
    }
}
