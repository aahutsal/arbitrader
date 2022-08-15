import { Exchange } from 'ccxt'

interface IStrategy {
    run(): void
    shutdown(): void
    waitForShutdown(): void;
}

class StrategyRunner {
    public static run(exchanges: any, strategyName: string): IStrategy {
        const normalizedStrategyName: string = strategyName.split('-').join('_')
        const Strategy: any = require(`./strategies/${normalizedStrategyName}`).Strategy;
        const strategy: IStrategy = Strategy.newInstance(exchanges)
        strategy.run()
        return strategy
    }
}

export { IStrategy, StrategyRunner }

