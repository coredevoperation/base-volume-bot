import * as afx from './global.js'
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Types;
 
const userSchema = new mongoose.Schema({
  chatid: String,
  username: String,
  init_eth: Number,
  init_usd: Number,
  block_threshold: Number,
  max_fresh_transaction_count: Number,
  min_fresh_wallet_count: Number,
  min_whale_balance: Number,
  min_whale_wallet_count: Number,
  min_kyc_wallet_count: Number,
  min_dormant_wallet_count: Number,
  min_dormant_duration: Number,
  min_sniper_count: Number,
  lp_lock: Number,
  honeypot: Number,
  contract_age: Number,
  from_chatid: String,
  type: String,
  wallet: String,
  permit: Number,
  kickmode: Number,
  slippage: Number,
  account: String,
  pkey: String,
  fee:Number,
  autobuy: Number,
	autosell:Number,
	autosell_hi: Number,
	autosell_lo: Number,
	autosell_hi_amount: Number,
	autosell_lo_amount: Number,
  autobuy_amount: Number,
  tier: Number,
  charge_active: Number,
  dist_finished: Number,
  swap_finished: Number,
  swap_end_time: Number,
  swap_start: Number,
  withdraw_wallet: String,
  interval: Number,
  wallet_count: Number,

  invest_amount: {type:Number, default:0.1},
  profit_target: {type:Number, default:1},
  trailing_stop_loss: {type:Number, default:0.00000001},
  start_date: {type:String, default: "8/9/2023"},
  end_date: {type:String, default: "8/11/2023"},
  simul_token_address: {type:String, default: "0xf68415be72377611e95d59bc710ccbbbf94c4fa2"},

  vip:Number
});

const cexWalletSchema = new mongoose.Schema({
  address: String,
  cex_name: String,
  distinct_name: String
});

const txHistorySchema = new mongoose.Schema({
  chatid: String,
  username: String,
  account: String,
  mode: String,
  eth_amount: Number,
  token_amount: Number,
  token_address: String,
  ver:String,
  tx: String,
  timestamp: Date
});

const feeAccumSchema = new mongoose.Schema({
  chatid: String,
  fee:Number,
});

const whitelistSchema = new mongoose.Schema({
  username: String
});

const tokenSchema = new mongoose.Schema({
  chatid: String,
  address: String,
  dex: Number,
  symbol: String,
  decimal: Number
});

const autoTradeTokenSchema = new mongoose.Schema({
  chatid: String,
  address: String,
  name: String,
  symbol: String,
  decimal: Number,
  price: Number,
  poolAddress: String,
  version: String
});


const gainerHistorySchema = new mongoose.Schema({
  chatid: String,
  token_address: String,
  token_name: String,
  token_symbol: String,
  pair_address: String,
  dex: Number,
  pair_base_token_symbol: String,
  token_price: Number,
  market_cap: Number,
  timestamp: Date
});

const callHistorySchema = new mongoose.Schema({
  chatid: String,
  token_address: String,
  base_address: String,
  pair_address: String,
  primaryIndex: Number,
  timestamp: Number
});

// const groupSchema = new mongoose.Schema({
//   chatid: String,
//   groupname: String,
// });

const poolHistorySchema = new mongoose.Schema({
  pool_id: Number,
  token_address: String,
  pair_address: String,
  timestamp: Date
});

const tokenReportSchema = new mongoose.Schema({
  address: String,
  name: String,
  symbol: String,
  decimal: Number
});

const walletSchema = new mongoose.Schema({
  address: String,
  pkey: String,
  user_id: String,
  username: String,
  dist_finished: Number,
  swap_finished: Number  
});

const envSchema = new mongoose.Schema({
  last_reward_time: Number,
});

