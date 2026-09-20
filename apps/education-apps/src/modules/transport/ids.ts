// Prisma treats `where: { id: undefined }` as "no filter", so a missing id would match an
// arbitrary record in the branch. Validate ids before they reach a query.
export function assertId(label: string, value: unknown): asserts value is string {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
}
