import { env } from "cloudflare:workers";
import { D1Repository } from "./d1-repository.ts";
import { describeRepositoryContract } from "./repository.contract.ts";

// env.DB is a real local D1 database with the migrations applied (see test/apply-migrations.ts).
describeRepositoryContract("D1Repository", () => new D1Repository(env.DB));
