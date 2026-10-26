// A table row that reveals a detail row underneath when clicked.
export function ExpandableRow({
  open,
  onToggle,
  colSpan,
  detail,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  colSpan: number;
  detail: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr onClick={onToggle} className="border-b border-stone-100 cursor-pointer hover:bg-stone-50">
        {children}
      </tr>
      {open && (
        <tr className="border-b border-stone-100 bg-stone-50">
          <td colSpan={colSpan} className="p-4">{detail}</td>
        </tr>
      )}
    </>
  );
}
