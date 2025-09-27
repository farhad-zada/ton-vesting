import "./common";
import "./messages";

struct AllocationInit {
    vesting: Address;
    vested: Address;
}

struct AllocationState {
    vesting: Address;
    vested: Address;
    amount: Int as uint256;
    claimed: Int as uint256;
    claimable: Int as uint256;
    unlocked: Int as uint256;
    schedule: VestingSchedule;
}

message(0xfc264fcd) Claim {
    receiver: Address?;
}

/**
* TODO:
* Integrate Jetton Wallet
* Transfer Jetton Amount on claim
* Handle cashback
* Handle bounced Transfer for claims which can result in inconcistent state
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

    init(data: AllocationInit) {
        self.vesting = data.vesting;
        self.vested = data.vested;
    }

    receive() {}

    receive(msg: DeployAllocation) {
        let sender: Address = sender();
        require(self.vesting == sender, "Only Vesting contract can deploy.");
        require(self.jettonWallet == null, "Double deploy not allowed.");
        self.jettonWallet = msg.jettonWallet;
        self.startsAt = msg.startsAt;
        self.interval = msg.interval;
        self.cycles = msg.cycles;
        cashback(sender);
    }

    receive(msg: JettonNotification) {
        require(sender() == self.jettonWallet, "Unrecognized Jetton Wallet.");
        self.amount += msg.amount;
    }

    // TODO: handle bounce cases to redo this func
    receive(msg: Claim) {
        let sender = sender();
        throwUnless(2403, sender == self.vested);
        let unlocked = self.unlocked();
        let claimable = unlocked - self.claimed;
        self.claimed = unlocked;
        let receiver: Address = sender;
        if (msg.receiver != null) {
            receiver = msg.receiver!!;
        }
        message(self.jettonTransferMessage(claimable, receiver));
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
                forwardTonAmount: 0,
                forwardPayload: beginCell().asSlice(),
            }.toCell(),
        }
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
            unlocked,
            claimable,
            schedule: VestingSchedule {
                startsAt: self.startsAt,
                interval: self.interval,
                cycles: self.cycles,
            },
        };
    }
}
