use std::collections::VecDeque;

struct Task {
    name: String,
    action: Box<dyn FnOnce(&mut EventLoop)>,
}

struct EventLoop {
    queue: VecDeque<Task>,
}

impl EventLoop {
    fn new() -> Self { // TODO: implement
        Self {
            queue: VecDeque::new(),
        }
    }

    fn enqueue(&mut self, name: &str, action: impl FnOnce(&mut EventLoop) + 'static) { // TODO: implement
        self.queue.push_back(Task {
            name: name.to_string(),
            action: Box::new(action),
        });
    }

    fn run(&mut self) -> Vec<String> { // TODO: implement
        let mut executed = Vec::new();
        while let Some(task) = self.queue.pop_front() {
            (task.action)(self);
            executed.push(task.name);
        }
        executed
    }

    fn pending(&self) -> usize { // TODO: implement
        self.queue.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;

    #[test]
    fn test_event_loop_order() {
        let mut el = EventLoop::new();
        let log = Rc::new(RefCell::new(Vec::new()));

        let l = log.clone();
        el.enqueue("a", move |_| l.borrow_mut().push(1));
        let l = log.clone();
        el.enqueue("b", move |_| l.borrow_mut().push(2));
        let l = log.clone();
        el.enqueue("c", move |_| l.borrow_mut().push(3));

        let names = el.run();
        assert_eq!(names, vec!["a", "b", "c"]);
        assert_eq!(*log.borrow(), vec![1, 2, 3]);
    }

    #[test]
    fn test_event_loop_enqueue_during_run() {
        let mut el = EventLoop::new();
        let log = Rc::new(RefCell::new(Vec::new()));

        let l = log.clone();
        el.enqueue("first", move |el| {
            l.borrow_mut().push("first".to_string());
            let l2 = l.clone();
            el.enqueue("nested", move |_| {
                l2.borrow_mut().push("nested".to_string());
            });
        });

        el.run();
        assert_eq!(*log.borrow(), vec!["first", "nested"]);
    }

    #[test]
    fn test_event_loop_empty() {
        let mut el = EventLoop::new();
        let names = el.run();
        assert!(names.is_empty());
        assert_eq!(el.pending(), 0);
    }
}
