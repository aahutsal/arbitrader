import { expect } from 'chai'
import ccxt, { Exchange } from 'ccxt'

import { Token, NetworkID, SwapSide } from 'paraswap'

import dotenv from 'dotenv'
dotenv.config({
    override: true
})

import { IContext, Context } from './context'
import { ConfigHelper } from './config-helper'

describe("Context", () => {
    let context: any
    let exchanges: Exchange[]
    const tokensOfInterest: Token[] = ConfigHelper.parseTokensString(process.env.TOKENS_OF_INTEREST)
    const stablecoins: Token[] = ConfigHelper.parseTokensString(process.env.STABLECOINS)
    const network: NetworkID = 56 // BSC
    const swapSide: SwapSide = SwapSide.SELL
    const slippage: number = 2
    const difference: number = 1
    const aggregatorScanInterval: number = 1
    const gasFee: number = 0.25
    const userAddress: string = process.env.USER_ADDRESS
    const minVolume: number = 0.01

    const aggregator = 'paraswap'
    const strategy = 'cex-ioc-dex'

    const cex = process.env.EXCHANGES?.split(' ').map((it: string) => it.trim())
    beforeAll(() => {
        exchanges = cex.map(cex_name => {
            const cex_name_upper = cex_name.toUpperCase()
            console.log(cex_name_upper);
            return new ccxt[cex_name]({
                apiKey: process.env[`${cex_name_upper}_API_KEY`],
                secret: process.env[`${cex_name_upper}_SECRET`],
                password: process.env[`${cex_name_upper}_PASSWORD`]
            })
        })
        context = new Context({
            exchanges,
            tokensOfInterest,
            stablecoins,
            network,
            swapSide,
            slippage,
            difference,
            aggregatorScanInterval,
            gasFee,
            userAddress,
            minVolume
        } as any)

    })

    test('init', () => {
        expect(context).to.not.be.null
        expect(context).have.property('exchanges').to.be.not.null
        expect(context.exchanges).to.be.an('array')
        expect(context.exchanges).to.not.be.empty
        expect(context.exchanges[0]).to.be.an('object')
    })
})
