import express from "express";

import * as database from '../db.js'
import * as utils from '../utils.js'
// import * as bot from '../bot.js'

import dotenv from 'dotenv'
dotenv.config()


export default (web3, bot) => {

    var router = express.Router();

    router.post("/auth", async (req, res) => {

        let chatid = req.body.chatid;
        let walletAddr = req.body.wallet;
    
        if (!chatid || !walletAddr) {
            return res.send({error: 1, message: "paramter error"});
        }
        
        if (!utils.isValidWalletAddress(walletAddr)) {
            return res.send({error: 1, message: "invalid wallet address"});
        }
    
        var user = await database.selectUser({chatid:chatid});
    
        if (!user) {
            return res.send({error: 1, message: "user/group/channel does not exist"});
        }

    
        let communityTokenBalance = await utils.getTokenBalanceFromWallet(web3, walletAddr, process.env.COMUNITY_TOKEN);
    
        if (communityTokenBalance < 0) {

            console.log(`@${user.username} failed to get token balance from wallet`)
            return res.send({error: 1, message: `failed to get token balance from wallet`});
        }

        if (communityTokenBalance < Number(process.env.MIN_COMUNITY_TOKEN_AMOUNT)) {
            console.log(`@${user.username} user/group owner/channel owner's wallet must hold more than ${process.env.MIN_COMUNITY_TOKEN_AMOUNT} balance of community token. Currently you have  ${communityTokenBalance}`)
            return res.send({error: 1, message: `user/group owner/channel owner's wallet must hold more than ${process.env.MIN_COMUNITY_TOKEN_AMOUNT} balance of community token. Currently you have  ${communityTokenBalance}.`});
        }

        console.log(`@${user.username} holds ${communityTokenBalance} tokens!`)

        user.wallet = walletAddr

        await user.save();

        bot.updateSession(user)
    
        bot.sendLoginSuccessMessage(user);
    
        return res.send({error: 0, message: `Success! you are holding ${communityTokenBalance} tokens!`});
    });

    return router;
}
