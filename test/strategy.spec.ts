import { expect } from 'chai'
import { CronJob } from 'cron'
import { StrategyRunner } from '../lib/strategy'

describe("StrategyRunner", () => {
    test('inite', () => {
        expect(StrategyRunner).to.be.not.null;
    });

    test('runStrategy', (done) => {
        jest.setTimeout(20000)
        console.log('Running run strategy');
        const strategy = StrategyRunner.run([], 'cex_ioc_dex')
        new CronJob('*/10 * * * * *', () => {
            console.log('Running shutdown');
            strategy.shutdown()
        }, null, true)
        strategy.waitForShutdown();
        done()
    })
})
