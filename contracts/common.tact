struct VestingSchedule {
    startsAt: Int as uint32 = 0;
    interval: Int as uint32 = 0;
    cycles: Int as uint32 = 0;
}

message(0xd90d54c) SetVestingSchedule {
    startsAt: Int as uint32 = 0;
    interval: Int as uint32 = 0;
    cycles: Int as uint32 = 0;
}

message(0x1760e95e) DeployAllocation {
    jettonWallet: Address;
    startsAt: Int as uint32;
    interval: Int as uint32;
    cycles: Int as uint32;
}

message(0x7362d09c) JettonTransferNotification {
    // Unique identifier used to trace transactions across multiple contracts
    // Defaults to 0, which means we don't mark messages to trace their chains
    queryId: Int as uint64 = 0;

    // Amount of Jettons transferred
    amount: Int as coins;

    // Address of the sender of the Jettons
    sender: Address;

    // Optional custom payload
    forwardPayload: Slice as remaining;
}

message(0xf8a7ea5) JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell? = null;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}
