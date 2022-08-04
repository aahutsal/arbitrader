import { ParaSwap, NetworkID, Token, APIError } from "paraswap";

import BigNumber from "bignumber.js";
import { OptimalRate, SwapSide } from "paraswap-core";
import winston from "winston";

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'user-service' },
    transports: [
        //
        // - Write all logs with importance level of `error` or less to `error.debug`
        // - Write all logs with importance level of `info` or less to `combined.debug`
        //
        new winston.transports.File({ filename: 'error.debug', level: 'error' }),
        new winston.transports.File({ filename: 'combined.debug' }),
    ],
});
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

const USER_ADDRESS =
  /* process.env.USER_ADDRESS */ "0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245";
const PARTNER = "chucknorris";
const SLIPPAGE = 1; // 1%

let tokens: APIError | Token[] = [];

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


export function getToken(symbol: Symbol, networkID = Networks.BSC): Token {
    const token: any = (tokens as Token[]).filter((t: Token) => t.symbol === symbol)

    if (!token)
        throw new Error(`Token ${symbol} not available on network ${networkID}`);
    return token[0];
}

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

export interface Swapper {
    getRate(params: {
        srcToken: Token,
        destToken: Token,
        srcAmount: NumberAsString;
        userAddress: Address;
        partner?: string;
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
}

export function createSwapper(networkID: number, apiURL?: string): Swapper {
    const paraswap = new ParaSwap(
        networkID as NetworkID,
        apiURL,
        web3ProividersURLs[networkID]
    );

    const getRate: Swapper["getRate"] = async ({
        srcToken,
        destToken,
        srcAmount,
        userAddress,
        partner = PARTNER
    }) => {

        const priceRouteOrError = await paraswap.getRate(
            srcToken.address,
            destToken.address,
            srcAmount,
            userAddress,
            SwapSide.SELL,
            { partner },
            srcToken.decimals,
            destToken.decimals
        );

        logger.debug('priceRouteOrError', priceRouteOrError);

        if ("message" in priceRouteOrError) {
            throw new Error(priceRouteOrError.message);
        }

        return priceRouteOrError;
    };

    const getTokens: Swapper["getTokens"] = async () => {
        return await paraswap.getTokens()
    }

    const buildSwap: Swapper["buildSwap"] = async ({
        srcToken,
        destToken,
        srcAmount,
        minAmount,
        priceRoute,
        userAddress,
        receiver,
        partner
    }) => {
        const transactionRequestOrError = await paraswap.buildTx(
            srcToken.address,
            destToken.address,
            srcAmount,
            minAmount,
            priceRoute,
            userAddress,
            partner,
            undefined,
            undefined,
            receiver
        );

        if ("message" in transactionRequestOrError) {
            throw new Error(transactionRequestOrError.message);
        }

        return transactionRequestOrError as TransactionParams;
    };

    return { getRate, buildSwap, getTokens };
}

export interface GetSwapTxInput {
    srcToken: Symbol;
    destToken: Symbol;
    srcAmount: NumberAsString; // in srcToken denomination
    networkID: number;
    slippage?: number;
    partner?: string;
    userAddress: Address;
    swapper?: Swapper;
    receiver?: Address;
}

export async function getSwapTransaction({
    srcToken: srcTokenSymbol,
    destToken: destTokenSymbol,
    srcAmount: _srcAmount,
    networkID,
    slippage = SLIPPAGE,
    userAddress,
    swapper,
    ...rest
}: GetSwapTxInput): Promise<TransactionParams> {
    try {
        logger.debug('NetworkID', networkID)
        const ps = createSwapper(networkID);
        tokens = await ps.getTokens();
        logger.debug('srcTokenSymbol', srcTokenSymbol)

        const srcToken = getToken(srcTokenSymbol, networkID);
        const destToken = getToken(destTokenSymbol, networkID);
        logger.debug('srcToken, destToken', srcToken, destToken)

        srcToken.decimals = 18
        const srcAmount = new BigNumber(_srcAmount)
            .times(10 ** srcToken.decimals)
            .toFixed(0);

        logger.debug('srcAmount', srcAmount)

        logger.debug('srcToken, destToken', srcToken, destToken)
        const priceRoute = await ps.getRate({
            srcToken,
            destToken,
            srcAmount,
            userAddress
        });

        logger.debug('priceRoute', priceRoute)

        const minAmount = new BigNumber(priceRoute.destAmount)
            .times(1 - slippage / 100)
            .toFixed(0);

        const transactionRequest = await ps.buildSwap({
            srcToken,
            destToken,
            srcAmount,
            minAmount,
            priceRoute,
            userAddress,
            ...rest
        });

        logger.debug("TransactionRequest", transactionRequest);

        return transactionRequest;
    } catch (error) {
        console.error(error);
        throw error;
    }
}
