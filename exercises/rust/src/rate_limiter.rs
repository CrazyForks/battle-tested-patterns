use std::time::Instant;

pub struct TokenBucket {
    tokens: f64,
    max_tokens: f64,
    refill_rate: f64,
    last_refill: Instant,
}

impl TokenBucket {
    pub fn new(max_tokens: f64, refill_rate: f64) -> Self { // TODO: implement
        TokenBucket {
            tokens: max_tokens,
            max_tokens,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    fn refill(&mut self) { // TODO: implement
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.max_tokens);
        self.last_refill = now;
    }

    pub fn allow(&mut self) -> bool { // TODO: implement
        self.refill();
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allows_with_tokens() {
        let mut tb = TokenBucket::new(3.0, 1.0);
        assert!(tb.allow());
    }

    #[test]
    fn test_exhaustion() {
        let mut tb = TokenBucket::new(2.0, 0.0);
        tb.allow();
        tb.allow();
        assert!(!tb.allow());
    }

    #[test]
    fn test_refill() {
        let mut tb = TokenBucket::new(1.0, 1000.0);
        tb.allow();
        std::thread::sleep(std::time::Duration::from_millis(5));
        assert!(tb.allow());
    }

    #[test]
    fn test_max_cap() {
        let mut tb = TokenBucket::new(2.0, 1000.0);
        std::thread::sleep(std::time::Duration::from_millis(10));
        tb.allow();
        tb.allow();
        assert!(!tb.allow());
    }
}
