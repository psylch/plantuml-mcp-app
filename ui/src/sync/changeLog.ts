/**
 * ChangeLog: tracks user edits on the diagram for delta reporting to AI.
 *
 * Records code edits and type changes. On "Send to Agent", the log is
 * serialized to natural language and sent alongside the full diagram state.
 */

export type Change =
  | { type: "edit"; summary: string }
  | { type: "type-change"; oldType: string; newType: string };

export class ChangeLog {
  private changes: Change[] = [];

  add(change: Change): void {
    // Coalesce consecutive edits
    if (change.type === "edit" && this.changes.length > 0) {
      const last = this.changes[this.changes.length - 1];
      if (last.type === "edit") {
        this.changes[this.changes.length - 1] = change;
        return;
      }
    }

    // Coalesce consecutive type-change entries
    if (change.type === "type-change" && this.changes.length > 0) {
      const last = this.changes[this.changes.length - 1];
      if (last.type === "type-change") {
        this.changes[this.changes.length - 1] = {
          ...change,
          oldType: last.oldType,
        };
        return;
      }
    }

    this.changes.push(change);
  }

  serialize(): string {
    if (this.changes.length === 0) return "";

    return this.changes
      .map((c, i) => {
        const num = `${i + 1}.`;
        switch (c.type) {
          case "edit":
            return `${num} Edited diagram code: ${c.summary}`;
          case "type-change":
            return `${num} Changed diagram type from ${c.oldType} to ${c.newType}`;
        }
      })
      .join("\n");
  }

  clear(): void {
    this.changes = [];
  }

  get count(): number {
    return this.changes.length;
  }

  get isEmpty(): boolean {
    return this.changes.length === 0;
  }
}