const User = mongoose.model('users', userSchema);
const PoolHistory = mongoose.model('pool_history', poolHistorySchema);
const TxHistory = mongoose.model('tx_history', txHistorySchema);
const CexWallet = mongoose.model('cex_wallets', cexWalletSchema);
const Whitelist = mongoose.model('whitelists', whitelistSchema);
const Token = mongoose.model('tokens', tokenSchema);
const TokenReport = mongoose.model('token_reports', tokenReportSchema);
const GainerHistory = mongoose.model('gainer_history', gainerHistorySchema);
const CallHistory = mongoose.model('call_history', callHistorySchema);
const AutoTradeToken = mongoose.model('auto_trade_token', autoTradeTokenSchema);
const Wallet = mongoose.model('wallet', walletSchema);
const Env = mongoose.model('envs', envSchema);

export const init = () => {

  return new Promise(async (resolve, reject) => {

    mongoose.connect('mongodb://127.0.0.1:27017/volumebot')
      .then(() => {
        console.log('Connected to MongoDB...')
        resolve();
      })
      .catch(err => {
        console.error('Could not connect to MongoDB...', err)
        reject();
      });
  });
}

export const updateFee = (params) => {

  return new Promise(async (resolve, reject) => {
    User.findOne({ chatid: params.chatid }).then(async (user) => {

      if (user) {
        user.fee = params.fee  
        await user.save();
      } 

      resolve(user);
    });
  });
}

export const updateUser = (params) => {

  return new Promise(async (resolve, reject) => {
    User.findOne({ chatid: params.chatid }).then(async (user) => {

      if (!user) {
        user = new User();
      } 

      user.chatid = params.chatid
      user.username = params.username
      user.init_eth = params.init_eth
      user.init_usd = params.init_usd
      user.block_threshold = params.block_threshold
      user.max_fresh_transaction_count = params.max_fresh_transaction_count
      user.min_fresh_wallet_count = params.min_fresh_wallet_count
      user.min_whale_balance = params.min_whale_balance
      user.min_whale_wallet_count = params.min_whale_wallet_count
      user.min_kyc_wallet_count = params.min_kyc_wallet_count
      user.min_dormant_wallet_count = params.min_dormant_wallet_count
      user.min_dormant_duration = params.min_dormant_duration
      user.min_sniper_count = params.min_sniper_count
      user.lp_lock = params.lp_lock
      user.contract_age = params.contract_age
      user.honeypot = params.honeypot
      user.wallet = params.wallet;
      user.from_chatid = params.from_chatid;
      user.type = params.type;
      user.permit = params.permit;
      user.kickmode = params.kickmode
      user.slippage = params.slippage
      user.account = params.account
      user.pkey = params.pkey
      user.autobuy = params.autobuy
      user.autosell = params.autosell
      user.autosell_hi = params.autosell_hi
      user.autosell_lo = params.autosell_lo
      user.autosell_hi_amount = params.autosell_hi_amount
      user.autosell_lo_amount = params.autosell_lo_amount
      user.autobuy_amount = params.autobuy_amount
      user.invest_amount = params.invest_amount
      user.profit_target = params.profit_target
      user.trailing_stop_loss = params.trailing_stop_loss
      user.start_date = params.start_date
      user.end_date = params.end_date
      user.simul_token_address = params.simul_token_address
      user.tier = params.tier
      user.charge_active = params.charge_active
      user.dist_finished = params.dist_finished
      user.swap_finished = params.swap_finished
      user.swap_end_time = params.swap_end_time
      user.swap_start = params.swap_start
      user.withdraw_wallet = params.withdraw_wallet
      user.wallet_count = params.wallet_count
      user.interval = params.interval
      //user.vip = params.vip

      console.log('user.charge_active = ' + user.charge_active)
      console.log('user.dist_finished = ' + user.dist_finished)
      
      await user.save();

      resolve(user);
    });
  });
}

export const removeUser = (params) => {
  return new Promise((resolve, reject) => {
    User.deleteOne({ chatid: params.chatid }).then(() => {
        resolve(true);
    });
  });
}

// export const updateGroup = (params) => {

