import { strict as assert } from 'assert';
import {Block} from "@ethersproject/abstract-provider";

const expDiffPeriod = 100000n;
const DifficultyBoundDivisor = 2048n;   // The bound divisor of the difficulty, used in the update calculations.
const MinimumDifficulty = 131072n; // The minimum that the difficulty may ever be.

export type BlockWithUnclesAndBigIntDifficulty = Block & {
    uncles: string[];
    difficulty: bigint;
}

// makeDifficultyCalculator creates a difficultyCalculator with the given bomb-delay.
// the difficulty is calculated with Byzantium rules, which differs from Homestead in
// how uncles affect the calculation
function makeDifficultyCalculator(bombDelay: bigint) {
    // Note, the calculations below looks at the parent number, which is 1 below
    // the block number. Thus we remove one from the delay given
    const bombDelayFromParent = bombDelay - 1n;
    return function (time: number, parent: BlockWithUnclesAndBigIntDifficulty) {
        // https://github.com/ethereum/EIPs/issues/100.
        // algorithm:
        // diff = (parent_diff +
        //         (parent_diff / 2048 * max((2 if len(parent.uncles) else 1) - ((timestamp - parent.timestamp) // 9), -99))
        //        ) + 2^(periodCount - 2)

        const bigTime = BigInt(time);
        const bigParentTime = BigInt(parent.timestamp);

        // holds intermediate values to make the algo easier to read & audit
        let x = 0n;
        let y = 0n;

        // (2 if len(parent_uncles) else 1) - (block_timestamp - parent_timestamp) // 9
        x = bigTime - bigParentTime;
        x = x / 9n;
        if (parent.uncles.length === 0) {
            x = 1n - x;
        } else {
            x = 2n - x;
        }
        // max((2 if len(parent_uncles) else 1) - (block_timestamp - parent_timestamp) // 9, -99)
        if (x < -99n) {
            x = -99n;
        }
        // parent_diff + (parent_diff / 2048 * max((2 if len(parent.uncles) else 1) - ((timestamp - parent.timestamp) // 9), -99))
        y = parent.difficulty / DifficultyBoundDivisor;
        x = y * x;
        x = parent.difficulty + x;

        // minimum difficulty can ever be (before exponential factor)
        if (x < MinimumDifficulty) {
            x = MinimumDifficulty;
        }
        // calculate a fake block number for the ice-age delay
        // Specification: https://eips.ethereum.org/EIPS/eip-1234
        let fakeBlockNumber = 0n;
        if (BigInt(parent.number) >= bombDelayFromParent) {
            fakeBlockNumber = BigInt(parent.number) - bombDelayFromParent;
        }
        // for the exponential factor
        let periodCount = fakeBlockNumber / expDiffPeriod;

        // the exponential factor, commonly referred to as "the bomb"
        // diff = diff + 2^(periodCount - 2)
        if (periodCount > 1n) {
            y = periodCount - 2n;
            y = 2n ** y;
            x = x + y;
        }
        return x;
    }
}

// calcDifficultyEip3554 is the difficulty adjustment algorithm as specified by EIP 3554.
// It offsets the bomb a total of 9.7M blocks.
// Specification EIP-3554: https://eips.ethereum.org/EIPS/eip-3554
const calcDifficultyEip3554 = makeDifficultyCalculator(9700000n);


const MainnetLondonBlock = 12_965_000n;
function isLondon(blockNumber: number) {
    return blockNumber >= MainnetLondonBlock;
}

function calcDifficulty(time: number, parent: BlockWithUnclesAndBigIntDifficulty): bigint {
    const next = parent.number + 1;
    assert(isLondon(next));
    return calcDifficultyEip3554(time, parent);
}

module.exports = {calcDifficulty};