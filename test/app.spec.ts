import { expect } from 'chai'
import { Swapper, Networks, getToken, getSwapTransaction } from '../lib/swapper'
import { app } from '../src/app'

describe("DEXSwapper", () => {
    test('inite', () => {
        expect(app).to.be.not.null;
    });

    test('swap', async (done) => {
        jest.setTimeout(200000)
        const USER_ADDRESS = '0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE'
        const srcToken = 'BNB'
        const destToken = 'USDC'
        const srcAmount = '0.5'
        const minAmount = '0.5'
        const networkID = Networks.BSC
        const slippage = 2;
        const userAddress = USER_ADDRESS;

        const swap = await getSwapTransaction({ srcToken, destToken, srcAmount, networkID, slippage, userAddress })
        expect(swap).not.to.be.null;
        console.log(swap)
    })
})
