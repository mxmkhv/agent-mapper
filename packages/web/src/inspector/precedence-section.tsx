import type { Finding } from "@agent-mapper/core";
import { isLink, linkedFrom, linkTarget } from "../model/links";
import { tildePath, type PathContext } from "../model/paths";
import { precedenceOf } from "../model/precedence";
import type { InventoryRecord } from "../model/record-types";
import { PathText } from "../ui/path-text";
import { LinkRow, Section } from "./inspector-sections";

interface PrecedenceProps {
  record: InventoryRecord;
  scope: {
    records: InventoryRecord[];
    findings: Finding[];
    context: PathContext;
  };
  onSelect(id: string): void;
}

/** What the record wins over, what wins over it, and which skills share its name. */
export function PrecedenceSection({
  record,
  scope,
  onSelect
}: PrecedenceProps) {
  const { overriddenBy, overrides, sameName } = precedenceOf(record, scope);
  const sections: [string, InventoryRecord[]][] = [
    ["Overridden by", overriddenBy ? [overriddenBy] : []],
    ["Overrides", overrides],
    ["Shares its name with", sameName]
  ];
  return sections.map(([title, records]) =>
    records.length ? (
      <Section key={title} title={title}>
        {records.map((item) => (
          <LinkRow
            context={scope.context}
            key={item.id}
            onSelect={onSelect}
            record={item}
            symlink={false}
          />
        ))}
      </Section>
    ) : null
  );
}

/** The file a symlink points to, and the symlinks that point at this file. */
export function Links({ record, scope, onSelect }: PrecedenceProps) {
  const target = isLink(record) ? linkTarget(record, scope.records) : undefined;
  const sources = linkedFrom(record, scope.records);
  return (
    <>
      {isLink(record) ? (
        <Section title="Symlink to">
          {target ? (
            <LinkRow
              context={scope.context}
              onSelect={onSelect}
              record={target}
            />
          ) : (
            <p className="m-0 font-mono text-mono break-words">
              <PathText path={tildePath(record.realPath, scope.context)} />
            </p>
          )}
        </Section>
      ) : null}
      {sources.length ? (
        <Section
          title={`Linked from ${sources.length} ${sources.length === 1 ? "place" : "places"}`}
        >
          {sources.map((source) => (
            <LinkRow
              context={scope.context}
              key={source.id}
              onSelect={onSelect}
              record={source}
            />
          ))}
        </Section>
      ) : null}
    </>
  );
}