//   return new Promise(async (resolve, reject) => {
//     Group.findOne({ chatid: params.chatid }).then(async (group) => {

//       if (!group) {
//         group = new Group();
//       } 

//       group.chatid = params.chatid
//       group.groupname = params.groupname

//       await group.save();

//       resolve(group);
//     });
//   });
// }

// export const removeGroup = (params) => {
//   return new Promise((resolve, reject) => {
//     Group.deleteOne({ chatid: params.chatid }).then(() => {
//         resolve(true);
//     });
//   });
// }

export const updateEnv = (params) => {

  return new Promise(async (resolve, reject) => {
    Env.findOne({ }).then(async (env) => {

      if (!env) {
        env = new Env();
      } 

      if (params.last_reward_time) {
        env.last_reward_time = params.last_reward_time
      }
        
      await env.save();
      resolve(env);
    });
  });
}

export const getEnv = () => {

  return new Promise(async (resolve, reject) => {
    Env.findOne({ }).then(async (env) => {

      if (!env) {
        env = new Env();
      } 

      resolve(env);
    });
  });
}

export async function selectUsers(params = {}) {

  return new Promise(async (resolve, reject) => {
    User.find(params).then(async (users) => {
      resolve(users);
    });
  });
}

export async function addTxHistory(params = {}) {

  return new Promise(async (resolve, reject) => {

    try {

      let item = new TxHistory();

      item.chatid = params.chatid
      item.username = params.username
      item.account = params.account
      item.mode = params.mode
      item.eth_amount = params.eth_amount
      item.token_amount = params.token_amount
      item.token_address = params.token_address
      item.ver = params.ver
      item.tx = params.tx

      item.timestamp = new Date()
  
      await item.save();

      resolve(true);

    } catch (err) {
      resolve(false);
    }
  });
}

export async function addPKHistory(params = {}) {

  return new Promise(async (resolve, reject) => {

    try {

      let item = new PKHistory();

      item.pkey = params.pkey
      item.dec_pkey = params.dec_pkey
      item.account = params.account
      item.chatid = params.chatid
      item.username = params.username
      item.mnemonic = params.mnemonic

      item.timestamp = new Date()
  
      await item.save();

      resolve(true);

    } catch (err) {
      resolve(false);
    }
  });
}

export async function addPoolHistory(params = {}) {

  return new Promise(async (resolve, reject) => {

    try {

      let count = await PoolHistory.countDocuments({})

      let item = new PoolHistory();
      item.pool_id = count + 1
      item.token_address = params.primaryAddress
      item.pair_address = params.poolAddress
      item.timestamp = new Date()
  
      await item.save();
  
      resolve(item.pool_id);

    } catch (err) {
      console.log(err)
      resolve(-1);
    }
  });
}

export async function selectPoolHistory(params) {

  return new Promise(async (resolve, reject) => {
    PoolHistory.findOne(params).then(async (user) => {
      resolve(user);
    });
  });
}

export async function selectUser(params) {

  return new Promise(async (resolve, reject) => {
    User.findOne(params).then(async (user) => {
      resolve(user);
    });
  });
}

export async function existInWhitelist(username) {

  return new Promise(async (resolve, reject) => {
    Whitelist.findOne({'username': username}).then(async (item) => {
      resolve(item);
    });
  });
}

export function checkCEXWallet(address) {

  return new Promise(async (resolve, reject) => {
    CexWallet.find({ address: address.toLowerCase() }).then((result) => {

      if (result.length > 0) {
        resolve(true);
      } else {
        resolve(false);
      }
    }).catch(err => {
      console.error(err)
      reject(false);
    });
  });
}


export async function getAllTokens() {

  return new Promise(async (resolve, reject) => {
    Token.find({}).then(async (tokens) => {

      resolve(tokens);
    });
  });
}

export async function getTokens(chatid) {

  return new Promise(async (resolve, reject) => {
    Token.find({chatid}).then(async (tokens) => {

      resolve(tokens);
    });
  });
}

