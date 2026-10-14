/** Renders a bullet list of text items, or nothing when there are none. */
export function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
}
