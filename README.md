# Nim webpack loader

[Webpack](https://webpack.js.org/) loader for the [Nim](http://nim-lang.org/) programming language.

Checkout [Jetpack](https://github.com/NoRedInk/jetpack) as an alternative to Webpack!

## Installation

```sh
$ npm install --save nim-webpack-loader
# ...
```

## Usage

Documentation: [rules](https://webpack.js.org/configuration/module/#rule)

`webpack.config.js`:

```js
module.exports = {
  module: {
    rules: [{
      test: /\.nim$/,
      exclude: [/nim-stuff/, /node_modules/],
      use: {
        loader: 'nim-webpack-loader',
        options: {}
      }
    }]
  }
};
```

See the [examples](#example) section below for the complete webpack configuration.

### Options

#### maxInstances (default 1)

You can add `maxInstances=8` to the loader:

```js
  ...
  use: {
    loader: 'nim-webpack-loader',
    options: {
      maxInstances: 8
    }
  }
  ...
```

Set a limit to the number of maxInstances of nim that can spawned. This should be set to a number
less than the number of cores your machine has. The ideal number is 1, as it will prevent nim
instances causing deadlocks.

### 1.0.0

Initial experimental release.
