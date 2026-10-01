import type { Finding } from "@agent-mapper/core";
import type { PathContext } from "../model/paths";
import { precedenceOf } from "../model/precedence";
import type { InventoryRecord } from "../model/record-types";
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
