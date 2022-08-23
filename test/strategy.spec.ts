import { expect } from 'chai'
import { CronJob } from 'cron'
import { StrategyRunner } from '../lib/strategy'
import { IContext, Context } from '../lib/context'
import ccxt, { Exchange } from 'ccxt'

import { Token, NetworkID, SwapSide } from 'paraswap'
import { ConfigHelper } from '../lib/config-helper'
import { logger } from '../lib/logger'

import dotenv from 'dotenv'
dotenv.config({
    override: true
})

describe("StrategyRunner", () => {
    let context: IContext
    let exchanges: Exchange[]
    let killJob: CronJob
    let cex = process.env.EXCHANGES?.split(' ')
    const log = logger.debug.bind(logger)
    const error = logger.error.bind(logger)

    const tokensOfInterest: Token[] = ConfigHelper.parseTokensString(process.env.TOKENS_OF_INTEREST)
    const stablecoins: Token[] = ConfigHelper.parseTokensString(process.env.STABLECOINS)
    const network: NetworkID = 56 // BSC
    const swapSide: SwapSide = SwapSide.SELL
    const slippage: number = 2
    const difference: number = 1
    const aggregatorScanInterval: number = 1
    const gasFee: number = 0.25
    const userAddress: string = process.env.USER_ADDRESS
    const minVolume: number = 0.01

    const aggregator = 'paraswap'
    const strategy = 'cex-ioc-dex'

    beforeAll(() => {
        expect(StrategyRunner).to.be.not.null;
        exchanges = cex.map(cex_name => {
            const cex_name_upper = cex_name.toUpperCase()
            logger.info(cex_name_upper);
            return new ccxt[cex_name]({
                apiKey: process.env[`${cex_name_upper}_API_KEY`],
                secret: process.env[`${cex_name_upper}_SECRET`],
                password: process.env[`${cex_name_upper}_PASSWORD`],
                enableRateLimit: process.env['ENABLE_RATE_LIMIT']
            })
        });
        context = new Context({
            exchanges,
            tokensOfInterest,
            stablecoins,
            network,
            swapSide,
            slippage,
            difference,
            aggregatorScanInterval,
            gasFee,
            userAddress,
            minVolume
        } as IContext)
    })

    test('runStrategy', async () => {
        logger.info('Running `cex_ioc_dex` strategy');

        const strategy = StrategyRunner.run(context, 'cex_ioc_dex')
        killJob = new CronJob('*/5 * * * * *',
            () => {
                logger.info('Running shutdown');
                killJob.stop()
                strategy.shutdown()
            },
            null,
            true,
            'Europe/Kiev')


        return strategy.waitForShutdown();

    }, 8000)

    test('rateLimit', async () => {
        const ms = Date.now()
        return Promise.all(exchanges.map(async (it) => {
            const ms = Date.now()
            return it
                .fetchTickers(['BTC/USDT'])
                .catch(error)
                .then((tickers) => log(`fetched from ${it.name} in ${Date.now() - ms} ms. ${JSON.stringify(tickers)}`))
        }))
            .catch(error)
            .then(() => log(`Fetched all in ${Date.now() - ms} ms`))
    })

    // test('cex-ioc-dex', async () => {
    //     fail('Not implemented')
    // })
})
