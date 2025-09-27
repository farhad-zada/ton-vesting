import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import { JettonMinter } from '../build/JettonMinter/JettonMinter_JettonMinter';
import { JettonWallet } from '../build/JettonWallet/JettonWallet_JettonWallet';
import '@ton/test-utils';

describe('JettonMinter', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let jettonMinter: SandboxContract<JettonMinter>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        jettonMinter = blockchain.openContract(await JettonMinter.fromInit(
            0n,
            deployer.address,
            beginCell().endCell(),
            true

        ));

        const deployResult = await jettonMinter.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            null

        );
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and jettonMinter are ready to use
        let jettonData = await jettonMinter.getGetJettonData();
        expect(jettonData.totalSupply).toBe(0n);
    });

    it('should mint jettons', async () => {

        let jettonWalletAddress = await jettonMinter.getGetWalletAddress(deployer.address);
        let jettonWallet = blockchain.openContract(JettonWallet.fromAddress(jettonWalletAddress));


        let mintResult = await jettonMinter.send(
            deployer.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: 'Mint',
                queryId: 0n,
                tonAmount: 0n,
                receiver: deployer.address,
                mintMessage: {
                    $$type: 'JettonTransferInternal',
                    queryId: 1n,
                    amount: toNano("1289"),
                    sender: deployer.address,
                    responseDestination: deployer.address,
                    forwardTonAmount: 1n,
                    forwardPayload: beginCell().storeUint(0, 1).asSlice(),
                },
            }
        );

        expect(mintResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: false,
            success: true,
        });

        expect(mintResult.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: jettonWalletAddress,
            deploy: true,
            success: true,
        });

        let jettonData = await jettonMinter.getGetJettonData();
        let jettonWalletData = await jettonWallet.getGetWalletData();
        expect(jettonData.totalSupply).toBe(jettonWalletData.balance);
        expect(jettonData.totalSupply).toBe(toNano("1289"))
    })
});
