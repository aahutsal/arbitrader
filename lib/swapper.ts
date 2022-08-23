import { ParaSwap, NetworkID, Token, APIError } from "paraswap";

import ccxt from 'ccxt'
import { IContext } from "./context";

import BigNumber from "bignumber.js";
import { OptimalRate, SwapSide } from "paraswap-core";
import { logger } from './logger'
import { ethers, Wallet } from "ethers"

import dotenv from 'dotenv'
dotenv.config({
    override: true
})

const NONE_PARTNER = "chucknorris";

export enum Networks {
    MAINNET = 1,
    BSC = 56,
    POLYGON = 137
}

export const web3ProividersURLs: Partial<Record<number, string>> = {
    [Networks.MAINNET]: process.env.MAINNET_PROVIDER_URL,
    [Networks.BSC]: process.env.BSC_PROVIDER_URL,
    [Networks.POLYGON]: process.env.POLYGON_PROVIDER_URL
};
/**
 * @type ethereum address
 */
export type Address = string;
/**
 * @type Token symbol
 */
export type Symbol = string;
/**
 * @type number as string
 */
type NumberAsString = string;

export interface TransactionParams {
    to: Address;
    from: Address;
    value: NumberAsString;
    data: string;
    gasPrice: NumberAsString;
    gas?: NumberAsString;
    chainId: number;
}
export interface GetSwapTxInput {
    srcToken: Symbol;
    destToken: Symbol;
    srcAmount: NumberAsString; // in srcToken denomination
    networkID: number;
    slippage?: number;
    partner?: string;
    userAddress: Address;
    swapper?: DEXSwapper;
    swapSide?: SwapSide;
    receiver?: Address;
}

export interface ISwapper {
    getRate(params: {
        srcToken: Token,
        destToken: Token,
        srcAmount: NumberAsString;
        userAddress: Address;
        partner?: string;
        swapSide?: SwapSide;
    }): Promise<OptimalRate>;
    buildSwap(params: {
        srcToken: Token,
        destToken: Token,
        srcAmount: NumberAsString;
        minAmount: NumberAsString;
        priceRoute: OptimalRate;
        userAddress: Address;
        receiver?: Address;
        partner?: string;
    }): Promise<TransactionParams>;
    getTokens(): Promise<APIError | Token[]>;
    getToken(symbolOrAddress: Symbol | Address): Promise<Token>;
    getSenderAddress(): string
}

export class DEXSwapper implements ISwapper {
    private tokens: APIError | Token[] = []
    private paraswap: ParaSwap
    private Ready: Promise<any>
    private context: IContext
    private wallet: Wallet
    private senderAddress: string

    constructor(context: IContext, apiURL?: string) {
        // initializing tokens
        this.context = context
        this.paraswap = new ParaSwap(
            this.context.network,
            apiURL,
            web3ProividersURLs[this.context.network]
        );

        logger.debug(`WALLET_MNEMONIC: ${process.env.WALLET_MNEMONIC}`)
        this.wallet = ethers.Wallet.fromMnemonic(process.env.WALLET_MNEMONIC)

        this.Ready = this.getTokens().then((tokens: Token[]) => {
            logger.debug('Loading token list');
            this.tokens = tokens

            logger.debug(`Token list loaded. Size: ${tokens.length}`);
            console.log('NON ERC20 TOKENS', tokens.filter(it => it.connectors.length > 1))
        }).then(() => this.wallet.getAddress().then((address: string) => this.senderAddress = address))

    }

    public getSenderAddress(): string {
        return this.senderAddress
    }

    public async getTokens() {
        return this.paraswap.getTokens()
    }

    public async getToken(symbolOrAddress: Symbol | Address): Promise<Token> {
        await this.Ready;
        const [symbol, address] = symbolOrAddress.split(',')

        const token: any = (this.tokens as Token[]).filter((t: Token) => (address ? t.address === symbolOrAddress : t.symbol === symbol))
        if (token.length === 0) // found nothing
            token.push(new Token(address, 18, symbol, undefined, undefined, undefined, this.context.network))

        if (token.length === 0) // found nothing
            throw new Error(`Token ${symbolOrAddress} is not available on network ${this.context.network}`);
        return token[0];
    }

    public async buildSwap({ srcToken, destToken, srcAmount, minAmount, priceRoute, userAddress, ...rest }) {
        const transactionRequestOrError = await this.paraswap.buildTx(
            srcToken.address,
            destToken.address,
            srcAmount,
            minAmount,
            priceRoute,
            userAddress,
            rest.partner,
            undefined,
            undefined,
            rest.receiver
        );

        if ("message" in transactionRequestOrError) {
            throw new Error(transactionRequestOrError.message);
        }

        return transactionRequestOrError as TransactionParams;
    }

    public async getRate({ srcToken, destToken, srcAmount, userAddress, partner = process.env.PARTNER || NONE_PARTNER, swapSide = this.context.swapSide || SwapSide.SELL }): Promise<OptimalRate> {
        const _srcAmount = new BigNumber(srcAmount)
            .times(10 ** srcToken.decimals)
            .toFixed(0);

        const [srcTokenAddress, destTokenAddress] = [srcToken.address, destToken.address]
        const priceRouteOrError = await this.paraswap.getRate(
            srcTokenAddress,
            destTokenAddress,
            _srcAmount,
            userAddress,
            swapSide,
            { partner },
            srcToken.decimals,
            destToken.decimals
        );

        if ("message" in priceRouteOrError) {
            throw new Error(priceRouteOrError.message);
        }

        return priceRouteOrError;
    }

    public async getSwapTransaction({
        srcToken: srcTokenSymbol,
        destToken: destTokenSymbol,
        srcAmount: _srcAmount,
        networkID = this.context.network || parseInt(process.env.NETWORK_ID) as NetworkID,
        swapSide = (this.context.swapSide || process.env.SWAP_SIDE).toUpperCase() === 'BUY' ? SwapSide.BUY : SwapSide.SELL,
        slippage = new BigNumber(this.context.slippage || process.env.SLIPPAGE).div(100).toNumber(), // converting percents to
        userAddress,
        ...rest
    }: GetSwapTxInput): Promise<TransactionParams> {
        try {

            const srcToken: Token = await this.getToken(srcTokenSymbol);
            const destToken: Token = await this.getToken(destTokenSymbol);

            srcToken.decimals = 18
            const srcAmount = new BigNumber(_srcAmount)
                .times(10 ** srcToken.decimals)
                .toFixed(0);

            logger.debug({ srcAmount })

            logger.debug({ srcToken, destToken })
            const priceRoute = await this.getRate({
                srcToken,
                destToken,
                srcAmount,
                userAddress
            });

            logger.debug({ priceRoute })

            const minAmount = new BigNumber(priceRoute.destAmount)
                .times(1 - slippage / 100)
                .toFixed(0);

            const transactionRequest = await this.buildSwap({
                srcToken,
                destToken,
                srcAmount,
                minAmount,
                priceRoute,
                userAddress,
                ...rest
            });

            logger.debug('TransactionRequest', transactionRequest);

            return transactionRequest;
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }

}

export { Token }
