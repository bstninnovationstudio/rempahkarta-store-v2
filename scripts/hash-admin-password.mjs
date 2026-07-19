import { createAdminPasswordHash } from "../lib/password.ts";

let password = process.env.ADMIN_PASSWORD;
if (!password && !process.stdin.isTTY) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  password = Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString("utf8").replace(/[\r\n]+$/, "");
}
if (!password) {
  console.error("Kirim password melalui stdin atau set ADMIN_PASSWORD sementara.");
  process.exitCode = 1;
} else {
  console.log(await createAdminPasswordHash(password));
}
