require("dotenv").config();
const solanaWeb3 = require("@solana/web3.js");
const splToken = require('@solana/spl-token');
const bs58 = require('bs58');
const ethers = require('ethers');
const BufferLayout = require('@solana/buffer-layout');

const main = async () => {
    let connection = new solanaWeb3.Connection(process.env.SOLANA_DEVNET_RPC);

    const base58PrivateKey = process.env.SOLANA_DEVNET_PK;
    const decodedPrivateKey = bs58.decode(base58PrivateKey);
    const userWallet = solanaWeb3.Keypair.fromSecretKey(decodedPrivateKey);

    const solanaDevnetMessageTransmitterProgramId = new solanaWeb3.PublicKey(process.env.SOLANA_DEVNET_MESSAGE_TRANSMITTER);

    const usdcTokenMintAddress = new solanaWeb3.PublicKey(process.env.SOLANA_DEVNET_USDC_ADDRESS);
    const senderTokenAccountAddress = await splToken.getAssociatedTokenAddress(
        usdcTokenMintAddress,
        userWallet.publicKey
    );

    // send 10 USDC
    const amount = 10 * 1e6;
    const destinationAddressInBytes32 = ethers.getBytes(ethers.zeroPadBytes((process.env.MINT_RECIPIENT_HEX), 32));

    const seed = "hello123";
    const [pda, _bump] = await solanaWeb3.PublicKey.findProgramAddressSync(
        [Buffer.from(seed)],
        solanaDevnetMessageTransmitterProgramId
    );

    const DataLayout = BufferLayout.struct([
        BufferLayout.u32('amount'),
        BufferLayout.u32('destinationDomain'),
        BufferLayout.blob(32, 'mintRecipient')
    ]);

    const data = Buffer.alloc(DataLayout.span);
    DataLayout.encode({
        amount: amount,
        destinationDomain: parseInt(process.env.DESTINATION_DOMAIN),
        mintRecipient: destinationAddressInBytes32
    }, data);

    const instruction = new solanaWeb3.TransactionInstruction({
        keys: [
            { pubkey: userWallet.publicKey, isSigner: true, isWritable: false },
            { pubkey: senderTokenAccountAddress, isSigner: false, isWritable: true },
            { pubkey: pda, isSigner: false, isWritable: true },
        ],
        programId: solanaDevnetMessageTransmitterProgramId,
        data: data,
    });

    const transaction = new solanaWeb3.Transaction().add(instruction);
    const signature = await solanaWeb3.sendAndConfirmRawTransaction(
        connection,
        transaction,
        [userWallet]
    );

    console.log(signature);
}

main();