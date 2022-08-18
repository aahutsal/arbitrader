import { StrategyRunner } from '../lib/strategy'
import ccxt, { Exchange } from 'ccxt'
import dotenv from 'dotenv'
import { Token, NetworkID } from 'paraswap'

dotenv.config({ path: './.env' })

import { logger } from '../lib/logger'
import fs from 'fs'
import _ from 'lodash'


let exchanges: Exchange[] = []

import yargs from 'yargs'
import { SwapSide } from 'paraswap-core'

const argv = yargs
    .command('run', 'Runs arbitrage strategy', {
        cex: {
            description: 'CEX(es) to use ',
            type: 'array',
            default: process.env.EXCHANGES?.split(',').map((it: string) => it.trim())
        },
        aggregator: {
            description: 'Aggregator to use',
            type: 'string',
            default: 'paraswap'
        },
        'aggregator-scan-interval': {
            description: 'Aggregator scan interval (seconds)',
            type: 'number',
            default: 1
        },
        network: {
            description: 'Network',
            type: 'number',
            default: 56
        },
        tokensOfInterest: {
            description: 'Arbitrage coin(s)',
            type: 'array',
            default: process.env.TOKENS_OF_INTEREST?.split(' ').map((it: string) => it.trim())
        },
        strategy: {
            description: 'Strategy name to run',
            type: 'string',
            default: 'cex-ioc-dex'
        },
        slippage: {
            description: 'Slippage to use on DEX aggregators (%)',
            type: 'number',
            default: 2
        },
        swapSide: {
            description: 'Swap side',
            type: 'string',
            default: SwapSide.SELL
        },
        difference: {
            description: 'Price difference (%), starting arbitrage',
            type: 'number',
            default: 1
        },
        gasFee: {
            description: 'Gas Fee we offer to network when sending swap',
            type: 'number',
            default: 0.25
        },
        minVolume: {
            description: 'Minimum volume which is sold/purchased',
            type: 'number',
            default: 0.01
        }
    })
    .help()
    .alias('help', 'h').argv;
console.log(argv);

exchanges = argv['cex'].map(cex_name => {
    const cex_name_upper = cex_name.toUpperCase()
    console.log(cex_name_upper);
    return new ccxt[cex_name]({
        apiKey: process.env[`${cex_name_upper}_API_KEY`],
        secret: process.env[`${cex_name_upper}_SECRET`],
        password: process.env[`${cex_name_upper}_PASSWORD`]
    })
})
const tokensOfInterest = argv['tokens-of-interest'].map(it => it.split(',') as string[]).map((splitedToken: string[]) => new Token(splitedToken[1], parseInt(splitedToken[2]), splitedToken[0], undefined, undefined, undefined, parseInt(splitedToken[3]) as NetworkID))



logger.info('Using these symbols of interest: ' + JSON.stringify(tokensOfInterest.map(it => it.symbol)))
logger.info('Using these contracts of interest: ' + JSON.stringify(tokensOfInterest.map(it => it.address)))

Promise.all(exchanges.map(async (ex: Exchange) =>
    Promise.all([
        ex.fetchBalance()
            .catch((err) => { logger.error(err); return err })
            .then(balances => {
                return { balances }
            }),
        ex.loadMarkets()
            .catch((err) => { logger.error(err); return err })
            .then(markets => Object.getOwnPropertyNames(markets)
                // finding intersection
                // omitting market name form of "BTC/USD:USD" and "BTC/USD:USD-221230"
                .filter(name => (name.indexOf(':') === -1)
                    // including market names with tokensOfInterest in it
                    && (_.intersection(name.split('/'),
                        tokensOfInterest.map(it => it.symbol)).length > 0)
                    &&
                    // omitting market names witout stablecoin in it
                    (_.intersection(name.split('/'),
                        process.env.STABLECOINS.split(',')).length > 0)
                ))
            .then(markets => {
                return {
                    markets
                }
            })
    ])
        .catch((err) => { logger.error(err); return err })
        .then(result => {
            const id = ex.id
            //const [balances, markets] = { ...result }
            return {
                [id]:
                    _.values(result).reduce((acc, val) => Object.assign(acc, val), {})

            }
        })
))
    .then((arrExtra) => {
        fs.writeFileSync(`${argv["cex"].join('_')}_markets.json`, JSON.stringify(arrExtra.reduce((acc, val) => Object.assign(acc, val), {}), null, 2))
        return arrExtra
    })
// .then((extra) => {
//     exchanges.forEach(it => {
//         logger.debug(`For exchange ${it.id} found extra: ${JSON.stringify(extra[it.id]).length}`)
//     })
//StrategyRunner.run({ exchanges, ...argv }, 'cex-ioc-dex')
//    })






