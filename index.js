'use strict';

var fs = require("fs")
var path = require('path')
var loaderUtils = require('loader-utils');
var nimCompiler = require('./node-nim-compiler');
var yargs = require('yargs');

var runningInstances = 0;
var alreadyCompiledFiles = [];

var defaultOptions = {
  cache: false,
  forceWatch: false,
  optimize: false
};

var getFiles = function(options) {
  var basepath = path.dirname(this.resourcePath);
  var files = options && options.files;

  if (files === undefined) return [this.resourcePath];

  if (!Array.isArray(files)) {
    throw new Error('files option must be an array');
  }

  if (files.length === 0) {
    throw new Error("You specified the 'files' option but didn't list any files");
  }

  delete options.files;
  return files;
};

var getOptions = function() {
  var globalOptions = this.options
    ? this.options.nim || {}
    : this.query.nim || {};
  var loaderOptions = loaderUtils.getOptions(this) || {};
  return Object.assign({}, defaultOptions, globalOptions, loaderOptions);
};

var isFlagSet = function(args, flag) {
  return typeof args[flag] !== "undefined" && args[flag];
};

/* Figures out if webpack has been run in watch mode
    This currently means either that the `watch` command was used
    Or it was run via `webpack-dev-server`
*/
var isInWatchMode = function(){
  // parse the argv given to run this webpack instance
  var argv = yargs(process.argv)
      .alias('w', 'watch')
      .alias('stdin', 'watch-stdin')
      .argv;

  var hasWatchArg = isFlagSet(argv, 'watch');
  var hasStdinArg = isFlagSet(argv, 'watch-stdin');

  var hasWebpackServe = Array.prototype.filter.call(process.argv, function (arg) {
    return arg.indexOf('webpack-serve') !== -1;
  }).length > 0;

  var hasWebpackDevServer = Array.prototype.filter.call(process.argv, function (arg) {
    return arg.indexOf('webpack-dev-server') !== -1;
  }).length > 0;


  return hasWebpackServe || hasWebpackDevServer || hasWatchArg || hasStdinArg;
};

/* Takes a working dir, tries to read nim.json, then grabs all the modules from in there
*/
var filesToWatch = function(cwd){
  var readFile = fs.readFileSync(path.join(cwd, "nim.json"), 'utf8');
  var nimPackage = JSON.parse(readFile);

  var paths = nimPackage["source-directories"].map(function(dir){
    return path.join(cwd, dir);
  });

  return paths;
};


module.exports = function() {
  this.cacheable && this.cacheable();

  var callback = this.async();
  if (!callback) {
    throw 'nim-webpack-loader currently only supports async mode.';
  }

  var emitError = this.emitError.bind(this);

  var options = getOptions.call(this);
  var files = getFiles.call(this, options);
  var resourcePath = this.resourcePath;

  var promises = [];

  // we only need to track deps if we are in watch mode
  // otherwise, we trust nim to do it's job
  if (options.forceWatch || isInWatchMode()){
    // we can do a glob to track deps we care about if cwd is set
    if (typeof options.cwd !== "undefined" && options.cwd !== null){
      var dirs = filesToWatch(options.cwd);
    }
  }

  delete options.forceWatch

  var maxInstances = options.maxInstances;

  if (typeof maxInstances === "undefined"){
    maxInstances = 1;
  } else {
    delete options.maxInstances;
  }

  var intervalId = setInterval(function(){
    if (runningInstances >= maxInstances) return;
    runningInstances += 1;
    clearInterval(intervalId);

    // If we are running in watch mode, and we have previously compiled
    // the current file, then let the user know that `nim make` is running
    // and can be slow
    if (alreadyCompiledFiles.indexOf(resourcePath) > -1){
      console.log('Started compiling nim..');
    }

    var compilation = nimCompiler.compileToString(files, options)
      .then(function(v) { runningInstances -= 1; return { kind: 'success', result: v }; })
      .catch(function(v) { runningInstances -= 1; return { kind: 'error', error: v }; });

    promises.push(compilation);

    Promise.all(promises)
      .then(function(results) {
        var output = results[results.length - 1]; // compilation output is always last

        if (output.kind === 'success') {
          alreadyCompiledFiles.push(resourcePath);
          callback(null, output.result);
        } else {
          if (typeof output.error === 'string') {
            output.error = new Error(output.error);
          }

          output.error.message = 'Compiler process exited with error ' + output.error.message;
          callback(output.error);
        }
      }).catch(function(err){
        callback(err);
      });

  }, 200);
}


// HELPERS

function flatten(arrayOfArrays) {
  return arrayOfArrays.reduce(function(flattened, array) {
    return flattened.concat(array)
  }, []);
}

function unique(items) {
  return items.filter(function(item, index, array) {
    return array.indexOf(item) === index;
  });
}

function remove(condemned, items) {
  return items.filter(function(item) {
    return item !== condemned;
  });
}
