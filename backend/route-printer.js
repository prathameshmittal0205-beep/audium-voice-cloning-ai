const app = require('./src/index');

function printRoutes(app) {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push(middleware.route.path);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = handler.route.path;
          const fullPath = middleware.regexp.source.replace('^\\', '').replace('\\/?(?=\\/|$)', '') + path;
          routes.push(fullPath);
        }
      });
    }
  });
  console.log("Mounted Routes:");
  routes.forEach(r => console.log(r));
  process.exit(0);
}

printRoutes(app);
