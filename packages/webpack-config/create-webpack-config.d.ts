interface HtmlPluginOptions {
    template: string;
}

interface Options {
    /**
     * Port to listen with the dev server
     */
    devServerPort?: number;

    /**
     * https://github.com/jantimon/html-webpack-plugin#options
     */
    htmlPlugin?: HtmlPluginOptions;

    /**
     * Shorcut for the htmlPlugin template option
     */
    template?: string;

    /**
     * Enable hot module replacement over CORS domains
     */
    hotCors?: boolean;

    /**
     * https://webpack.js.org/configuration/dev-server/#devserver-historyapifallback
     */
    historyApiFallback?: boolean;

    /**
     * https://github.com/webpack-contrib/webpack-bundle-analyzer
     */
    bundleAnalyzerPlugin?: boolean;

    /**
     * Manual cusomization of the generated config
     */
    customize?: (config: WebpackConfig) => any;
}

interface WebpackConfig {
    entry: any;
    output: any;
    devServer: any;
    resolve: any;
    module: any;
    plugins: any;
    [key: string]: any;
}

export function createWebpackConfig(
    options?: Options,
    customize: (options: Options) => any
): WebpackConfig;
export default createWebpackConfig;

declare global {
    const WEBPACK_GIT_DATE: string;
    const WEBPACK_GIT_REV: string;
    const WEBPACK_BUILD_DATE: string;
}
