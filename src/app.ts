import ccxt, { Exchange } from 'ccxt'
import dotenv from 'dotenv'
import { getSwapTransaction, Networks } from '../lib/swapper'
dotenv.config({ path: '../.env' })
console.log(process.env.OKX_API_KEY)


let kucoin: Exchange, okx: Exchange

let initExchanges = () => {
    [kucoin, okx] = [new ccxt.kucoin({
        apiKey: process.env.KUCOIN_API_KEY,
        secret: process.env.KUCOIN_SECRET
    }), new ccxt.okx({
        apiKey: process.env.OKX_API_KEY,
        secret: process.env.OKX_SECRET
    })]
}
export async function app() {
    const USER_ADDRESS = '0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE'
    const srcToken = 'BNB'
    const destToken = 'USDT'
    const srcAmount = '0.1'
    const minAmount = '0.1'
    const networkID = Networks.BSC
    const slippage = 2;
    const userAddress = USER_ADDRESS;

    return getSwapTransaction({ srcToken, destToken, srcAmount, networkID, slippage, userAddress })
}

app().then(console.log)

// const ps = new ParaSwap(56 as NetworkID)
// ps.getBalance('0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE', 'BNB').then(console.log)
// ps.getRate('BNB', 'USDT', '100000000000000000', '0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE', SwapSide.BUY)
//     .then(r => console.log(JSON.stringify(r, null, 2)));

