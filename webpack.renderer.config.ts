import type { Configuration } from "webpack";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

// Rule for global CSS files (excluding CSS Modules)
rules.push({
  test: /\.css$/,
  exclude: /\.module\.css$/, // Exclude .module.css
  use: [{ loader: "style-loader" }, { loader: "css-loader" }],
});

// Rule for CSS Modules (files ending in .module.css)
rules.push({
  test: /\.module\.css$/,
  use: [
    { loader: "style-loader" },
    {
      loader: "css-loader",
      options: {
        modules: true, // Enable CSS Modules
        // Optional: configure localIdentName for easier debugging
        // modules: {
        //   localIdentName: '[name]__[local]__[hash:base64:5]',
        // },
      },
    },
  ],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css"],
  },
};
