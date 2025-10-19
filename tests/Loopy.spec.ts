import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Loopy } from '../build/Loopy/Loopy_Loopy';
import '@ton/test-utils';

describe('Loopy', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let loopy: SandboxContract<Loopy>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        loopy = blockchain.openContract(await Loopy.fromInit(deployer.address, 0n));

        const deployResult = await loopy.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: loopy.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and loopy are ready to use
    });

    it('should send 300 recursive messages', async () => {
        let recursion = 300n;
        let result = await loopy.send(
            deployer.getSender(),
            {
                value: toNano("50"),
            },
            {
                $$type: "Recursive",
                recursion
            }
        );
        let expectedMessageCount;
        let selfCalls = recursion / 253n;
        if (selfCalls * 253n < recursion) {
             selfCalls++;
        }
        expectedMessageCount = selfCalls + 1n + recursion;
        expect(result.transactions.length).toEqual(parseInt(expectedMessageCount.toString()));
        expect(result.transactions).toHaveTransaction(
            {
                from: deployer.address,
                to: loopy.address,
                success: true
            }
        );

        expect(result.transactions).toHaveTransaction(
            {
                from: loopy.address,
                to: deployer.address,
                success: true,
                op: Loopy.opcodes.OutgoingNotification
            }
        )
        let data = await loopy.getData();
        expect(data).toEqual(recursion);
    })
});
