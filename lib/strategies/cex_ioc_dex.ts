import { IStrategy } from '../strategy'
import { Networks, Token, ISwapper, IContext, DEXSwapper } from '../../lib/swapper'
import { CronJob } from 'cron'

import { logger } from '../logger'
//import { BigNumber } from 'ethers'
import BigNumber from "bignumber.js";

const USER_ADDRESS = '0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE'

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
                logger.debug('tick')
                this.runPrivate().then(() => logger.debug('tock'))
            },
            null,
            true,
            'Europe/Kiev',
        );
    }
    private async runPrivate(): Promise<void> {
        //const tx = await getSwapTransaction({ srcToken, destToken, srcAmount, networkID, slippage, userAddress, swapper });
        const pair = this.context.market.split('/')
        const srcToken: Token = await this.swapper.getToken(pair[0])
        const destToken: Token = await this.swapper.getToken(pair[1])
        const srcAmount = '0.1'
        const userAddress = USER_ADDRESS;
        logger.debug('srcToken', srcToken)
        logger.debug(this.context.exchanges)

        const rate = await Promise.all([
            this.swapper.getRate({ srcToken, destToken, srcAmount, userAddress }),
            ...this.context.exchanges.map(it => it.fetchTickers([this.context.market]))
        ])
        const result = rate.slice(1).map(it => {
            return {
                bid: new BigNumber(srcAmount).times(rate[1][this.context.market].bid),
                ask: new BigNumber(srcAmount).times(rate[1][this.context.market].ask)
            }
        })
        console.log('Running %d iteration. \n%s\n%s\n%s', this.iteration++,
            //JSON.stringify(rate, null, 2)
            new BigNumber(rate[0].destAmount).div(10 ** rate[0].destDecimals),
            ...result,
        )
        if (this.iteration > 10) {
            logger.debug('Shutting down')

            this.shutdown()
            this.waitForShutdown()
        }
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

