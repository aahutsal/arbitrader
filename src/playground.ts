import BigNumber from "bignumber.js"
import ccxt, { Exchange } from "ccxt"
import { NetworkID, ParaSwap, SwapSide, Token } from "paraswap"
import { OptimalRate } from 'paraswap-core'
import { ConfigHelper } from '../lib/config-helper'
import PromiseThrottle from 'promise-throttle'

import _ from 'lodash'
import fs from 'fs'

const stablecoins = ConfigHelper.parseTokensString("USDC,0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d,18,56 USDT,0x55d398326f99059ff775485246999027b3197955,18,56 BUSD,0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56,18,56")
const log = console.log.bind(console)
const exchangesP: Promise<Exchange[]> =
    Promise.all(['exmo', 'kucoin', 'okx', 'coinbase', 'bitmart']
        .map(async (ex: string): Promise<Exchange> => {
            const exchange = new (ccxt[ex])({ enableRateLimit: true })
            exchange.markets = await exchange.loadMarkets()
            return exchange
        }))

let tokensOfInterest: Token[] = ConfigHelper.parseTokensString("WAL,0xd306c124282880858a634e7396383ae58d37c79c,18,56") /// OLE,0xa865197A84E780957422237B5D152772654341F3,18,56")

const paraswap = new ParaSwap(56 as NetworkID)

log('Tokens of interest', tokensOfInterest)

let marketsOfInterest: any[] = _.flatten(tokensOfInterest.map(token => stablecoins.map(sc => [token.symbol, sc.symbol].join('/'))))
log('Markets of interest', marketsOfInterest)
var promiseThrottle = new PromiseThrottle({
    requestsPerSecond: 6,           // up to 1 request per second
    promiseImplementation: Promise  // the Promise library you are using
});

let now: number = undefined

let throttledParaswap = marketsOfInterest.map(async (sc) => {
    const srcToken = _.find(tokensOfInterest, (t => t.symbol === sc.split('/')[0]))?.address
    const destToken = _.find(stablecoins, (s => s.symbol === sc.split('/')[1]))?.address
    const srcAmount = "500"
    return {
        [sc]: {
            bid: await promiseThrottle.add(async () => paraswap.getRate(
                srcToken,
                destToken,
                new BigNumber(srcAmount)
                    .times(10 ** 18)
                    .toFixed(0),
                undefined,
                //"0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE",
                SwapSide.BUY,
                undefined, 18, 18)
                .catch(err => ({ sc, srcToken, destToken, err }))
                .then(rate => ({ sc, srcToken, destToken, rate }))
                .then(obj => {
                    //console.log(Date.now(), obj)
                    return {
                        //obj,
                        price: new BigNumber((obj.rate as OptimalRate).destAmount)
                            .div((obj.rate as OptimalRate).srcAmount).toNumber()
                    }
                })
            ),
            ask: await promiseThrottle.add(async () => paraswap.getRate(
                srcToken,
                destToken,
                new BigNumber(srcAmount)
                    .times(10 ** 18)
                    .toFixed(0),
                //"0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE",
                undefined,
                SwapSide.SELL,
                undefined, 18, 18)
                .catch(err => ({ sc, srcToken, destToken, err }))
                .then(rate => ({ sc, srcToken, destToken, rate }))
                .then(obj => {
                    return {
                        //obj,
                        price: new BigNumber((obj.rate as OptimalRate).destAmount)
                            .div((obj.rate as OptimalRate).srcAmount).toNumber()
                    }
                })
            )
        }
    }
})
const singleCycle = () => exchangesP.then((exchanges: Exchange[]) => {
    now = Date.now()
    fs.mkdirSync(`./.data/${now}`)
    return Promise.all(
        [...exchanges
            .filter((ex: Exchange) => ex.hasFetchTickers)
            .filter((ex: Exchange) => _.intersection(_.keys(ex.markets), marketsOfInterest).length > 0)
            .map(ex =>
                ex.fetchTickers(_.intersection(_.keys(ex.markets), marketsOfInterest))
                    .catch(err => ({ err }))
                    .then(tickers => {
                        fs.writeFileSync(`./.data/${now}/tickers_${ex.id}.json`, JSON.stringify(tickers, null, 2))
                        return tickers
                    })
                    .then((tickers) => _.assign({ ex: ex.id }, ...
                        Object.getOwnPropertyNames(tickers).map((m: string) => ({
                            [m]: {
                                bid: tickers[m].bid,
                                ask: tickers[m].ask,
                            }
                        })))
                    )
            ),
        Promise.all(throttledParaswap).then(arr => _.assign({ "ex": "paraswap" }, ...arr))
        ])
})
    .then(all => {
        const minAsk = _.minBy(all, (o) => {
            const m = _.keys(o)[1]
            //log(o[m])
            return o[m].ask.price
        })
        const maxBid = _.maxBy(all, (o) => {
            const m = _.keys(o)[1]
            //log(o[m])
            return o[m].bid.price
        })

        const mbk = _.keys(maxBid)[1]
        const mak = _.keys(minAsk)[1]
        if (maxBid[mbk].bid > minAsk[mak].ask) {
            console.log('Arbitrage:', JSON.stringify({ maxBid, minAsk, mbk, mak }, null, 2))
        } else {
            console.log('No Arbitrage found:', JSON.stringify({ maxBid, minAsk }, null, 2))
        }
    })
// fs.writeFileSync('./.data/tickers_' + Date.now() + '.json',
// JSON.stringify(all.map(it => {
//     return it;
// }), null, 2))

setInterval(singleCycle, 5000)

// fs.readFile('./.data/tickers_1661592400959.json', (data => {
//     const json = JSON.parse(data)
//     _.sortBy(json,)

// }))
