use std::cmp::Reverse;
use std::collections::BinaryHeap;

fn merge_k_sorted(lists: &[Vec<i32>]) -> Vec<i32> { // TODO: implement
    let mut heap: BinaryHeap<Reverse<(i32, usize, usize)>> = BinaryHeap::new();

    for (i, list) in lists.iter().enumerate() {
        if !list.is_empty() {
            heap.push(Reverse((list[0], i, 0)));
        }
    }

    let mut result = Vec::new();
    while let Some(Reverse((val, list_idx, elem_idx))) = heap.pop() {
        result.push(val);
        let next = elem_idx + 1;
        if next < lists[list_idx].len() {
            heap.push(Reverse((lists[list_idx][next], list_idx, next)));
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_k_sorted() {
        let lists = vec![vec![1, 4, 7], vec![2, 5, 8], vec![3, 6, 9]];
        let result = merge_k_sorted(&lists);
        assert_eq!(result, vec![1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }

    #[test]
    fn test_merge_unequal_lengths() {
        let lists = vec![vec![1, 10], vec![2, 3, 4, 5], vec![6]];
        let result = merge_k_sorted(&lists);
        for i in 1..result.len() {
            assert!(result[i] >= result[i - 1], "not sorted at index {}", i);
        }
        assert_eq!(result.len(), 7);
    }

    #[test]
    fn test_merge_empty_lists() {
        let lists: Vec<Vec<i32>> = vec![vec![], vec![], vec![]];
        let result = merge_k_sorted(&lists);
        assert!(result.is_empty());
    }

    #[test]
    fn test_merge_single_list() {
        let lists = vec![vec![5, 10, 15]];
        let result = merge_k_sorted(&lists);
        assert_eq!(result, vec![5, 10, 15]);
    }
}
