struct VestingSchedule {
    startsAt: Int as uint32 = 0;
    interval: Int as uint32 = 0;
    cycles: Int as uint32 = 0;
}

message(0x1f1c73aa) VestingSetup {
    jettonWallet: Address;
    startsAt: Int as uint32;
    interval: Int as uint32;
    cycles: Int as uint32;
}

message(0x1760e95e) DeployAllocation {
    jettonWallet: Address;
    startsAt: Int as uint32;
    interval: Int as uint32;
    cycles: Int as uint32;
}