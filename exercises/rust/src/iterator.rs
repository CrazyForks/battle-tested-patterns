pub struct Iter<T> {
    items: Vec<T>,
}

impl<T: Clone> Iter<T> {
    pub fn from(items: Vec<T>) -> Self { // TODO: implement
        Iter { items }
    }

    pub fn filter<F>(self, pred: F) -> Iter<T> // TODO: implement
    where
        F: Fn(&T) -> bool,
    {
        Iter {
            items: self.items.into_iter().filter(|x| pred(x)).collect(),
        }
    }

    pub fn map_items<U: Clone, F>(self, f: F) -> Iter<U> // TODO: implement
    where
        F: Fn(T) -> U,
    {
        Iter {
            items: self.items.into_iter().map(f).collect(),
        }
    }

    pub fn take(self, n: usize) -> Iter<T> { // TODO: implement
        Iter {
            items: self.items.into_iter().take(n).collect(),
        }
    }

    pub fn collect(self) -> Vec<T> { // TODO: implement
        self.items
    }

    pub fn fold<U, F>(self, init: U, f: F) -> U // TODO: implement
    where
        F: Fn(U, T) -> U,
    {
        self.items.into_iter().fold(init, f)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_filter() {
        let result = Iter::from(vec![1, 2, 3, 4, 5, 6])
            .filter(|x| x % 2 != 0)
            .collect();
        assert_eq!(result, vec![1, 3, 5]);
    }

    #[test]
    fn test_map_and_take() {
        let result = Iter::from(vec![1, 2, 3, 4, 5])
            .map_items(|x| x * 2)
            .take(3)
            .collect();
        assert_eq!(result, vec![2, 4, 6]);
    }

    #[test]
    fn test_pipeline() {
        let result = Iter::from(vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
            .filter(|x| x % 2 != 0)
            .map_items(|x| x * 10)
            .take(3)
            .collect();
        assert_eq!(result, vec![10, 30, 50]);
    }

    #[test]
    fn test_fold() {
        let sum = Iter::from(vec![1, 2, 3, 4, 5])
            .fold(0, |acc, x| acc + x);
        assert_eq!(sum, 15);
    }

    #[test]
    fn test_empty() {
        let result: Vec<i32> = Iter::from(vec![])
            .filter(|_| true)
            .collect();
        assert!(result.is_empty());
    }
}
