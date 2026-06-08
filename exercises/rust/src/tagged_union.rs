use std::fmt;

enum TaggedValue {
    Int(i64),
    Float(f64),
    Str(String),
}

impl TaggedValue {
    fn is_numeric(&self) -> bool { // TODO: implement
        matches!(self, TaggedValue::Int(_) | TaggedValue::Float(_))
    }
}

impl fmt::Display for TaggedValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { // TODO: implement
        match self {
            TaggedValue::Int(v) => write!(f, "Int({})", v),
            TaggedValue::Float(v) => write!(f, "Float({:.2})", v),
            TaggedValue::Str(v) => write!(f, "String({:?})", v),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_int() {
        let v = TaggedValue::Int(42);
        assert!(v.is_numeric());
        assert_eq!(v.to_string(), "Int(42)");
    }

    #[test]
    fn test_float() {
        let v = TaggedValue::Float(3.14);
        assert!(v.is_numeric());
        assert_eq!(v.to_string(), "Float(3.14)");
    }

    #[test]
    fn test_string() {
        let v = TaggedValue::Str("hello".to_string());
        assert!(!v.is_numeric());
        assert_eq!(v.to_string(), "String(\"hello\")");
    }

    #[test]
    fn test_collection() {
        let values = vec![
            TaggedValue::Int(1),
            TaggedValue::Float(2.5),
            TaggedValue::Str("three".to_string()),
        ];
        let num_count = values.iter().filter(|v| v.is_numeric()).count();
        assert_eq!(num_count, 2);
    }
}
