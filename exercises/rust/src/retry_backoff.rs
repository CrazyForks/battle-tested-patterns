use std::time::Duration;
use std::thread;

pub struct RetryConfig {
    pub max_retries: u32,
    pub base_delay: Duration,
}

pub fn with_retry<F>(cfg: &RetryConfig, mut f: F) -> Result<u32, String> // TODO: implement
where
    F: FnMut() -> Result<(), String>,
{
    for attempt in 0..=cfg.max_retries {
        match f() {
            Ok(()) => return Ok(attempt + 1),
            Err(e) => {
                if attempt == cfg.max_retries {
                    return Err(e);
                }
                let delay = cfg.base_delay * (1 << attempt);
                thread::sleep(delay);
            }
        }
    }
    unreachable!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_succeeds_first() {
        let cfg = RetryConfig { max_retries: 3, base_delay: Duration::from_millis(1) };
        let result = with_retry(&cfg, || Ok(()));
        assert_eq!(result, Ok(1));
    }

    #[test]
    fn test_succeeds_after_failures() {
        let cfg = RetryConfig { max_retries: 5, base_delay: Duration::from_millis(1) };
        let mut count = 0;
        let result = with_retry(&cfg, || {
            count += 1;
            if count < 3 { Err("transient".into()) } else { Ok(()) }
        });
        assert_eq!(result, Ok(3));
    }

    #[test]
    fn test_exhausted() {
        let cfg = RetryConfig { max_retries: 2, base_delay: Duration::from_millis(1) };
        let result = with_retry(&cfg, || Err("permanent".into()));
        assert!(result.is_err());
    }

    #[test]
    fn test_exponential_backoff() {
        let cfg = RetryConfig { max_retries: 3, base_delay: Duration::from_millis(5) };
        let start = std::time::Instant::now();
        let _ = with_retry(&cfg, || Err::<(), String>("fail".into()));
        assert!(start.elapsed() >= Duration::from_millis(30));
    }
}
