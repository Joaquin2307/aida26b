import path from "node:path";
import { fileURLToPath } from "node:url";
import HtmlWebpackPlugin from "html-webpack-plugin";
import webpack from "webpack"; // to access built-in plugins
import { merge } from 'webpack-merge';
import common from './webpack.common.js';

export default merge(common, {
  mode: "development",
  plugins: [new HtmlWebpackPlugin({ template: "./index.html", title: 'Development mode' })], //Cambio título para darme cuenta que estamos en ese modo
  devtool: 'eval-source-map', //En modo development queremos que podamos ver el código en el browser así usamos las dev tools para ayudarnos si es necesario debugging
  devServer: {
    port: 8080,
    hot: true,
    historyApiFallback: true,
    
    proxy: [
      { context: ["/api"],
        target: 'http://localhost:3000'
      }
    ]
  }
});