import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { Allocation, storeJettonTransferNotification } from '../build/Allocation/Allocation_Allocation';
import '@ton/test-utils';
import { storeClaim } from '../build/Vesting/Vesting_Vesting';

describe('Allocation', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let allocation: SandboxContract<Allocation>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');

        allocation = blockchain.openContract(await Allocation.fromInit(
            {
                $$type: 'AllocationInit',
                vesting: deployer.address,
                vested: deployer.address
            }
        ));

        let startsAt = BigInt(Math.floor(Date.now() / 1000)) - 100n;
        let interval = 10n;
        let cycles = 20n;

        const deployResult = await allocation.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'DeployAllocation',
                jettonWallet: deployer.address,
                startsAt,
                interval,
                cycles,
            },
        );

        await allocation.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'JettonTransferNotification',
                sender: deployer.address,
                queryId: 0n,
                amount: toNano("1000"),
                forwardPayload: beginCell().asSlice(),
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: allocation.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and allocation are ready to use
        let allocationState = await allocation.getAllocationState();
        expect(allocationState.claimable).toBeGreaterThan(0n);
    });

    it('should claim', async () => {
        let allocationStateBeforeClaim = await allocation.getAllocationState();
        expect(allocationStateBeforeClaim.claimable).toBeGreaterThan(0n);
        expect(allocationStateBeforeClaim.claimed).toBe(0n);
        let result = await allocation.send(
            deployer.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: 'Claim',
                receiver: null
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: allocation.address,
            body: beginCell().store(storeClaim({
                $$type: 'Claim',
                receiver: null
            })).endCell(),
            deploy: false,
            success: true
        });

        let allocationStateAfterClaim = await allocation.getAllocationState();
        expect(allocationStateAfterClaim.claimable).toBe(0n);
        expect(allocationStateAfterClaim.claimed).toBeGreaterThan(0n);
    });

    it('should claim with a receiver', async () => {
        let allocationStateBeforeClaim = await allocation.getAllocationState();
        expect(allocationStateBeforeClaim.claimable).toBeGreaterThan(0n);
        expect(allocationStateBeforeClaim.claimed).toBe(0n);
        let receiver = await blockchain.treasury('receiver');
        let result = await allocation.send(
            deployer.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: 'Claim',
                receiver: receiver.address,
            }
        );
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: allocation.address,
            body: beginCell().store(storeClaim({
                $$type: 'Claim',
                receiver: receiver.address,
            })).endCell(),
            deploy: false,
            success: true
        });

        let allocationStateAfterClaim = await allocation.getAllocationState();
        expect(allocationStateAfterClaim.claimable).toBe(0n);
        expect(allocationStateAfterClaim.claimed).toBeGreaterThan(0n);
    });

    it('should claim with a null receiver', async () => {
        let allocationStateBeforeClaim = await allocation.getAllocationState();
        expect(allocationStateBeforeClaim.claimable).toBeGreaterThan(0n);
        expect(allocationStateBeforeClaim.claimed).toBe(0n);
        let receiver = await blockchain.treasury('receiver');
        let result = await allocation.send(
            deployer.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: 'Claim',
                receiver: null,
            }
        );
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: allocation.address,
            body: beginCell().store(storeClaim({
                $$type: 'Claim',
                receiver: null,
            })).endCell(),
            deploy: false,
            success: true
        });

        let allocationStateAfterClaim = await allocation.getAllocationState();
        expect(allocationStateAfterClaim.claimable).toBe(0n);
        expect(allocationStateAfterClaim.claimed).toBeGreaterThan(0n);
    });

    it('should receive jetton transfer notification', async () => {
        let trxResult = await allocation.send(
            deployer.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: "JettonTransferNotification",
                queryId: 0n,
                amount: 250n,
                sender: deployer.address,
                forwardPayload: beginCell().asSlice()
            }
        )

        expect(trxResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: allocation.address,
            success: true,
        });
    })

    it("should set amount on jetton transfer notification", async () => {
        let allocationStateBefore = await allocation.getAllocationState();
        expect(allocationStateBefore.amount).toBe(toNano("1000"));
        let amount = 100000n;
        let trxResult = await allocation.send(
            deployer.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: "JettonTransferNotification",
                queryId: 0n,
                amount,
                sender: deployer.address,
                forwardPayload: beginCell().asSlice()
            }
        )

        expect(trxResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: allocation.address,
            success: true,
            body: beginCell().store(storeJettonTransferNotification({
                $$type: "JettonTransferNotification",
                queryId: 0n,
                amount,
                sender: deployer.address,
                forwardPayload: beginCell().asSlice()
            })).endCell(),
        });

        let allocationState = await allocation.getAllocationState();
        expect(allocationState.amount).toBe(toNano("1000") + amount);
    })
});
