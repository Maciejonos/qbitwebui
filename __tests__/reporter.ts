import type { Reporter, Vitest } from "vitest/node";
import pc from "picocolors";
import path from "node:path";

type TaskState = "pass" | "fail" | "skip" | "todo" | "pending" | "unknown";

type AnyTask = {
    id?: string;
    type?: "suite" | "test";
    name?: string;
    mode?: "run" | "skip" | "only" | "todo";
    tasks?: AnyTask[];
    result?: {
        state?: unknown;
        duration?: number;
        errors?: unknown[];
    };
};

type AnyFile = {
    filepath?: string;
    name?: string;
    file?: string;
    tasks?: AnyTask[];
};

type TaskResultPack = {
    id: string;
    result?: {
        state?: unknown;
        duration?: number;
        errors?: unknown[];
    };
};

function normalisePath(p: string) {
    return p.replaceAll("\\", "/");
}

function toRelative(p: string) {
    try {
        return path.relative(process.cwd(), p);
    } catch {
        return p;
    }
}

function safeBasename(p: string) {
    try {
        return path.basename(p);
    } catch {
        return p;
    }
}

function safeDirname(p: string) {
    try {
        return path.dirname(p);
    } catch {
        return "";
    }
}

function normaliseState(rawState: unknown, mode: unknown): TaskState {
    if (mode === "skip") return "skip";
    if (mode === "todo") return "todo";

    const s = String(rawState ?? "").toLowerCase();

    if (s === "pass" || s === "passed" || s === "success") return "pass";
    if (s === "fail" || s === "failed") return "fail";
    if (s === "skip" || s === "skipped") return "skip";
    if (s === "todo") return "todo";

    if (!s) return "pending";
    return "unknown";
}

function iconFor(state: TaskState) {
    switch (state) {
        case "pass":
            return pc.green("✔");
        case "fail":
            return pc.red("✖");
        case "skip":
            return pc.yellow("↷");
        case "todo":
            return pc.yellow("…");
        case "pending":
            return pc.gray("·");
        default:
            return pc.gray("?");
    }
}

function colourName(state: TaskState, text: string) {
    switch (state) {
        case "pass":
            return pc.white(text);
        case "fail":
            return pc.red(text);
        case "skip":
        case "todo":
            return pc.yellow(text);
        default:
            return pc.gray(text);
    }
}

function formatDuration(ms?: number) {
    if (!ms || ms <= 0) return "";
    if (ms < 1000) return pc.dim(` ${Math.round(ms)}ms`);
    return pc.dim(` ${(ms / 1000).toFixed(2)}s`);
}

export default class PrettyReporter implements Reporter {
    private ctx: Vitest | undefined;

    private startMs = 0;

    private indexed = false;
    private totalTests = 0;

    private pass = 0;
    private fail = 0;
    private skip = 0;
    private todo = 0;

    private completed = new Set<string>();
    private lastProgressRender = 0;

    onInit(ctx: Vitest) {
        try {
            this.ctx = ctx;
            this.startMs = Date.now();

            process.stdout.write(pc.cyan(pc.bold("\n QBITWEBUI TEST SUITE \n")));
            process.stdout.write(pc.gray(" Running tests…\n\n"));
        } catch (e) {
            console.error("Reporter init error:", e);
        }
    }

    onTaskUpdate(packs: TaskResultPack[]) {
        try {
            this.ensureIndexedFromState();

            for (const pack of packs ?? []) {
                if (!pack?.id) continue;
                if (!pack.result) continue;

                const state = normaliseState(pack.result.state, undefined);

                const terminal =
                    state === "pass" || state === "fail" || state === "skip" || state === "todo";

                if (!terminal) continue;
                if (this.completed.has(pack.id)) continue;

                this.completed.add(pack.id);

                if (state === "pass") this.pass += 1;
                if (state === "fail") this.fail += 1;
                if (state === "skip") this.skip += 1;
                if (state === "todo") this.todo += 1;
            }

            // Progress bar (throttled)
            const now = Date.now();
            if (now - this.lastProgressRender < 1) return;
            this.lastProgressRender = now;

            this.renderProgressLine();
        } catch (e) {
            console.error("Reporter update error:", e);
        }
    }

    onTestRunEnd() {
        try {
            // Clear the progress line
            process.stdout.write("\r\x1b[2K\n");
            this.printReportFromState();
        } catch (e) {
            console.error("Reporter error:", e);
        }
    }

