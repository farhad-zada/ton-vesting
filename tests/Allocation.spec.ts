import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, Cell, toNano } from '@ton/core';
import { Allocation, storeJettonNotification } from '../build/Allocation/Allocation_Allocation';
import '@ton/test-utils';
import { storeClaim } from '../build/Vesting/Vesting_Vesting';
import { JettonWallet } from '../build/JettonWallet/JettonWallet_JettonWallet';
import { JettonMinter } from '../build/JettonMinter/JettonMinter_JettonMinter';

describe('Allocation', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let allocation: SandboxContract<Allocation>;
    let jettonMinter: SandboxContract<JettonMinter>
    let jettonWallet: SandboxContract<JettonWallet>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');


        jettonMinter = blockchain.openContract(
            await JettonMinter.fromInit(
                0n,
                deployer.address,
                beginCell().endCell(),
                true
            )
        );

        const jettonMinterDeployment = await jettonMinter.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Mint',
                queryId: 0n,
                receiver: deployer.address,
                tonAmount: 0n,
                mintMessage: {
                    $$type: 'JettonTransferInternal',
                    queryId: 1n,
                    amount: toNano("2000"),
                    sender: deployer.address,
                    responseDestination: deployer.address,
                    forwardTonAmount: 0n,
                    forwardPayload: beginCell().storeUint(0, 1).asSlice()
                }
            }
        );

        expect(jettonMinterDeployment.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: true,
            success: true
        });

        jettonWallet = blockchain.openContract(JettonWallet.fromAddress(await jettonMinter.getGetWalletAddress(deployer.address)));
        let jettonWalletData = await jettonWallet.getGetWalletData();

        expect(jettonWalletData.balance).toBe(toNano("2000"));
        expect(jettonWalletData.minter).toEqualAddress(jettonMinter.address);
        expect(jettonWalletData.owner).toEqualAddress(deployer.address);

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
                jettonWallet: await jettonMinter.getGetWalletAddress(allocation.address),
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
                $$type: 'JettonNotification',
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
                $$type: 'JettonNotification',
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

    it("should set allocated amount on jetton transfer notification", async () => {
        let allocationStateBefore = await allocation.getAllocationState();
        expect(allocationStateBefore.amount).toBe(toNano("1000"));
        let amount = 100000n;
        let trxResult = await allocation.send(
            deployer.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: 'JettonNotification',
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
            body: beginCell().store(storeJettonNotification({
                $$type: 'JettonNotification',
                queryId: 0n,
                amount,
                sender: deployer.address,
                forwardPayload: beginCell().asSlice()
            })).endCell(),
        });

        let allocationState = await allocation.getAllocationState();
        expect(allocationState.amount).toBe(toNano("1000") + amount);
    })

    it("should send jettons from deployer to allocation", async () => {
        const forwardPayload = beginCell().storeUint(239, 17).endCell()
        let result = await jettonWallet.send(
            deployer.getSender(),
            {
                value: toNano("2")
            },
            {
                $$type: 'JettonTransfer',
                queryId: 0n,
                amount: 100n,
                destination: allocation.address,
                customPayload: null,
                responseDestination: deployer.address,
                forwardTonAmount: toNano("0.02"),
                forwardPayload: beginCell()
                    .storeBit(false) // Inline format
                    .storeSlice(forwardPayload.asSlice())
                    .endCell()
                    .asSlice(),
            }
        )
        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonWallet.address,
            deploy: false,
            success: true
        })
        let allocationWalletAddress = await jettonMinter.getGetWalletAddress(allocation.address);
        expect(result.transactions).toHaveTransaction({
            from: jettonWallet.address,
            to: allocationWalletAddress,
            deploy: true,
            success: true
        })
        expect(result.transactions).toHaveTransaction({
            from: allocationWalletAddress,
            to: allocation.address,
            deploy: false,
            success: true
        })
    })

});
