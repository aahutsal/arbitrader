import { IStrategy } from '../strategy'
import { getSwapTransaction, Networks, createSwapper } from '../../lib/swapper'
import { CronJob } from 'cron'

import { logger } from '../logger'

const USER_ADDRESS = '0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE'
const srcToken = 'BNB'
const destToken = 'USDT'
const srcAmount = '0.1'
const minAmount = '0.1'
const networkID = Networks.BSC
const swapper = createSwapper(networkID)
const slippage = 2;
const userAddress = USER_ADDRESS;

export class Strategy implements IStrategy {
    private isShuttingDown: boolean = false
    private job: CronJob
    private iteration: number = 0

    protected constructor(...rest) {
    }

    public run(): void {
        console.log('You will see this message every second');
        this.job = new CronJob(
            '* * * * * *',
            async () => this.runPrivate(),
            null,
            true
        );
    }
    private async runPrivate(): Promise<void> {
        const tx = await getSwapTransaction({ srcToken, destToken, srcAmount, networkID, slippage, userAddress, swapper });
        console.log('Running %d iteration', this.iteration++)
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

    public static newInstance(...rest: any[]): IStrategy {
        return new Strategy(rest) as IStrategy
    }
}

