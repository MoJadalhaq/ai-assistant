import { MemoryRepository } from "./memory-repository.ts";
import { describeRepositoryContract } from "./repository.contract.ts";

describeRepositoryContract("MemoryRepository", () => new MemoryRepository());
