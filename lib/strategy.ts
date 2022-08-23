import { IContext } from "./context";

interface IStrategy {
    run(): void
    shutdown(): void
    waitForShutdown(): void;
}

class StrategyRunner {
    public static run(context: IContext, strategyName: string): IStrategy {
        const normalizedStrategyName: string = strategyName.split('-').join('_')
        const Strategy: any = require(`./strategies/${normalizedStrategyName}`).Strategy;
        const strategy: IStrategy = Strategy.newInstance(context)
        strategy.run()
        return strategy
    }
}

export { IStrategy, StrategyRunner }

