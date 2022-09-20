import ccxt, { Exchange } from "ccxt"
import { SwapSide, Token } from "paraswap"
import { OptimalRate } from 'paraswap-core'
import PromiseThrottle from 'promise-throttle'
import { ConfigHelper } from '../lib/config-helper'


import {
    constructAxiosFetcher, constructEthersContractCaller, constructFullSDK
} from '@paraswap/sdk'
import axios from 'axios'
import { ethers, Wallet } from 'ethers'


import BigNumber from "bignumber.js"

import fs from 'fs'
import _ from 'lodash'

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
const MIN_ARBITRAGE_PERCENT = 0.1

log('Tokens of interest', tokensOfInterest)

let marketsOfInterest: any[] = _.flatten(tokensOfInterest.map(token => stablecoins.map(sc => [token.symbol, sc.symbol].join('/'))))
log('Markets of interest', marketsOfInterest)
let promiseThrottle = undefined

let now: number = undefined
const AMOUNT = "500"
const USER_ADDRESS = "0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE"
const NETWORK_ID = 56

const provider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/', { name: 'binance', chainId: NETWORK_ID })
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
    network: NETWORK_ID,
    fetcher,
    contractCaller,
});

paraswap.getAllowance(USER_ADDRESS, tokensOfInterest[0].address)
    .catch(err => log(err))
    .then((allowance) => {
        if (allowance.message) {
            return paraswap.approveToken(AMOUNT, tokensOfInterest[0].address).then(txHash => ({ allowance, txHash }))
        } else {
            return { allowance, txHash: null }
        }
    })
    .then(({ allowance, txHash }) => {
        log('Allowance,', allowance)
        log('txHash', txHash)
    })

// creating throttled promise
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
                    .then(obj => ({
                        rateObj: obj,
                        price: new BigNumber((obj.rate as OptimalRate).destAmount)
                            .div((obj.rate as OptimalRate).srcAmount).toNumber()
                    }))
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
                    .then(optimalRate => ({ sc, srcToken, destToken, optimalRate }))
                    .then(obj => ({
                        rateObj: obj,
                        price: 1 / new BigNumber((obj.optimalRate as OptimalRate).destAmount)
                            .div((obj.optimalRate as OptimalRate).srcAmount).toNumber()
                    }))
                ),

            }
        }
    })
// creating what we do at a single tick
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
                                bid: {
                                    price: tickers[m].bid
                                },
                                ask: {
                                    price: tickers[m].ask
                                }
                            }
                        })))
                    )),
        Promise.all(throttledParaswap())
            .then(arr => _.assign({ "ex": "paraswap" }, ...arr))
            .then((all) => {
                fs.writeFileSync(`./.data/${now}/tickers_paraswap.json`, JSON.stringify(all, null, 2))
                return all
            })
            .then((all) => { log(all); return all })
        ])
})
    .then(async (all) => {
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
        if (maxBid[mbk].bid.price > minAsk[mak].ask.price) {
            const arbitragePercent = (maxBid[mbk].bid.price - minAsk[mak].ask.price) / maxBid[mbk].bid.price * 100
            log(`Arbitrage:(${arbitragePercent})%)`, { maxBid, minAsk, mbk, mak })
            log('Creating two orders:')

            // const srcToken = _.find(tokensOfInterest, (t => t.symbol === sc.split('/')[0]))?.address
            // const destToken = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359';
            // let srcAmount = '3'
            // srcAmount = new BigNumber(srcAmount).times(10 ** 18).toFixed(0); //The source amount multiplied by its decimals
            // const senderAddress = wallet.getAddress();
            // //const receiver = '0x8B4e846c90a2521F0D2733EaCb56760209EAd51A'; // Useful in case of swap and transfer
            // const referrer = 'cex_dex_arbitrate_bot';

            //     const arbitrage: ({ sellOn, buyOn, pair, priceRoute }) => {
            //     const txParams = await paraswap.buildTx(
            //         srcToken,
            //         destToken,
            //         srcAmount,
            //         destAmount,
            //         priceRoute,
            //         senderAddress,
            //         referrer,
            //         //receiver
            //     );

            // }
            // arbitrage({
            //     sellOn,
            //     buyOn,
            //     pair: 'OLE/USDT',
            //     priceRoute
            // }, maxBid.ex === 'paraswap' ? SwapSide.SELL : SwapSide.BUY)

            // web3.eth.sendTransaction(
            //     txParams,
            //     async (err: Error, transactionHash: string) => {
            //         if (err) {
            //             return this.setState({ error: err.toString(), loading: false });
            //         }
            //         log('transactionHash', transactionHash);
            //     },
            // );
            // if (arbitragePercent >= MIN_ARBITRAGE_PERCENT) {
            //     log('Exitting')
            //     process.exit(0);
            // }


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
