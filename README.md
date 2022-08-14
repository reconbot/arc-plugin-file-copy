# arc-plugin-file-copy

Copy files into your functions. Works for sandbox and built functions.

> [Arc serverless framework](https://arc.codes) plugin for compiling your functions with ESBuild Bundler

## Install

```bash
npm i --save-dev arc-plugin-file-copy
```

## Usage

After installing add `@plugins` and `@file-copy` pragmas to your `app.arc` file:

`app.arc`

```arc
@app
myapp

@file-copy
config/config.json config.json

@http
get /

@plugins
arc-plugin-file-copy
```

File listing;

```sh
myapp/app.arc
myapp/config.json
myapp/package.json
myapp/tsconfig.json
myapp/src/http/get-index/index.js
```

When running sandbox your functions will be able to find your file symlinked, when deploying the symlinks will be shipped as files. Since these are symbolic links file changes are immediate, however changes to your app.arc won't be picked up without a restart.

```sh
myapp/src/http/get-index/config.json
```

Copy as many files as you like, directories, and give them any new path.

```arc
@file-copy
config/settings.json config.json
config fullconfig
data.csv data/root.csv

```

### Options

The options are simply source and destination. Both are required.

The source is relative to the .arc file. The destination is relative to the function directory. The target directory structure will be created and a symlink will be created. While the sandbox symlinks will be cleaned up, target directories will not be removed as it is generally not safe.
