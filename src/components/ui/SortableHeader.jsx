function SortableHeader({ field, sort, onSort, children }) {
  const active = sort.field === field;
  return (
    <th aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="table-sort-button"
        onClick={() => onSort({ field, direction: active && sort.direction === "asc" ? "desc" : "asc" })}
      >
        {children} <span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

export default SortableHeader;
