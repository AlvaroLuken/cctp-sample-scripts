const tokenMessengerAbi = require('../../abis/cctp/TokenMessenger.json');
const messageTransmitterAbi = require('../../abis/cctp/MessageTransmitter.json');
const usdcAbi = require('../../abis/USDC.json');
const ethers = require('ethers');
require("dotenv").config();

const main = async () => {
    console.log("Starting cross-chain transfer...")

    // Set up signers + providers
    const ethSepoliaProvider = new ethers.providers.JsonRpcProvider(process.env.ETH_SEPOLIA_TESTNET_RPC);
    const polygonAmoyProvider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_AMOY_TESTNET_RPC);
    const ethSepoliaWallet = new ethers.Wallet(process.env.ETH_SEPOLIA_PRIVATE_KEY, ethSepoliaProvider);
    const polygonAmoyWallet = new ethers.Wallet(process.env.POLYGON_AMOY_PRIVATE_KEY, polygonAmoyProvider);

    // Testnet Contract Addresses
    const POLYGON_AMOY_TOKEN_MESSENGER_CONTRACT_ADDRESS = process.env.POLYGON_AMOY_TOKEN_MESSENGER_CONTRACT_ADDRESS;
    const ETH_SEPOLIA_USDC_CONTRACT_ADDRESS = process.env.ETH_SEPOLIA_USDC_CONTRACT_ADDRESS;
    const POLYGON_AMOY_USDC_CONTRACT_ADDRESS = process.env.POLYGON_AMOY_USDC_CONTRACT_ADDRESS;
    const POLYGON_AMOY_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS = process.env.POLYGON_AMOY_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS;

    // initialize contracts using address and ABI
    const polygonAmoyUsdcContract = new ethers.Contract(POLYGON_AMOY_USDC_CONTRACT_ADDRESS, usdcAbi, polygonAmoyWallet);
    const polygonAmoyTokenMessengerContract = new ethers.Contract(POLYGON_AMOY_TOKEN_MESSENGER_CONTRACT_ADDRESS, tokenMessengerAbi, polygonAmoyWallet);
    const polygonAmoyMessageTransmitterContract = new ethers.Contract(POLYGON_AMOY_MESSAGE_TRANSMITTER_CONTRACT_ADDRESS, messageTransmitterAbi, polygonAmoyWallet);
    //

    // Polygon Amoy destination address
    const mintRecipient = process.env.RECIPIENT_ADDRESS; // does not have to be an EOA
    const destinationAddressInBytes32 = ethers.utils.hexZeroPad(mintRecipient, 32);
    const POLYGON_AMOY_DESTINATION_DOMAIN = process.env.POLYGON_AMOY_DESTINATION_DOMAIN;

    // Amount that will be transferred
    const amount = process.env.TRANSFER_AMOUNT;

    // STEP 1: Approve messenger contract to withdraw from our active eth address
    console.log("Approving USDC contract on source chain...")
    const approveTx = await usdcEthSepoliaContract.approve(ETH_SEPOLIA_TOKEN_MESSENGER_CONTRACT_ADDRESS, amount);
    await approveTx.wait();

    // STEP 2: Burn USDC
    console.log("Burning USDC on source chain...")
    const burnTx = await ethSepoliaTokenMessengerContract.depositForBurn(amount, POLYGON_AMOY_DESTINATION_DOMAIN, destinationAddressInBytes32, ETH_SEPOLIA_USDC_CONTRACT_ADDRESS);
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
    const receiveTx = await polygonAmoyMessageTransmitterContract.receiveMessage(messageBytes[0], attestationSignature);
    const receiveTxReceipt = await receiveTx.wait();
    console.log("Funds received on destination chain!");
    console.log(`See tx details: https://amoy.polygonscan.com/tx/${receiveTxReceipt.transactionHash}`);
};

main();