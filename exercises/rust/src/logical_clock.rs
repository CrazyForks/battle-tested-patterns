struct LamportClock {
    time: u64,
}

impl LamportClock {
    fn new() -> Self { // TODO: implement
        Self { time: 0 }
    }

    fn tick(&mut self) -> u64 { // TODO: implement
        self.time += 1;
        self.time
    }

    fn send(&mut self) -> u64 { // TODO: implement
        self.time += 1;
        self.time
    }

    fn receive(&mut self, remote: u64) -> u64 { // TODO: implement
        if remote > self.time {
            self.time = remote;
        }
        self.time += 1;
        self.time
    }

    fn time(&self) -> u64 { // TODO: implement
        self.time
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tick() {
        let mut c = LamportClock::new();
        let t1 = c.tick();
        let t2 = c.tick();
        assert!(t2 > t1);
    }

    #[test]
    fn test_send_receive() {
        let mut a = LamportClock::new();
        let mut b = LamportClock::new();

        a.tick();
        a.tick();
        let msg_time = a.send();

        let recv_time = b.receive(msg_time);
        assert!(recv_time > msg_time);
    }

    #[test]
    fn test_causality() {
        let mut a = LamportClock::new();
        let mut b = LamportClock::new();

        a.tick(); // a=1
        a.tick(); // a=2
        a.tick(); // a=3

        b.tick(); // b=1

        let msg = a.send();        // a=4
        let recv = b.receive(msg); // b=max(1,4)+1=5

        assert!(recv > msg);
    }

    #[test]
    fn test_monotonic() {
        let mut c = LamportClock::new();
        let mut prev = c.time();
        for _ in 0..100 {
            let curr = c.tick();
            assert!(curr > prev);
            prev = curr;
        }
    }
}
