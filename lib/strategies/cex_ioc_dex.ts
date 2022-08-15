import { IStrategy } from '../strategy'
import { Networks, Token, ISwapper, IContext, DEXSwapper } from '../../lib/swapper'
import { CronJob } from 'cron'

import { logger } from '../logger'
//import { BigNumber } from 'ethers'

import BigNumber from "bignumber.js";
import { SwapSide } from 'paraswap-core';



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
        //const tx = await getSwapTransaction({ srcToken, destToken, srcAmount, networkID, slippage, userAddress, swapper });
        let pair = this.context.market.split('/')
        let srcToken: Token = await this.swapper.getToken(pair[0])
        let destToken: Token = await this.swapper.getToken(pair[1])
        let srcAmount = '0.1'
        let userAddress = this.swapper.getSenderAddress()
        let swapSide = SwapSide.SELL
        logger.debug('srcToken', srcToken)
        //logger.debug(this.context.exchanges.map(it => it.name))
        const rate = await Promise.all([
            this.swapper.getRate({ srcToken, destToken, srcAmount, userAddress }).then((resp1) => {
                let token = srcToken
                srcToken = destToken
                destToken = token
                srcAmount = resp1.destAmount
                swapSide = SwapSide.BUY
                return this.swapper.getRate({ srcToken, destToken, srcAmount, userAddress, swapSide }).then((resp2) => {
                    return { resp1, resp2 }
                })
            }),
            ...this.context.exchanges.map(it => it.fetchTickers([this.context.market]))
        ])
        const result = rate.slice(2).map(it => {
            return {
                bid: new BigNumber(srcAmount).times(it[this.context.market].bid),
                ask: new BigNumber(srcAmount).times(it[this.context.market].ask)
            }
        })
        console.log('Running %d iteration. \n%s\n%s\n%s', this.iteration++,
            // new BigNumber(rate[0].destAmount).div(10 ** rate[0].destDecimals),
            // new BigNumber(rate[1].destAmount).div(10 ** rate[1].destDecimals),
            JSON.stringify(rate[0]),
            JSON.stringify(rate[1]),
            ...result,
        )

        // if (this.iteration > 10) {
        //     logger.debug('Shutting down')

        //     this.shutdown()
        //     this.waitForShutdown()
        // }
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

