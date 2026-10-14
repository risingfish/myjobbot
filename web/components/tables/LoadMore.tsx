import { useRef } from "react";
import { useWhenVisible } from "../../lib/useWhenVisible.js";

interface LoadMoreProps {
  columns: number;
  onLoad: () => void;
  error: string | null;
}

/** Renders the last table row, which loads more rows when scrolled near or clicked. */
export function LoadMore({ columns, onLoad, error }: LoadMoreProps) {
  const row = useRef<HTMLTableRowElement>(null);
  useWhenVisible(row, onLoad);
  return (
    <tr ref={row} className="more">
      <td colSpan={columns}>
        <button type="button" onClick={onLoad}>Load more</button>
        {error && <> <small className="note">Couldn't load more: {error}</small></>}
      </td>
    </tr>
  );
}
