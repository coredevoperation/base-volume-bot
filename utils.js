import EventEmitter from 'events'

import { ERC20_ABI } from './abi/ERC20_ABI.js'
import { UNILOCKER_ABI } from './abi/unilocker-abi.js'
import { PINKLOCK_ABI } from './abi/pinklock-abi.js'
import { TEAMFINANCE_ABI } from './abi/teamfinance-abi.js'
import { UNISWAP_V2_POOL_ABI } from './abi/uniswapv2-pool-abi.js'

import * as fs from 'fs'
import * as uniconst from './uni-catch/const.js'

import assert from 'assert';
import * as afx from './global.js'
import { application } from 'express';
import * as ethscan_api from './etherscan-api.js'
import * as ethUtil from 'ethereumjs-util'

import { ethers } from "ethers";

import * as crypto from './aes.js'

import dotenv from 'dotenv'
import { toNamespacedPath } from 'path'
dotenv.config()

export const isValidWalletAddress = (walletAddress) => {
    // The regex pattern to match a wallet address.
    const pattern = /^(0x){1}[0-9a-fA-F]{40}$/;
  
    // Test the passed-in wallet address against the regex pattern.
    return pattern.test(walletAddress);
}

export const getTokenBalanceFromWallet = async (web3, walletAddress, tokenAddress) => {

    let tokenContract = null;
    try {
        tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
    } catch (error) {
        afx.error_log('getTokenBalanceFromWallet 1', error)
        return -1
    }

    if (!tokenContract) {
        return -1;
    }
    

    try {
        const balance = await tokenContract.methods.balanceOf(walletAddress).call();
        const decimals = await tokenContract.methods.decimals().call();
        const tokenBalance = Number(balance) / 10 ** Number(decimals);

        return tokenBalance;

    } catch (error) {
        afx.error_log('getTokenBalanceFromWallet 2', error)
    }

    return -1;
    //console.log(`getTokenBalanceFromWallet(wallet = ${walletAddress} token = ${tokenAddress})`, "Token Balance:", tokenBalance);

}


export const isValidAddress = (address) => {
    // Check if it's 20 bytes
    if (!address) {
        return false
    }
    
    if (address.length !== 42) {
      return false;
    }
  
    // Check that it starts with 0x
    if (address.slice(0,2) !== '0x') {
      return false;
    }
  
    // Check that each character is a valid hexadecimal digit
    for (let i = 2; i < address.length; i++) {
      let charCode = address.charCodeAt(i);
      if (!((charCode >= 48 && charCode <= 57) ||
            (charCode >= 65 && charCode <= 70) ||
            (charCode >= 97 && charCode <= 102))) {
        return false;
      }
    }
  
    // If all checks pass, it's a valid address
    return true;
  }


  export function isValidPrivateKey(privateKey) {
    try {

        if (privateKey.startsWith('0x')) {
            privateKey = privateKey.substring(2)
        }
      const privateKeyBuffer = Buffer.from(privateKey, 'hex');
      const publicKeyBuffer = ethUtil.privateToPublic(privateKeyBuffer);
      const addressBuffer = ethUtil.pubToAddress(publicKeyBuffer);
      const address = ethUtil.bufferToHex(addressBuffer);
      return true
    } catch (error) {
      return false
    }
  }

export const roundDecimal = (number, digits) => {
    return number.toLocaleString('en-US', {maximumFractionDigits: digits});
}

export const getBlockTimeStampFromBlockNumber = async (blockNumber) => {
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC_MEVBLOCKER_HTTP_URL);
    let timeData = await provider.getBlock(blockNumber);
    if (!timeData) {
        const date = new Date();
        timeData = Math.floor(date.getTime() / 1000);
    }
    return timeData.timestamp;
}

export const getBlockNumberByTimestamp = async (timestamp) => {
    let url = `https://api.etherscan.io/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before`
    const apiKey = await ethscan_api.getApiKey()
    const resp = await ethscan_api.executeEthscanAPI(url, apiKey)

    if (!resp || !resp.result || resp.result.length == 0) {
        return null
    } 

    return resp.result
}

export let web3Inst = null

export const init = (web3) => {
    web3Inst = web3
}

