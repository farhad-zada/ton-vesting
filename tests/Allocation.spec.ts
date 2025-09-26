import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { Allocation } from '../build/Allocation/Allocation_Allocation';
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

        let amount = toNano("1000");
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
                amount,
                startsAt,
                interval,
                cycles,
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
});
