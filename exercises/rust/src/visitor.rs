enum ASTNode {
    Number(i64),
    BinOp {
        op: String,
        left: Box<ASTNode>,
        right: Box<ASTNode>,
    },
}

trait ASTVisitor {
    fn visit_number(&self, value: i64) -> String;
    fn visit_bin_op(&self, op: &str, left: &ASTNode, right: &ASTNode) -> String; // TODO: implement
}

impl ASTNode {
    fn accept(&self, visitor: &dyn ASTVisitor) -> String { // TODO: implement
        match self {
            ASTNode::Number(v) => visitor.visit_number(*v),
            ASTNode::BinOp { op, left, right } => visitor.visit_bin_op(op, left, right),
        }
    }
}

struct Printer;

impl ASTVisitor for Printer {
    fn visit_number(&self, value: i64) -> String { // TODO: implement
        format!("{}", value)
    }

    fn visit_bin_op(&self, op: &str, left: &ASTNode, right: &ASTNode) -> String { // TODO: implement
        format!("({} {} {})", left.accept(self), op, right.accept(self))
    }
}

struct Evaluator;

impl ASTVisitor for Evaluator {
    fn visit_number(&self, value: i64) -> String { // TODO: implement
        format!("{}", value)
    }

    fn visit_bin_op(&self, op: &str, left: &ASTNode, right: &ASTNode) -> String { // TODO: implement
        let l: i64 = left.accept(self).parse().unwrap();
        let r: i64 = right.accept(self).parse().unwrap();
        let result = match op {
            "+" => l + r,
            "*" => l * r,
            _ => 0,
        };
        result.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_printer() {
        let tree = ASTNode::BinOp {
            op: "+".to_string(),
            left: Box::new(ASTNode::Number(1)),
            right: Box::new(ASTNode::Number(2)),
        };
        assert_eq!(tree.accept(&Printer), "(1 + 2)");
    }

    #[test]
    fn test_evaluator() {
        // 3 + (2 * 4) = 11
        let tree = ASTNode::BinOp {
            op: "+".to_string(),
            left: Box::new(ASTNode::Number(3)),
            right: Box::new(ASTNode::BinOp {
                op: "*".to_string(),
                left: Box::new(ASTNode::Number(2)),
                right: Box::new(ASTNode::Number(4)),
            }),
        };
        assert_eq!(tree.accept(&Evaluator), "11");
    }

    #[test]
    fn test_nested() {
        // (1 + 2) * (3 + 4)
        let tree = ASTNode::BinOp {
            op: "*".to_string(),
            left: Box::new(ASTNode::BinOp {
                op: "+".to_string(),
                left: Box::new(ASTNode::Number(1)),
                right: Box::new(ASTNode::Number(2)),
            }),
            right: Box::new(ASTNode::BinOp {
                op: "+".to_string(),
                left: Box::new(ASTNode::Number(3)),
                right: Box::new(ASTNode::Number(4)),
            }),
        };
        assert_eq!(tree.accept(&Printer), "((1 + 2) * (3 + 4))");
        assert_eq!(tree.accept(&Evaluator), "21");
    }
}
