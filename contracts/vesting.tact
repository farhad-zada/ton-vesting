import "./common";
import "./allocation";
import "./messages";
import "./exit_codes";

struct VestingInit {
    uid: Int as uint32;
    owner: Address;
    title: String;
}

struct VestingState {
    uid: Int as uint32;
    title: String;
    owner: Address;
    jettonWallet: Address;
    jettonBalance: Int as coins;
    schedule: VestingSchedule;
}

// TODO: you should handle jettons too
contract Vesting {
    uid: Int as uint32; // provides a way to have dublication on `owner` & `title`
    owner: Address;
    title: String;

    jettonWallet: Address?;
    jettonBalance: Int as coins = 0;

    startsAt: Int as uint32 = 0;
    interval: Int as uint32 = 0;
    cycles: Int as uint32 = 0;

    init(data: VestingInit) {
        self.uid = data.uid;
        self.title = data.title;
        self.owner = data.owner;
    }

    receive() {} // store incoming value

    receive(msg: VestingSetup) {
        let sender: Address = sender();
        throwUnless(NOT_OWNER, self.owner == sender);
        self.jettonWallet = msg.jettonWallet;
        self.startsAt = msg.startsAt;
        self.interval = msg.interval;
        self.cycles = msg.cycles;
        cashback(sender);
    }

    receive(msg: JettonNotification) {
        throwUnless(UNRECOGNIZED_JETTON_WALLET, sender() == self.jettonWallet);
        self.jettonBalance += msg.amount;
        cashback(msg.sender);
    }

    receive(msg: Allocate) {
        let sender: Address = sender();
        throwUnless(NOT_OWNER, sender == self.owner);
        let allocationInit: StateInit = initOf Allocation(
            AllocationInit {
                vesting: myAddress(),
                vested: msg.vested,
            },
        );

        deploy(
            DeployParameters {
                init: allocationInit,
                mode: SendRemainingValue,
                value: 0,
                body: DeployAllocation {
                    jettonWallet: msg.jettonWallet,
                    startsAt: self.startsAt,
                    interval: self.interval,
                    cycles: self.cycles,
                }.toCell(),
            },
        );

        let allocationAddress: Address = contractAddress(allocationInit);
        // here we send a transfer jetton to the Vesting Jetton Wallet
        message(MessageParameters {
            to: self.jettonWallet!!,
            value: 0,
            mode: SendRemainingValue,
            body: JettonTransfer {
                queryId: msg.queryId,
                amount: msg.amount,
                destination: allocationAddress,
                responseDestination: allocationAddress,
                forwardTonAmount: 1,
                forwardPayload: beginCell().storeBit(false).asSlice(),
            }.toCell(),
        });
    }

    receive(msg: AllocateWithCustomSchedule) {
        let sender: Address = sender();

        throwUnless(NOT_OWNER, sender == self.owner);
        let allocationInit: StateInit = initOf Allocation(
            AllocationInit {
                vesting: myAddress(),
                vested: msg.vested,
            },
        );
        deploy(
            DeployParameters {
                init: allocationInit,
                mode: SendRemainingValue,
                value: 0,
                body: DeployAllocation {
                    jettonWallet: msg.jettonWallet,
                    startsAt: msg.schedule.startsAt,
                    interval: msg.schedule.interval,
                    cycles: msg.schedule.cycles,
                }.toCell(),
            },
        );

        let allocationAddress: Address = contractAddress(allocationInit);
        message(MessageParameters {
            to: self.jettonWallet!!,
            value: 0,
            mode: SendRemainingValue,
            body: JettonTransfer {
                queryId: msg.queryId,
                amount: msg.amount,
                destination: allocationAddress,
                responseDestination: allocationAddress,
                forwardTonAmount: 1,
                forwardPayload: beginCell().storeBit(false).asSlice(),
            }.toCell(),
        });
    }

    get fun vestingState(): VestingState {
        return VestingState {
            uid: self.uid,
            title: self.title,
            owner: self.owner,
            jettonWallet: self.jettonWallet!!,
            jettonBalance: self.jettonBalance,
            schedule: VestingSchedule {
                startsAt: self.startsAt,
                interval: self.interval,
                cycles: self.cycles,
            },
        };
    }
}