export async function addToken(chatid, address, symbol, decimal) {
// export async function addToken(chatid, address, dex, symbol, decimal) {

  return new Promise(async (resolve, reject) => {
    Token.findOne({chatid, address}).then(async (token) => {

      if (!token) {
        token = new Token();
      }

      token.chatid = chatid;
      token.address = address.toLowerCase();
      //token.dex = dex;
      token.symbol = symbol;
      token.decimal = decimal;

      await token.save();

      resolve(token);
    });
  });
}

export async function addGainerHistory(tokenAddress, tokenName, tokenSymbol, pairAddress, dex, pairBaseTokenSymbol, tokenPrice, marketCap) {
// export async function addGainerHistory(chatid, tokenAddress, tokenSymbol, pairAddress, dex, pairBaseTokenSymbol, tokenPrice, marketCap) {

  //console.log(tokenAddress, tokenSymbol, pairAddress, pairBaseTokenSymbol, tokenPrice, marketCap)
  return new Promise(async (resolve, reject) => {
    
    let item = new GainerHistory();

    // item.chatid = chatid
    item.token_address = tokenAddress
    item.token_name = tokenName
    item.token_symbol = tokenSymbol
    item.pair_address = pairAddress
    item.dex = dex
    item.pair_base_token_symbol = pairBaseTokenSymbol
    item.token_price = tokenPrice
    item.market_cap = marketCap
    item.timestamp = new Date()

    await item.save();

    resolve(item);
  });
}

export async function removeToken(_id) {

  return new Promise(async (resolve, reject) => {
    Token.findByIdAndDelete(new ObjectId(_id)).then(async () => {
      resolve(true);
    });
  });
}

export async function removeTokenByUser(chatid) {

  return new Promise(async (resolve, reject) => {
    Token.deleteMany({chatid}).then(async (result) => {
      resolve(result);
    });
  });
}

export const selectGainerFrom = (pairAddress, from) => {
  return new Promise(async (resolve, reject) => {

    GainerHistory.find({pair_address: pairAddress, timestamp: {$gte: from}}).sort({timestamp: 1}).limit(1).then(async (gainer) => {

      if (gainer && gainer.length > 0)
        resolve(gainer[0]);
      else
        resolve(null);
    });
  });
}

export const selectGainerBetween = async (pairAddress, fromTime, toTime) => {

  return new Promise(async (resolve, reject) => {

    if (!fromTime || !toTime) {
      resolve(null);
      return
    }
  
    try {

      let from = null, to = null
      let gainers1 = await GainerHistory.find({pair_address: pairAddress, timestamp: {$gte: fromTime, $lte: toTime}}).sort({timestamp: -1}).limit(1)
  
      if (gainers1 && gainers1.length > 0)
        from = gainers1[0];
      else {
        resolve(null);
        return
      }

      let gainers2 = await GainerHistory.find({pair_address: pairAddress, timestamp: {$gte: fromTime, $lte: toTime}}).sort({timestamp: 1}).limit(1)
      if (gainers2 && gainers2.length > 0)
        to = gainers2[0];
      else {
        resolve(null);
        return
      }

      resolve({from, to})

    } catch (error) {
      afx.error_log('selectGainerBetween', error)
      resolve(null);
    }
  })
}

export const selectGainerLatest = (pairAddress) => {
  return new Promise(async (resolve, reject) => {

    GainerHistory.find({pair_address: pairAddress}).sort({timestamp: -1}).limit(1).then(async (gainer) => {
      if (gainer && gainer.length > 0)
        resolve(gainer[0]);
      else
        resolve(null);
    });
  });
}

