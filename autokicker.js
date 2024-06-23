
import * as afx from './global.js'
import * as uniconst from './uni-catch/const.js'
import {UNISWAP_V2_FACTORY_ABI} from './abi/uniswapv2-factory-abi.js'
import {UNISWAP_V3_FACTORY_ABI} from './abi/uniswapv3-factory-abi.js'
import {UNISWAP_V2_POOL_ABI} from './abi/uniswapv2-pool-abi.js'

import * as utils from './utils.js'


export const start = (web3, database, bot) => {

    console.log('Autokicker daemon has been started...')

    setTimeout(() => {
        doEvent(web3, database, bot)
    }
    , 1000 * 5)
}

export const doEvent = async (web3, database, bot) => {

    console.log('Autokicker is checking VIP status...')

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

    console.log('Autokicker is checking ...')

    let usersKicked = []
    let count = 0
    for (const [chatid, session] of bot.sessions) {
        
        if (!session.wallet || session.type !== 'private') {
            continue
        }

        let communityTokenBalance = await utils.getTokenBalanceFromWallet(web3, session.wallet, process.env.COMUNITY_TOKEN);
    
        if (communityTokenBalance < 0) {
            continue
        }
    
        if (communityTokenBalance < Number(process.env.MIN_COMUNITY_TOKEN_AMOUNT) && session.vip !== 1) {

            const message = `Hi @${session.username}!
In order to utilize the service, possessing a minimum of ${process.env.MIN_COMUNITY_TOKEN_AMOUNT} units of the community's token in your wallet is requisite.
At present, your wallet holds only ${utils.roundDecimal(communityTokenBalance, 3)} tokens; hence, until you obtain additional tokens to satisfy this requirement, accessing the service will be impossible.`
            
            session.wallet = null
            database.updateUser(session)

            bot.sendMessage(chatid, message)

            usersKicked.push(session)

            console.log(`@${session.username} has been kicked out! current balance = ${communityTokenBalance}`)
            count++
        }
    }

    console.log(`${count} users has been kicked out from subscription`)

    let count1 = 0

    let pointer = 0
    const groups = await database.selectUsers({type:'group', kickmode: 1})

    for (const group of groups) {

        for (const user of usersKicked) {
            let chatMember = null;
            try {
                chatMember = await bot.bot.getChatMember(group.chatid, user.chatid);
            } catch (err) {
                continue
            }

            pointer++

            if (pointer % 100 == 1)
                console.log(`Checking ${pointer} - 1`)
            if (chatMember.status === 'member') {

                const res = await bot.bot.unbanChatMember(group.chatid, user.chatid)
                if (res) {
                    count1++

                    const message = `Hi @${user.username}!
In order to keep stay in the group, possessing a minimum of ${process.env.MIN_COMUNITY_TOKEN_AMOUNT} units of the community's token in your wallet is requisite. You are removed from the group. 
Please login to @alphAI_Token_Bot. Thank you for understanding`

                    bot.sendMessage(user.chatid, message)
                    bot.sendMessage(group.chatid, `@${user.username} has been kicked out from this group due insufficient balance of community tokens`)

                    console.log(`@${user.username} has been kicked out from the group(${group.username})`)
                }
            }
        }
    }

    for (const group of groups) {

        for (const user of users) {
            if (user.wallet || user.vip === 1) {
                continue
            }


            let chatMember = null;
            try {
                chatMember = await bot.bot.getChatMember(group.chatid, user.chatid);
            } catch (err) {

                continue
            }

            pointer++
            if (pointer % 100 == 1)
                console.log(`Checking ${pointer} - 2`)
            if (chatMember.status === 'member') {
                const res = await bot.bot.unbanChatMember(group.chatid, user.chatid)
                if (res) {
                    count1++

                    const message = `Hi @${user.username}!
In order to keep stay in the group, possessing a minimum of ${process.env.MIN_COMUNITY_TOKEN_AMOUNT} units of the community's token in your wallet is requisite. You are removed from the group
Please login to @alphAI_Token_Bot. Thank you for understanding`
                    
                    bot.sendMessage(user.chatid, message)
                    bot.sendMessage(group.chatid, `@${user.username} has been kicked out from this group due insufficient balance of community tokens`)

                    console.log(`@${user.username} has been kicked out from the group(${group.username})`)
                }
            }
        }
    }

    console.log(`${count1} users has been kicked out from the group`)

    console.log('Autokicker checking done ...')

    setTimeout(() => {
        doEvent(web3, database, bot)
    }
    , 1000 * 60 * 5)
}
