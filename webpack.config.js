const path = require('path');

module.exports = {
    mode: 'production',
    entry: {
        'minisync': './src/minisync.ts',
    },
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: '[name].js',
        library: 'MiniSync',
        libraryTarget: 'umd',
        umdNamedDefine: true,
        path: path.resolve(__dirname, 'dist', 'umd'),
    },
    optimization: {
        minimize: false
    }
};