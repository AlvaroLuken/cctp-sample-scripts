## Simple Cross-Chain Transfer of USDC using CCTP

This script (`index.js`) sets up a cross-chain transfer with the following specs:

1. **Source chain**: Ethereum Sepolia
2. **Destination chain**: Arbitrum Sepolia

⚠️ NOTE: This script uses [ethers.js (v5.7)](https://docs.ethers.org/v5/).

CCTP contract addresses for mainnet and testnet can be found [here](https://developers.circle.com/stablecoins/docs/evm-smart-contracts).

## Check out the `/scripts-by-chain` folder to see scripts to/from other chains

## Quick Setup

1. Clone this repo (star it if you like it!)
2. Create a `.env` file in the root of the project
3. Use the `.env.example` to populate your `.env` file
4. For `TRANSFER_AMOUNT`, fill in `10000000` in order to transfer 10 USDC
5. Remember to fund your wallets with ETH on both the source AND destination chain for this script to work!
6. Once everything is set up, run `node index` and your cross-chain transfer will begin! 🏄‍♂️

Questions? [Join our Discord](https://discord.gg/buildoncircle)!