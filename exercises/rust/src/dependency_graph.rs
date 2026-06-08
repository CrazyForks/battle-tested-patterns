use std::collections::HashMap;

struct DepGraph {
    edges: HashMap<String, Vec<String>>,
}

impl DepGraph {
    fn new() -> Self { // TODO: implement
        Self {
            edges: HashMap::new(),
        }
    }

    fn add_dep(&mut self, node: &str, dep: &str) { // TODO: implement
        self.edges
            .entry(node.to_string())
            .or_default()
            .push(dep.to_string());
        self.edges.entry(dep.to_string()).or_default();
    }

    fn topo_sort(&self) -> Result<Vec<String>, &'static str> { // TODO: implement
        let mut state: HashMap<&str, u8> = HashMap::new(); // 0=unvisited, 1=visiting, 2=done
        let mut result = Vec::new();

        for node in self.edges.keys() {
            Self::visit(node, &self.edges, &mut state, &mut result)?;
        }
        Ok(result)
    }

    fn visit<'a>( // TODO: implement
        node: &'a str,
        edges: &'a HashMap<String, Vec<String>>,
        state: &mut HashMap<&'a str, u8>,
        result: &mut Vec<String>,
    ) -> Result<(), &'static str> {
        match state.get(node).copied().unwrap_or(0) {
            1 => return Err("cycle detected"),
            2 => return Ok(()),
            _ => {}
        }
        state.insert(node, 1);
        if let Some(deps) = edges.get(node) {
            for dep in deps {
                Self::visit(dep, edges, state, result)?;
            }
        }
        state.insert(node, 2);
        result.push(node.to_string());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_topo_sort() {
        let mut g = DepGraph::new();
        g.add_dep("app", "router");
        g.add_dep("app", "db");
        g.add_dep("router", "logger");
        g.add_dep("db", "logger");

        let order = g.topo_sort().unwrap();
        let pos: HashMap<&str, usize> = order.iter().enumerate().map(|(i, n)| (n.as_str(), i)).collect();

        assert!(pos["logger"] < pos["router"]);
        assert!(pos["logger"] < pos["db"]);
        assert!(pos["router"] < pos["app"]);
        assert!(pos["db"] < pos["app"]);
    }

    #[test]
    fn test_cycle_detection() {
        let mut g = DepGraph::new();
        g.add_dep("a", "b");
        g.add_dep("b", "c");
        g.add_dep("c", "a");

        assert!(g.topo_sort().is_err());
    }

    #[test]
    fn test_self_cycle() {
        let mut g = DepGraph::new();
        g.add_dep("solo", "solo");

        assert!(g.topo_sort().is_err());
    }
}
