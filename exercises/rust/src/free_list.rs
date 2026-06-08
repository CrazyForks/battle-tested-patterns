struct FreeList {
    pool: Vec<i32>,
    free: Vec<usize>,
}

impl FreeList {
    fn new(size: usize) -> Self { // TODO: implement
        let free: Vec<usize> = (0..size).rev().collect();
        Self {
            pool: vec![0; size],
            free,
        }
    }

    fn alloc(&mut self) -> Option<usize> { // TODO: implement
        self.free.pop()
    }

    fn free(&mut self, idx: usize) { // TODO: implement
        self.pool[idx] = 0;
        self.free.push(idx);
    }

    fn set(&mut self, idx: usize, val: i32) { // TODO: implement
        self.pool[idx] = val;
    }

    fn get(&self, idx: usize) -> i32 { // TODO: implement
        self.pool[idx]
    }

    fn available(&self) -> usize { // TODO: implement
        self.free.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_alloc_and_free() {
        let mut fl = FreeList::new(4);
        assert_eq!(fl.available(), 4);

        let i1 = fl.alloc().unwrap();
        fl.set(i1, 42);
        assert_eq!(fl.get(i1), 42);
        assert_eq!(fl.available(), 3);
    }

    #[test]
    fn test_exhaustion() {
        let mut fl = FreeList::new(2);
        fl.alloc();
        fl.alloc();
        assert!(fl.alloc().is_none());
    }

    #[test]
    fn test_reuse() {
        let mut fl = FreeList::new(2);
        let i1 = fl.alloc().unwrap();
        fl.set(i1, 100);
        fl.free(i1);

        let i2 = fl.alloc().unwrap();
        assert_eq!(fl.get(i2), 0, "freed slot should be zeroed");
    }

    #[test]
    fn test_all_alloc_and_free() {
        let mut fl = FreeList::new(8);
        let mut indices = Vec::new();
        for _ in 0..8 {
            indices.push(fl.alloc().unwrap());
        }
        assert_eq!(fl.available(), 0);
        for idx in indices {
            fl.free(idx);
        }
        assert_eq!(fl.available(), 8);
    }
}
