import { Swapper, Networks, getToken, getSwapTransaction, createSwapper } from '../lib/swapper'
import { ParaSwap, NetworkID, Token, APIError } from 'paraswap';

export async function app() {
    const USER_ADDRESS = '0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE'
    const srcToken = 'BNB'
    const destToken = 'USDC'
    const srcAmount = '0.005'
    const minAmount = '0.005'
    const networkID = Networks.BSC
    const slippage = 2;
    const userAddress = USER_ADDRESS;

    const swap = await getSwapTransaction({ srcToken, destToken, srcAmount, networkID, slippage, userAddress })
    return swap;
}

app().then(console.log)