    private getStateFiles(): AnyFile[] {
        const ctx = this.ctx as { state?: { getFiles?: () => unknown; files?: unknown } } | undefined;
        const state = ctx?.state;

        const filesFromGetter = state?.getFiles?.();
        if (Array.isArray(filesFromGetter)) return filesFromGetter;

        const filesFromProp = state?.files;
        if (Array.isArray(filesFromProp)) return filesFromProp;

        return [];
    }

    private ensureIndexedFromState() {
        if (this.indexed) return;

        const files = this.getStateFiles();
        if (!files.length) return;

        let total = 0;

        const walk = (t: AnyTask) => {
            if (!t) return;
            if (t.type === "test") total += 1;
            if (Array.isArray(t.tasks)) t.tasks.forEach(walk);
        };

        files.forEach((f) => {
            if (Array.isArray(f.tasks)) f.tasks.forEach(walk);
        });

        this.totalTests = total;
        this.indexed = true;
    }

    private renderProgressLine() {
        const total = Math.max(this.totalTests, 1);
        const done = Math.min(this.completed.size, total);
        const pct = this.totalTests ? Math.round((done / total) * 100) : 0;

        const width = 28;
        const filled = Math.round((pct / 100) * width);
        const bar =
            pc.green("█".repeat(filled)) + pc.gray("░".repeat(width - filled));

        const elapsed = (Date.now() - this.startMs) / 1000;

        const line = [
            pc.dim(" Progress "),
            "[",
            bar,
            "] ",
            pc.white(`${pct}%`),
            pc.dim(`  (${done}/${this.totalTests})`),
            pc.dim("  | "),
            pc.green(`✔ ${this.pass}`),
            pc.dim(" "),
            pc.red(`✖ ${this.fail}`),
            pc.dim(" "),
            pc.yellow(`↷ ${this.skip}`),
            this.todo ? pc.dim(" ") : "",
            this.todo ? pc.yellow(`… ${this.todo}`) : "",
            pc.dim(`  | ${elapsed.toFixed(1)}s`),
        ].join("");

        process.stdout.write("\r\x1b[2K" + line);
    }

    private printReportFromState() {
        const files = this.getStateFiles();

        const endMs = Date.now();
        const duration = ((endMs - this.startMs) / 1000).toFixed(2);

        // Recompute final totals from the actual state (authoritative)
        const totals = this.computeTotals(files);
        this.pass = totals.pass;
        this.fail = totals.fail;
        this.skip = totals.skip;
        this.todo = totals.todo;
        this.totalTests = totals.total;

        process.stdout.write(pc.cyan(pc.bold("\n RESULTS \n")));

        // Group by directory
        const grouped = new Map<string, AnyFile[]>();
        for (const file of files) {
            const raw = file.filepath ?? file.file ?? file.name ?? "";
            const rel = normalisePath(toRelative(raw));
            const dir = normalisePath(safeDirname(rel)) || ".";
            const arr = grouped.get(dir) ?? [];
            arr.push(file);
            grouped.set(dir, arr);
        }

        const dirs = [...grouped.keys()].sort((a, b) => a.localeCompare(b));

        for (const dir of dirs) {
            const niceDir = dir === "." ? "__tests__" : dir;
            process.stdout.write(pc.magenta(pc.bold(`\n 📁 ${niceDir}\n`)));

            const dirFiles = grouped.get(dir) ?? [];
            dirFiles.sort((a, b) => {
                const ap = a.filepath ?? a.file ?? a.name ?? "";
                const bp = b.filepath ?? b.file ?? b.name ?? "";
                return ap.localeCompare(bp);
            });

            for (const file of dirFiles) {
                const raw = file.filepath ?? file.file ?? file.name ?? "";
                const rel = normalisePath(toRelative(raw));
                const fname = safeBasename(rel);

                const stats = this.computeFileTotals(file);

                const badge =
                    stats.fail > 0
                        ? pc.red(` ${stats.fail} failed`)
                        : pc.green(` ${stats.pass} passed`);

                const extrasParts: string[] = [];
                if (stats.skip > 0) extrasParts.push(pc.yellow(`${stats.skip} skipped`));
                if (stats.todo > 0) extrasParts.push(pc.yellow(`${stats.todo} todo`));

                const extras = extrasParts.length
                    ? pc.dim(` (${extrasParts.join(", ")})`)
                    : "";

                process.stdout.write(
                    `  ${pc.dim(fname)}${pc.dim("  ")}${badge}${extras}${formatDuration(
                        stats.durationMs,
                    )}\n`,
                );

                if (Array.isArray(file.tasks) && file.tasks.length) {
                    for (const t of file.tasks) this.printTaskTree(t, 4);
                } else {
                    process.stdout.write(pc.dim("    (no tasks collected)\n"));
                }
            }
        }

        const done = this.pass + this.fail + this.skip + this.todo;
        const pct = this.totalTests ? Math.round((done / this.totalTests) * 100) : 0;

        process.stdout.write(pc.gray("\n ─────────────────────────────────────────────\n"));
        process.stdout.write(
            ` Summary: ${pc.green(`✔ ${this.pass}`)}  ${pc.red(
                `✖ ${this.fail}`,
            )}  ${pc.yellow(`↷ ${this.skip}`)}${this.todo ? `  ${pc.yellow(`… ${this.todo}`)}` : ""
            }\n`,
        );
        process.stdout.write(
            ` Progress: ${pct}% (${done}/${this.totalTests})\n`,
        );
        process.stdout.write(` Time: ${duration}s\n`);

        if (this.fail > 0) {
            process.stdout.write(
                pc.red(
                    `\n ${this.fail} failing test(s). Check your code.\n\n`,
                ),
            );
            process.exitCode = 1;
        } else {
            process.stdout.write(
                pc.green(`\n All tests passed. \n\n`),
            );
            process.exitCode = 0;
        }
    }

