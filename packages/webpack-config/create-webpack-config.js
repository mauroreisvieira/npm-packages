// @ts-check
const webpack = require("webpack");
const fs = require("fs");
const {execSync} = require("child_process");
const gitRev = execSync("git rev-parse HEAD").toString();
const gitDate = new Date(
    execSync("git log -1 --format=%cd").toString()
).toISOString();

/**
 * @param {string} dir
 */
function hasBabelrc(dir) {
    const rcFiles = ["babel.config.js", ".babelrc", ".babelrc.js"];
    return fs.readdirSync(dir).some(file => rcFiles.includes(file));
}

function getDefaultConfig() {
    return {
        entry: {
            main: "./src/index",
        },

        optimization: {},

        devtool: "source-map",

        output: {
            filename: "[name].js",
            path: process.cwd() + "/dist",
        },

        devServer: {
            // With dev server serve files from the dist directory
            contentBase: process.cwd() + "/dist",
        },

        resolve: {
            // The default extensions are quite lame.
            // the .mjs enables tree shaking for some npm modules
            // https://github.com/react-icons/react-icons/issues/154#issuecomment-411036960
            extensions: [".tsx", ".ts", ".mjs", ".jsx", ".js", ".json"],
        },

        module: {
            rules: [],
        },

        plugins: [
            new webpack.DefinePlugin({
                WEBPACK_GIT_DATE: JSON.stringify(gitDate),
                WEBPACK_GIT_REV: JSON.stringify(gitRev),
                WEBPACK_BUILD_DATE: JSON.stringify(new Date().toISOString()),
            }),
        ].filter(Boolean),
    };
}

function getBabelLoaderConfig() {
    return {
        test: /\.(ts|tsx|js|jsx|mjs)$/,
        use: {
            loader: "babel-loader",
        },
    };
}

/**
 * @param {{extractCss?: boolean, sass?: boolean}} options
 */
function getCssLoaderConfig(options = {}) {
    /** @type any */
    let styleLoader = "style-loader";

    if (options.extractCss) {
        const MiniCssExtractPlugin = require("mini-css-extract-plugin");
        styleLoader = {loader: MiniCssExtractPlugin.loader};
    }

    return {
        test: /\.(css|scss)$/,
        use: [
            styleLoader,

            {
                loader: "css-loader",
                options: {
                    sourceMap: true,
                    url: !options.extractCss,
                },
            },

            options.sass
                ? {
                      loader: "sass-loader",
                      options: {sourceMap: true},
                  }
                : null,
        ].filter(Boolean),
    };
}

/**
 * Get Emotion babel plugin config
 *
 * @param {boolean} production
 * @return {any}
 */
function getEmotionPlugin(production) {
    if (production) {
        return "emotion";
    }

    return [
        "emotion",
        {
            sourceMap: true,
            autoLabel: true,
            labelFormat: "[filename]--[local]",
        },
    ];
}

function getBabelConfig() {
    return {
        presets: [
            "@babel/preset-typescript",
            "@babel/preset-react",
            "@babel/preset-env",
        ],
        plugins: [
            "@babel/plugin-proposal-class-properties",
            "@babel/plugin-syntax-dynamic-import",
        ],
    };
}

function bundleAnalyzerPlugin() {
    const {BundleAnalyzerPlugin} = require("webpack-bundle-analyzer");
    return new BundleAnalyzerPlugin();
}

function htmlWebpackPlugin(options) {
    if (!options) return;
    const HtmlWebpackPlugin = require("html-webpack-plugin");
    return new HtmlWebpackPlugin(
        Object.assign(
            {
                inject: false,

                templateParameters: (_, assets) => {
                    /**
                     * @param {string} chunkName
                     */
                    const assertChunk = chunkName => {
                        const chunk = assets.chunks[chunkName];
                        if (!chunk) {
                            // prettier-ignore
                            throw new Error(`Unknown entry '${chunkName}'. Available entries ${Object.keys(assets.chunks).join(", ")}`);
                        }
                    };

                    return {
                        htmlWebpackPlugin: {files: assets},

                        /**
                         * @param {string} chunkName
                         * @returns {string}
                         */
                        renderHash(chunkName) {
                            assertChunk(chunkName);
                            return assets.chunks[chunkName].hash;
                        },

                        /**
                         * @param {string} chunkName
                         */
                        renderHashedChunk(chunkName) {
                            assertChunk(chunkName);
                            // prettier-ignore
                            return `${assets.chunks[chunkName].entry}?v=${assets.chunks[chunkName].hash}`;
                        },

                        /**
                         * @param {string} chunkName
                         */
                        renderScriptTag(chunkName) {
                            assertChunk(chunkName);
                            // prettier-ignore
                            return `<script src="${this.renderHashedChunk(chunkName)}"></script>`;
                        },
                    };
                },
            },
            options
        )
    );
}