export const getTokenInfo = async (tokenAddress) => {

    assert(web3Inst)
    
    return new Promise( async (resolve, reject) => {
        getTokenInfoW(web3Inst, tokenAddress).then(result => {
            resolve(result)
        })
    })
}

export const getTokenInfoW = async (web3, tokenAddress) => {

    return new Promise( async (resolve, reject) => { 

        let tokenContract = null
        
        try {
            tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
        } catch (err) {
            console.log("AAA->getTokenInfoW() : tokenContract error ")
            resolve(null)
            return
        }

        var tokenPromises = [];

        tokenPromises.push(tokenContract.methods.name().call());
        tokenPromises.push(tokenContract.methods.symbol().call());
        tokenPromises.push(tokenContract.methods.decimals().call());
        tokenPromises.push(tokenContract.methods.totalSupply().call());

        Promise.all(tokenPromises).then(tokenInfo => {

            
            const decimal = parseInt(tokenInfo[2])
            const totalSupply =  Number(tokenInfo[3]) / 10 ** decimal
            const result = {address: tokenAddress, name: tokenInfo[0], symbol: tokenInfo[1], decimal, totalSupply}
            
            console.log(`AAA->getTokenInfoW() : tokenInfo success tvl = ${totalSupply}, name = ${tokenInfo[0]} `)
            resolve(result)

        }).catch(err => {
            console.log("AAA->getTokenInfoW() : tokenPromises error ")
        resolve(null)
        })
    })
}

export const getEthPrice = async (web3) => {

    try {

        const pairContract = new web3.eth.Contract(UNISWAP_V2_POOL_ABI, uniconst.ETH_USDT_V2_PAIR_ADDRESS);
        let res = await pairContract.methods.getReserves().call()

        let tokenBalance = res._reserve0
        let baseTokenBalance = res._reserve1

        tokenBalance = Number(tokenBalance) / 10 ** 18
        baseTokenBalance = Number(baseTokenBalance) / 10 ** 6

        let price =  baseTokenBalance / tokenBalance

        return price

    } catch (error) {
        afx.error_log('[getEthPrice]', error)
    }
    
    return 0.0
}

export const getTimeStringUTC = (timestamp) => {

    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: 'numeric',
        timeZone: 'UTC'
    };
    
    const formattedDate = timestamp.toLocaleString('en-US', options);

    return formattedDate
}

export function isValidDate(dateString) {
    const date = new Date(dateString);
  
    // The date constructor returns 'Invalid Date' if the date string is invalid
    return date instanceof Date && !isNaN(date);
}

export function isValidNumber(numString) {
    const numReg = /^[0-9]+$/
    const testResult = numString.match(numReg)
    const num = parseInt(numString);
    
    console.log(num, testResult, !isNaN(num));
    // The date constructor returns 'Invalid Date' if the date string is invalid
    return testResult && !isNaN(num);
}

export const fetchAPI = async (url, method, data = {}) => {
    try {
        let params = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        }

        if (method === "POST") {
            params.body = JSON.stringify(data) 
        }

        const res = await fetch(url, params);

        if (res) {

            const resData = await res.json()
            //console.log(resData)
            return resData
        }

    } catch (error) {

    }

    return null
}

export const getUniLockerDetails = (web3, pairAddress) => {

    return new Promise( async (resolve, reject) => { 

        let contract = null
        
        try {
            contract = new web3.eth.Contract(UNILOCKER_ABI, uniconst.UNILOCKER_CONTRACT_ADDRESS);
        } catch (err) {
            resolve(null)
            return
        }

        let numLocks = 0
        try {

            numLocks = await contract.methods.getNumLocksForToken(pairAddress).call()

            // console.log('numLocks', numLocks, pairAddress)

        } catch (err) {
            resolve(null)
            return
        }

        let resAmount = 0
        let resUnlockDate = 0
        for (let iLock = 0; iLock < numLocks; iLock++) {

            let detail = null

            try {

                detail = await contract.methods.tokenLocks(pairAddress, iLock).call()
                // console.log(detail)
    
            } catch (error) {

                //console.log(err)
                afx.error_log('getUniLockerDetails', error)
                continue
            }

            if (!detail) {
                continue
            }

            resAmount += Number(detail.amount)
            if (resUnlockDate < Number(detail.unlockDate)) {
                resUnlockDate = Number(detail.unlockDate)
            }
        }

        resolve({resAmount, resUnlockDate})
    })

}

