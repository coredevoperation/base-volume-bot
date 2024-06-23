
import * as utils from './utils.js'

export const mapApiRepeater = new Map()

export const start = (web3) => {

    console.log('ApiRepeater daemon has been started...')

    setTimeout(() => {
        doEvent(web3)
    }
    , 1000 * 30)
}

export const doEvent = async (web3) => {

    let keyList = []
    for (const [key, state] of mapApiRepeater) {
        if (state.timestamp < Date.now()) {
            keyList.push(key)
        }
    }

    for (const key of keyList) {
        //console.log('[Api Repeater]', key)
        mapApiRepeater.delete(key)
    }

    setTimeout(() => {
        doEvent(web3)
    }
    , 1000 * 30)
}

export const getTokenDetailInfo = async (primaryAddress) => {

    const key = `getTokenDetailInfo_${primaryAddress}`
    let state = mapApiRepeater.get(key)
    if (!state) {

        const tokenDetailInfo = await utils.getTokenDetailInfo(primaryAddress)    
        state = { value: tokenDetailInfo}
        mapApiRepeater.set(key, state)
        // console.log("[API Repeater] new")

    } else {
        // console.log("[API Repeater]", key)
    }

    state.timestamp = Date.now() + (10 * 1000)

    return state.value
}

export const getTopHolders = async (primaryAddress, decimals) => {

    const key = `getTopHolders_${primaryAddress}`
    let state = mapApiRepeater.get(key)
    if (!state) {

        const topHoldersResult = await utils.getTopHolders(primaryAddress, decimals)    
        state = { value: topHoldersResult}
        mapApiRepeater.set(key, state)
        // console.log("[API Repeater] new")

    } else {
        // console.log("[API Repeater]", key)
    }

    state.timestamp = Date.now() + (10 * 1000)

    return state.value

}
