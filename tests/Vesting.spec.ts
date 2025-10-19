import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano, Cell, safeSignVerify, Slice, Message, Address, CommonMessageInfo, CommonMessageInfoInternal } from '@ton/core';
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
        
        // console.log(vesting.init?.code.depth(100));
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
        // console.log(Vesting.opcodes)
        result.transactions.forEach(trx => {
            trx.outMessages.keys().forEach(key => {
                let info = trx.outMessages.get(key)?.info;
                console.log(info);
                // try {
                //     console.log(trx.outMessages.get(key)?.body.beginParse().loadUint(32))
                // } catch (error) {
                    
                // }
            })
        })
    })

    // done in before each
    it("should set up vesting", async () => {

    })
});
