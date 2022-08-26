import { StrategyRunner } from '../lib/strategy'
import ccxt, { Exchange } from 'ccxt'
import { Token, NetworkID } from 'paraswap'

import dotenv from 'dotenv'
dotenv.config({
    override: true
})

import { logger } from '../lib/logger'

let exchanges: Exchange[] = []

import yargs from 'yargs'
import { SwapSide } from 'paraswap-core'
import { Context, IContext } from '../lib/context'
import { ConfigHelper } from '../lib/config-helper'

const argv = yargs
    .command('run', 'Runs arbitrage strategy', {
        cex: {
            description: 'CEX(es) to use ',
            type: 'array',
            default: process.env.EXCHANGES?.split(' ').map((it: string) => it.trim())
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
            default: process.env.TOKENS_OF_INTEREST
        },
        stablecoins: {
            description: 'Array of stablecoins',
            type: 'array',
            default: process.env.STABLECOINS
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
        userAddress: {
            description: `Address of the arbitrage wallet in ${process.env.NETWORK_ID}`,
            type: 'string',
            default: process.env.USER_ADDRESS
        },
        minVolume: {
            description: 'Minimum volume which is sold/purchased',
            type: 'number',
            default: 0.01
        }
    })
    .help()
    .alias('help', 'h').argv;

logger.debug(JSON.stringify(argv))
if (Object.getOwnPropertyNames(argv).length > 2) {
    exchanges = argv['cex']?.map(cex_name => {
        const cex_name_upper = cex_name.toUpperCase()
        console.log(cex_name_upper);
        return new ccxt[cex_name]({
            apiKey: process.env[`${cex_name_upper}_API_KEY`],
            secret: process.env[`${cex_name_upper}_SECRET`],
            password: process.env[`${cex_name_upper}_PASSWORD`],
            enableRateLimit: true
        })
    })
    argv['tokensOfInterest'] = ConfigHelper.parseTokensString(argv['tokensOfInterest'])
    argv['stablecoins'] = ConfigHelper.parseTokensString(argv['stablecoins'])

    logger.info(`Using these symbols of interest: \
${JSON.stringify(argv['tokensOfInterest'].map((it: Token) => ({ [it.symbol]: it.address })))}`)
    logger.info('Using these stablecoins: ' + JSON.stringify(argv['stablecoins']))

    StrategyRunner.run(new Context({ exchanges, ...argv } as any), 'cex-ioc-dex')
}
else
    yargs.help()