export const getPinkLockDetails = (web3, pairAddress) => {

    return new Promise( async (resolve, reject) => { 

        let contract = null
        
        try {
            contract = new web3.eth.Contract(PINKLOCK_ABI, uniconst.PINKLOCK_CONTRACT_ADDRESS);
        } catch (err) {
            resolve(null)
            return
        }

        let numLocks = 10
        let detail = null

        try {

            detail = await contract.methods.getLocksForToken(pairAddress, 0, numLocks).call()

        } catch (err) {
            resolve(null)
            return
        }

        if (!detail) {
            resolve(null)
            return
        }

        let resAmount = 0
        let resUnlockDate = 0
        for (const lockInfo of detail) {

            if (!lockInfo[5]) {
                continue
            }

            const unlockDate = Number(lockInfo[5])
            if (resUnlockDate < unlockDate) {
                resUnlockDate = unlockDate
            }
        }

        resolve({resAmount, resUnlockDate})
    })

}

export const addressToHex = (address) => {
    const hexString = '0x' + address.slice(2).toLowerCase().padStart(64, '0');
    return hexString.toLowerCase();
}

export async function getTokenSender(web3, tokenContractAddress, dest) {

    const transferEventSignature = web3.utils.keccak256("Transfer(address,address,uint256)").toString();
    const destAddress = addressToHex(dest)
    const url = `https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${tokenContractAddress}&topic0=${transferEventSignature}&topic2=${destAddress}`

    const apiKey = await ethscan_api.getApiKey()
    const res = await ethscan_api.executeEthscanAPI(url, apiKey)
    
    let senders = []
    if (res.result) {

        console.log(res)
        senders = res.result.map(log => {
            return '0x' + log.topics[1].substr(26); 
        });
    }
    // extract the sender's address from each log

    return senders
}

export const getTeamFinanceDetails = async (web3, pairAddress) => {


    return new Promise( async (resolve, reject) => { 

        let senders = null
        
        try {
            senders = await getTokenSender(web3, pairAddress, uniconst.TEAMFINANCE_CONTRACT_ADDRESS)
        } catch (error) {
            //console.log(err)
            afx.error_log('getTeamFinanceDetails', error)
            resolve(null)
            return
        }

        //console.log('senders', senders)
        if (!senders || senders.length == 0) {
            return
        }

        let contract = null
        
        try {
            contract = new web3.eth.Contract(TEAMFINANCE_ABI, uniconst.TEAMFINANCE_CONTRACT_ADDRESS);
        } catch (err) {
        console.log('err', err)

            resolve(null)
            return
        }

        let resAmount = 0
        let resUnlockDate = 0

        for (const sender of senders) {

            let lockIds = []
            try {

                lockIds = await contract.methods.getDepositsByWithdrawalAddress(sender).call()

                //console.log('lockIds', lockIds, pairAddress, sender)

            } catch (err) {
                resolve(null)
                return
            }

            for (const lockId of lockIds) {

                let detail = null

                try {

                    detail = await contract.methods.getDepositDetails(lockId).call()
                    //console.log(detail)
        
                } catch (error) {
    
                    // console.log(err)
                    afx.error_log('getTeamFinanceDetails', error)
                    continue
                }

                if (!detail) {
                    continue
                }

                resAmount += Number(detail._tokenAmount)
                if (resUnlockDate < Number(detail._unlockTime)) {
                    resUnlockDate = Number(detail._unlockTime)
                }
            }
        }
        
        //console.log({resAmount, resUnlockDate})
        resolve({resAmount, resUnlockDate})
    })

}

export const getLastTransactionDateFromAddress = async (address) => {

    let url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&offset=1&page=1`

    const apiKey = await ethscan_api.getApiKey()
    const resp = await ethscan_api.executeEthscanAPI(url, apiKey)

    if (!resp || !resp.result || resp.result.length == 0) {
        return null
    } 

    return resp.result[0].timeStamp
}

export const getContractVerified = async (web3, address) => {

    let url = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=3QBM5TM1N5K8KFI69HYXIKH466AUXI3PTA`
 
    const apiKey = await ethscan_api.getApiKey()
    const resp = await ethscan_api.executeEthscanAPI(url, apiKey)

    if (!resp 
        || !resp.status
        || resp.status !== '1'
        || !resp.message
        || resp.message !== 'OK'
        || !resp.result 
        || resp.result.length === 0 
        || !resp.result[0].SourceCode || resp.result[0].SourceCode === '' || !resp.result[0].ABI || resp.result[0].ABI === 'Contract source code not verified') {
            
        return null
    } 

    const bytecodeHash = web3.utils.keccak256(resp.result[0].SourceCode);
  
    const checksum = '0x' + bytecodeHash.slice(-8);

    return checksum
}

