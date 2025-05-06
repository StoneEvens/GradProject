import path from 'path';
import webpack from 'webpack';

export default {
  entry: './src/components/index.jsx',
  output: {
    path: path.resolve('./static/login'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/, // Rule for CSS files
        use: ['style-loader', 'css-loader'], // Loaders for CSS
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/, // Rule for image files
        type: 'asset/resource', // Use Webpack's asset modules for images
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  optimization: {
    minimize: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
      },
    }),
  ],
};