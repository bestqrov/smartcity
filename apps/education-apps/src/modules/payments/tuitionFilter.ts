// Transport fees are stored as Payment rows too (transportSubscriptionId set). Anything that
// treats a student's payments as tuition — balances, receipts, portals — must use this filter.
export const tuitionPayments = { where: { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] } };
