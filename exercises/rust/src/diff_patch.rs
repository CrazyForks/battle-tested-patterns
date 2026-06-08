#[derive(Debug, PartialEq)]
enum EditKind {
    Keep,
    Add,
    Remove,
}

#[derive(Debug)]
struct EditOp {
    kind: EditKind,
    text: String,
}

fn diff_lines(old: &[&str], new: &[&str]) -> Vec<EditOp> { // TODO: implement
    let m = old.len();
    let n = new.len();

    let mut dp = vec![vec![0usize; n + 1]; m + 1];
    for i in 1..=m {
        for j in 1..=n {
            if old[i - 1] == new[j - 1] {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
            }
        }
    }

    let mut ops = Vec::new();
    let (mut i, mut j) = (m, n);
    while i > 0 || j > 0 {
        if i > 0 && j > 0 && old[i - 1] == new[j - 1] {
            ops.push(EditOp {
                kind: EditKind::Keep,
                text: old[i - 1].to_string(),
            });
            i -= 1;
            j -= 1;
        } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
            ops.push(EditOp {
                kind: EditKind::Add,
                text: new[j - 1].to_string(),
            });
            j -= 1;
        } else {
            ops.push(EditOp {
                kind: EditKind::Remove,
                text: old[i - 1].to_string(),
            });
            i -= 1;
        }
    }
    ops.reverse();
    ops
}

fn patch(ops: &[EditOp]) -> Vec<String> { // TODO: implement
    ops.iter()
        .filter(|op| op.kind != EditKind::Remove)
        .map(|op| op.text.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_change() {
        let lines = vec!["a", "b", "c"];
        let ops = diff_lines(&lines, &lines);
        assert!(ops.iter().all(|op| op.kind == EditKind::Keep));
    }

    #[test]
    fn test_add_remove() {
        let old = vec!["a", "b", "c"];
        let new = vec!["a", "x", "c"];
        let ops = diff_lines(&old, &new);

        let has_remove = ops.iter().any(|op| op.kind == EditKind::Remove && op.text == "b");
        let has_add = ops.iter().any(|op| op.kind == EditKind::Add && op.text == "x");
        assert!(has_remove && has_add);
    }

    #[test]
    fn test_patch_apply() {
        let old = vec!["a", "b", "c"];
        let new = vec!["a", "x", "c", "d"];
        let ops = diff_lines(&old, &new);
        let result = patch(&ops);
        let expected: Vec<String> = new.iter().map(|s| s.to_string()).collect();
        assert_eq!(result, expected);
    }

    #[test]
    fn test_diff_empty() {
        let ops = diff_lines(&[], &["a", "b"]);
        let add_count = ops.iter().filter(|op| op.kind == EditKind::Add).count();
        assert_eq!(add_count, 2);
    }
}
