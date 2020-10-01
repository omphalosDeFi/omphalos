# Omphalos

[![Build Status](https://travis-ci.com/omphalosDeFi/omphalos.svg?branch=master)](https://travis-ci.com/omphalosDeFi/omphalos.svg?branch=master)&nbsp;&nbsp;[![Coverage Status](https://coveralls.io/repos/github/frgprotocol/omphalos/badge.svg?branch=master&t=GiWi8p)](https://coveralls.io/github/frgprotocol/omphalos?branch=master)

Omphalos is a decentralized elastic supply protocol. It maintains a stable unit price by adjusting supply directly to and from wallet holders. You can read the [whitepaper](https://omphalos.co/wp-content/uploads/2020/09/Omphalos_lightpaper_9212020_v1.0.pdf) for the motivation and a complete description of the protocol.

This repository is a collection of [smart contracts](http://omphalos.co/) that implement the Omphalos protocol on the Ethereum blockchain.

## Table of Contents

- [Omphalos](#omphalos)
  - [Table of Contents](#table-of-contents)
  - [Install](#install)
  - [Testing](#testing)
  - [Testnets](#testnets)
  - [Contribute](#contribute)
  - [License](#license)


## Install

```bash
# Install project dependencies
npm install

# Install ethereum local blockchain(s) and associated dependencies
npx setup-local-chains
```

## Testing

``` bash
# You can use the following command to start a local blockchain instance
npx start-chain [ganacheUnitTest|gethUnitTest]

# Run all unit tests
npm test

# Run unit tests in isolation
npx truffle --network ganacheUnitTest test test/unit/omphalos.js
```

## Contribute

To report bugs within this package, create an issue in this reposito
For security issues, please contact hello@omphalos.co.
When submitting code ensure that it is free of lint errors and has 100% test coverage.

``` bash
# Lint code
npm run lint

# View code coverage
npm run coverage
```

## License

[GNU General Public License v3.0 (c) 2018 Fragments, Inc.](./LICENSE)
