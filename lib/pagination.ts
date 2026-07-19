export type PaginationInput = {
  page: number;
  pageSize: number;
  skip: number;
};

export function readPagination(url: string, options: { defaultPageSize?: number; maxPageSize?: number } = {}): PaginationInput {
  const params = new URL(url).searchParams;
  const parsedPage = Number(params.get("page") || 1);
  const parsedPageSize = Number(params.get("pageSize") || options.defaultPageSize || 20);
  // Keep offset pagination inside Prisma/MySQL's practical numeric range even
  // when a caller supplies an exponential or unsafe JavaScript number.
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 100_000) : 1;
  const maxPageSize = options.maxPageSize || 50;
  const pageSize = Number.isSafeInteger(parsedPageSize) && parsedPageSize > 0
    ? Math.min(parsedPageSize, maxPageSize)
    : Math.min(options.defaultPageSize || 20, maxPageSize);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}
