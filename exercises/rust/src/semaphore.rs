use std::sync::{Arc, Mutex, Condvar};

pub struct Semaphore {
    state: Mutex<usize>,
    cvar: Condvar,
    max: usize,
}

impl Semaphore {
    pub fn new(permits: usize) -> Self { // TODO: implement
        Semaphore {
            state: Mutex::new(0),
            cvar: Condvar::new(),
            max: permits,
        }
    }

    pub fn acquire(&self) { // TODO: implement
        let mut count = self.state.lock().unwrap();
        while *count >= self.max {
            count = self.cvar.wait(count).unwrap();
        }
        *count += 1;
    }

    pub fn release(&self) { // TODO: implement
        let mut count = self.state.lock().unwrap();
        *count -= 1;
        self.cvar.notify_one();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicI64, Ordering};
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_acquire_release() {
        let sem = Semaphore::new(2);
        sem.acquire();
        sem.acquire();
        sem.release();
        sem.acquire();
    }

    #[test]
    fn test_limits_concurrency() {
        let sem = Arc::new(Semaphore::new(2));
        let max_concurrent = Arc::new(AtomicI64::new(0));
        let current = Arc::new(AtomicI64::new(0));
        let mut handles = vec![];

        for _ in 0..10 {
            let sem = sem.clone();
            let max_c = max_concurrent.clone();
            let cur = current.clone();
            handles.push(thread::spawn(move || {
                sem.acquire();
                let c = cur.fetch_add(1, Ordering::SeqCst) + 1;
                max_c.fetch_max(c, Ordering::SeqCst);
                thread::sleep(Duration::from_millis(1));
                cur.fetch_sub(1, Ordering::SeqCst);
                sem.release();
            }));
        }

        for h in handles {
            h.join().unwrap();
        }

        assert!(max_concurrent.load(Ordering::SeqCst) <= 2);
    }
}
