import { Blockchain, SandboxContract, SendMessageResult, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, fromNano, toNano } from '@ton/core';
import { Allocation, storeJettonNotification } from '../build/Allocation/Allocation_Allocation';
import '@ton/test-utils';
import { storeClaim } from '../build/Vesting/Vesting_Vesting';
import { JettonWallet } from '../build/JettonWallet/JettonWallet_JettonWallet';
import { JettonMinter } from '../build/JettonMinter/JettonMinter_JettonMinter';
import { assert } from 'console';
import { ppAstBouncedMessageType } from '@tact-lang/compiler';
import { sleep } from '@ton/blueprint';

describe('Allocation', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let allocation: SandboxContract<Allocation>;
    let jettonMinter: SandboxContract<JettonMinter>
    let jettonWallet: SandboxContract<JettonWallet>;

    async function allocate(destination: Address, amount: bigint): Promise<SendMessageResult> {
        assert(jettonWallet != undefined, "jetton wallet not initialized");
        return jettonWallet.send(
            deployer.getSender(),
            {
                value: toNano("0.5")
            },
            {
                $$type: 'JettonTransfer',
                queryId: 0n,
                amount,
                destination,
                customPayload: null,
                responseDestination: deployer.address,
                forwardTonAmount: toNano("0.02"),
                forwardPayload: beginCell().storeBit(false).endCell().asSlice()
            }
        )
    }
    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('sksksmoeimwoewoiimnwoncfjwnfownoi');


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
        let result = await allocate(allocation.address, toNano("100"));
        expect(result.transactions).toHaveTransaction({
            from: await jettonMinter.getGetWalletAddress(allocation.address),
            to: allocation.address,
            success: true,
            op: JettonWallet.opcodes.JettonNotification
        })
        let allocationState = await allocation.getAllocationState();
        expect(allocationState.claimable).toBe(toNano("50"));
    });

    it('should claim', async () => {
        // allocate
        let allocationResult = await allocate(allocation.address, toNano("100"));
        expect(allocationResult.transactions).toHaveTransaction({
            from: await jettonMinter.getGetWalletAddress(allocation.address),
            to: allocation.address,
            success: true,
            op: JettonWallet.opcodes.JettonNotification
        })

        let allocationStateBeforeClaim = await allocation.getAllocationState();
        expect(allocationStateBeforeClaim.claimable).toBe(toNano('50'));
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

        let allocationWalletAddress = await jettonMinter.getGetWalletAddress(allocation.address)

        // from allocation -> allocation jetton wallet
        expect(result.transactions).toHaveTransaction({
            from: allocation.address,
            to: allocationWalletAddress,
            deploy: false,
            success: true,
            op: JettonWallet.opcodes.JettonTransfer
        });

        // from allocation jetton wallet -> deployer jetton wallet
        expect(result.transactions).toHaveTransaction({
            from: allocationWalletAddress,
            to: jettonWallet.address,
            success: true,
            op: JettonWallet.opcodes.JettonTransferInternal
        });

        // from deployer jetton wallet -> deployer wallet
        expect(result.transactions).toHaveTransaction({
            from: jettonWallet.address,
            to: deployer.address,
            success: true,
            op: JettonWallet.opcodes.JettonNotification
        })
        let allocationStateAfterClaim = await allocation.getAllocationState();
        expect(allocationStateAfterClaim.claimable).toBe(0n);
        expect(allocationStateAfterClaim.claimed).toBe(toNano("50"));

        // console.log(fromNano(allocationStateAfterClaim.storageFee));
        // console.log(allocationStateAfterClaim);
    });

    it('should claim with a receiver', async () => {
        // allocate
        let allocationResult = await allocate(allocation.address, toNano("100"));
        expect(allocationResult.transactions).toHaveTransaction({
            from: await jettonMinter.getGetWalletAddress(allocation.address),
            to: allocation.address,
            success: true,
            op: JettonWallet.opcodes.JettonNotification
        })

        let allocationStateBeforeClaim = await allocation.getAllocationState();
        expect(allocationStateBeforeClaim.claimable).toBe(toNano('50'));
        expect(allocationStateBeforeClaim.claimed).toBe(0n);
        let receiver = await blockchain.treasury("receiver");
        let result = await allocation.send(
            deployer.getSender(),
            {
                value: toNano("0.05")
            },
            {
                $$type: 'Claim',
                receiver: receiver.address
            }
        );

        let allocationWalletAddress = await jettonMinter.getGetWalletAddress(allocation.address)

        // from allocation -> allocation jetton wallet
        expect(result.transactions).toHaveTransaction({
            from: allocation.address,
            to: allocationWalletAddress,
            deploy: false,
            success: true,
            op: JettonWallet.opcodes.JettonTransfer
        });
        let receiverJettonWallet = await jettonMinter.getGetWalletAddress(receiver.address);
        // from allocation jetton wallet -> deployer jetton wallet
        expect(result.transactions).toHaveTransaction({
            from: allocationWalletAddress,
            to: receiverJettonWallet,
            success: true,
            op: JettonWallet.opcodes.JettonTransferInternal
        });

        // from deployer jetton wallet -> deployer wallet
        expect(result.transactions).toHaveTransaction({
            from: receiverJettonWallet,
            to: receiver.address,
            success: true,
            op: JettonWallet.opcodes.JettonNotification
        })
        let allocationStateAfterClaim = await allocation.getAllocationState();
        expect(allocationStateAfterClaim.claimable).toBe(0n);
        expect(allocationStateAfterClaim.claimed).toBe(toNano("50"));
    });

    it('should receive jetton transfer notification', async () => {
        let trxResult = await allocate(allocation.address, toNano("1"))

        expect(trxResult.transactions).toHaveTransaction({
            from: await jettonMinter.getGetWalletAddress(allocation.address),
            to: allocation.address,
            success: true,
            op: JettonWallet.opcodes.JettonNotification
        });
    })

    it("should send jettons from deployer to allocation", async () => {
        let result = await allocate(allocation.address, 1000n);
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

    it.skip("should recover claimed in bounced jetton transfer", async () => {
        // this only works with a little bit of tweak in the contract. 
        await allocate(allocation.address, toNano("100"));
        console.log(await allocation.getAllocationState());


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

        let allocationWalletAddress = await jettonMinter.getGetWalletAddress(allocation.address);

        // allocation -> allocation jetton wallet
        expect(result.transactions).toHaveTransaction({
            from: allocation.address,
            to: allocationWalletAddress,
            success: false,
            op: JettonWallet.opcodes.JettonTransfer,
            inMessageBounced: false
        })

        // allocation jetton wallet -> allocation (bounced)
        expect(result.transactions).toHaveTransaction({
            from: allocationWalletAddress,
            to: allocation.address,
            success: false,
            inMessageBounced: true
        })

        console.log(await allocation.getAllocationState());
        
    })

});
