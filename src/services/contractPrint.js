export function openContractPrint(contractId) {
  if (!contractId) return;
  const path = `/contracts/${encodeURIComponent(contractId)}/print`;
  window.open(path, '_blank', 'noopener,noreferrer');
}

export function getOverflowingContractPageNumbers(root) {
  if (!root?.querySelectorAll) return [];

  return [...root.querySelectorAll('.contract-document-page-content')]
    .map((page, index) => ({
      pageNumber: index + 1,
      overflows: page.scrollHeight > page.clientHeight + 1,
    }))
    .filter(page => page.overflows)
    .map(page => page.pageNumber);
}
