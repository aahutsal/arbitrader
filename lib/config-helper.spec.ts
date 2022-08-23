import { expect } from 'chai'
import ccxt, { Exchange } from 'ccxt'

import { Token, NetworkID, SwapSide } from 'paraswap'

import dotenv from 'dotenv'
import { IContext, Context } from './context'
import { ConfigHelper } from './config-helper'
dotenv.config({
    override: true
})

describe("ConfigHelper", () => {
    test('parseTokenString', () => {
        let szToken: string
        let token: Token

        szToken = "USDC,0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d,18,56"
        token = ConfigHelper.parseTokenString(szToken)

        expect(token.address).to.equal('0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d')
        expect(token.symbol).to.equal('USDC')
        expect(token.decimals).to.equal(18)
        expect(token.network).to.equal(56)

        szToken = "USDC,0x8ac76a51cc950d9822d68b83fe1ad97b32cd58Dd,14,1"
        token = ConfigHelper.parseTokenString(szToken)

        expect(token.address).to.equal('0x8ac76a51cc950d9822d68b83fe1ad97b32cd58Dd')
        expect(token.symbol).to.equal('USDC')
        expect(token.decimals).to.equal(14)
        expect(token.network).to.equal(1)
    })
})
