import webpack from "webpack"; // to access built-in plugins
import { merge } from 'webpack-merge';
import common from './webpack.common.js';

export default merge(common, {
   mode: 'development',
   devtool: 'source-map', //más liviano y rápido 
});


