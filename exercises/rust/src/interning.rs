use std::collections::HashMap;
use std::sync::Arc;

struct Interner {
    pool: HashMap<String, Arc<str>>,
}

impl Interner {
    fn new() -> Self { // TODO: implement
        Self {
            pool: HashMap::new(),
        }
    }

    fn intern(&mut self, s: &str) -> Arc<str> { // TODO: implement
        if let Some(existing) = self.pool.get(s) {
            return Arc::clone(existing);
        }
        let arc: Arc<str> = Arc::from(s);
        self.pool.insert(s.to_string(), Arc::clone(&arc));
        arc
    }

    fn len(&self) -> usize { // TODO: implement
        self.pool.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_same_pointer() {
        let mut interner = Interner::new();
        let p1 = interner.intern("hello");
        let p2 = interner.intern("hello");
        assert!(Arc::ptr_eq(&p1, &p2));
    }

    #[test]
    fn test_different_strings() {
        let mut interner = Interner::new();
        let p1 = interner.intern("hello");
        let p2 = interner.intern("world");
        assert!(!Arc::ptr_eq(&p1, &p2));
        assert_eq!(interner.len(), 2);
    }

    #[test]
    fn test_value() {
        let mut interner = Interner::new();
        let p = interner.intern("test");
        assert_eq!(&*p, "test");
    }

    #[test]
    fn test_many_strings() {
        let mut interner = Interner::new();
        let strs = vec!["alpha", "beta", "gamma", "alpha", "beta"];
        let ptrs: Vec<_> = strs.iter().map(|s| interner.intern(s)).collect();

        assert_eq!(interner.len(), 3);
        assert!(Arc::ptr_eq(&ptrs[0], &ptrs[3])); // alpha
        assert!(Arc::ptr_eq(&ptrs[1], &ptrs[4])); // beta
    }
}
