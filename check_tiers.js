import * as afx from './global.js'
import * as uniconst from './uni-catch/const.js'
import {UNISWAP_V2_FACTORY_ABI} from './abi/uniswapv2-factory-abi.js'
import {UNISWAP_V3_FACTORY_ABI} from './abi/uniswapv3-factory-abi.js'
import {UNISWAP_V2_POOL_ABI} from './abi/uniswapv2-pool-abi.js'

import * as utils from './utils.js'


export const start = (web3, database, bot) => {

    console.log('checktiers daemon has been started...')

    setTimeout(() => {
        doEvent(web3, database, bot)
    }
    , 1000 * 5)
}

export const doEvent = async (web3, database, bot) => {

    console.log('checktiers is checking VIP status...')

    const users = await database.selectUsers({type:'private'})

	for (const user of users) {

        let session = bot.sessions.get(user.chatid)
        if (session) {
            if (session.vip !== user.vip) {
                session.vip = user.vip
                if (user.vip) {
                    const message = `Hi @${session.username}!
You have been promoted to a VIP user. As a VIP user, you can receive notifications without having to hold the community token anymore. Congratulations!
If you have any questions or any suggestion, please feel free to ask to developer team @Hiccupwalter. Thank you`

                    bot.sendMessage(session.chatid, message)

                    console.log(`@${user.username} has been permitted to work as VIP`)
                } else {
                    console.log(`@${user.username} has been cancelled from VIP permission`)
                }
            }
        }
    }

    console.log('checktiers is checking ...')

    for (const [chatid, session] of bot.sessions) {
        
        if (!session.wallet || session.type !== 'private') {
            continue
        }

        let communityTokenBalance = await utils.getTokenBalanceFromWallet(web3, session.wallet, process.env.COMUNITY_TOKEN);
        const price = await utils.getTokenPriceInETH(process.env.COMUNITY_TOKEN, 18)
        
        if (communityTokenBalance < 0) {
            continue
        }
        
        const tokenWorth_forEth = communityTokenBalance * price;
        let msg = "Normal"
        if (tokenWorth_forEth >= 2) {
            session.tier = bot.TIER_STATE_DARKMATTER
            msg = "Dark Matter"
        }else if (tokenWorth_forEth >= 1) {
            session.tier = bot.TIER_STATE_DIAMOND
            msg = "Diamond"
        }else if (tokenWorth_forEth >= 0.3) {
            session.tier = bot.TIER_STATE_GOLD
            msg = "Gold"
        }else if (tokenWorth_forEth >= 0.15) {
            session.tier = bot.TIER_STATE_SILVER
            msg = "Silver"
        }else{
            session.tier = bot.TIER_STATE_NORMAL
        }
        const message = `Hi @${session.username}!
    Your wallet hold ${process.env.MIN_COMUNITY_TOKEN_AMOUNT} units of the community's token.
    so we set you ${msg} user. Silver: 0.15ETH, Gold: 0.3ETH, Diamond: 1ETH, Dark Matter: 2ETH.
    Here's the <a href="https://www.dextools.io/app/en/ether/pair-explorer/0x695051b0028d02172d0204c964b293d7b25b6710">link</a> to buy
    `  
        //database.updateUser(session)

        bot.sendMessage(chatid, message)

        console.log(`@${session.username} has been set ${msg}`)
    }

    console.log('checktiers checking done ...')

    setTimeout(() => {
        doEvent(web3, database, bot)
    }
    , 1000 * 60 * 60 * 48)
}
