import * as path from 'path'
import * as fs from 'fs'
import * as utils from './utils.js'

const basePath = './work/alphai'

export const init = () => {
    utils.createDirectoryIfNotExists(basePath)
}

export const storeMsgData = async (chatid, poolAddress, tokenAddress, poolId, hashCode, msgData) => {

    const msgDatapath = path.join(basePath, `${chatid}_${hashCode}`)


    let json = {
        poolAddress: poolAddress,
        tokenAddress: tokenAddress,
        chatid: chatid,
        poolId: poolId,
        data: msgData
    }

    return new Promise(async (resolve, reject) => {
        try {
            const text = btoa(encodeURIComponent(JSON.stringify(json)))
            fs.writeFileSync(msgDatapath, text)
            resolve(true)

        } catch (err) {

            console.error(err)
            resolve(false)
        }
    });
}

export const readMsgData = async (chatid, hashCode) => {
    const msgDatapath = path.join(basePath, `${chatid}_${hashCode}`)

    return new Promise(async (resolve, reject) => {

        try {

            const result = fs.readFileSync(msgDatapath)

            const jsonObject = JSON.parse(decodeURIComponent(atob(result)));
            resolve(jsonObject)

        } catch (err) {

            resolve(null)
        }
    });
}
