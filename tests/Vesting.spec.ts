import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano, Cell, safeSignVerify, Slice, Message, Address } from '@ton/core';
import { Vesting } from '../build/Vesting/Vesting_Vesting';
import '@ton/test-utils';
import { Allocation } from '../build/Allocation/Allocation_Allocation';
import { JettonMinter } from '../build/JettonMinter/JettonMinter_JettonMinter';
import { JettonWallet } from '../build/JettonMinter/JettonMinter_JettonWallet';
import { randomUUID } from 'crypto';


describe.only('Vesting', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let jettonOwner: SandboxContract<TreasuryContract>;
    let vesting: SandboxContract<Vesting>;
    let jettonMinter: SandboxContract<JettonMinter>;
    let jettonWalletDeployer: SandboxContract<JettonWallet>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        // let's first deploy the Jetton & transfer some to the deployer/owner of vesting
        jettonOwner = await blockchain.treasury("jetton-owner");
        jettonMinter = blockchain.openContract(await JettonMinter.fromInit(0n, jettonOwner.address, new Cell(), true));
        let jettonMintResult = await jettonMinter.send(
            jettonOwner.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: 'Mint',
                queryId: 1000n,
                receiver: deployer.address,
                tonAmount: 0n,
                mintMessage: {
                    $$type: 'JettonTransferInternal',
                    queryId: 1000n,
                    amount: toNano("2000"),
                    sender: jettonOwner.address,
                    responseDestination: deployer.address,
                    forwardPayload: beginCell().storeBit(false).asSlice(),
                    forwardTonAmount: toNano("0.005"),
                }
            }
        );

        expect(jettonMintResult.transactions).toHaveTransaction({
            from: jettonOwner.address,
            to: jettonMinter.address,
            deploy: true,
            success: true,
            op: JettonMinter.opcodes.Mint
        });

        expect(jettonMintResult.transactions).toHaveTransaction({
            from: jettonMinter.address,
            to: await jettonMinter.getGetWalletAddress(deployer.address),
            deploy: true,
            success: true,
            op: JettonMinter.opcodes.JettonTransferInternal
        });

        expect(jettonMintResult.transactions).toHaveTransaction({
            from: await jettonMinter.getGetWalletAddress(deployer.address),
            to: deployer.address,
            deploy: false,
            success: true,
            op: JettonMinter.opcodes.JettonNotification
        });

        expect(jettonMintResult.transactions).toHaveTransaction({
            from: await jettonMinter.getGetWalletAddress(deployer.address),
            to: deployer.address,
            deploy: false,
            success: true,
            op: JettonMinter.opcodes.JettonExcesses
        });

        jettonWalletDeployer = blockchain.openContract(JettonWallet.fromAddress(await jettonMinter.getGetWalletAddress(deployer.address)));

        ///// VESTING /////
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
                value: toNano('0.055'),
            },
            {
                $$type: 'VestingSetup',
                startsAt: 1000000n,
                interval: 3600n,
                cycles: 30n,
                jettonWallet: await jettonMinter.getGetWalletAddress(vesting.address)
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: vesting.address,
            deploy: true,
            success: true,
        });

        let vestingState = await vesting.getVestingState();
        expect(vestingState.jettonWallet).toEqualAddress(await jettonMinter.getGetWalletAddress(vesting.address));
    });

    // done in before each
    it('should deploy', async () => {
    });

    it("should top up vesting jetton balance", async () => {
        let result = await jettonWalletDeployer.send(
            deployer.getSender(),
            {
                value: toNano("0.09")
            }, {
            $$type: 'JettonTransfer',
            queryId: 2001n,
            amount: toNano("20"),
            destination: vesting.address,
            responseDestination: deployer.address,
            customPayload: null,
            forwardTonAmount: toNano("0.005"),
            forwardPayload: beginCell().storeBit(false).asSlice()
        }
        );

        let vestinJettonWallet = await jettonMinter.getGetWalletAddress(vesting.address);
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonWalletDeployer.address,
            success: true,
            op: JettonWallet.opcodes.JettonTransfer
        });

        expect(result.transactions).toHaveTransaction({
            from: jettonWalletDeployer.address,
            to: vestinJettonWallet,
            success: true,
            op: JettonWallet.opcodes.JettonTransferInternal
        });

        expect(result.transactions).toHaveTransaction({
            from: vestinJettonWallet,
            to: vesting.address,
            success: true,
            op: JettonWallet.opcodes.JettonNotification
        });

        expect(result.transactions).toHaveTransaction({
            from: vestinJettonWallet,
            to: deployer.address,
            success: true,
            op: JettonWallet.opcodes.JettonExcesses
        });
        let feesAll = 0n;
        // result.transactions.forEach(trx => {
            
        //     console.log(trx.events);
        //     feesAll += trx.totalFees.coins;
        //     console.log(trx.description);
        // })
        // console.log("Fees aLL: " + feesAll.toString());
    })

    // done in before each
    it("should set up vesting", async () => {

    })

    // it("should update vesting schedule after being set", async () => {
    //     let startsAt = BigInt(Math.floor(Date.now() / 1000));
    //     let interval = 3600n;
    //     let cycles = 12n;
    //     const resSet = await vesting.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano('0.05')
    //         },
    //         {
    //             $$type: 'SetVestingSchedule',
    //             startsAt,
    //             interval,
    //             cycles,
    //         }
    //     );

    //     expect(resSet.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vesting.address,
    //         deploy: false,
    //         success: true,
    //     });

    //     expect(resSet.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vesting.address,
    //         deploy: false,
    //         success: true,
    //     });

    //     let vestingState = await vesting.getVestingState();
    //     expect(vestingState.schedule.startsAt).toEqual(startsAt)
    //     expect(vestingState.schedule.interval).toEqual(interval)
    //     expect(vestingState.schedule.cycles).toEqual(cycles)

    //     startsAt = startsAt + 1n;
    //     interval = interval + 1n;
    //     cycles = cycles + 1n;

    //     const resUpdate = await vesting.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano('0.05')
    //         },
    //         {
    //             $$type: 'SetVestingSchedule',
    //             startsAt,
    //             interval,
    //             cycles,
    //         }
    //     );


    //     expect(resUpdate.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vesting.address,
    //         deploy: false,
    //         success: true,
    //     });

    //     expect(resUpdate.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vesting.address,
    //         deploy: false,
    //         success: true,
    //     });

    //     let updatedVestingState = await vesting.getVestingState();
    //     expect(updatedVestingState.schedule.startsAt).toEqual(startsAt)
    //     expect(updatedVestingState.schedule.interval).toEqual(interval)
    //     expect(updatedVestingState.schedule.cycles).toEqual(cycles)
    // })

    // it("should deploy allocation", async () => {
    //     let vested = (await blockchain.treasury("vested")).address;
    //     let amount = toNano("1000");
    //     let result = await vesting.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano('0.05')
    //         },
    //         {
    //             $$type: 'Allocate',
    //             vested,
    //             amount
    //         }
    //     )
    //     let allocation = blockchain.openContract(await Allocation.fromInit({
    //         $$type: 'AllocationInit',
    //         'vesting': vesting.address,
    //         vested
    //     }));
    //     expect(result.transactions).toHaveTransaction({
    //         from: vesting.address,
    //         deploy: true,
    //         to: allocation.address,
    //         success: true
    //     })
    //     let allocationState = await allocation.getAllocationState();
    //     expect(allocationState.amount).toBe(amount);
    //     expect(allocationState.vested).toEqualAddress(vested);
    //     expect(allocationState.vesting).toEqualAddress(vesting.address)
    // })


    // it("should deploy allocation with custom schedule", async () => {
    //     let vested = (await blockchain.treasury("vested")).address;
    //     let amount = toNano("1000");
    //     let startsAt = BigInt(Math.floor(Date.now() / 1000)) - 100n;
    //     let interval = 10n;
    //     let cycles = 20n;
    //     let result = await vesting.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano('0.05')
    //         },
    //         {
    //             $$type: 'AllocateWithCustomSchedule',
    //             vested,
    //             amount,
    //             schedule: {
    //                 $$type: 'VestingSchedule',
    //                 startsAt,
    //                 interval,
    //                 cycles
    //             }
    //         }
    //     )
    //     let allocation = blockchain.openContract(await Allocation.fromInit({
    //         $$type: 'AllocationInit',
    //         'vesting': vesting.address,
    //         vested
    //     }));
    //     expect(result.transactions).toHaveTransaction({
    //         from: vesting.address,
    //         deploy: true,
    //         to: allocation.address,
    //         success: true
    //     })
    //     let allocationState = await allocation.getAllocationState();
    //     expect(allocationState.amount).toBe(amount);
    //     expect(allocationState.vested).toEqualAddress(vested);
    //     expect(allocationState.vesting).toEqualAddress(vesting.address)
    //     expect(allocationState.schedule.startsAt).toBe(startsAt);
    //     expect(allocationState.schedule.interval).toBe(interval);
    //     expect(allocationState.schedule.cycles).toBe(cycles);
    // })

    // it("should unlock", async () => {
    //     let vested = (await blockchain.treasury("vested")).address;
    //     let amount = toNano("1000");
    //     let startsAt = BigInt(Math.floor(Date.now() / 1000)) - 100n;
    //     let interval = 10n;
    //     let cycles = 20n;
    //     let result = await vesting.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano('0.05')
    //         },
    //         {
    //             $$type: 'AllocateWithCustomSchedule',
    //             vested,
    //             amount,
    //             schedule: {
    //                 $$type: 'VestingSchedule',
    //                 startsAt,
    //                 interval,
    //                 cycles
    //             }
    //         }
    //     )
    //     let allocation = blockchain.openContract(await Allocation.fromInit({
    //         $$type: 'AllocationInit',
    //         'vesting': vesting.address,
    //         vested
    //     }));
    //     expect(result.transactions).toHaveTransaction({
    //         from: vesting.address,
    //         deploy: true,
    //         to: allocation.address,
    //         success: true
    //     })
    //     let allocationState = await allocation.getAllocationState();
    //     expect(allocationState.amount).toBe(amount);
    //     expect(allocationState.unlocked).toBeGreaterThan(0n);
    //     expect(allocationState.unlocked).toBe(toNano("500"));
    // })

    // it("should find allocation address without deployment deterministically", async () => {
    //     let allocationBeforeDeployment = blockchain.openContract(await Allocation.fromInit({
    //         $$type: 'AllocationInit',
    //         vesting: vesting.address,
    //         vested: deployer.address
    //     }));

    //     let throwed = false;
    //     try {
    //         await allocationBeforeDeployment.getAllocationState();
    //     } catch (error) {
    //         throwed = true;
    //     }
    //     expect(throwed).toBe(true);

    //     let result = await vesting.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano("0.05")
    //         },
    //         {
    //             $$type: 'Allocate',
    //             vested: deployer.address,
    //             amount: toNano("1000")
    //         }
    //     );

    //     expect(result.transactions).toHaveTransaction({
    //         from: vesting.address,
    //         to: allocationBeforeDeployment.address,
    //         deploy: true,
    //         success: true,
    //     });

    //     expect(result.transactions).toHaveTransaction({
    //         from: allocationBeforeDeployment.address,
    //         to: vesting.address,
    //         deploy: false,
    //         success: true,
    //     });

    //     let allocationState = await allocationBeforeDeployment.getAllocationState()
    // })

    // it.only("should send jetton notification", async () => {
    //     let trxResult = await vesting.send(
    //         deployer.getSender(),
    //         {
    //             value: toNano("0.05")
    //         },
    //         {
    //             $$type: ,
    //             queryId: 0n,
    //             amount: toNano("1000"),
    //             sender: deployer.address,
    //             forwardPayload: beginCell().storeCoins(toNano("2000")).asSlice()
    //         }
    //     )

    //     expect(trxResult.transactions).toHaveTransaction({
    //         from: deployer.address,
    //         to: vesting.address,
    //         success: true,
    //         body: beginCell().store(storeJettonTransferNotification({
    //             $$type: "JettonTransferNotification",
    //             queryId: 0n,
    //             amount: toNano("1000"),
    //             sender: deployer.address,
    //             forwardPayload: beginCell().storeCoins(toNano("2000")).asSlice()
    //         })).endCell(),
    //     });

    //     let vestingState = await vesting.getVestingState();
    //     console.log(vestingState);
    // })
});
