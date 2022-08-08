import { expect } from 'chai'
import { CronJob } from 'cron'
import { StrategyRunner } from '../lib/strategy'

describe("StrategyRunner", () => {
  test('inite', () => {
    expect(StrategyRunner).to.be.not.null;
  });

  test('runStrategy', (done) => {
    jest.setTimeout(20000)
    const strategy = StrategyRunner.run([], 'cex_ioc_dex')
    new CronJob('*/10 * * * * *', () => strategy.shutdown(), null, true)
    strategy.waitForShutdown();
    done()
  })
})
