import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { parseFrontmatter } from "./validate-frontmatter";

function frontmatter(body: string): string {
  return `---\n${body}---\n\nAgent body.\n`;
}

describe("block scalar descriptions", () => {
  test("literal | keeps the indented body as the description", () => {
    const result = parseFrontmatter(
      frontmatter("name: a\ndescription: |\n  line one\n  line two\n")
    );

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toBe("line one\nline two\n");
  });

  test("|- strips the trailing newline", () => {
    const result = parseFrontmatter(
      frontmatter("name: a\ndescription: |-\n  line one\n  line two\n")
    );

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toBe("line one\nline two");
  });

  test("|+ keeps trailing newlines", () => {
    const result = parseFrontmatter(
      frontmatter("name: a\ndescription: |+\n  line one\n\n\nmodel: inherit\n")
    );

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toBe("line one\n\n\n");
    expect(result.frontmatter["model"]).toBe("inherit");
  });

  test("> folds the body onto one line", () => {
    const result = parseFrontmatter(
      frontmatter("name: a\ndescription: >\n  line one\n  line two\n")
    );

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toBe("line one line two\n");
  });

  test.each([
    ["|2", "|2\n   line one\n"],
    ["|2-", "|2-\n   line one\n"],
    ["|-2", "|-2\n   line one\n"],
    [">-", ">-\n  line one\n"],
  ])("%s header is left unquoted", (_label, value) => {
    const result = parseFrontmatter(frontmatter(`name: a\ndescription: ${value}`));

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toContain("line one");
  });

  test("block scalar body keeps colons, hashes, and quotes verbatim", () => {
    const body = 'Examples:\\n\\nDaisy: "review PR #1234" | now';
    const result = parseFrontmatter(
      frontmatter(`name: a\ndescription: |-\n  ${body}\nmodel: inherit\n`)
    );

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toBe(body);
  });

  test("a block scalar with an unindented body is still reported as broken", () => {
    const result = parseFrontmatter(
      frontmatter("name: a\ndescription: |\nline one\n")
    );

    expect(result.error).toMatch(/YAML parse failed/);
  });
});

describe("plain values with special characters", () => {
  test("a glob pattern survives quoting", () => {
    const result = parseFrontmatter(
      frontmatter("name: a\ndescription: Review **/*.{ts,tsx} files\n")
    );

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toBe("Review **/*.{ts,tsx} files");
  });

  test("a value starting with | is not mistaken for a block scalar header", () => {
    const result = parseFrontmatter(
      frontmatter("name: a\ndescription: |pipe-prefixed text\n")
    );

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toBe("|pipe-prefixed text");
  });

  test("an inline hash is kept instead of being read as a comment", () => {
    const result = parseFrontmatter(
      frontmatter("name: a\ndescription: fixes # 1234\n")
    );

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toBe("fixes # 1234");
  });

  test("an already-quoted value is left alone", () => {
    const result = parseFrontmatter(
      frontmatter('name: a\ndescription: "quoted # value"\n')
    );

    expect(result.error).toBeUndefined();
    expect(result.frontmatter["description"]).toBe("quoted # value");
  });
});

describe("invalid frontmatter", () => {
  test("a file without frontmatter reports no frontmatter found", () => {
    const result = parseFrontmatter("# Just a heading\n");

    expect(result.error).toBe("No frontmatter found");
  });

  test("a plain scalar containing a colon-space is reported as broken", () => {
    const result = parseFrontmatter(
      frontmatter("name: a\ndescription: Context: Daisy asked for a review\n")
    );

    expect(result.error).toMatch(/YAML parse failed/);
  });
});

// The CLI is what CI invokes, so exercise its exit codes end to end.
const SCRIPT = join(import.meta.dir, "validate-frontmatter.ts");

async function runCli(agentFile: string): Promise<{ code: number; out: string }> {
  const dir = await mkdtemp(join(tmpdir(), "frontmatter-"));
  await mkdir(join(dir, "agents"));
  await writeFile(join(dir, "agents", "sample.md"), agentFile);

  const proc = Bun.spawnSync(["bun", SCRIPT, dir], { stdout: "pipe", stderr: "pipe" });
  return { code: proc.exitCode, out: proc.stdout.toString() };
}

describe("cli", () => {
  test("exits 0 for an agent whose description is a block scalar", async () => {
    const { code, out } = await runCli(
      frontmatter("name: a\ndescription: |-\n  Use this agent when: reviewing.\n")
    );

    expect(out).toContain("1 files: 0 errors");
    expect(code).toBe(0);
  });

  test("exits 1 for an agent with unparseable frontmatter", async () => {
    const { code, out } = await runCli(
      frontmatter("name: a\ndescription: Context: Daisy asked for a review\n")
    );

    expect(out).toContain("ERROR: YAML parse failed");
    expect(code).toBe(1);
  });

  test("exits 1 for an agent missing a name", async () => {
    const { code, out } = await runCli(frontmatter("description: no name here\n"));

    expect(out).toContain('Missing required "name" field');
    expect(code).toBe(1);
  });
});
