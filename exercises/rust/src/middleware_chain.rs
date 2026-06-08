#[allow(dead_code)]
struct Context {
    request: String,
    response: String,
    log: Vec<String>,
}

impl Context {
    fn new(request: &str) -> Self { // TODO: implement
        Self {
            request: request.to_string(),
            response: String::new(),
            log: Vec::new(),
        }
    }
}

type Middleware = Box<dyn Fn(&mut Context, &dyn Fn(&mut Context))>;

struct Pipeline {
    middlewares: Vec<Middleware>,
}

impl Pipeline {
    fn new() -> Self { // TODO: implement
        Self {
            middlewares: Vec::new(),
        }
    }

    fn use_mw(&mut self, mw: impl Fn(&mut Context, &dyn Fn(&mut Context)) + 'static) { // TODO: implement
        self.middlewares.push(Box::new(mw));
    }

    fn execute(&self, ctx: &mut Context) { // TODO: implement
        self.run(ctx, 0);
    }

    fn run(&self, ctx: &mut Context, index: usize) { // TODO: implement
        if index < self.middlewares.len() {
            let mw = &self.middlewares[index];
            mw(ctx, &|ctx| self.run(ctx, index + 1));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_middleware_order() {
        let mut p = Pipeline::new();
        p.use_mw(|ctx, next| {
            ctx.log.push("A-before".to_string());
            next(ctx);
            ctx.log.push("A-after".to_string());
        });
        p.use_mw(|ctx, next| {
            ctx.log.push("B-before".to_string());
            next(ctx);
            ctx.log.push("B-after".to_string());
        });
        p.use_mw(|ctx, _next| {
            ctx.log.push("handler".to_string());
            ctx.response = "OK".to_string();
        });

        let mut ctx = Context::new("test");
        p.execute(&mut ctx);

        assert_eq!(ctx.log.join(","), "A-before,B-before,handler,B-after,A-after");
        assert_eq!(ctx.response, "OK");
    }

    #[test]
    fn test_middleware_short_circuit() {
        let mut p = Pipeline::new();
        p.use_mw(|ctx, _next| {
            ctx.response = "blocked".to_string();
        });
        p.use_mw(|ctx, next| {
            ctx.response = "should not reach".to_string();
            next(ctx);
        });

        let mut ctx = Context::new("");
        p.execute(&mut ctx);

        assert_eq!(ctx.response, "blocked");
    }

    #[test]
    fn test_middleware_empty() {
        let p = Pipeline::new();
        let mut ctx = Context::new("test");
        p.execute(&mut ctx);
        assert!(ctx.response.is_empty());
    }
}