    private computeTotals(files: AnyFile[]) {
        let pass = 0;
        let fail = 0;
        let skip = 0;
        let todo = 0;
        let total = 0;

        const walk = (t: AnyTask) => {
            if (!t) return;

            if (t.type === "test") {
                total += 1;
                const st = normaliseState(t.result?.state, t.mode);
                if (st === "pass") pass += 1;
                else if (st === "fail") fail += 1;
                else if (st === "skip") skip += 1;
                else if (st === "todo") todo += 1;
            }

            if (Array.isArray(t.tasks)) t.tasks.forEach(walk);
        };

        files.forEach((f) => {
            if (Array.isArray(f.tasks)) f.tasks.forEach(walk);
        });

        return { pass, fail, skip, todo, total };
    }

    private computeFileTotals(file: AnyFile) {
        let pass = 0;
        let fail = 0;
        let skip = 0;
        let todo = 0;
        let durationMs = 0;

        const walk = (t: AnyTask) => {
            if (!t) return;

            if (t.type === "test") {
                const st = normaliseState(t.result?.state, t.mode);
                if (st === "pass") pass += 1;
                else if (st === "fail") fail += 1;
                else if (st === "skip") skip += 1;
                else if (st === "todo") todo += 1;

                if (typeof t.result?.duration === "number") {
                    durationMs += t.result.duration;
                }
            }

            if (Array.isArray(t.tasks)) t.tasks.forEach(walk);
        };

        if (Array.isArray(file.tasks)) file.tasks.forEach(walk);

        return { pass, fail, skip, todo, durationMs };
    }

    private printTaskTree(task: AnyTask, indent: number) {
        const pad = " ".repeat(indent);

        if (task.type === "suite") {
            if (task.name && task.name.trim()) {
                process.stdout.write(`${pad}${pc.blue(pc.bold(task.name))}\n`);
            }
            if (Array.isArray(task.tasks)) {
                for (const child of task.tasks) this.printTaskTree(child, indent + 2);
            }
            return;
        }

        if (task.type === "test") {
            const state = normaliseState(task.result?.state, task.mode);
            const icon = iconFor(state);
            const name = colourName(state, task.name ?? "(unnamed test)");
            const time = formatDuration(task.result?.duration);

            process.stdout.write(`${pad}${icon} ${name}${time}\n`);

            if (state === "fail" && Array.isArray(task.result?.errors)) {
                for (const err of task.result.errors) {
                    let msg: string;
                    if (err instanceof Error) {
                        msg = err.message.split("\n")[0];
                    } else if (typeof err === "string") {
                        msg = err.split("\n")[0];
                    } else if (err && typeof err === "object") {
                        try {
                            msg = JSON.stringify(err).slice(0, 100);
                        } catch {
                            msg = "[object]";
                        }
                    } else {
                        msg = String(err ?? "Unknown error").split("\n")[0];
                    }

                    process.stdout.write(`${pad}  ${pc.red("└─ ")}${pc.dim(msg)}\n`);
                }
            }
        }
    }
}
