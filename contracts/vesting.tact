import "./common";
import "./allocation";
import "./messages";

struct VestingInit {
    uid: Int as uint32;
    owner: Address;
    title: String;
}

message(0x2ab9ebe8) VestingDeployment {
    title: String;
    startsAt: Int as uint32;
    interval: Int as uint32;
    cycles: Int as uint32;
}

message(0x6bb4e20f) Allocate {
    vested: Address;
    amount: Int as uint256;
}

message(0x64587da4) AllocateWithCustomSchedule {
    vested: Address;
    amount: Int as uint256;
    schedule: VestingSchedule;
}

struct VestingState {
    uid: Int as uint32;
    title: String;
    owner: Address;
    schedule: VestingSchedule;
}

// TODO: you should handle jettons too
contract Vesting {
    uid: Int as uint32;
    owner: Address;
    title: String;
    startsAt: Int as uint32 = 0;
    interval: Int as uint32 = 0;
    cycles: Int as uint32 = 0;

    init(data: VestingInit) {
        self.uid = data.uid;
        self.title = data.title;
        self.owner = data.owner;
    }

    receive() {} // store incoming value

    receive(msg: JettonNotification) {
        let allocation = Allocate.fromSlice(msg.forwardPayload);
        self.interval = allocation.amount;
    }

    receive(msg: SetVestingSchedule) {
        let sender: Address = sender();
        throwUnless(2403, self.owner == sender);
        self.startsAt = msg.startsAt;
        self.interval = msg.interval;
        self.cycles = msg.cycles;
        cashback(sender);
    }

    receive(msg: Allocate) {
        throwUnless(2403, sender() == self.owner);
        let allocationInit: StateInit = initOf Allocation(
            AllocationInit {
                vesting: myAddress(),
                vested: msg.vested,
            },
        );
        let allocationAddress: Address = contractAddress(allocationInit);

        deploy(
            DeployParameters {
                init: allocationInit,
                mode: SendRemainingValue,
                value: 0,
                body: DeployAllocation {
                    jettonWallet: sender(),
                    startsAt: self.startsAt,
                    interval: self.interval,
                    cycles: self.cycles,
                }.toCell(),
            },
        );

        // here we send a transfer jetton to the Vesting Jetton Wallet
        message(MessageParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingBalance,
            body: JettonTransfer {
                queryId: 2000,
                amount: msg.amount,
                destination: allocationAddress,
                responseDestination: allocationAddress,
                forwardTonAmount: 1,
                forwardPayload: beginCell().storeCoins(msg.amount).asSlice(),
            }.toCell(),
        });
    }

    receive(msg: AllocateWithCustomSchedule) {
        throwUnless(2403, sender() == self.owner);
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
                    jettonWallet: sender(),
                    startsAt: msg.schedule.startsAt,
                    interval: msg.schedule.interval,
                    cycles: msg.schedule.cycles,
                }.toCell(),
            },
        );
    }

    get fun vestingState(): VestingState {
        return VestingState {
            uid: self.uid,
            title: self.title,
            owner: self.owner,
            schedule: VestingSchedule {
                startsAt: self.startsAt,
                interval: self.interval,
                cycles: self.cycles,
            },
        };
    }
}
