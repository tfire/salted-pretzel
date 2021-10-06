const ethers = require('ethers');
const fb = require('@flashbots/ethers-provider-bundle');

const FLASHBOTS_ENDPOINT = "https://relay.flashbots.net";

async function withdraw() {
    const provider = new ethers.providers.IpcProvider("/Users/yourname/Library/Ethereum/geth.ipc");
    const flashbotsProvider = await fb.FlashbotsBundleProvider.create(provider, ethers.Wallet.createRandom(), FLASHBOTS_ENDPOINT);

    const master_mainnet = "0x00";
    const master_abi = [
        "function attack(address permissionContract, address mintingContract, uint256 permissionTokenId, uint256 collectionId, uint256 parentTimestamp, uint256[] memory diffs, bytes32[] memory salts, address[] memory addrs) public",
        "function withdraw(address erc721, uint256 tokenId) public",
        "function onERC721Received(address operator, address from, uint256 tokenId, bytes memory data) public returns (bytes4)"
    ];

    const master_ct = new ethers.Contract(master_mainnet, master_abi, provider);
    const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
    const feeData = await provider.getFeeData();

    try {
        const transaction = await master_ct.populateTransaction.withdraw(
            "0x00", // NFT Contract
            0, // NFT ID
            {
                gasPrice: feeData.maxFeePerGas,
                gasLimit: 100000,
            }
        );

        const bundle = [
            {
                transaction: transaction,
                signer: wallet,
            }
        ];

        const bundleSubmitResponse = await flashbotsProvider.sendBundle(
            bundle, await provider.getBlockNumber() + 1
        )

        if ('error' in bundleSubmitResponse) {
            console.log(bundleSubmitResponse.error.message);
            return;
        }
        
        const sim = await bundleSubmitResponse.simulate();
        console.log(sim);
    } catch (e) {
        console.log(e);
    }
}

withdraw();