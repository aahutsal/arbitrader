import { StrategyRunner } from '../lib/strategy'
import ccxt, { Exchange } from 'ccxt'
import dotenv from 'dotenv'
import { logger } from '../lib/logger'

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

// if (argv._.includes('run')) {
//     logger.info(`Running strategy ${argv.strategy} on ${argv.cex} using ${argv.aggregator} aggregator and ${argv.market} market`);
// }

// if (argv._.includes('lyr')) {
// }
// let initExchanges = () => {
//     [allExchanges.kucoin, allExchanges.okx] = [new ccxt.kucoin({
//         apiKey: process.env.KUCOIN_API_KEY,
//         secret: process.env.KUCOIN_SECRET,
//         password: process.env.KUCOIN_PASSWORD
//     }), new ccxt.okx({
//         apiKey: process.env.OKX_API_KEY,
//         secret: process.env.OKX_SECRET,
//         password: process.env.OKX_PASSWORD
//     })]
// }
// initExchanges()

exchanges = argv['cex'].map(cex_name => {
    const cex_name_upper = cex_name.toUpperCase()
    return new ccxt[cex_name]({
        apiKey: process.env[`${cex_name_upper}_API_KEY`],
        secret: process.env[`${cex_name_upper}_SECRET`],
        password: process.env[`${cex_name_upper}_PASSWORD`]
    })
})
exchanges.forEach(it => it.fetchBalance().then(balance => console.log(JSON.stringify(balance))))

StrategyRunner.run({ exchanges, ...argv }, 'cex-ioc-dex')


// const ps = new ParaSwap(56 as NetworkID)
// ps.getBalance('0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE', 'BNB').then(console.log)
// ps.getRate('BNB', 'USDT', '100000000000000000', '0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE', SwapSide.BUY)
//     .then(r => console.log(JSON.stringify(r, null, 2)));

