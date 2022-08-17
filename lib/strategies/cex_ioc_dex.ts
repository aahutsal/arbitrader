import { IStrategy } from '../strategy'
import { Networks, Token, ISwapper, IContext, DEXSwapper } from '../../lib/swapper'
import { CronJob } from 'cron'

import { logger } from '../logger'
//import { BigNumber } from 'ethers'

import BigNumber from "bignumber.js";
import { SwapSide } from 'paraswap-core';

import fs from 'fs';

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
    }

    public run(): void {
        console.log('Starting cronjob repeating every second');
        this.job = new CronJob(
            `*/${this.context.aggregatorScanInterval} * * * * *`,
            () => {
                this.runPrivate()
            },
            null,
            true,
            'Europe/Kiev',
        );

        process.on('SIGTERM', () => {
            logger.debug('Shutting down')

            this.shutdown()
            this.waitForShutdown()
        });

    }
    private async runPrivate(): Promise<void> {
        this.iteration++
        //const tx = await getSwapTransaction({ srcToken, destToken, srcAmount, networkID, slippage, userAddress, swapper });
        let pair = this.context.market.split('/')
        let srcToken: Token = await this.swapper.getToken(pair[0])
        let destToken: Token = await this.swapper.getToken(pair[1])
        let srcAmount = '0.1'
        let userAddress = this.swapper.getSenderAddress()
        let swapSide = SwapSide.SELL
        const market = `${srcToken.symbol}/${destToken.symbol}`
        Promise.all([
            this.swapper.getRate({ srcToken, destToken, srcAmount, userAddress })
                .catch((error) => { logger.error(error) })
                .then((swapSideSELL) => {
                    swapSide = SwapSide.BUY // changing direction
                    // return this.swapper.getRate({ srcToken, destToken, srcAmount, userAddress, swapSide })
                    //     .catch((error) => { logger.error(error) })
                    //     .then((swapSideBUY) => {
                    //         return { swapSideSELL, swapSideBUY }
                    //     })
                    const swapSideBUY = {}
                    return { swapSideSELL, swapSideBUY }
                }),
            ...(this.context.exchanges.map(async (it) => it.fetchTickers([market])
                .catch(err => {
                    return {
                        ERROR: err.message
                    }
                })
                .then((it) => it) // enforcing promise execution
            ))
        ]).then((rates) => {
            const dexRates = rates.slice(0, 1)
            const cexRates = rates.slice(1)
            return {
                dexRates,
                cexRates
            }
        }).then((result) => {
            fs.writeFileSync(`./.data/${Date.now()}.json`, JSON.stringify(result, null, 2))
            return result
        })
    }

    public waitForShutdown(): void {
        while (this.isShuttingDown === false) {
            process.nextTick((rest) => console.log('Ticking...', ...rest))
        }
    }

    public shutdown(): void {
        logger.info('Shutting down strategy')
        this.isShuttingDown = true;
        this.job.stop();
    }

    public static newInstance(context): IStrategy {
        return new Strategy(context) as IStrategy
    }
}


