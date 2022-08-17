import { StrategyRunner } from '../lib/strategy'
import ccxt, { Exchange } from 'ccxt'
import dotenv from 'dotenv'
import { logger } from '../lib/logger'
import fs from 'fs'
import _ from 'lodash'

dotenv.config({ path: './.env' })
let exchanges: Exchange[] = []

import yargs from 'yargs'
import { SwapSide } from 'paraswap-core'
const argv = yargs
    .command('run', 'Runs arbitrage strategy', {
        cex: {
            description: 'CEX(es) to use ',
            type: 'array',
            default: ['okx', 'kucoin']
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
        market: {
            description: 'Market name',
            type: 'string',
            default: 'BNB/USDC'
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

Promise.all(exchanges.map(async (ex: Exchange) =>
    Promise.all([
        ex.fetchBalance(),
        ex.loadMarkets()])
        .catch((err) => logger.error(err))
        .then(result => {
            const extra = {
                exchange: ex.id,
                balance: result[0],
                markets: result[1]
            }
            ex.extra = extra
            return extra;
        })))
    .then((arrExtra) => {
        fs.writeFileSync(`${argv["cex"].join('_')}_markets.json`, JSON.stringify(arrExtra))
        return arrExtra
    })


StrategyRunner.run({ exchanges, ...argv }, 'cex-ioc-dex')

