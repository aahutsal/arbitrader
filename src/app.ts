import { StrategyRunner } from '../lib/strategy'
import ccxt, { Exchange } from 'ccxt'
import dotenv from 'dotenv'
dotenv.config({ path: '../.env' })
console.log(process.env.OKX_API_KEY)

let kucoin: Exchange, okx: Exchange

let initExchanges = () => {
    [kucoin, okx] = [new ccxt.kucoin({
        apiKey: process.env.KUCOIN_API_KEY,
        secret: process.env.KUCOIN_SECRET,
        password: process.env.KUCOIN_PASSWORD
    }), new ccxt.okx({
        apiKey: process.env.OKX_API_KEY,
        secret: process.env.OKX_SECRET,
        password: process.env.OKX_PASSWORD
    })]
}
initExchanges()
kucoin.loadMarkets().then(() => {
    kucoin.fetchBalance().then(balance => console.log(JSON.stringify(balance)))
    console.log(kucoin.version, okx.version)
})
okx.loadMarkets().then(() => {
    okx.fetchBalance().then(balance => console.log(JSON.stringify(balance)))
    console.log(kucoin.version, okx.version)
})


StrategyRunner.run([okx, kucoin], 'cex-ioc-dex')


// const ps = new ParaSwap(56 as NetworkID)
// ps.getBalance('0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE', 'BNB').then(console.log)
// ps.getRate('BNB', 'USDT', '100000000000000000', '0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE', SwapSide.BUY)
//     .then(r => console.log(JSON.stringify(r, null, 2)));