/**
 * https://webpack.js.org/plugins/split-chunks-plugin/#split-chunks-example-1
 */
function extractCommons() {
    return {
        splitChunks: {
            cacheGroups: {
                commons: {
                    name: "commons",
                    chunks: "initial",
                    minChunks: 2,
                },
            },
        },
    };
}

function createWebpackConfig(options = {}, customize) {
    return (_, args) => {
        const isProduction = args.mode === "production";
        // For some reason --mode option does not set NODE_ENV for .babelrc.js
        if (args.hot) {
            // always development with --hot
            process.env.NODE_ENV = "development";
        } else {
            // Otherwise it's just development or production
            process.env.NODE_ENV = args.mode;
        }

        const config = getDefaultConfig();

        if (options.outputPath) {
            config.output.path = options.outputPath;
            config.devServer.contentBase = options.outputPath;
        }

        if (options.entry) {
            config.entry = options.entry;
        }
        const babelLoader = getBabelLoaderConfig();
        config.module.rules.push(babelLoader);

        if (!hasBabelrc(process.cwd())) {
            const babelConfig = getBabelConfig();

            if (args.hot) {
                babelConfig.plugins.push("react-hot-loader/babel");
            }

            if (options.emotion !== false) {
                babelConfig.plugins.push(getEmotionPlugin(isProduction));
            }

            babelLoader.use.options = babelConfig;
        }

        if (options.extractCommons && options.entry) {
            Object.assign(config.optimization, extractCommons());
        }

        if (options.extractCss && isProduction) {
            const cssLoader = getCssLoaderConfig({
                extractCss: true,
                sass: options.sass,
            });

            config.module.rules.push(cssLoader);

            const MiniCssExtractPlugin = require("mini-css-extract-plugin");
            config.plugins.push(new MiniCssExtractPlugin());

            const TerserPlugin = require("terser-webpack-plugin");
            const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
            config.optimization.minimizer = [
                new TerserPlugin({sourceMap: true}),

                // What the shit. When the optimize-css plugin is added we must
                // manually configure the js minifier too
                new OptimizeCSSAssetsPlugin({
                    cssProcessorOptions: {
                        map: {inline: true, annotations: true},
                    },
                }),
            ];
        } else {
            const cssLoader = getCssLoaderConfig({
                sass: options.sass,
            });
            config.module.rules.push(cssLoader);
        }

        if (!isProduction) {
            config.module.rules.push({
                test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
                loader: "url-loader",
            });
        }

        const devServerPort = args.port || options.devServerPort || 8080;

        config.devServer.port = devServerPort;

        const publicPath = options.publicPath || "/";

        if (!isProduction && options.cors) {
            const host = options.devServerHost || "localhost";
            config.output.publicPath = `http://${host}:${devServerPort}${publicPath}`;
            config.devServer.headers = {
                "Access-Control-Allow-Origin": "*",
            };
        } else {
            config.output.publicPath = publicPath;
        }

        if (options.historyApiFallback) {
            config.devServer.historyApiFallback = options.historyApiFallback;
        }

        if (options.bundleAnalyzerPlugin || process.env.ANALYZE) {
            config.plugins.push(bundleAnalyzerPlugin());
        }

        if (options.template) {
            config.plugins.push(
                htmlWebpackPlugin({template: options.template})
            );
        } else if (options.htmlPlugin) {
            config.plugins.push(
                htmlWebpackPlugin(
                    Object.assign(
                        {template: options.template},
                        options.htmlPlugin
                    )
                )
            );
        }

        if (typeof customize === "function") {
            return customize(config, _, args) || config;
        }

        return config;
    };
}

module.exports = {
    createWebpackConfig,
    getBabelConfig,
};
