import { toNano } from '@ton/core';
import { Allocation } from '../build/Allocation/Allocation_Allocation';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const allocation = provider.open(await Allocation.fromInit());

    await allocation.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        null,
    );

    await provider.waitForDeploy(allocation.address);

    // run methods on `allocation`
}
