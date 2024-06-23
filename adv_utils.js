import * as uniswapV2 from '@uniswap/sdk'
import * as uniswapV3 from '@uniswap/v3-sdk'

export async function getTokenPriceUniV2() {

  const chainId = uniswapV2.ChainId.MAINNET;

  const token0Address = '0xf68415be72377611e95d59bc710ccbbbf94c4fa2';
  const token1Address = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

  const token0 = await uniswapV2.Fetcher.fetchTokenData(chainId, token0Address);
  const token1 = await uniswapV2.Fetcher.fetchTokenData(chainId, token1Address);

  const pair = await uniswapV2.Fetcher.fetchPairData(token0, token1);

  const route = new uniswapV2.Route([pair], token0);
  const tokenPrice = route.midPrice.toSignificant(6);

  console.log(`The current price of ${token0.symbol} is ${tokenPrice} ${token1.symbol}`);
}

// export async function getTokenPriceUniV3() {
    
//     const chainId = uniswapV3.ChainId.MAINNET;
  
//     const token0Address = '<token_0_address>';
//     const token1Address = '<token_1_address>';
  
//     const token0 = await uniswapV3.Fetcher.fetchTokenData(chainId, token0Address);
//     const token1 = await uniswapV3.Fetcher.fetchTokenData(chainId, token1Address);
  
//     const pair = await uniswapV3.Fetcher.fetchPairData(token0, token1);
  
//     const tokenPrice = pair.priceOf(token0).toSignificant(6);
  
//     console.log(`The current price of ${token0.symbol} is ${tokenPrice} ${token1.symbol}`);
// }
