import { NetworkID, Token } from "paraswap";

export class ConfigHelper {
    public static parseTokenString(szToken: string): Token {
        const splittedToken: string[] = szToken.split(',') as string[]
        return new Token(splittedToken[1],
            parseInt(splittedToken[2]),
            splittedToken[0],
            undefined,
            undefined,
            undefined,
            parseInt(splittedToken[3]) as NetworkID)
    }

    public static parseTokensString(szTokens: string): Token[] {
        return szTokens.split(' ').map(it => ConfigHelper.parseTokenString(it.trim()))
    }
}
