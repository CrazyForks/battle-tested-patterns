use std::cell::Cell;
use std::rc::Rc as StdRc;

struct RcInner<T> {
    value: T,
    ref_count: Cell<i64>,
    dropped: StdRc<Cell<bool>>,
}

struct Rc<T> {
    inner: StdRc<RcInner<T>>,
}

impl<T> Rc<T> {
    fn new(value: T, dropped: StdRc<Cell<bool>>) -> Self { // TODO: implement
        Self {
            inner: StdRc::new(RcInner {
                value,
                ref_count: Cell::new(1),
                dropped,
            }),
        }
    }

    fn clone_rc(&self) -> Self { // TODO: implement
        self.inner.ref_count.set(self.inner.ref_count.get() + 1);
        Self {
            inner: StdRc::clone(&self.inner),
        }
    }

    fn drop_rc(&self) { // TODO: implement
        let count = self.inner.ref_count.get() - 1;
        self.inner.ref_count.set(count);
        if count == 0 {
            self.inner.dropped.set(true);
        }
    }

    fn ref_count(&self) -> i64 { // TODO: implement
        self.inner.ref_count.get()
    }

    fn value(&self) -> &T { // TODO: implement
        &self.inner.value
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rc_basic() {
        let dropped = StdRc::new(Cell::new(false));
        let r = Rc::new(42, dropped.clone());
        assert_eq!(*r.value(), 42);
        assert_eq!(r.ref_count(), 1);
        r.drop_rc();
        assert!(dropped.get());
    }

    #[test]
    fn test_rc_clone() {
        let dropped = StdRc::new(Cell::new(false));
        let r1 = Rc::new("hello", dropped.clone());
        let r2 = r1.clone_rc();

        assert_eq!(r1.ref_count(), 2);

        r1.drop_rc();
        assert!(!dropped.get());
        assert_eq!(r2.ref_count(), 1);

        r2.drop_rc();
        assert!(dropped.get());
    }

    #[test]
    fn test_rc_multiple_clones() {
        let dropped = StdRc::new(Cell::new(false));
        let r = Rc::new(99, dropped.clone());
        let clones: Vec<_> = (0..5).map(|_| r.clone_rc()).collect();
        assert_eq!(r.ref_count(), 6);

        for c in &clones {
            c.drop_rc();
        }
        assert!(!dropped.get());

        r.drop_rc();
        assert!(dropped.get());
    }
}