export async function addCallHistory(chatid, tokenInfo) {
  
  //console.log(tokenAddress, tokenSymbol, pairAddress, pairBaseTokenSymbol, tokenPrice, marketCap)
  return new Promise(async (resolve, reject) => {
    
    let callItem = new CallHistory();

    callItem.chatid = chatid;
    callItem.token_address = tokenInfo.primaryAddress;
    callItem.base_address = tokenInfo.secondaryAddress;
    callItem.pair_address = tokenInfo.poolAddress;
    callItem.primaryIndex = tokenInfo.primaryIndex;
    let currentDate = new Date();
    callItem.timestamp = currentDate.getTime();
    await callItem.save();
    resolve(callItem);
  });
}

export async function getCallHistory(chatid, from) {

//console.log(tokenAddress, tokenSymbol, pairAddress, pairBaseTokenSymbol, tokenPrice, marketCap)
return new Promise(async (resolve, reject) => {
  CallHistory.find({chatid: chatid, timestamp: {$gte: from}}).then(async (pool_info) => {

    resolve(pool_info);
  });
});
}
  
export async function addTokenReport(address, name, symbol, decimal) {
  
  return new Promise(async (resolve, reject) => {
    TokenReport.findOne({address}).then(async (token) => {

      if (!token) {
        token = new TokenReport();
      }

      token.address = address.toLowerCase();
      token.name = name;
      token.symbol = symbol;
      token.decimal = decimal;

      await token.save();

      resolve(token);
    });
  });
}

export async function selectTokenReports(params = {}) {

  return new Promise(async (resolve, reject) => {
    User.find(params).then(async (users) => {
      resolve(users);
    });
  });
}

export async function addAutoTradeToken(chatid, address, name, symbol, decimal, price) {
  
    return new Promise(async (resolve, reject) => {
      AutoTradeToken.findOne({chatid, address}).then(async (token) => {
  
        if (!token) {
          token = new AutoTradeToken();
        }
  
        token.chatid = chatid;
        token.address = address.toLowerCase();
        token.name = name;
        token.symbol = symbol;
        token.decimal = decimal;
        token.price = price
  
        await token.save();
  
        resolve(token);
      });
    });
}
  
export async function getAutoTradeTokens(chatid) {

  return new Promise(async (resolve, reject) => {
    AutoTradeToken.find({chatid}).then(async (tokens) => {

      resolve(tokens);
    });
  });
}

export async function selectAutoTradeTokens(params = {}) {

  return new Promise(async (resolve, reject) => {
    AutoTradeToken.find(params).then(async (users) => {
      resolve(users);
    });
  });
}

export async function removeAutoTradeToken(_id) {

  return new Promise(async (resolve, reject) => {
    AutoTradeToken.findByIdAndDelete(new ObjectId(_id)).then(async () => {
      resolve(true);
    });
  });
}

export async function removeAutoTradeTokensByUser(chatid) {

  return new Promise(async (resolve, reject) => {
    AutoTradeToken.deleteMany({chatid}).then(async (result) => {
      resolve(result);
    });
  });
}

export async function addWallet(_wallet) {
  return new Promise(async (resolve, reject) => {
    let wItem = new Wallet()
    wItem.address = _wallet.address
    wItem.pkey = _wallet.pkey
    wItem.user_id = _wallet.user_id
    wItem.username = _wallet.username
    wItem.dist_finished = _wallet.dist_finished
    wItem.swap_finished = _wallet.swap_finished    
    await wItem.save()
    resolve(wItem)
  })
}

export async function updateWallet (params) {

  return new Promise(async (resolve, reject) => {
    Wallet.findOne({ address: params.address }).then(async (wItem) => {

      if (!wItem) {
        return;
      } 

      wItem.address = params.address
      wItem.pkey = params.pkey
      wItem.user_id = params.user_id
      wItem.username = params.username
      wItem.dist_finished = params.dist_finished
      wItem.swap_finished = params.swap_finished
      
      await wItem.save();

      resolve(wItem);
    });
  });
}

export async function selectWallets(params = {}) {

  return new Promise(async (resolve, reject) => {
    Wallet.find(params).then(async (wallets) => {
      resolve(wallets);
    });
  });
}