export const createDirectoryIfNotExists = (directoryPath) => {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath);  // GSI ???
      console.log(`The directory '${directoryPath}' has been created.`);
    } else {
    }
};

export const getTopHolders = async (tokenAddress, decimals) => {

    let res = { topHoldersMsg: '', holderCount: 0 }
    let resultMsg = ''

    const url = `https://api.honeypot.is/v1/TopHolders?address=${tokenAddress}&chainID=1`
    let resp = await fetchAPI(url, 'GET')

    if (!resp) {
		return res
	}

    if (!resp.totalSupply || !resp.holders || resp.holders.length === 0) {
        return res
    }

    const icons = ['👮‍♀️', '🕵️', '👩‍🚀', '🧑‍🚒', '👩‍🎨', '🧑‍✈️', '👨‍🎤', '🧑‍🔬', '👩‍🍳', '👩‍🌾', '🦹', '🧙', '🧝‍♀️', '🧟' ]

    const totalSupply = Number(resp.totalSupply)

    resultMsg = '<u>Top holders</u>'

    let row = 0
    for (const holder of resp.holders) {

        const iconIndex = parseInt(Math.random() * icons.length) % icons.length
        row++
        let percent = Number(holder.balance) * 100 / totalSupply

        let bal = Number(holder.balance) / (10 ** decimals)
        resultMsg += `\n${icons[iconIndex]} ${row}. <a href='https://etherscan.io/address/${holder.address}'>${roundDecimal(bal, 3)}</a> | ${roundDecimal(percent, 3)} %`
        // resultMsg += `\n${icons[iconIndex]} ${row}. <a href='https://etherscan.io/address/${holder.address}'>${getShortenedAddress(holder.address)}</a> | ${roundDecimal(percent, 3)} %`

        if (row >= 10) {
            break
        }
    }

    return { topHoldersMsg: resultMsg, holderCount: resp.holders.length }
}

export const getTokenDetailInfo = async (tokenAddress) => {

    const url = `https://api.isrug.app/tokens/scan?mode=detailed&addr=${tokenAddress}&chain=ethereum`
    let resp = await fetchAPI(url, 'GET')

    if (!resp) {
		return null
	}

    return resp
}

export const getShortenedAddress = (address) => {

    if (!address) {
        return ''
    }

    let str = address.slice(0, 24) + '...'

    return str
}

export const getWalletAddressFromPKeyW = (web3, privateKey) => {

    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const walletAddress = account.address;

    return walletAddress
}

export const getWalletAddressFromPKey = (privateKey) => {

    if (!web3Inst) {
        return null
    }

    return getWalletAddressFromPKeyW(web3Inst, privateKey)
}

export const encryptPKey = (text) => {

    if (text.startsWith('0x')) {
        text = text.substring(2)
    }

    // const key = crypto_ysi.randomBytes(32).toString('base64'); 
    // const iv = crypto_ysi.randomBytes(16).toString('base64');
    // console.log('CRYPT_KEY = ' + key + ':' + iv)

    return crypto.aesEncrypt(text, process.env.CRYPT_KEY)
}

export const decryptPKey = (text) => {
    return crypto.aesDecrypt(text, process.env.CRYPT_KEY)
}

export const generateNewWallet = () => {

    try {
        const mnemonic = ethers.Wallet.createRandom().mnemonic;
        const wallet = ethers.Wallet.fromMnemonic(mnemonic.phrase.toString());
            
        //const privateKey = wallet.privateKey;
        const privateKey = wallet._signingKey().privateKey;
        const address = wallet.address;
    
        return {mnemonic: mnemonic.phrase, privateKey, address}

    } catch (error) {

        console.log(error)
        return null
    }
}

