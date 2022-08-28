import ccxt, { Exchange } from "ccxt"
import { NetworkID, ParaSwap, SwapSide, Token } from "paraswap"
import { OptimalRate } from 'paraswap-core'
import { ConfigHelper } from '../lib/config-helper'
import PromiseThrottle from 'promise-throttle'


import axios from 'axios';
import { ethers, Wallet } from 'ethers';
import {
    constructPartialSDK,
    constructFullSDK,
    constructGetAdapters,
    constructEthersContractCaller,
    constructAxiosFetcher,
} from '@paraswap/sdk'


import BigNumber from "bignumber.js"

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

//let tokensOfInterest: Token[] = ConfigHelper.parseTokensString("WAL,0xd306c124282880858a634e7396383ae58d37c79c,18,56"
let tokensOfInterest: Token[] = ConfigHelper.parseTokensString("OLE,0xa865197A84E780957422237B5D152772654341F3,18,56")

const DEX_DEST_TOKEN = "BUSD"


log('Tokens of interest', tokensOfInterest)

let marketsOfInterest: any[] = _.flatten(tokensOfInterest.map(token => stablecoins.map(sc => [token.symbol, sc.symbol].join('/'))))
log('Markets of interest', marketsOfInterest)
let promiseThrottle = undefined

let now: number = undefined
const AMOUNT = "500"
const USER_ADDRESS = "0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE"

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/')
//const wallet = ethers.Wallet.fromMnemonic("leg spirit cycle write point giraffe opinion exile snake shoot sure have")

const wallet = new Wallet(
    ethers.Wallet.fromMnemonic("leg spirit cycle write point giraffe opinion exile snake shoot sure have").privateKey,
    provider
)
log("Address:", wallet.address)

wallet
const fetcher = constructAxiosFetcher(axios);
console.log(provider.getSigner())
const contractCaller = constructEthersContractCaller({
    ethersProviderOrSigner: wallet,
    EthersContract: ethers.Contract,
}, wallet.address);

const paraswap = constructFullSDK({
    network: 56,
    fetcher,
    contractCaller,
});

paraswap.getAllowance(USER_ADDRESS, tokensOfInterest[0].address)
    .catch(err => log(err))
    .then(allowance =>
        paraswap.approveToken(AMOUNT, tokensOfInterest[0].address).then(txHash => ({ allowance, txHash })))
    .then(({ allowance, txHash }) => {
        log('Allowance,', allowance)
        log('txHash', txHash)
    })

let throttledParaswap = () => // marketsOfInterest
    [tokensOfInterest[0].symbol + '/' + DEX_DEST_TOKEN].map(async (sc) => {
        const srcToken = _.find(tokensOfInterest, (t => t.symbol === sc.split('/')[0]))?.address
        const destToken = _.find(stablecoins, (s => s.symbol === sc.split('/')[1]))?.address
        const srcAmount = AMOUNT
        return {
            [sc]: {
                bid: await promiseThrottle.add(async () => paraswap.getRate({
                    srcToken,
                    destToken,
                    amount: new BigNumber(srcAmount)
                        .times(10 ** 18)
                        .toFixed(0),
                    userAddress: USER_ADDRESS,
                    side: SwapSide.SELL,
                    srcDecimals: 18,
                    destDecimals: 18
                })
                    .catch(err => ({ sc, srcToken, destToken, err }))
                    .then(rate => ({ sc, srcToken, destToken, rate }))
                    .then(obj => new BigNumber((obj.rate as OptimalRate).destAmount)
                        .div((obj.rate as OptimalRate).srcAmount).toNumber())
                ),
                ask: await promiseThrottle.add(async () => paraswap.getRate({
                    destToken: srcToken,
                    srcToken: destToken,
                    amount: new BigNumber(srcAmount)
                        .times(10 ** 18)
                        .toFixed(0),
                    userAddress: USER_ADDRESS,
                    side: SwapSide.BUY,
                    srcDecimals: 18,
                    destDecimals: 18
                })
                    .catch(err => ({ sc, srcToken, destToken, err }))
                    .then(rate => ({ sc, srcToken, destToken, rate }))
                    .then(obj => 1 / new BigNumber((obj.rate as OptimalRate).destAmount)
                        .div((obj.rate as OptimalRate).srcAmount).toNumber()
                    )
                ),

            }
        }
    })
const singleCycle = () => exchangesP.then((exchanges: Exchange[]) => {
    now = Date.now()

    fs.mkdirSync(`./.data/${now}`)
    promiseThrottle = new PromiseThrottle({
        requestsPerSecond: 6,           // up to 1 request per second
        promiseImplementation: Promise  // the Promise library you are using
    })
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
        Promise.all(throttledParaswap())
            .then(arr => _.assign({ "ex": "paraswap" }, ...arr))
            .then((all) => { log(all); return all })
        ])
})
    .then(all => {
        const minAsk = _.minBy(all, (o) => {
            const m = _.keys(o)[1]
            //log(o[m])
            return o[m].ask
        })
        const maxBid = _.maxBy(all, (o) => {
            const m = _.keys(o)[1]
            //log(o[m])
            return o[m].bid
        })

        const mbk = _.keys(maxBid)[1]
        const mak = _.keys(minAsk)[1]
        if (maxBid[mbk].bid > minAsk[mak].ask) {
            log(`Arbitrage:(${(maxBid[mbk].bid - minAsk[mak].ask) / maxBid[mbk].bid * 100}%)`, { maxBid, minAsk, mbk, mak })

        } else {
            log('No Arbitrage found:', { maxBid, minAsk })
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
