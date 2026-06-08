use std::sync::Arc;

#[derive(Clone)]
pub struct CowList {
    data: Arc<Vec<i32>>,
}

impl CowList {
    pub fn new(items: Vec<i32>) -> Self { // TODO: implement
        CowList { data: Arc::new(items) }
    }

    pub fn get(&self, index: usize) -> i32 { // TODO: implement
        self.data[index]
    }

    pub fn set(&mut self, index: usize, value: i32) { // TODO: implement
        let data = Arc::make_mut(&mut self.data);
        data[index] = value;
    }

    #[allow(dead_code)]
    pub fn len(&self) -> usize { // TODO: implement
        self.data.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shared_read() {
        let a = CowList::new(vec![1, 2, 3]);
        let b = a.clone();
        assert_eq!(a.get(0), b.get(0));
    }

    #[test]
    fn test_copy_on_write() {
        let a = CowList::new(vec![1, 2, 3]);
        let mut b = a.clone();
        b.set(0, 99);
        assert_eq!(a.get(0), 1);
        assert_eq!(b.get(0), 99);
    }

    #[test]
    fn test_no_unnecessary_copy() {
        let mut a = CowList::new(vec![10, 20]);
        a.set(0, 99);
        assert_eq!(a.get(0), 99);
    }
}
