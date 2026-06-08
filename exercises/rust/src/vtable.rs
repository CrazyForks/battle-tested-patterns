use std::collections::HashMap;

struct VTable {
    type_name: String,
    methods: HashMap<String, Box<dyn Fn(&dyn std::any::Any) -> String>>,
}

impl VTable {
    fn new(type_name: &str) -> Self { // TODO: implement
        Self {
            type_name: type_name.to_string(),
            methods: HashMap::new(),
        }
    }

    fn add_method( // TODO: implement
        &mut self,
        name: &str,
        f: impl Fn(&dyn std::any::Any) -> String + 'static,
    ) {
        self.methods.insert(name.to_string(), Box::new(f));
    }
}

struct DynObject<'a> {
    vtable: &'a VTable,
    data: Box<dyn std::any::Any>,
}

impl<'a> DynObject<'a> {
    fn new(vtable: &'a VTable, data: impl std::any::Any) -> Self { // TODO: implement
        Self {
            vtable,
            data: Box::new(data),
        }
    }

    fn call(&self, method: &str) -> Option<String> { // TODO: implement
        let f = self.vtable.methods.get(method)?;
        Some(f(self.data.as_ref()))
    }

    fn type_name(&self) -> &str { // TODO: implement
        &self.vtable.type_name
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dispatch() {
        let mut vt = VTable::new("Dog");
        vt.add_method("speak", |data| {
            let name = data.downcast_ref::<String>().unwrap();
            format!("{} says Woof!", name)
        });

        let dog = DynObject::new(&vt, "Rex".to_string());
        assert_eq!(dog.call("speak"), Some("Rex says Woof!".to_string()));
    }

    #[test]
    fn test_shared() {
        let mut vt = VTable::new("Cat");
        vt.add_method("speak", |data| {
            let name = data.downcast_ref::<String>().unwrap();
            format!("{} says Meow!", name)
        });

        let cat1 = DynObject::new(&vt, "Whiskers".to_string());
        let cat2 = DynObject::new(&vt, "Mittens".to_string());

        assert_ne!(cat1.call("speak"), cat2.call("speak"));
        assert_eq!(cat1.type_name(), cat2.type_name());
    }

    #[test]
    fn test_missing_method() {
        let vt = VTable::new("Fish");
        let fish = DynObject::new(&vt, ());
        assert_eq!(fish.call("fly"), None);
    }

    #[test]
    fn test_multiple_methods() {
        let mut vt = VTable::new("Calculator");
        vt.add_method("add", |data| {
            let nums = data.downcast_ref::<(i32, i32)>().unwrap();
            format!("{}", nums.0 + nums.1)
        });
        vt.add_method("mul", |data| {
            let nums = data.downcast_ref::<(i32, i32)>().unwrap();
            format!("{}", nums.0 * nums.1)
        });

        let calc = DynObject::new(&vt, (3i32, 4i32));
        assert_eq!(calc.call("add"), Some("7".to_string()));
        assert_eq!(calc.call("mul"), Some("12".to_string()));
    }
}
