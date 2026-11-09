import type { SourceModule } from "./module.js";
import { ashby } from "./modules/ashby.js";
import { gem } from "./modules/gem.js";
import { greenhouse } from "./modules/greenhouse.js";
import { lever } from "./modules/lever.js";
import { workday } from "./modules/workday.js";

export const BOARD_MODULES: readonly SourceModule<unknown>[] = [greenhouse, lever, ashby, gem, workday];