export function waitForEvent(eventEmitter, eventName) {
	return new Promise(resolve => {
		eventEmitter.on(eventName, resolve)
	})
}

export async function waitSeconds(seconds) {
	const eventEmitter = new EventEmitter()

	setTimeout(() => {
		eventEmitter.emit('TimeEvent')
	}, seconds * 1000)

	await waitForEvent(eventEmitter, 'TimeEvent')
}

export async function waitMilliseconds(ms) {
	const eventEmitter = new EventEmitter()

	setTimeout(() => {
		eventEmitter.emit('TimeEvent')
	}, ms)

	await waitForEvent(eventEmitter, 'TimeEvent')
}

export async function getGasPrices(web3) {
    try {
        const gasPrice = await web3.eth.getGasPrice();
        console.log("==============gasPrice================", gasPrice)
        const gasPrices = {
            low: web3.utils
                .toBN(gasPrice),
            medium: web3.utils
                .toBN(gasPrice)
                .muln(1.2),
            high: web3.utils
                .toBN(gasPrice)
                .muln(1.5),
        };
        // console.log("chainID", chainID, gasPrices)
        return gasPrices;
    } catch (error) {
        console.log("error:", error);
    }
};

export const toBNe18 = (web3, value) => {

    return web3.utils.toBN(web3.utils.toWei(value.toFixed(18).toString(), 'ether'))
}

export const toBNeN = (web3, value, decimals = 18) => {

    if (18 < decimals || decimals < 1) {
        throw `Decimal must be between 1 to 18`
    }

    return web3.utils.toBN(web3.utils.toWei(value.toFixed(18).toString())).div(web3.utils.toBN(10 ** (18 - decimals)))
}

export const roundEthUnit = (number, digits = 5) => {

    if (Math.abs(number) >= 0.00001 || Math.abs(number) === 0) {
        return `${roundDecimal(number, digits)} ${afx.get_chain_symbol()}`
    }

    number *= 1000000000

    if (Math.abs(number) >= 0.00001) {
        return `${roundDecimal(number, digits)} GWEI`
    }

    number *= 1000000000
    return `${roundDecimal(number, digits)} WEI`
}

export const getFullTxLink = (chainId, hash) => {

    let prefixHttps = ''
    if (chainId === uniconst.ETHEREUM_GOERLI_CHAIN_ID) {

        prefixHttps = 'https://goerli.etherscan.io/tx/'

    } else if (chainId === uniconst.ETHEREUM_GOERLI_CHAIN_ID) {

        prefixHttps = 'https://etherscan.io/tx/'

    } else if (chainId === uniconst.ETHEREUM_SEPOLIA_CHAIN_ID) {

        prefixHttps = 'https://sepolia.etherscan.io/tx/'
    } else if (chainId === uniconst.BASE_CHAIN_ID) {

        prefixHttps = 'https://basescan.org/tx/'
    }

    let txLink = `${prefixHttps}${hash}`

    return txLink
}

export const getTokenPriceInETH = async (tokenAddress, decimal) => {

    const url = `https://api.honeypot.is/v1/GetPairs?address=${tokenAddress}&chainID=0`

    let resp = await fetchAPI(url, 'GET')

    if (!resp) {
		return 0
	}

    tokenAddress = tokenAddress.toLowerCase()

    try {

        let maxPrice = 0.0
        for (const info of resp) {
            if (info.Pair && info.Pair.Tokens && info.Pair.Tokens.length === 2 && info.Reserves && info.Reserves.length === 2) {

                const token0 = info.Pair.Tokens[0].toLowerCase()
                const token1 = info.Pair.Tokens[1].toLowerCase()

                let price = 0.0
                if (token0 === uniconst.WETH_ADDRESS.toLowerCase()) {
                    
                    price = (info.Reserves[0] / (10 ** 18)) / (info.Reserves[1] / (10 ** decimal))

                } else if (token1 === uniconst.WETH_ADDRESS.toLowerCase()) {

                    price = (info.Reserves[1] / (10 ** 18)) / (info.Reserves[0] / (10 ** decimal))

                } else {

                    continue
                }

                if (maxPrice < price) {
                    maxPrice = price
                }
            }
        }

        return maxPrice

    } catch (error) {

        console.error('getTokenPriceInETH', error)
        return 0
    }
}
export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}