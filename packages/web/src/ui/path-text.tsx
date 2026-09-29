/** Long paths in detail panes break after "/" instead of mid-word. */
export function PathText({ path }: { path: string }) {
  const parts = path.split("/");
  const segments = parts.map((part, position) => ({
    part,
    key: parts.slice(0, position + 1).join("/"),
    last: position === parts.length - 1
  }));
  return segments.map((segment) => (
    <span key={segment.key}>
      {segment.part}
      {segment.last ? null : (
        <>
          /<wbr />
        </>
      )}
    </span>
  ));
}
