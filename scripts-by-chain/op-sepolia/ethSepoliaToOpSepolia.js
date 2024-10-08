const tokenMessengerAbi = require('../../abis/cctp/TokenMessenger.json');
const messageTransmitterAbi = require('../../abis/cctp/MessageTransmitter.json');
const usdcAbi = require('../../abis/USDC.json');
const ethers = require('ethers');
require("dotenv").config();

const main = async () => {
    console.log("Starting cross-chain transfer...");

    // Set up signers + providers
    const ethSepoliaProvider = new ethers.providers.JsonRpcProvider(process.env.ETH_SEPOLIA_TESTNET_RPC);
    const opSepoliaProvider = new ethers.providers.JsonRpcProvider(process.env.OP_SEPOLIA_TESTNET_RPC);
    const ethSepoliaWallet = new ethers.Wallet(process.env.ETH_SEPOLIA_PRIVATE_KEY, ethSepoliaProvider);
    const opSepoliaWallet = new ethers.Wallet(process.env.OP_SEPOLIA_PRIVATE_KEY, opSepoliaProvider);

    // Testnet Contract Addresses
    const ETH_SEPOLIA_TOKEN_MESSENGER_CONTRACT_ADDRESS = process.env.ETH_SEPOLIA_TOKEN_MESSENGER_CONTRACT_ADDRESS;
    const USDC_ETH_SEPOLIA_CONTRACT_ADDRESS = process.env.USDC_ETH_SEPOLIA_CONTRACT_ADDRESS;
    const OP_SEPOLIA_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS = process.env.OP_SEPOLIA_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS;

    // initialize contracts using address and ABI
    const usdcEthSepoliaContract = new ethers.Contract(USDC_ETH_SEPOLIA_CONTRACT_ADDRESS, usdcAbi, ethSepoliaWallet);
    const ethSepoliaTokenMessengerContract = new ethers.Contract(ETH_SEPOLIA_TOKEN_MESSENGER_CONTRACT_ADDRESS, tokenMessengerAbi, ethSepoliaWallet)
    const opSepoliaMessageTransmitterContract = new ethers.Contract(OP_SEPOLIA_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS, messageTransmitterAbi, opSepoliaWallet);

    // OP Sepolia destination address
    const mintRecipient = process.env.RECIPIENT_ADDRESS; // does not have to be an EOA
    const destinationAddressInBytes32 = ethers.utils.hexZeroPad(mintRecipient, 32);
    const OP_SEPOLIA_DESTINATION_DOMAIN = 2;

    // Amount that will be transferred
    const amount = process.env.TRANSFER_AMOUNT;

    // STEP 1: Approve messenger contract to withdraw from our active eth address
    console.log("Approving USDC contract on source chain...")
    const approveTx = await usdcEthSepoliaContract.approve(ETH_SEPOLIA_TOKEN_MESSENGER_CONTRACT_ADDRESS, amount);
    await approveTx.wait();

    // STEP 2: Burn USDC
    console.log("Burning USDC on source chain...")
    const burnTx = await ethSepoliaTokenMessengerContract.depositForBurn(amount, OP_SEPOLIA_DESTINATION_DOMAIN, destinationAddressInBytes32, USDC_ETH_SEPOLIA_CONTRACT_ADDRESS);
    const burnTxReceipt = await burnTx.wait();

    // STEP 3: Retrieve message bytes from logs
    const eventTopic = ethers.utils.id('MessageSent(bytes)')
    const log = burnTxReceipt.logs.find((l) => l.topics[0] === eventTopic);

    let messageBytes, messageBytesHash;
    if (!log) {
        console.log("No MessageSent found!");
        return;
    } else {
        messageBytes = ethers.utils.defaultAbiCoder.decode(
            ['bytes'], log.data
        );
        messageBytesHash = ethers.utils.keccak256(messageBytes[0]);
    }

    // STEP 4: Fetch attestation signature
    console.log("Fetching attestation signature...");
    let attestationResponse = { status: 'pending' };
    while (attestationResponse.status != 'complete') {
        console.log("Checking for attestation...");
        const response = await fetch(`https://iris-api-sandbox.circle.com/attestations/${messageBytesHash}`);
        attestationResponse = await response.json();
        // check again every 5 seconds
        await new Promise(r => setTimeout(r, 5000));
    }

    const attestationSignature = attestationResponse.attestation;
    console.log(`Attestation Signature: ${attestationSignature}`)

    // STEP 5: Using the message bytes and signature receive the funds on destination chain and address
    console.log("Receiving funds on destination chain...")
    const receiveTx = await opSepoliaMessageTransmitterContract.receiveMessage(messageBytes[0], attestationSignature);
    const receiveTxReceipt = await receiveTx.wait();
    console.log("Funds received on destination chain!");
    console.log(`See tx details: https://sepolia-optimism.etherscan.io/tx/${receiveTxReceipt.transactionHash}`);
};

main();