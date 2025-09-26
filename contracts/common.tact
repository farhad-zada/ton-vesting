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
    amount: Int as uint256;
    startsAt: Int as uint32;
    interval: Int as uint32;
    cycles: Int as uint32;
}
