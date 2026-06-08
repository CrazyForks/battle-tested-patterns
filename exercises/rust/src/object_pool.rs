use std::sync::Mutex;

pub struct ObjectPool<T> {
    pool: Mutex<Vec<T>>,
    factory: Box<dyn Fn() -> T + Send + Sync>,
}

impl<T> ObjectPool<T> {
    pub fn new<F: Fn() -> T + Send + Sync + 'static>(factory: F) -> Self { // TODO: implement
        ObjectPool {
            pool: Mutex::new(Vec::new()),
            factory: Box::new(factory),
        }
    }

    pub fn get(&self) -> T { // TODO: implement
        let mut pool = self.pool.lock().unwrap();
        pool.pop().unwrap_or_else(|| (self.factory)())
    }

    pub fn put(&self, obj: T) { // TODO: implement
        let mut pool = self.pool.lock().unwrap();
        pool.push(obj);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn test_get_and_put() {
        let pool = ObjectPool::new(|| vec![0u8; 1024]);
        let mut buf = pool.get();
        assert_eq!(buf.len(), 1024);
        buf[0] = 42;
        pool.put(buf);
    }

    #[test]
    fn test_reuse() {
        let create_count = Arc::new(AtomicUsize::new(0));
        let cc = create_count.clone();
        let pool = ObjectPool::new(move || {
            cc.fetch_add(1, Ordering::SeqCst);
            vec![0u8; 64]
        });

        let buf = pool.get();
        pool.put(buf);
        let _buf2 = pool.get();

        assert!(create_count.load(Ordering::SeqCst) <= 2);
    }

    #[test]
    fn test_concurrent() {
        let pool = Arc::new(ObjectPool::new(|| vec![0u8; 64]));
        let mut handles = vec![];

        for _ in 0..100 {
            let pool = pool.clone();
            handles.push(std::thread::spawn(move || {
                let mut buf = pool.get();
                buf[0] = 1;
                pool.put(buf);
            }));
        }

        for h in handles {
            h.join().unwrap();
        }
    }
}
