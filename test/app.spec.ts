import { expect } from 'chai'
import { getSwapTransaction, Networks } from '../lib/swapper'

describe("DEXSwapper", () => {
    test('swap', async () => {
        jest.setTimeout(20000)
        const USER_ADDRESS = '0xD2236a1ccd4ced06E16eb1585C8c474969A6CcfE'
        const srcToken = 'BNB'
        const destToken = 'USDC'
        const srcAmount = '0.1'
        const minAmount = '0.1'
        const networkID = Networks.BSC
        const slippage = 2;
        const userAddress = USER_ADDRESS;

        return getSwapTransaction({ srcToken, destToken, srcAmount, networkID, slippage, userAddress })
            .then((tx) => {
                expect(tx).not.to.be.null;
                console.log(tx)
            })
    })
})
