// this contracts' sole purpose is to show that recursive self calls can be used
// to set thousands of allocations with a single "transaction" by which I mean
// the allocator will call the vesting contract only once with enough funds
message(0x2f2dab58) Recursive {
    recursion: Int as uint32;
}

message(0xdf43effd) OutgoingNotification {
    received: Int as uint32;
}
contract Loopy(
    owner: Address,
    received: Int as uint32,
) {
    receive() {
        cashback(sender());
    }

    receive(msg: Recursive) {
        let idx: Int = self.received;
        let loopTill: Int = min(msg.recursion, idx + 253);
        while (idx < loopTill) { // 253 messages
            message(MessageParameters {
                to: self.owner,
                value: ton("0.001"),
                body: OutgoingNotification { received: self.received }.toCell(),
            });
            idx += 1;
        }
        self.received = idx;
        if (idx < msg.recursion) {
            nativeReserve(ton("0.1"), ReserveAtMost); // +1 message = 254 messages 
            message(MessageParameters { // +1 message = 255 messages
                to: myAddress(),
                value: 1,
                mode: SendRemainingBalance,
                body: msg.toCell(),
            });
        } else {
            nativeReserve(ton("0.1"), ReserveAtMost); // +1 message = 254 messages 
            cashback(self.owner);
        }
    }

    get fun data(): Int {
        return self.received;
    }
}
