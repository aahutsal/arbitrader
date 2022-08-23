import { Balance, Balances, Dictionary, Exchange, Market } from 'ccxt';
import { NetworkID, Token } from "paraswap";
import { SwapSide } from "paraswap-core";
import { logger } from './logger';

import _ from 'lodash';

import fs from 'fs';

export interface IContext {
    exchanges: Exchange[];
    tokensOfInterest: Token[];
    stablecoins: Token[];
    network: NetworkID;
    swapSide: SwapSide;
    slippage: number;
    difference: number;
    aggregatorScanInterval: number;
    gasFee: number;
    userAddress: string;
    minVolume: number;
    build(): Promise<{ [x: string]: any } | Error>
}

export class Context implements IContext {
    exchanges: Exchange[];
    tokensOfInterest: Token[];
    stablecoins: Token[];
    network: NetworkID;
    swapSide: SwapSide;
    slippage: number;
    difference: number;
    aggregatorScanInterval: number;
    gasFee: number;
    userAddress: string;
    minVolume: number;
    public constructor({ exchanges, tokensOfInterest, stablecoins, network, swapSide, slippage, difference, aggregatorScanInterval, gasFee, userAddress, minVolume }: IContext) {
        this.exchanges = exchanges;
        this.tokensOfInterest = tokensOfInterest;
        this.stablecoins = stablecoins;
        this.network = network;
        this.swapSide = swapSide;
        this.slippage = slippage;
        this.difference = difference;
        this.aggregatorScanInterval = aggregatorScanInterval;
        this.gasFee = gasFee;
        this.userAddress = userAddress;
        this.minVolume = minVolume;
    }

    public async build(): Promise<{ [x: string]: any } | Error> {
        return Promise.all(this.exchanges.map(async (ex: Exchange) =>
            Promise.all([
                this.loadBalances(ex),
                this.loadMarkets(ex)
            ])
                .catch((err) => { logger.error('Promise.all failed', err); return err })
                .then(result => {
                    const id = ex.id
                    return {
                        [id]:
                            _.values(result).reduce((acc, val) => Object.assign(acc, val), {})

                    }
                })
        ))
            .then((arrExtra) => {
                fs.writeFileSync(`${this.exchanges.map(ex => ex.id).join('_')}_markets.json`,
                    JSON.stringify(arrExtra.reduce((acc, val) => Object.assign(acc, val), {}), null, 2))
                return arrExtra
            })
    }

    private async loadMarkets(ex: Exchange) {
        return ex.loadMarkets()
            .then((markets: Dictionary<Market>) => Object.getOwnPropertyNames(markets)
                // finding intersection
                // omitting markets with names of form: "BTC/USD:USD" and "BTC/USD:USD-221230"
                .filter(name => (name.indexOf(':') === -1)
                    // including market names with tokensOfInterest in it
                    && (_.intersection(name.split('/'),
                        this.tokensOfInterest.map(it => it.symbol)).length > 0)
                    &&
                    // omitting market names witout stablecoin in it
                    (_.intersection(name.split('/'),
                        this.stablecoins.map(it => it.symbol)).length > 0)
                )
            )
            .then((markets: string[]) => ({ markets }))
    }

    private async loadBalances(ex: Exchange): Promise<{ balances: Balances }> {
        return ex.fetchBalance()
            .then((balances) => ({ balances }))
    }
}
