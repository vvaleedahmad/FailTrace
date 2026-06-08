import { app } from "./app.js";
import { env } from "./config/env.js";
import { bootstrapConfiguredAdmin } from "./modules/auth/auth.service.js";

await bootstrapConfiguredAdmin();

app.listen(env.port, () => {
  console.log(`API server listening on port ${env.port}`);
});
