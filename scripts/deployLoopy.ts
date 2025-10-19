import { toNano } from '@ton/core';
import { Loopy } from '../build/Loopy/Loopy_Loopy';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const loopy = provider.open(await Loopy.fromInit());

    await loopy.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        null,
    );

    await provider.waitForDeploy(loopy.address);

    // run methods on `loopy`
}
