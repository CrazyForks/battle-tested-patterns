struct Checkpoint<T> {
    history: Vec<T>,
}

impl<T: Clone> Checkpoint<T> {
    fn new() -> Self { // TODO: implement
        Self {
            history: Vec::new(),
        }
    }

    fn save(&mut self, state: T) { // TODO: implement
        self.history.push(state);
    }

    fn restore(&self, index: usize) -> Option<&T> { // TODO: implement
        self.history.get(index)
    }

    fn latest(&self) -> Option<&T> { // TODO: implement
        self.history.last()
    }

    fn len(&self) -> usize { // TODO: implement
        self.history.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_save_and_restore() {
        let mut cp = Checkpoint::new();
        cp.save(10);
        cp.save(20);
        cp.save(30);

        assert_eq!(cp.restore(0), Some(&10));
        assert_eq!(cp.restore(2), Some(&30));
    }

    #[test]
    fn test_latest() {
        let mut cp = Checkpoint::new();
        cp.save("v1".to_string());
        cp.save("v2".to_string());

        assert_eq!(cp.latest(), Some(&"v2".to_string()));
    }

    #[test]
    fn test_empty() {
        let cp: Checkpoint<i32> = Checkpoint::new();
        assert!(cp.latest().is_none());
        assert!(cp.restore(0).is_none());
    }

    #[test]
    fn test_out_of_bounds() {
        let mut cp = Checkpoint::new();
        cp.save(1);
        assert!(cp.restore(5).is_none());
        assert_eq!(cp.len(), 1);
    }
}
