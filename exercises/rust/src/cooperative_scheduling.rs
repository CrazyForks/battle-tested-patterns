struct CoopTask {
    #[allow(dead_code)]
    name: String,
    steps: Vec<Box<dyn Fn() -> String>>,
}

struct Scheduler {
    tasks: Vec<CoopTask>,
}

impl Scheduler {
    fn new() -> Self { // TODO: implement
        Self { tasks: Vec::new() }
    }

    fn add_task(&mut self, name: &str, steps: Vec<Box<dyn Fn() -> String>>) { // TODO: implement
        self.tasks.push(CoopTask {
            name: name.to_string(),
            steps,
        });
    }

    fn run(&self) -> Vec<String> { // TODO: implement
        let mut cursors = vec![0usize; self.tasks.len()];
        let mut results = Vec::new();

        loop {
            let mut progress = false;
            for (i, task) in self.tasks.iter().enumerate() {
                if cursors[i] < task.steps.len() {
                    let result = (task.steps[cursors[i]])();
                    results.push(result);
                    cursors[i] += 1;
                    progress = true;
                }
            }
            if !progress {
                break;
            }
        }
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interleaving() {
        let mut s = Scheduler::new();
        s.add_task(
            "A",
            vec![
                Box::new(|| "A1".to_string()),
                Box::new(|| "A2".to_string()),
            ],
        );
        s.add_task(
            "B",
            vec![
                Box::new(|| "B1".to_string()),
                Box::new(|| "B2".to_string()),
            ],
        );

        let results = s.run();
        assert_eq!(results, vec!["A1", "B1", "A2", "B2"]);
    }

    #[test]
    fn test_unequal_steps() {
        let mut s = Scheduler::new();
        s.add_task(
            "A",
            vec![
                Box::new(|| "A1".to_string()),
                Box::new(|| "A2".to_string()),
                Box::new(|| "A3".to_string()),
            ],
        );
        s.add_task("B", vec![Box::new(|| "B1".to_string())]);

        let results = s.run();
        assert_eq!(results.len(), 4);
        assert_eq!(results[0], "A1");
        assert_eq!(results[1], "B1");
    }

    #[test]
    fn test_empty() {
        let s = Scheduler::new();
        assert!(s.run().is_empty());
    }
}
