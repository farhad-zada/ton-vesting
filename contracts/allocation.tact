import "./common";
import "./messages";
import "./exit_codes";

struct AllocationInit {
    vesting: Address;
    vested: Address;
}

struct AllocationState {
    vesting: Address;
    vested: Address;
    amount: Int as coins;
    claimed: Int as coins;
    previousClaimed: Int as coins;
    claimable: Int as coins;
    unlocked: Int as coins;
    schedule: VestingSchedule;
    dataSize: DataSize?;
    storageFee: Int;
}

message(0xfc264fcd) Claim {
    receiver: Address?;
}

/**
* TODO:
* Handle cashback
* Calculate fees & hardcode
* Lock for a cycle or bounced message on claim
*/
contract Allocation {
    vesting: Address; // the parent vesting contract address
    vested: Address; // the wallet that would claim the amount

    jettonWallet: Address?; // the jetton wallet address of this Allocation contract
    amount: Int as coins = 0;
    claimed: Int as coins = 0;

    // vesting schedule
    startsAt: Int as uint32 = 0;
    interval: Int as uint32 = 0;
    cycles: Int as uint32 = 0;
    aliveSeconds: Int as uint32 = 0;

    dataSize: DataSize?;
    storageFee: Int = 0;

    // this holds the claimed amount before the latest claim to recover in case of JettonTransfer bounce
    previousClaimed: Int as coins = 0;

    init(data: AllocationInit) {
        self.vesting = data.vesting;
        self.vested = data.vested;
    }

    receive() {}

    receive(msg: DeployAllocation) {
        let sender: Address = sender();
        throwUnless(NOT_OWNER, self.vesting == sender);
        throwUnless(UNRECOGNIZED_JETTON_WALLET, self.jettonWallet == null);
        self.jettonWallet = msg.jettonWallet;
        self.startsAt = msg.startsAt;
        self.interval = msg.interval;
        self.cycles = msg.cycles;
        self.aliveSeconds = now() - (self.startsAt + self.interval * self.cycles) + 31536000;
        self.dataSize = myCode().computeDataSize(25);
        let seconds: Int = min(self.aliveSeconds, 31536000 /* a year */);
        self.storageFee = getStorageFee(self.dataSize!!.cells, self.dataSize!!.bits, seconds, false);
        cashback(sender);
    }

    receive(msg: JettonNotification) {
        throwUnless(401, sender() == self.jettonWallet);
        self.amount += msg.amount;
        cashback(msg.sender);
    }

    // TODO: handle bounce cases to redo this func
    receive(msg: Claim) {
        let sender = sender();
        throwUnless(NOT_OWNER, sender == self.vested);
        let unlocked = self.unlocked();
        let claimable = unlocked - self.claimed;
        self.previousClaimed = self.claimed;
        self.claimed = unlocked;
        let receiver: Address = sender;
        if (msg.receiver != null) {
            receiver = msg.receiver!!;
        }
        throwUnless(NO_CLAIMABLE, claimable >= 0);
        message(self.jettonTransferMessage(claimable, receiver));
    }

    bounced(msg: bounced<JettonTransfer>) {
        self.claimed = self.previousClaimed;
    }

    inline fun jettonTransferMessage(amount: Int, destination: Address): MessageParameters {
        return MessageParameters {
            to: self.jettonWallet!!,
            value: 0,
            mode: SendRemainingValue,
            body: JettonTransfer {
                queryId: 2000,
                amount,
                destination,
                responseDestination: destination,
                forwardTonAmount: ton("0.005"),
                forwardPayload: beginCell().storeBit(false).endCell().asSlice(),
            }.toCell(),
        };
    }

    inline fun unlocked(): Int {
        return self.amount / self.cycles * ((now() - (self.startsAt)) / self.interval);
    }

    get fun allocationState(): AllocationState {
        let unlocked = self.unlocked();
        let claimable = unlocked - self.claimed;
        return AllocationState {
            vesting: self.vesting,
            vested: self.vested,
            amount: self.amount,
            claimed: self.claimed,
            previousClaimed: self.previousClaimed,
            unlocked,
            claimable,
            schedule: VestingSchedule {
                startsAt: self.startsAt,
                interval: self.interval,
                cycles: self.cycles,
            },
            dataSize: self.dataSize,
            storageFee: self.storageFee,
        };
    }
}
