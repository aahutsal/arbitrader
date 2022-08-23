import { IStrategy } from '../strategy'
import { Token, ISwapper, DEXSwapper } from '../../lib/swapper'
import { IContext } from "../context"
import { Exchange } from 'ccxt'

import { CronJob } from 'cron'

import { logger } from '../logger'
//import { BigNumber } from 'ethers'

import { SwapSide } from 'paraswap-core'

import fs from 'fs'
import _ from 'lodash'

export class ArbitragePath {

}

export interface IArbitrader {
    getOptimalPaths(rates: any): Promise<ArbitragePath[] | Error>
    doArbitrage(paths: ArbitragePath[]): Promise<any | Error>
}
export class Arbitrader implements IArbitrader {
    public async getOptimalPaths(rates: any): Promise<ArbitragePath[] | Error> {
        return new Promise<ArbitragePath[]>((resolve, reject) => { resolve([new ArbitragePath()]) })
            .catch(() => new Error("Not implemented"))
    }

    public async doArbitrage(paths: ArbitragePath[]): Promise<any | Error> {
        return new Promise<any>((resolve, reject) => { resolve([]) })
            .catch(() => new Error("Not implemented"))
    }
}

export class Strategy implements IStrategy {
    private isShuttingDown: boolean = false
    private job: CronJob
    private iteration: number = 0
    private swapper: ISwapper
    private context: IContext

    protected constructor(context: IContext) {
        this.context = context
        this.swapper = new DEXSwapper(this.context)
        this.job = new CronJob(
            `*/${this.context.aggregatorScanInterval} * * * * *`,
            () => {
                this.runPrivate()
            },
            null,
            true,
            'Europe/Kiev',
            undefined,
            false // don't run on init
        );
    }

    public run(): void {
        this.context.build()
            .then(result => {
                this.context = Object.assign(this.context, result)
                logger.info('Starting cronjob repeating every second');
                return result
            })
            .then(result => {
                this.job.start()
            })

        process.on('SIGTERM', () => {
            logger.debug('Shutting down')

            this.shutdown()
            this.waitForShutdown()
        });

    }

    private async runPrivate(): Promise<void> {
        this.iteration++
        logger.debug(this.iteration)
        //         //const tx = await getSwapTransaction({ srcToken, destToken, srcAmount, networkID, slippage, userAddress, swapper });
        //         let srcToken: Token = this.context.tokensOfInterest[0]
        //         let srcAmount: string = this.context.minVolume.toString()
        //         let userAddress = this.swapper.getSenderAddress()
        //         let swapSide = SwapSide.SELL

        //         Promise.all([
        //             this.context.stablecoins.map(sc => {
        //                 let destTokens: string[][] = this.context.tokensOfInterest.map(it => [it.symbol, sc.symbol])
        //                 const market = `${srcToken.symbol}/${destToken.symbol}`

        //                 logger.debug('getRate params:', { srcToken, destToken, srcAmount, userAddress })
        //                 this.swapper.getRate({ srcToken, destToken, srcAmount, userAddress })
        //                     .catch((error) => { logger.error('getRate failed', error) })
        //                     .then((swapSideSELL) => {
        //                         swapSide = SwapSide.BUY // changing direction
        //                         // return this.swapper.getRate({ srcToken, destToken, srcAmount, userAddress, swapSide })
        //                         //     .catch((error) => { logger.error(error) })
        //                         //     .then((swapSideBUY) => {
        //                         //         return { swapSideSELL, swapSideBUY }
        //                         //     })
        //                         const swapSideBUY = {}
        //                         return { swapSideSELL, swapSideBUY }
        //                     }),
        //             ...(this.context.exchanges.map(async (it) => it.fetchTickers([market])
        //                         .catch(err => {
        //                             return {
        //                                 ERROR: err.message
        //                             }
        //                         })
        //                         .then((it) => it) // enforcing promise execution
        //                     ))
        //     })

        //         ]).then((rates) => {
        //     const dexRates = rates.slice(0, 1)
        //     const cexRates = rates.slice(1)
        //     return {
        //         dexRates,
        //         cexRates
        //     }
        // }).then((result) => {
        //     //fs.writeFileSync(`./.data / ${ Date.now() }.json`, JSON.stringify(result, null, 2))
        //     return result
        // })
    }

    public async waitForShutdown() {
        const sleep = require('util').promisify(setTimeout)
        while (this.isShuttingDown === false) {
            logger.info(this.isShuttingDown)
            await sleep(500)
        }
    }

    public shutdown(): void {
        logger.info('Shutting down strategy')
        this.isShuttingDown = true;
        this.job.stop();
    }

    public static newInstance(context: IContext): IStrategy {
        return new Strategy(context) as IStrategy
    }
}
