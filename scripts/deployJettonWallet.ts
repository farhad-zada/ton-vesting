import { toNano } from '@ton/core';
import { JettonWallet } from '../build/JettonWallet/JettonWallet_JettonWallet';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const jettonWallet = provider.open(await JettonWallet.fromInit());

    await jettonWallet.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        null,
    );

    await provider.waitForDeploy(jettonWallet.address);

    // run methods on `jettonWallet`
}
