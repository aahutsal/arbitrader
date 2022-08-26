import BigNumber from "bignumber.js";
import ccxt, { Exchange } from "ccxt";
import { NetworkID, ParaSwap, SwapSide, Token } from "paraswap";
import { ConfigHelper } from '../lib/config-helper';

import _ from 'lodash';

const stablecoins = ConfigHelper.parseTokensString("USDC,0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d,18,56 USDT,0x55d398326f99059ff775485246999027b3197955,18,56 BUSD,09e7CEA3DedcA5984780Bafc599bD69ADd087D56,18,56")
const log = console.log.bind(console)
const exchangesP: Promise<Exchange[]> =
    Promise.all(['exmo', 'kucoin', 'okx', 'coinbase', 'bitmart']
        .map(async (ex: string): Promise<Exchange> => {
            const exchange = new (ccxt[ex])({ enableRateLimit: true })
            exchange.markets = await exchange.loadMarkets()
            return exchange
        }))

let tokensOfInterest: Token[] = ConfigHelper.parseTokensString("WAL,0xd306c124282880858a634e7396383ae58d37c79c,18,56 OLE,0xa865197A84E780957422237B5D152772654341F3,18,56")

const paraswap = new ParaSwap(56 as NetworkID)

log(tokensOfInterest)
let marketsOfInterest: any[] = _.flatten(tokensOfInterest.map(token => stablecoins.map(sc => [token.symbol, sc.symbol].join('/'))))
log('Markets of interest', marketsOfInterest)

exchangesP.then((exchanges: Exchange[]) =>
    Promise.all(
        [...exchanges
            .filter((ex: Exchange) => ex.hasFetchTickers)
            .filter((ex: Exchange) => _.intersection(_.keys(ex.markets), marketsOfInterest).length > 0)
            .map(ex =>
                ex.fetchTickers(_.intersection(_.keys(ex.markets), marketsOfInterest))
                    .catch(err => ({ err }))
                    .then((tickers) => ({
                        [ex.name]:
                            _.assign({}, ...Object.getOwnPropertyNames(tickers).map((m: string) => ({
                                [m]: {
                                    bid: tickers[m].bid,
                                    ask: tickers[m].ask
                                }
                            })))
                    }))
            ),
        ...marketsOfInterest.map(sc =>
            paraswap.getRate(
                _.find(tokensOfInterest, (t => t.symbol === sc.split('/')[0]))?.address,
                _.find(stablecoins, (s => s.symbol === sc.split('/')[1]))?.address,
                new BigNumber("500").times(10 ** 18).toFixed(0), "0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE", SwapSide.SELL, undefined, 18, 18)
                .catch(err => ({ sc, err }))
                .then(rate => ({ rate }))
        )
        ]))
    .then(all => log(JSON.stringify(all, null, 2)))


