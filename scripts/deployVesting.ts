import { toNano } from '@ton/core';
import { Vesting } from '../build/Vesting/Vesting_Vesting';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const vesting = provider.open(await Vesting.fromInit({
        $$type: 'VestingInit',
        uid: 2025n,
        title: "Vesting Hero",
        owner: provider.sender().address ?? (() => { throw new Error("Sender address is undefined"); })()
    }));

    let startsAt = BigInt(Math.floor(Date.now() / 1000));
    let interval = 3600n;
    let cycles = 12n;
    let cliff = 600n;

    await vesting.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'SetVestingSchedule',
            startsAt,
            interval,
            cycles,
            cliff
        }
    );

    await provider.waitForDeploy(vesting.address);

    // run methods on `vesting`
}
