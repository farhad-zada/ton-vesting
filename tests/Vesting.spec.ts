import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Vesting } from '../build/Vesting/Vesting_Vesting';
import '@ton/test-utils';
import { Allocation } from '../build/Allocation/Allocation_Allocation';
import { Unknown } from '@tact-lang/compiler/dist/asm/logs/grammar';

describe('Vesting', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let vesting: SandboxContract<Vesting>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        vesting = blockchain.openContract(await Vesting.fromInit(
            {
                $$type: 'VestingInit',
                uid: 10000n,
                owner: deployer.address,
                title: "Nebula 4 Nous"
            }
        ));

        const deployResult = await vesting.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'SetVestingSchedule',
                startsAt: 1000000n,
                interval: 3600n,
                cycles: 30n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vesting.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
    });

    it("should set vesting schedule", async () => {
        let startsAt = BigInt(Math.floor(Date.now() / 1000));
        let interval = 3600n;
        let cycles = 12n;
        const res = await vesting.send(
            deployer.getSender(),
            {
                value: toNano('0.05')
            },
            {
                $$type: 'SetVestingSchedule',
                startsAt,
                interval,
                cycles,
            }
        );

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vesting.address,
            deploy: false,
            success: true,
        });

        expect(res.transactions).toHaveTransaction({
            from: deployer.address,
            to: vesting.address,
            deploy: false,
            success: true,
        });

        let vestingState = await vesting.getVestingState();
        expect(vestingState.schedule.startsAt).toEqual(startsAt)
        expect(vestingState.schedule.interval).toEqual(interval)
        expect(vestingState.schedule.cycles).toEqual(cycles)

    })

    it("should update vesting schedule after being set", async () => {
        let startsAt = BigInt(Math.floor(Date.now() / 1000));
        let interval = 3600n;
        let cycles = 12n;
        const resSet = await vesting.send(
            deployer.getSender(),
            {
                value: toNano('0.05')
            },
            {
                $$type: 'SetVestingSchedule',
                startsAt,
                interval,
                cycles,
            }
        );

        expect(resSet.transactions).toHaveTransaction({
            from: deployer.address,
            to: vesting.address,
            deploy: false,
            success: true,
        });

        expect(resSet.transactions).toHaveTransaction({
            from: deployer.address,
            to: vesting.address,
            deploy: false,
            success: true,
        });

        let vestingState = await vesting.getVestingState();
        expect(vestingState.schedule.startsAt).toEqual(startsAt)
        expect(vestingState.schedule.interval).toEqual(interval)
        expect(vestingState.schedule.cycles).toEqual(cycles)

        startsAt = startsAt + 1n;
        interval = interval + 1n;
        cycles = cycles + 1n;

        const resUpdate = await vesting.send(
            deployer.getSender(),
            {
                value: toNano('0.05')
            },
            {
                $$type: 'SetVestingSchedule',
                startsAt,
                interval,
                cycles,
            }
        );


        expect(resUpdate.transactions).toHaveTransaction({
            from: deployer.address,
            to: vesting.address,
            deploy: false,
            success: true,
        });

        expect(resUpdate.transactions).toHaveTransaction({
            from: deployer.address,
            to: vesting.address,
            deploy: false,
            success: true,
        });

        let updatedVestingState = await vesting.getVestingState();
        expect(updatedVestingState.schedule.startsAt).toEqual(startsAt)
        expect(updatedVestingState.schedule.interval).toEqual(interval)
        expect(updatedVestingState.schedule.cycles).toEqual(cycles)
    })

    it("should deploy allocation", async () => {
        let vested = (await blockchain.treasury("vested")).address;
        let amount = toNano("1000");
        let result = await vesting.send(
            deployer.getSender(),
            {
                value: toNano('0.05')
            },
            {
                $$type: 'Allocate',
                vested,
                amount
            }
        )
        let allocation = blockchain.openContract(await Allocation.fromInit({
            $$type: 'AllocationInit',
            'vesting': vesting.address,
            vested
        }));
        expect(result.transactions).toHaveTransaction({
            from: vesting.address,
            deploy: true,
            to: allocation.address,
            success: true
        })
        let allocationState = await allocation.getAllocationState();
        expect(allocationState.amount).toBe(amount);
        expect(allocationState.vested).toEqualAddress(vested);
        expect(allocationState.vesting).toEqualAddress(vesting.address)
    })


    it("should deploy allocation with custom schedule", async () => {
        let vested = (await blockchain.treasury("vested")).address;
        let amount = toNano("1000");
        let startsAt = BigInt(Math.floor(Date.now() / 1000)) - 100n;
        let interval = 10n;
        let cycles = 20n;
        let result = await vesting.send(
            deployer.getSender(),
            {
                value: toNano('0.05')
            },
            {
                $$type: 'AllocateWithCustomSchedule',
                vested,
                amount,
                schedule: {
                    $$type: 'VestingSchedule',
                    startsAt,
                    interval,
                    cycles
                }
            }
        )
        let allocation = blockchain.openContract(await Allocation.fromInit({
            $$type: 'AllocationInit',
            'vesting': vesting.address,
            vested
        }));
        expect(result.transactions).toHaveTransaction({
            from: vesting.address,
            deploy: true,
            to: allocation.address,
            success: true
        })
        let allocationState = await allocation.getAllocationState();
        expect(allocationState.amount).toBe(amount);
        expect(allocationState.vested).toEqualAddress(vested);
        expect(allocationState.vesting).toEqualAddress(vesting.address)
        expect(allocationState.schedule.startsAt).toBe(startsAt);
        expect(allocationState.schedule.interval).toBe(interval);
        expect(allocationState.schedule.cycles).toBe(cycles);
    })

    it("should unlock", async () => {
        let vested = (await blockchain.treasury("vested")).address;
        let amount = toNano("1000");
        let startsAt = BigInt(Math.floor(Date.now() / 1000)) - 100n;
        let interval = 10n;
        let cycles = 20n;
        let result = await vesting.send(
            deployer.getSender(),
            {
                value: toNano('0.05')
            },
            {
                $$type: 'AllocateWithCustomSchedule',
                vested,
                amount,
                schedule: {
                    $$type: 'VestingSchedule',
                    startsAt,
                    interval,
                    cycles
                }
            }
        )
        let allocation = blockchain.openContract(await Allocation.fromInit({
            $$type: 'AllocationInit',
            'vesting': vesting.address,
            vested
        }));
        expect(result.transactions).toHaveTransaction({
            from: vesting.address,
            deploy: true,
            to: allocation.address,
            success: true
        })
        let allocationState = await allocation.getAllocationState();
        expect(allocationState.amount).toBe(amount);
        expect(allocationState.unlocked).toBeGreaterThan(0n);
        expect(allocationState.unlocked).toBe(toNano("500"));
    })

    it.only("should find allocation address without deployment deterministically", async () => {
        let allocationBeforeDeployment = blockchain.openContract(await Allocation.fromInit({
            $$type: 'AllocationInit',
            vesting: vesting.address,
            vested: deployer.address
        }));

        let throwed = false;
        try {
            await allocationBeforeDeployment.getAllocationState();
        } catch (error) {
            throwed = true;
        }
        expect(throwed).toBe(true);

        let result = await vesting.send(
            deployer.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: 'Allocate',
                vested: deployer.address,
                amount: toNano("1000")
            }
        );

        expect(result.transactions).toHaveTransaction({
            from: vesting.address,
            to: allocationBeforeDeployment.address,
            deploy: true,
            success: true,
        });

         expect(result.transactions).toHaveTransaction({
            from: allocationBeforeDeployment.address,
            to: vesting.address,
            deploy: false,
            success: true,
        });

        let allocationState = await allocationBeforeDeployment.getAllocationState()
    })
});
